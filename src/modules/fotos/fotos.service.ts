import { Readable } from "node:stream";
import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";

const ACCEPTED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ROOT_FOLDER = "coracao-gaucho/fotos";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function sanitizeFolder(value?: string) {
  if (!value) return ROOT_FOLDER;
  const cleaned = value
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase())
    .filter(Boolean)
    .join("/");
  return cleaned ? `${ROOT_FOLDER}/${cleaned}` : ROOT_FOLDER;
}

function inferFolder(file: Express.Multer.File, fallbackFolder?: string) {
  const relative = file.originalname.replace(/\\/g, "/");
  const parts = relative.split("/");
  if (parts.length > 1) return sanitizeFolder(parts.slice(0, -1).join("/"));
  return sanitizeFolder(fallbackFolder);
}

function uploadToCloudinary(file: Express.Multer.File, folder: string) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image"
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary nao retornou resultado"));
        resolve(result);
      }
    );
    Readable.from(file.buffer).pipe(upload);
  });
}

export const fotosService = {
  async upload(files: Express.Multer.File[], folder?: string, uploadedById?: string) {
    if (!files.length) throw new AppError("Nenhuma foto enviada", 400);
    if (files.length > 1000) throw new AppError("Limite de 1000 fotos por lote", 400);

    const fotos = [];
    const erros: Array<{ arquivo: string; erro: string }> = [];

    for (const file of files) {
      try {
        if (!ACCEPTED_MIMES.has(file.mimetype)) throw new Error("Formato nao permitido");
        if (file.size > MAX_FILE_SIZE) throw new Error("Arquivo maior que 5MB");
        const targetFolder = inferFolder(file, folder);
        const result = await uploadToCloudinary(file, targetFolder);
        const saved = await prisma.foto.create({
          data: {
            originalName: file.originalname,
            publicId: result.public_id,
            url: result.url,
            secureUrl: result.secure_url,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
            folder: targetFolder,
            uploadedById
          }
        });
        fotos.push(saved);
      } catch (error) {
        erros.push({ arquivo: file.originalname, erro: (error as { message?: string })?.message ?? "Falha ao enviar" });
      }
    }

    return {
      totalRecebidos: files.length,
      totalEnviados: fotos.length,
      totalFalhas: erros.length,
      fotos,
      erros
    };
  }
};
