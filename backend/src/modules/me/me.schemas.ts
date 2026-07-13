import { z } from "zod";

const cpfSchema = z.string().transform((value) => value.replace(/\D/g, "")).refine((value) => value.length === 11, "CPF invalido");
const phoneSchema = z.string().transform((value) => value.replace(/\D/g, "")).refine((value) => value.length >= 10 && value.length <= 13, "Telefone invalido");

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(3).max(150),
  cpf: cpfSchema,
  phone: phoneSchema,
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional()
});

export const cartItemSchema = z.object({
  eventId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1)
});

export const cartSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(20)
});

export const orderParamSchema = z.object({ id: z.coerce.number().int().positive() });
