import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const promptStatusEnum = z.enum(["ATIVO", "INATIVO"]);
export const promptScopeEnum = z.enum(["GENERAL", "VENDAS", "INSCRICAO"]);

export const promptQuerySchema = paginationQuerySchema.extend({
  status: promptStatusEnum.optional(),
  scope: promptScopeEnum.optional()
});

export const promptCreateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  content: z.string().min(1),
  tone: z.string().optional(),
  scope: promptScopeEnum.default("GENERAL"),
  status: promptStatusEnum.default("ATIVO")
});

export const promptUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  content: z.string().min(1).optional(),
  tone: z.string().optional(),
  scope: promptScopeEnum.optional(),
  status: promptStatusEnum.optional()
});

export const promptStatusSchema = z.object({
  status: promptStatusEnum
});
