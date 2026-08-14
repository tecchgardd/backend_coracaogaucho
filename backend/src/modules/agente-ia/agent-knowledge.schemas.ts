import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const knowledgeStatusEnum = z.enum(["ATIVO", "INATIVO"]);
export const knowledgeTypeEnum = z.enum(["FAQ", "POLICY", "EVENT", "COURSE", "PAYMENT", "TICKET", "OTHER"]);

export const knowledgeQuerySchema = paginationQuerySchema.extend({
  status: knowledgeStatusEnum.optional(),
  type: knowledgeTypeEnum.optional()
});

export const knowledgeCreateSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(1),
  type: knowledgeTypeEnum,
  source: z.string().optional(),
  status: knowledgeStatusEnum.default("ATIVO")
});

export const knowledgeUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  content: z.string().min(1).optional(),
  type: knowledgeTypeEnum.optional(),
  source: z.string().optional(),
  status: knowledgeStatusEnum.optional()
});

export const knowledgeStatusSchema = z.object({
  status: knowledgeStatusEnum
});
