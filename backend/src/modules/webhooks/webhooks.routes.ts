import { Router } from "express";
import { asyncHandler, validate } from "../../utils/http.js";
import { webhooksController } from "./webhooks.controller.js";
import { abacatePayWebhookSchema } from "./webhooks.schemas.js";

export const webhooksRoutes = Router();

webhooksRoutes.post("/abacatepay", validate({ body: abacatePayWebhookSchema }), asyncHandler(webhooksController.abacatePay));
