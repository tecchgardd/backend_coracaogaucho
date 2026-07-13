import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/http.js";

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });

    if (!session?.user) {
      throw new AppError("Nao autenticado", 401);
    }

    const colaborador = await prisma.colaborador.findUnique({
      where: { userId: session.user.id }
    });

    if (!colaborador || colaborador.status !== "ATIVO") {
      throw new AppError("Colaborador sem acesso ativo", 403);
    }

    req.auth = {
      userId: session.user.id,
      colaboradorId: colaborador.id,
      role: colaborador.role,
      email: colaborador.email,
      name: colaborador.nome
    };

    next();
  } catch (error) {
    next(error);
  }
}
