import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const scannerCodigoSchema = z.object({
  codigo: z.string().min(4)
});

export const scannerHistoricoQuerySchema = paginationQuerySchema.extend({
  eventoId: z.coerce.number().int().positive().optional()
});
