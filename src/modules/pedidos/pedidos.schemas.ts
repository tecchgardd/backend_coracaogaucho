import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

const typeSchema = z.enum(["STORE", "EVENT", "LOJA", "EVENTO"]).transform((value) => {
  if (value === "LOJA") return "STORE";
  if (value === "EVENTO") return "EVENT";
  return value;
});

const itemSchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  ticketLotId: z.coerce.number().int().positive().optional(),
  description: z.string().optional(),
  nome: z.string().optional(),
  lote: z.string().optional(),
  quantity: z.coerce.number().int().positive().optional(),
  quantidade: z.coerce.number().int().positive().optional(),
  qtd: z.coerce.number().int().positive().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  valor: z.coerce.number().nonnegative().optional(),
  total: z.coerce.number().nonnegative().optional()
});

export const pedidoQuerySchema = paginationQuerySchema.extend({
  type: typeSchema.optional(),
  tipo: typeSchema.optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  cpf: z.string().optional(),
  cliente: z.string().optional(),
  eventId: z.coerce.number().int().positive().optional(),
  eventoId: z.coerce.number().int().positive().optional(),
  data: z.coerce.date().optional()
});

export const pedidoCreateSchema = z.object({
  code: z.string().optional(),
  type: typeSchema.optional(),
  tipo: typeSchema.optional(),
  customerId: z.coerce.number().int().positive().optional(),
  eventId: z.coerce.number().int().positive().optional(),
  eventoId: z.coerce.number().int().positive().optional(),
  cliente: z.string().optional(),
  cpf: z.string().optional(),
  telefone: z.string().optional(),
  status: z.string().default("PENDENTE"),
  paymentStatus: z.string().optional(),
  statusPagamento: z.string().optional(),
  paymentMethod: z.string().optional(),
  formaPagamento: z.string().optional(),
  total: z.coerce.number().nonnegative().optional(),
  isCourtesy: z.boolean().optional(),
  cortesia: z.boolean().optional(),
  courtesyReason: z.string().optional(),
  motivoCortesia: z.string().optional(),
  courtesyResponsible: z.string().optional(),
  responsavelCortesia: z.string().optional(),
  notes: z.string().optional(),
  observacoes: z.string().optional(),
  itens: z.array(itemSchema).optional(),
  items: z.array(itemSchema).optional()
});

export const pedidoUpdateSchema = pedidoCreateSchema.partial();

export const pedidoCancelSchema = z.object({
  notes: z.string().optional()
}).optional();
