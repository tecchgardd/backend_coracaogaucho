import type { Request, Response } from "express";
import { AppError } from "../../utils/http.js";
import { webhooksService } from "./webhooks.service.js";

export const webhooksController = {
  async stripe(req: Request, res: Response) {
    if (!Buffer.isBuffer(req.body)) throw new AppError("Payload bruto do webhook ausente", 400, { code: "INVALID_WEBHOOK_SIGNATURE" });
    const event = webhooksService.constructStripeEvent(req.body, req.get("stripe-signature"));
    res.json(await webhooksService.stripe(event));
  }
};
