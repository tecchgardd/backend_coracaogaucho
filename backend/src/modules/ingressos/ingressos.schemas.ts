import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const ingressoQuerySchema = paginationQuerySchema.extend({
  eventoId: z.coerce.number().int().positive().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  cpf: z.string().optional(),
  cidade: z.string().optional(),
  professor: z.string().optional(),
  search: z.string().optional()
});

export const loteIngressoQuerySchema = ingressoQuerySchema;

export const gerarLoteSchema = z.object({
  cpf: z.string().min(11),
  valorUnitario: z.coerce.number().nonnegative().default(0),
  dataLimite: z.coerce.date().optional(),
  observacoes: z.string().optional()
});

export const atualizarIngressoSchema = z.object({
  status: z.enum(["PENDENTE", "PAGO", "CANCELADO", "EXPIRADO", "CORTESIA", "UTILIZADO"]).optional(),
  tipo: z.enum(["NORMAL", "CORTESIA"]).optional(),
  valor: z.coerce.number().nonnegative().optional(),
  dueDate: z.coerce.date().optional(),
  motivo: z.string().optional(),
  responsavel: z.string().optional(),
  notes: z.string().optional()
});

export const atualizarLoteSchema = z.object({
  paymentStatus: z.enum(["PENDENTE", "PAGO", "CANCELADO", "EXPIRADO"]).optional(),
  dueDate: z.coerce.date().optional(),
  reason: z.string().optional(),
  notes: z.string().optional()
});

export const registrarPagamentoSchema = z.object({
  paymentStatus: z.enum(["PENDENTE", "PAGO", "CANCELADO", "EXPIRADO"]).default("PAGO"),
  reason: z.string().optional(),
  notes: z.string().optional()
});
