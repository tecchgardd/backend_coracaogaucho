import { Router } from "express";
import { asyncHandler } from "../../utils/http.js";
import { relatoriosController } from "./relatorios.controller.js";

export const relatoriosRoutes = Router();

relatoriosRoutes.get("/resumo", asyncHandler(relatoriosController.resumo));
relatoriosRoutes.get("/agrupamentos", asyncHandler(relatoriosController.agrupamentos));
relatoriosRoutes.get("/export/:format", asyncHandler(relatoriosController.exportar));
relatoriosRoutes.get("/financeiro", asyncHandler(relatoriosController.financeiro));
relatoriosRoutes.get("/eventos", asyncHandler(relatoriosController.eventos));
relatoriosRoutes.get("/cursos", asyncHandler(relatoriosController.cursos));
relatoriosRoutes.get("/pedidos", asyncHandler(relatoriosController.pedidos));
relatoriosRoutes.get("/cadastros", asyncHandler(relatoriosController.cadastros));
