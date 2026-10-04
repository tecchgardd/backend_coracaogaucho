import type { UserRole } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/http.js";

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    if (!roles.includes(req.auth.role)) throw new AppError("Acesso negado", 403);
    next();
  };
}
