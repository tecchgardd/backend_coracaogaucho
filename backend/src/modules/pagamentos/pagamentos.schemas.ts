import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";
import { isValidCpf } from "../customer-auth/customer-auth.schemas.js";

export const pagamentoQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["PENDENTE", "PROCESSANDO", "PAGO", "FALHOU", "CANCELADO", "EXPIRADO", "ESTORNADO", "PARCIALMENTE_ESTORNADO", "CONTESTADO", "CONTESTACAO_PERDIDA"]).optional(),
  customerId: z.coerce.number().int().positive().optional(),
  cpf: z.string().optional(),
  nome: z.string().optional(),
  codigo: z.string().optional(),
  item: z.string().optional(),
  origem: z.enum(["SITE", "WHATSAPP", "PAINEL_ADMIN"]).optional(),
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional()
});

const cartItemSchema = z.object({
  eventId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(10)
});

export const checkoutSchema = z.object({
  orderId: z.coerce.number().int().positive().optional(),
  eventId: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().int().min(1).max(10).optional(),
  items: z.array(cartItemSchema).min(1).max(20).optional(),
  origin: z.literal("SITE").default("SITE")
}).superRefine((data, ctx) => {
  if (!data.orderId && !data.items?.length && !data.eventId) {
    ctx.addIssue({ code: "custom", message: "Informe orderId, eventId ou items" });
  }
  if (data.eventId && !data.quantity) {
    ctx.addIssue({ code: "custom", path: ["quantity"], message: "quantity e obrigatorio com eventId" });
  }
});

export const orderParamSchema = z.object({ orderId: z.coerce.number().int().positive() });

export const cancelPaymentSchema = z.object({
  reason: z.string().trim().min(3).max(300).default("Cancelamento administrativo")
});

export const manualSettlementSchema = z.object({
  method: z.enum(["PIX_EXTERNO", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO"]),
  amount: z.coerce.number().int().positive().optional(),
  paidAt: z.coerce.date().default(() => new Date()),
  reason: z.string().trim().min(3).max(500)
});

export const refundPaymentSchema = z.object({
  amount: z.coerce.number().int().positive().optional(),
  reason: z.string().trim().min(3).max(300),
  stripeReason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).default("requested_by_customer")
});

export const integrationCustomerSchema = z.object({
  name: z.string().trim().min(5).max(150).refine((value) => value.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  email: z.string().trim().email().max(255),
  cpf: z.string().transform((value) => value.replace(/\D/g, "")).refine(isValidCpf, "CPF invalido"),
  phone: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().min(10).max(13))
});

export const whatsappCheckoutSchema = z.object({
  eventId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(10),
  customer: integrationCustomerSchema,
  origin: z.literal("WHATSAPP").default("WHATSAPP")
});
