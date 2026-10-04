import { Router } from "express";
import { idParamSchema } from "../common/schemas.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { inscricoesController } from "./inscricoes.controller.js";
import { inscricaoCreateSchema, inscricaoQuerySchema, inscricaoStatusSchema, inscricaoUpdateSchema } from "./inscricoes.schemas.js";

export const inscricoesRoutes = Router();

inscricoesRoutes.get("/", validate({ query: inscricaoQuerySchema }), asyncHandler(inscricoesController.listar));
inscricoesRoutes.get("/:id", validate({ params: idParamSchema }), asyncHandler(inscricoesController.buscar));
inscricoesRoutes.post("/", validate({ body: inscricaoCreateSchema }), asyncHandler(inscricoesController.criar));
inscricoesRoutes.put("/:id", validate({ params: idParamSchema, body: inscricaoUpdateSchema }), asyncHandler(inscricoesController.atualizar));
inscricoesRoutes.patch("/:id/status", validate({ params: idParamSchema, body: inscricaoStatusSchema }), asyncHandler(inscricoesController.atualizarStatus));
inscricoesRoutes.delete("/:id", validate({ params: idParamSchema }), asyncHandler(inscricoesController.remover));
