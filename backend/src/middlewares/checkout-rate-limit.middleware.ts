import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/http.js";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkoutRateLimit(req: Request, _res: Response, next: NextFunction) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }
  current.count += 1;
  if (current.count > MAX_REQUESTS) {
    next(new AppError("Muitas tentativas de checkout. Tente novamente em instantes.", 429));
    return;
  }
  next();
}
