import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/http.js";

export async function customerAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user) throw new AppError("Nao autenticado", 401);
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { customer: true } });
    if (!user || user.role !== "CUSTOMER") throw new AppError("Area exclusiva para clientes", 403);
    req.customerAuth = { userId: user.id, customerId: user.customer?.id, email: user.email, name: user.name };
    next();
  } catch (error) { next(error); }
}
