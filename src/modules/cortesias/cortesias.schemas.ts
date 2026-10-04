import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const cortesiaQuerySchema = paginationQuerySchema.extend({
  eventoId: z.coerce.number().int().positive().optional()
});

export const cortesiaCreateSchema = z.object({
  nome: z.string().min(2),
  cpf: z.string().optional(),
  telefone: z.string().optional(),
  eventoId: z.coerce.number().int().positive().optional()
});
