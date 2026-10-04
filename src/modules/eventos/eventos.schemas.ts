import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const eventoQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["ATIVO", "INATIVO", "CANCELADO", "ENCERRADO"]).optional(),
  tipo: z.enum(["BAILE", "CURSO", "EVENTO"]).optional()
});

const eventoBaseSchema = z.object({
  nome: z.string().min(2).optional(),
  titulo: z.string().min(2).optional(),
  tipo: z.enum(["BAILE", "CURSO", "EVENTO"]).default("EVENTO"),
  local: z.string().min(2),
  cidade: z.string().optional(),
  data: z.coerce.date().optional(),
  dataInicio: z.coerce.date().optional(),
  status: z.enum(["ATIVO", "INATIVO", "CANCELADO", "ENCERRADO"]).default("ATIVO"),
  capacidade: z.number().int().positive().optional(),
  preco: z.number().nonnegative(),
  qrcode: z.string().optional(),
  banner: z.string().trim().url().refine((url) => url.startsWith("https://"), "A URL do banner deve usar HTTPS").nullable().optional(),
  // Alias legado mantido apenas na entrada. A API e o banco usam `banner`.
  imagemUrl: z.string().trim().url().refine((url) => url.startsWith("https://"), "A URL da imagem deve usar HTTPS").nullable().optional(),
  observacao: z.string().optional(),
  descricao: z.string().optional(),
  atracao: z.string().optional(),
  dataLimiteInscricao: z.coerce.date().optional(),
  precoAntecipado: z.number().nonnegative().optional(),
  dataLimiteAntecipado: z.coerce.date().optional()
});

export const eventoCreateSchema = eventoBaseSchema.refine((data) => data.nome || data.titulo, {
  message: "Informe nome ou titulo",
  path: ["nome"]
}).refine((data) => data.data || data.dataInicio, {
  message: "Informe data ou dataInicio",
  path: ["data"]
});

export const eventoUpdateSchema = eventoBaseSchema.extend({
  tipo: z.enum(["BAILE", "CURSO", "EVENTO"]).optional(),
  status: z.enum(["ATIVO", "INATIVO", "CANCELADO", "ENCERRADO"]).optional()
}).partial();
