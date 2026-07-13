import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { z } from "zod";
import { auth } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";
import { AppError, asyncHandler, validate } from "../../utils/http.js";
import { customerSignUpSchema } from "./customer-auth.schemas.js";

export const customerAuthRoutes = Router();

customerAuthRoutes.post(
  "/sign-up",
  validate({ body: customerSignUpSchema }),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof customerSignUpSchema>;
    const existingCustomer = await prisma.customer.findUnique({ where: { cpf: data.cpf } });
    if (existingCustomer?.userId) throw new AppError("CPF já vinculado a outra conta", 409);

    const signUp = await auth.api.signUpEmail({
      body: { name: data.name, email: data.email, password: data.password },
      headers: fromNodeHeaders(req.headers),
      returnHeaders: true
    });

    const user = signUp.response.user;
    try {
      if (existingCustomer) {
        await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: { userId: user.id, nome: data.name, email: data.email, cpf: data.cpf, cep: data.cep, endereco: data.address }
        });
      } else {
        await prisma.customer.create({
          data: { userId: user.id, nome: data.name, email: data.email, cpf: data.cpf, cep: data.cep, endereco: data.address, telefone: "" }
        });
      }
    } catch (error) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
      throw error;
    }

    const responseHeaders = signUp.headers;
    const getSetCookie = (responseHeaders as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const cookies = getSetCookie?.call(responseHeaders);
    if (cookies?.length) res.setHeader("set-cookie", cookies);
    else {
      const cookie = responseHeaders.get("set-cookie");
      if (cookie) res.setHeader("set-cookie", cookie);
    }

    res.status(201).json(signUp.response);
  })
);
