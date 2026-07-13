import { Router } from "express";
import { idParamSchema } from "../common/schemas.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { customersController } from "./customers.controller.js";
import { customerCreateSchema, customerQuerySchema, customerUpdateSchema } from "./customers.schemas.js";

export const customersRoutes = Router();

customersRoutes.get("/", validate({ query: customerQuerySchema }), asyncHandler(customersController.listar));
customersRoutes.get("/:id", validate({ params: idParamSchema }), asyncHandler(customersController.buscar));
customersRoutes.get("/:id/historico", validate({ params: idParamSchema }), asyncHandler(customersController.historico));
customersRoutes.post("/", validate({ body: customerCreateSchema }), asyncHandler(customersController.criar));
customersRoutes.put("/:id", validate({ params: idParamSchema, body: customerUpdateSchema }), asyncHandler(customersController.atualizar));
customersRoutes.delete("/:id", validate({ params: idParamSchema }), asyncHandler(customersController.remover));
