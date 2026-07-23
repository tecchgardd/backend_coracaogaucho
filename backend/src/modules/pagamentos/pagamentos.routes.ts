import { Router } from "express";
import { customerAuthMiddleware } from "../../middlewares/customer-auth.middleware.js";
import { checkoutRateLimit } from "../../middlewares/checkout-rate-limit.middleware.js";
import { requireRoles } from "../../middlewares/role.middleware.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { idParamSchema } from "../common/schemas.js";
import { pagamentosController } from "./pagamentos.controller.js";
import { cancelPaymentSchema, checkoutSchema, editPaymentSchema, manualSettlementSchema, orderParamSchema, pagamentoQuerySchema, refundPaymentSchema, whatsappCheckoutSchema } from "./pagamentos.schemas.js";

export const pagamentosRoutes = Router();
pagamentosRoutes.get("/", validate({ query: pagamentoQuerySchema }), asyncHandler(pagamentosController.listar));
pagamentosRoutes.get("/:id", validate({ params: idParamSchema }), asyncHandler(pagamentosController.buscar));
pagamentosRoutes.patch("/:id", requireRoles("ADMIN", "STAFF"), validate({ params: idParamSchema, body: editPaymentSchema }), asyncHandler(pagamentosController.editar));
pagamentosRoutes.patch("/:id/cancelar", validate({ params: idParamSchema, body: cancelPaymentSchema }), asyncHandler(pagamentosController.cancelar));
pagamentosRoutes.post("/:id/baixa-externa", requireRoles("ADMIN", "STAFF"), validate({ params: idParamSchema, body: manualSettlementSchema }), asyncHandler(pagamentosController.baixaExterna));
pagamentosRoutes.post("/:id/substituir-por-externo", requireRoles("ADMIN"), validate({ params: idParamSchema, body: manualSettlementSchema }), asyncHandler(pagamentosController.baixaExterna));
pagamentosRoutes.post("/:id/reembolsar", requireRoles("ADMIN"), validate({ params: idParamSchema, body: refundPaymentSchema }), asyncHandler(pagamentosController.reembolsar));

export const customerPaymentsRoutes = Router();
customerPaymentsRoutes.use(customerAuthMiddleware);
customerPaymentsRoutes.post("/checkout", checkoutRateLimit, validate({ body: checkoutSchema }), asyncHandler(pagamentosController.checkout));
customerPaymentsRoutes.post("/:orderId/retry", checkoutRateLimit, validate({ params: orderParamSchema }), asyncHandler(pagamentosController.retry));
customerPaymentsRoutes.get("/:orderId/status", validate({ params: orderParamSchema }), asyncHandler(pagamentosController.status));

export const integrationsRoutes = Router();
integrationsRoutes.post("/whatsapp/checkout", checkoutRateLimit, validate({ body: whatsappCheckoutSchema }), asyncHandler(pagamentosController.whatsappCheckout));
