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

export const origemFinanceiraLoteSchema = z.enum([
  "SEM_COBRANCA",
  "CORTESIA",
  "NOVA_VENDA",
  "VENDA_EXISTENTE",
  "PAGAMENTO_EXTERNO"
]);

export const gerarLoteSchema = z.object({
  customerId: z.coerce.number().int().positive().optional(),
  cpf: z.string().min(11).optional(),
  eventoId: z.coerce.number().int().positive(),
  quantidade: z.coerce.number().int().positive().max(1000),
  origemFinanceira: origemFinanceiraLoteSchema,
  pedidoId: z.coerce.number().int().positive().optional(),
  valorUnitario: z.coerce.number().nonnegative().default(0),
  dataLimite: z.coerce.date().optional(),
  observacoes: z.string().trim().max(1000).optional(),
  formaPagamentoExterno: z.enum(["PIX_EXTERNO", "DINHEIRO", "CARTAO_EXTERNO"]).optional()
}).superRefine((data, ctx) => {
  if (!data.customerId && !data.cpf) {
    ctx.addIssue({ code: "custom", path: ["customerId"], message: "Aluno é obrigatório" });
  }
  if (data.origemFinanceira === "VENDA_EXISTENTE" && !data.pedidoId) {
    ctx.addIssue({ code: "custom", path: ["pedidoId"], message: "Venda existente é obrigatória" });
  }
  if (data.origemFinanceira === "PAGAMENTO_EXTERNO" && !data.formaPagamentoExterno) {
    ctx.addIssue({ code: "custom", path: ["formaPagamentoExterno"], message: "Informe a forma do pagamento externo" });
  }
  if ((data.origemFinanceira === "SEM_COBRANCA" || data.origemFinanceira === "CORTESIA") && !data.observacoes) {
    ctx.addIssue({ code: "custom", path: ["observacoes"], message: "Motivo ou observação administrativa é obrigatório" });
  }
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
