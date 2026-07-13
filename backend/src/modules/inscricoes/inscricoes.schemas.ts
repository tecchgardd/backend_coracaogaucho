import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const inscricaoQuerySchema = paginationQuerySchema.extend({
  eventoId: z.coerce.number().int().positive().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  status: z.enum(["PENDENTE", "CONFIRMADA", "CANCELADA"]).optional()
});

export const inscricaoCreateSchema = z.object({
  eventoId: z.coerce.number().int().positive().optional(),
  cursoId: z.coerce.number().int().positive().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  nome: z.string().optional(),
  cpf: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  cep: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  complemento: z.string().optional(),
  status: z.enum(["PENDENTE", "CONFIRMADA", "CONFIRMADO", "CANCELADA", "CANCELADO", "ATIVO"]).default("PENDENTE"),
  nomePar: z.string().optional(),
  observacao: z.string().optional(),
  padrinho: z.string().optional(),
  madrinha: z.string().optional(),
  jaFoiAluno: z.boolean().optional(),
  cursoCidadeAnterior: z.string().optional(),
  semPar: z.boolean().optional(),
  inscricaoMultipla: z.boolean().optional(),
  quantidadeAdicionais: z.coerce.number().int().nonnegative().optional(),
  adicionais: z.array(z.unknown()).optional(),
  quantidadeParticipantes: z.coerce.number().int().positive().optional(),
  padrinhos: z.array(z.object({
    nome: z.string().optional()
  })).optional()
});

export const inscricaoUpdateSchema = inscricaoCreateSchema.partial();

export const inscricaoStatusSchema = z.object({
  status: z.enum(["PENDENTE", "CONFIRMADA", "CONFIRMADO", "CANCELADA", "CANCELADO", "ATIVO"])
});
