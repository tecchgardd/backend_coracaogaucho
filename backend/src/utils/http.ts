import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

export function validate(schemas: { body?: ZodTypeAny; params?: ZodTypeAny; query?: ZodTypeAny }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.params) req.params = schemas.params.parse(req.params) as Request["params"];
    if (schemas.query) req.query = schemas.query.parse(req.query) as Request["query"];
    next();
  };
}

export const idParamsSchema = {
  id: "id"
} as const;
