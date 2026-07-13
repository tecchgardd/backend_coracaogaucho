import type { Request, Response } from "express";
import { webhooksService } from "./webhooks.service.js";

export const webhooksController = {
  async abacatePay(req: Request, res: Response) {
    const headerSecret = req.get("x-webhook-secret");
    const secret = headerSecret ?? (typeof req.query.webhookSecret === "string" ? req.query.webhookSecret : undefined);
    res.json(await webhooksService.abacatePay(req.body, secret));
  }
};
