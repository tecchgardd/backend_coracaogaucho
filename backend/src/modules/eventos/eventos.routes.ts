import { Router } from "express";
import { idParamSchema } from "../common/schemas.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { eventosController } from "./eventos.controller.js";
import { eventoCreateSchema, eventoQuerySchema, eventoUpdateSchema } from "./eventos.schemas.js";

export const eventosRoutes = Router();

eventosRoutes.get("/", validate({ query: eventoQuerySchema }), asyncHandler(eventosController.listar));
eventosRoutes.get("/:id", validate({ params: idParamSchema }), asyncHandler(eventosController.buscar));
eventosRoutes.post("/", validate({ body: eventoCreateSchema }), asyncHandler(eventosController.criar));
eventosRoutes.put("/:id", validate({ params: idParamSchema, body: eventoUpdateSchema }), asyncHandler(eventosController.atualizar));
eventosRoutes.delete("/:id", validate({ params: idParamSchema }), asyncHandler(eventosController.remover));
