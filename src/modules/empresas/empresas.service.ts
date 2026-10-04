import { Readable } from "node:stream";
import { cloudinary } from "../../lib/cloudinary.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";

const FOLDER = "coracao-gaucho/empresas";
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Query = { page: number; limit: number; search?: string; ativo?: boolean; publicado?: boolean };
type Input = { nome?: string; ativo?: boolean; publicado?: boolean; ordem?: number };

function validateImage(file?: Express.Multer.File, required = false) {
  if (!file && required) throw new AppError("A logo ou banner e obrigatoria", 400);
  if (file && !MIME_TYPES.has(file.mimetype)) throw new AppError("Use uma imagem PNG, JPG, JPEG ou WEBP", 400);
}

function uploadImage(file: Express.Multer.File) {
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: FOLDER, resource_type: "image" }, (error, result) => {
      if (error) return reject(error);
      if (!result) return reject(new Error("Cloudinary nao retornou resultado"));
      resolve({ secure_url: result.secure_url, public_id: result.public_id });
    });
    Readable.from(file.buffer).pipe(stream);
  });
}

async function destroyImage(publicId: string) {
  try { await cloudinary.uploader.destroy(publicId, { resource_type: "image" }); } catch { /* The database remains consistent and stale assets can be reconciled later. */ }
}

export const empresasService = {
  async listar(query: Query) {
    const where = {
      ...(query.search ? { nome: { contains: query.search, mode: "insensitive" as const } } : {}),
      ...(query.ativo === undefined ? {} : { ativo: query.ativo }),
      ...(query.publicado === undefined ? {} : { publicado: query.publicado })
    };
    const [data, total] = await Promise.all([
      prisma.empresa.findMany({ where, ...getPagination(query), orderBy: [{ ordem: "asc" }, { createdAt: "desc" }] }),
      prisma.empresa.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },
  async buscar(id: string) {
    const empresa = await prisma.empresa.findUnique({ where: { id } });
    if (!empresa) throw new AppError("Empresa nao encontrada", 404);
    return empresa;
  },
  async criar(input: Input, file?: Express.Multer.File) {
    validateImage(file, true);
    const uploaded = await uploadImage(file!);
    try {
      return await prisma.empresa.create({ data: { nome: input.nome!, ativo: input.ativo ?? true, publicado: input.publicado ?? true, ordem: input.ordem ?? 0, imagemUrl: uploaded.secure_url, imagemPublicId: uploaded.public_id } });
    } catch (error) { await destroyImage(uploaded.public_id); throw error; }
  },
  async atualizar(id: string, input: Input, file?: Express.Multer.File) {
    validateImage(file);
    const current = await this.buscar(id);
    const uploaded = file ? await uploadImage(file) : null;
    try {
      const updated = await prisma.empresa.update({ where: { id }, data: { ...input, ...(uploaded ? { imagemUrl: uploaded.secure_url, imagemPublicId: uploaded.public_id } : {}) } });
      if (uploaded) await destroyImage(current.imagemPublicId);
      return updated;
    } catch (error) { if (uploaded) await destroyImage(uploaded.public_id); throw error; }
  },
  async remover(id: string) {
    const current = await this.buscar(id);
    await prisma.empresa.delete({ where: { id } });
    await destroyImage(current.imagemPublicId);
    return { success: true };
  },
  async listarPublicas() {
    const data = await prisma.empresa.findMany({ where: { ativo: true, publicado: true }, select: { id: true, nome: true, imagemUrl: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }, { createdAt: "asc" }] });
    return { data, total: data.length };
  }
};
