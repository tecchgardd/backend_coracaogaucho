import { Router } from "express";
import { idParamSchema } from "../common/schemas.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { vendasController } from "./vendas.controller.js";
import { vendaCreateSchema, vendaQuerySchema, vendaUpdateSchema } from "./vendas.schemas.js";

export const vendasRoutes = Router();

vendasRoutes.get("/", validate({ query: vendaQuerySchema }), asyncHandler(vendasController.listar));
vendasRoutes.get("/:id", validate({ params: idParamSchema }), asyncHandler(vendasController.buscar));
vendasRoutes.post("/", validate({ body: vendaCreateSchema }), asyncHandler(vendasController.criar));
vendasRoutes.patch("/:id", validate({ params: idParamSchema, body: vendaUpdateSchema }), asyncHandler(vendasController.atualizar));
vendasRoutes.post("/:id/link-pagamento", validate({ params: idParamSchema }), asyncHandler(vendasController.gerarLinkPagamento));
vendasRoutes.delete("/:id", validate({ params: idParamSchema }), asyncHandler(vendasController.remover));
