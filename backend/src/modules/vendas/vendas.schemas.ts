import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const vendaTipoSchema = z.enum(["EVENTO", "BAILE", "CURSO"]);
export const vendaStatusSchema = z.enum(["PENDENTE", "PAGO", "CANCELADO", "CORTESIA"]);
export const formaPagamentoSchema = z.enum(["LINK_PAGAMENTO", "PIX_EXTERNO", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO", "CORTESIA"]).optional();

export const vendaQuerySchema = paginationQuerySchema.extend({
  cpf: z.string().optional(),
  nome: z.string().optional(),
  codigo: z.string().optional(),
  tipo: vendaTipoSchema.optional(),
  status: vendaStatusSchema.optional()
});

export const vendaCreateSchema = z.object({
  cpf: z.string().min(3),
  tipo: vendaTipoSchema,
  eventoId: z.coerce.number().int().positive().optional(),
  cursoId: z.coerce.number().int().positive().optional(),
  inscricaoId: z.coerce.number().int().positive().optional(),
  quantidade: z.coerce.number().int().positive(),
  valorUnitario: z.coerce.number().nonnegative().optional(),
  desconto: z.coerce.number().nonnegative().default(0),
  formaPagamento: formaPagamentoSchema,
  observacao: z.string().optional()
}).superRefine((data, ctx) => {
  if ((data.tipo === "EVENTO" || data.tipo === "BAILE") && !data.eventoId) {
    ctx.addIssue({ code: "custom", path: ["eventoId"], message: "eventoId é obrigatório para EVENTO/BAILE" });
  }
  if (data.tipo === "CURSO" && !data.cursoId && !data.inscricaoId) {
    ctx.addIssue({ code: "custom", path: ["cursoId"], message: "cursoId ou inscricaoId é obrigatório para CURSO" });
  }
});

export const vendaUpdateSchema = z.object({
  status: vendaStatusSchema.optional(),
  formaPagamento: formaPagamentoSchema,
  observacao: z.string().optional(),
  quantidade: z.coerce.number().int().positive().optional(),
  desconto: z.coerce.number().nonnegative().optional()
});
