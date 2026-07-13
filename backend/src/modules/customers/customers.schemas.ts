import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const customerQuerySchema = paginationQuerySchema.extend({
  cpf: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional()
});

export const customerCreateSchema = z.object({
  nome: z.string().min(2),
  cpf: z.string().min(11),
  telefone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  endereco: z.string().optional(),
  cep: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  complemento: z.string().optional(),
  status: z.string().optional()
});

export const customerUpdateSchema = customerCreateSchema.partial();
