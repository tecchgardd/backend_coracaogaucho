import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/http.js";

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.path}`, 404));
}

export function errorMiddleware(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Dados inválidos",
      issues: error.issues
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details
    });
  }

  const maybeError = error as { message?: string; statusCode?: number; details?: unknown };
  const statusCode = maybeError.statusCode ?? 500;
  const isServerError = statusCode >= 500;

  return res.status(statusCode).json({
    message: isServerError ? "Erro interno do servidor" : maybeError.message ?? "Erro ao processar a requisicao",
    details: process.env.NODE_ENV === "development" ? maybeError.details ?? error : undefined
  });
}
