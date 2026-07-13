import { Router } from "express";
import { idParamSchema } from "../common/schemas.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { pedidosController } from "./pedidos.controller.js";
import { pedidoCancelSchema, pedidoCreateSchema, pedidoQuerySchema, pedidoUpdateSchema } from "./pedidos.schemas.js";

export const pedidosRoutes = Router();

pedidosRoutes.get("/", validate({ query: pedidoQuerySchema }), asyncHandler(pedidosController.listar));
pedidosRoutes.get("/:id", validate({ params: idParamSchema }), asyncHandler(pedidosController.buscar));
pedidosRoutes.post("/", validate({ body: pedidoCreateSchema }), asyncHandler(pedidosController.criar));
pedidosRoutes.patch("/:id", validate({ params: idParamSchema, body: pedidoUpdateSchema }), asyncHandler(pedidosController.atualizar));
pedidosRoutes.put("/:id", validate({ params: idParamSchema, body: pedidoUpdateSchema }), asyncHandler(pedidosController.atualizar));
pedidosRoutes.patch("/:id/cancelar", validate({ params: idParamSchema, body: pedidoCancelSchema }), asyncHandler(pedidosController.cancelar));
pedidosRoutes.delete("/:id", validate({ params: idParamSchema }), asyncHandler(pedidosController.remover));
