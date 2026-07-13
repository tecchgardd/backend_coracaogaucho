import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const empresaQuerySchema = paginationQuerySchema.extend({
  ativo: z.coerce.boolean().optional(),
  publicado: z.coerce.boolean().optional()
});

export const empresaBodySchema = z.object({
  nome: z.string().trim().min(2).max(120),
  ativo: z.coerce.boolean().default(true),
  publicado: z.coerce.boolean().default(true),
  ordem: z.coerce.number().int().min(0).default(0)
});

export const empresaUpdateSchema = empresaBodySchema.partial();
