import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { z } from "zod";
import { env } from "../../env.js";
import { AppError } from "../../utils/http.js";
import { meService } from "../me/me.service.js";
import type { cancelPaymentSchema, checkoutSchema, refundPaymentSchema, whatsappCheckoutSchema } from "./pagamentos.schemas.js";
import { pagamentosService } from "./pagamentos.service.js";

function customerActor(req: Request) {
  if (!req.customerAuth?.customerId) throw new AppError("Complete seu perfil antes de finalizar", 422);
  return { customerId: req.customerAuth.customerId, userId: req.customerAuth.userId };
}

export function integrationSecretIsValid(received?: string) {
  if (!received) return false;
  const expected = Buffer.from(env.N8N_INTEGRATION_SECRET);
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const pagamentosController = {
  async listar(req: Request, res: Response) {
    res.json(await pagamentosService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await pagamentosService.buscar(Number(req.params.id)));
  },
  async checkout(req: Request, res: Response) {
    const body = req.body as z.infer<typeof checkoutSchema>;
    const actor = customerActor(req);
    const data = body.orderId
      ? await pagamentosService.createCheckoutForOrder(body.orderId, "SITE", actor)
      : await meService.checkout(req.customerAuth!, { items: body.items ?? [{ eventId: body.eventId!, quantity: body.quantity! }] });
    res.status(201).json({ success: true, data });
  },
  async retry(req: Request, res: Response) {
    const data = await pagamentosService.retry(Number(req.params.orderId), customerActor(req));
    res.status(201).json({ success: true, data });
  },
  async status(req: Request, res: Response) {
    const data = await pagamentosService.status(Number(req.params.orderId), customerActor(req));
    res.json({ success: true, data });
  },
  async whatsappCheckout(req: Request, res: Response) {
    if (!integrationSecretIsValid(req.get("x-integration-secret"))) {
      throw new AppError("Integracao nao autorizada", 401, { code: "UNAUTHORIZED_INTEGRATION" });
    }
    const data = await pagamentosService.createWhatsappOrder(req.body as z.infer<typeof whatsappCheckoutSchema>);
    res.status(201).json({ success: true, data });
  },
  async cancelar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Nao autenticado", 401);
    res.json(await pagamentosService.cancel(Number(req.params.id), req.auth, req.body as z.infer<typeof cancelPaymentSchema>));
  },
  async reembolsar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Nao autenticado", 401);
    res.status(201).json(await pagamentosService.refund(Number(req.params.id), req.auth, req.body as z.infer<typeof refundPaymentSchema>));
  }
};
