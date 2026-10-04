import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const ruleStatusEnum = z.enum(["ATIVO", "INATIVO"]);
export const ruleCategoryEnum = z.enum(["GERAL", "VENDAS", "INSCRICAO", "ATENDIMENTO", "PAGAMENTO"]);

export const ruleQuerySchema = paginationQuerySchema.extend({
  status: ruleStatusEnum.optional()
});

export const ruleCreateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: ruleCategoryEnum.default("GERAL"),
  content: z.string().min(1),
  priority: z.number().int().min(0).default(5),
  status: ruleStatusEnum.default("ATIVO")
});

export const ruleUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  category: ruleCategoryEnum.optional(),
  content: z.string().min(1).optional(),
  priority: z.number().int().min(0).optional(),
  status: ruleStatusEnum.optional()
});

export const ruleStatusSchema = z.object({
  status: ruleStatusEnum
});
