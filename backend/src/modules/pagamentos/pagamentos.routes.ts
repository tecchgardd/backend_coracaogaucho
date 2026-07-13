import { Router } from "express";
import { idParamSchema } from "../common/schemas.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { pagamentosController } from "./pagamentos.controller.js";
import { criarCobrancaSchema, pagamentoQuerySchema } from "./pagamentos.schemas.js";

export const pagamentosRoutes = Router();

pagamentosRoutes.get("/", validate({ query: pagamentoQuerySchema }), asyncHandler(pagamentosController.listar));
pagamentosRoutes.get("/:id", validate({ params: idParamSchema }), asyncHandler(pagamentosController.buscar));
pagamentosRoutes.post("/criar-cobranca", validate({ body: criarCobrancaSchema }), asyncHandler(pagamentosController.criarCobranca));
pagamentosRoutes.patch("/:id/confirmar", validate({ params: idParamSchema }), asyncHandler(pagamentosController.confirmar));
pagamentosRoutes.patch("/:id/cancelar", validate({ params: idParamSchema }), asyncHandler(pagamentosController.cancelar));
