import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const pagamentoQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["PENDENTE", "PAGO", "FALHOU", "ESTORNADO"]).optional(),
  customerId: z.coerce.number().int().positive().optional()
});

export const criarCobrancaSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  eventoId: z.coerce.number().int().positive(),
  inscricaoId: z.coerce.number().int().positive().optional(),
  valor: z.number().positive(),
  descricao: z.string().optional(),
  itens: z.array(z.record(z.string(), z.unknown())).default([]),
  metodos: z.array(z.enum(["PIX", "CARD"])).default(["PIX", "CARD"]),
  metadata: z.record(z.string(), z.unknown()).default({})
});
