import type { Request, Response } from "express";
import type { z } from "zod";
import { meService } from "./me.service.js";
import type { cartSchema, profileUpdateSchema } from "./me.schemas.js";

function auth(req: Request) {
  if (!req.customerAuth) throw new Error("customerAuth ausente");
  return req.customerAuth;
}

export const meController = {
  profile: (req: Request, res: Response) => meService.profile(auth(req)).then((data) => res.json(data)),
  updateProfile: (req: Request, res: Response) => meService.updateProfile(auth(req), req.body as z.infer<typeof profileUpdateSchema>).then((data) => res.json(data)),
  validateCart: (req: Request, res: Response) => meService.validateCart(req.body as z.infer<typeof cartSchema>).then((data) => res.json(data)),
  checkout: (req: Request, res: Response) => meService.checkout(auth(req), req.body as z.infer<typeof cartSchema>).then((data) => res.status(201).json(data)),
  orders: (req: Request, res: Response) => meService.orders(auth(req)).then((data) => res.json(data)),
  order: (req: Request, res: Response) => meService.order(auth(req), Number(req.params.id)).then((data) => res.json(data)),
  tickets: (req: Request, res: Response) => meService.tickets(auth(req)).then((data) => res.json(data)),
  enrollments: (req: Request, res: Response) => meService.enrollments(auth(req)).then((data) => res.json(data))
};
