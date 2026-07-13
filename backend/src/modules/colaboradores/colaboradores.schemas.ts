import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const colaboradorQuerySchema = paginationQuerySchema.extend({
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  status: z.enum(["ATIVO", "INATIVO"]).optional()
});

export const colaboradorCreateSchema = z.object({
  nome: z.string().min(2),
  cpf: z.string().min(11),
  email: z.string().email(),
  role: z.enum(["ADMIN", "STAFF"]),
  status: z.enum(["ATIVO", "INATIVO"]).default("ATIVO"),
  password: z.string().min(8).optional(),
  generateTemporaryPassword: z.boolean().default(true),
  mustChangePassword: z.boolean().default(true)
}).superRefine((data, ctx) => {
  if (!data.password && !data.generateTemporaryPassword) {
    ctx.addIssue({
      code: "custom",
      path: ["password"],
      message: "Informe uma senha manual ou gere uma senha temporária"
    });
  }
});

export const colaboradorUpdateSchema = z.object({
  nome: z.string().min(2).optional(),
  cpf: z.string().min(11).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  status: z.enum(["ATIVO", "INATIVO"]).optional()
});

export const colaboradorResetPasswordSchema = z.object({
  password: z.string().min(8).optional()
});
