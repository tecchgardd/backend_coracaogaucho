import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { cloudinary } from "../../lib/cloudinary.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import type { publicAlbumPhotosQuerySchema, publicAlbumQuerySchema, publicEventQuerySchema } from "./public.schemas.js";

const PHOTO_ROOT = "coracao-gaucho/fotos";
const ALBUM_CACHE_MS = 5 * 60 * 1000;

type CloudinaryResource = {
  public_id: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
  created_at?: string;
  asset_folder?: string;
  filename?: string;
};

let albumCache: { expiresAt: number; folders: string[] } | null = null;

export async function collectCursorPages<T extends { public_id: string }>(
  loadPage: (cursor?: string) => Promise<{ resources: T[]; next_cursor?: string }>
) {
  const resources = new Map<string, T>();
  let cursor: string | undefined;
  do {
    const page = await loadPage(cursor);
    for (const resource of page.resources) resources.set(resource.public_id, resource);
    cursor = page.next_cursor;
  } while (cursor);
  return [...resources.values()];
}

export function calculateEventUnitPrice(event: { preco: number; precoAntecipado: number | null; dataLimiteAntecipado: Date | null }, now = new Date()) {
  return event.precoAntecipado != null && event.dataLimiteAntecipado && event.dataLimiteAntecipado > now
    ? event.precoAntecipado
    : event.preco;
}

function albumSlug(folder: string) {
  return Buffer.from(folder, "utf8").toString("base64url");
}

function folderFromSlug(slug: string) {
  try {
    const folder = Buffer.from(slug, "base64url").toString("utf8");
    if (!folder.startsWith(`${PHOTO_ROOT}/`) || folder.includes("..")) throw new Error();
    return folder;
  } catch {
    throw new AppError("Album nao encontrado", 404);
  }
}

function albumName(folder: string) {
  return folder.split("/").at(-1)?.replace(/[-_]+/g, " ").replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) ?? "Album";
}

function thumbnail(publicId: string, width = 600) {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [{ width, height: width, crop: "fill", gravity: "auto", fetch_format: "auto", quality: "auto" }]
  });
}

function mapPhoto(resource: CloudinaryResource, index: number) {
  return {
    publicId: resource.public_id,
    secureUrl: resource.secure_url,
    thumbnailUrl: thumbnail(resource.public_id),
    width: resource.width ?? null,
    height: resource.height ?? null,
    format: resource.format ?? null,
    createdAt: resource.created_at ?? null,
    fileName: resource.filename ?? resource.public_id.split("/").at(-1) ?? resource.public_id,
    order: index
  };
}

async function listCloudinaryFolders() {
  if (albumCache && albumCache.expiresAt > Date.now()) return albumCache.folders;
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return [];

  const found = new Set<string>();
  const queue = [PHOTO_ROOT];
  while (queue.length) {
    const parent = queue.shift()!;
    let cursor: string | undefined;
    do {
      const result = await cloudinary.api.sub_folders(parent, { max_results: 500, next_cursor: cursor }) as {
        folders?: Array<{ path?: string; name?: string }>;
        next_cursor?: string;
      };
      for (const item of result.folders ?? []) {
        const path = item.path ?? `${parent}/${item.name}`;
        if (!path.startsWith(`${PHOTO_ROOT}/`)) continue;
        found.add(path);
        queue.push(path);
      }
      cursor = result.next_cursor;
    } while (cursor);
  }
  const folders = [...found].sort();
  albumCache = { folders, expiresAt: Date.now() + ALBUM_CACHE_MS };
  return folders;
}

async function searchFolder(folder: string, limit: number, cursor?: string) {
  let search = cloudinary.search
    .expression(`asset_folder="${folder.replace(/"/g, "\\\"")}" AND resource_type:image`)
    .sort_by("public_id", "asc")
    .max_results(limit);
  if (cursor) search = search.next_cursor(cursor);
  return search.execute() as Promise<{ resources?: CloudinaryResource[]; next_cursor?: string; total_count?: number }>;
}

async function prefixFolderPage(folder: string, limit: number, cursor?: string) {
  const result = await cloudinary.api.resources({
    type: "upload",
    resource_type: "image",
    prefix: `${folder}/`,
    max_results: limit,
    next_cursor: cursor
  }) as { resources?: CloudinaryResource[]; next_cursor?: string };
  return {
    resources: (result.resources ?? []).filter((item) => item.public_id.slice(0, item.public_id.lastIndexOf("/")) === folder),
    next_cursor: result.next_cursor
  };
}

async function fixedFolderSummary(folder: string) {
  const resources = await collectCursorPages<CloudinaryResource>((cursor) => prefixFolderPage(folder, 500, cursor));
  return { count: resources.length, cover: resources[0] };
}

async function folderSummary(folder: string) {
  try {
    const cloud = await searchFolder(folder, 1);
    const cover = cloud.resources?.[0];
    if ((cloud.total_count ?? 0) > 0 || cover) return { folder, count: cloud.total_count ?? 1, cover: cover ? mapPhoto(cover, 0) : null };
  } catch { /* Fixed-folder Cloudinary accounts are covered by the database fallback. */ }
  try {
    const fixed = await fixedFolderSummary(folder);
    if (fixed.count > 0) return { folder, count: fixed.count, cover: fixed.cover ? mapPhoto(fixed.cover, 0) : null };
  } catch { /* Database remains the final source of registered uploads. */ }
  const [count, cover] = await Promise.all([
    prisma.foto.count({ where: { folder } }),
    prisma.foto.findFirst({ where: { folder }, orderBy: [{ createdAt: "asc" }, { publicId: "asc" }] })
  ]);
  return {
    folder,
    count,
    cover: cover ? {
      publicId: cover.publicId,
      secureUrl: cover.secureUrl,
      thumbnailUrl: thumbnail(cover.publicId),
      width: cover.width,
      height: cover.height,
      format: cover.format,
      createdAt: cover.createdAt,
      fileName: cover.originalName,
      order: 0
    } : null
  };
}

export async function soldQuantity(eventId: number) {
  const rows = await prisma.pedidoItem.aggregate({
    where: {
      eventId,
      order: {
        status: { notIn: ["CANCELADO", "EXPIRADO"] },
        OR: [
          { paymentStatus: "PAGO" },
          { paymentStatus: "PENDENTE", expiresAt: null },
          { paymentStatus: "PENDENTE", expiresAt: { gt: new Date() } }
        ]
      }
    },
    _sum: { quantity: true }
  });
  return rows._sum.quantity ?? 0;
}

async function mapEvent(event: Prisma.EventoGetPayload<object>) {
  const sold = await soldQuantity(event.id);
  const available = event.capacidade == null ? null : Math.max(0, event.capacidade - sold);
  const price = calculateEventUnitPrice(event);
  return {
    id: event.id,
    slug: String(event.id),
    name: event.nome,
    type: event.tipo,
    venue: event.local,
    city: event.cidade,
    startsAt: event.data,
    salesEndAt: event.dataLimiteInscricao,
    price,
    free: price === 0,
    capacity: event.capacidade,
    available,
    soldOut: available === 0,
    status: event.status,
    banner: event.banner,
    description: event.observacao,
    attraction: event.atracao
  };
}

export const publicService = {
  async listEvents(query: z.infer<typeof publicEventQuerySchema>) {
    const where: Prisma.EventoWhereInput = {
      status: "ATIVO",
      tipo: query.type,
      cidade: query.city ? { equals: query.city, mode: "insensitive" } : undefined,
      data: query.upcoming ? { gte: new Date() } : undefined
    };
    const skip = (query.page - 1) * query.limit;
    const [events, total] = await Promise.all([
      prisma.evento.findMany({ where, skip, take: query.limit, orderBy: [{ data: "asc" }, { id: "asc" }] }),
      prisma.evento.count({ where })
    ]);
    return { data: await Promise.all(events.map(mapEvent)), total, page: query.page, limit: query.limit };
  },

  async getEvent(id: number) {
    const event = await prisma.evento.findFirst({ where: { id, status: "ATIVO" } });
    if (!event) throw new AppError("Evento nao encontrado", 404);
    return mapEvent(event);
  },

  async listAlbums(query: z.infer<typeof publicAlbumQuerySchema>) {
    const dbFolders = await prisma.foto.findMany({
      where: { folder: { startsWith: `${PHOTO_ROOT}/` } },
      distinct: ["folder"],
      select: { folder: true }
    });
    let cloudFolders: string[] = [];
    try { cloudFolders = await listCloudinaryFolders(); } catch { cloudFolders = []; }
    const folders = [...new Set([...dbFolders.map((item) => item.folder).filter((folder): folder is string => Boolean(folder)), ...cloudFolders])].sort();
    const summaries = (await Promise.all(folders.map(folderSummary))).filter((item) => item.count > 0);
    const start = (query.page - 1) * query.limit;
    const selected = summaries.slice(start, start + query.limit);
    return {
      data: selected.map((item) => ({
        id: albumSlug(item.folder),
        slug: albumSlug(item.folder),
        name: albumName(item.folder),
        title: albumName(item.folder),
        folder: item.folder,
        coverUrl: item.cover?.thumbnailUrl ?? null,
        photoCount: item.count,
        city: null,
        date: null,
        description: null,
        published: true
      })),
      total: summaries.length,
      page: query.page,
      limit: query.limit
    };
  },

  async getAlbum(slug: string) {
    const folder = folderFromSlug(slug);
    const summary = await folderSummary(folder);
    if (!summary.count) throw new AppError("Album nao encontrado", 404);
    return {
      id: slug,
      slug,
      name: albumName(folder),
      title: albumName(folder),
      folder,
      coverUrl: summary.cover?.thumbnailUrl ?? null,
      photoCount: summary.count
    };
  },

  async getAlbumPhotos(slug: string, query: z.infer<typeof publicAlbumPhotosQuerySchema>) {
    const folder = folderFromSlug(slug);
    try {
      const result = await searchFolder(folder, query.limit, query.cursor);
      const unique = [...new Map((result.resources ?? []).map((item) => [item.public_id, item])).values()];
      if (unique.length === 0 && (result.total_count ?? 0) === 0) throw new Error("Use database folder fallback");
      return {
        data: unique.map(mapPhoto),
        nextCursor: result.next_cursor ?? null,
        total: result.total_count ?? unique.length
      };
    } catch {
      try {
        const result = await prefixFolderPage(folder, query.limit, query.cursor);
        if (result.resources.length || result.next_cursor) {
          return {
            data: result.resources.map(mapPhoto),
            nextCursor: result.next_cursor ?? null,
            total: (await fixedFolderSummary(folder)).count
          };
        }
      } catch { /* Fall through to database pagination. */ }
      const offset = query.cursor ? Number(Buffer.from(query.cursor, "base64url").toString("utf8")) || 0 : 0;
      const [photos, total] = await Promise.all([
        prisma.foto.findMany({ where: { folder }, orderBy: [{ createdAt: "asc" }, { publicId: "asc" }], skip: offset, take: query.limit }),
        prisma.foto.count({ where: { folder } })
      ]);
      const nextOffset = offset + photos.length;
      return {
        data: photos.map((photo, index) => ({
          publicId: photo.publicId,
          secureUrl: photo.secureUrl,
          thumbnailUrl: thumbnail(photo.publicId),
          width: photo.width,
          height: photo.height,
          format: photo.format,
          createdAt: photo.createdAt,
          fileName: photo.originalName,
          order: offset + index
        })),
        nextCursor: nextOffset < total ? Buffer.from(String(nextOffset)).toString("base64url") : null,
        total
      };
    }
  },

  async getOrder(code: string) {
    const order = await prisma.pedido.findUnique({ where: { code }, include: { evento: true, items: true } });
    if (!order || !code.startsWith("WEB-")) throw new AppError("Pedido nao encontrado", 404);
    return {
      code: order.code,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      event: order.evento ? { id: order.evento.id, name: order.evento.nome, startsAt: order.evento.data } : null,
      items: order.items.map((item) => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, total: item.total }))
    };
  }
};
