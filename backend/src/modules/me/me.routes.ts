import { Router } from "express";
import { customerAuthMiddleware } from "../../middlewares/customer-auth.middleware.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { meController } from "./me.controller.js";
import { cartSchema, orderParamSchema, profileUpdateSchema } from "./me.schemas.js";

export const meRoutes = Router();
meRoutes.use(customerAuthMiddleware);
meRoutes.get("/profile", asyncHandler(meController.profile));
meRoutes.patch("/profile", validate({ body: profileUpdateSchema }), asyncHandler(meController.updateProfile));
meRoutes.post("/checkout/validate", validate({ body: cartSchema }), asyncHandler(meController.validateCart));
meRoutes.post("/checkout", validate({ body: cartSchema }), asyncHandler(meController.checkout));
meRoutes.get("/orders", asyncHandler(meController.orders));
meRoutes.get("/orders/:id", validate({ params: orderParamSchema }), asyncHandler(meController.order));
meRoutes.get("/tickets", asyncHandler(meController.tickets));
meRoutes.get("/enrollments", asyncHandler(meController.enrollments));
