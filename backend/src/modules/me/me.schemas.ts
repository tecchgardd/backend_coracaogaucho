import { z } from "zod";

const digits = (value: string) => value.replace(/\D/g, "");
const cpfSchema = z.string().transform(digits).refine((value) => value.length === 11, "CPF invalido");
const phoneSchema = z.string().transform(digits).refine((value) => value.length >= 10 && value.length <= 13, "Telefone invalido");
const cepSchema = z.string().transform(digits).refine((value) => value.length === 8, "CEP invalido");

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(3).max(150),
  cpf: cpfSchema,
  phone: phoneSchema,
  birthDate: z.coerce.date().refine((value) => value < new Date(), "Data de nascimento invalida"),
  gender: z.enum(["MASCULINO", "FEMININO", "OUTRO", "NAO_INFORMADO"]),
  cep: cepSchema,
  address: z.string().trim().min(3).max(200),
  number: z.string().trim().min(1).max(30),
  complement: z.string().trim().max(120).optional().default(""),
  neighborhood: z.string().trim().min(2).max(120),
  state: z.string().trim().length(2),
  city: z.string().trim().min(2).max(120)
});

export const cartItemSchema = z.object({
  eventId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1)
});

export const cartSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(20)
});

export const orderParamSchema = z.object({ id: z.coerce.number().int().positive() });
