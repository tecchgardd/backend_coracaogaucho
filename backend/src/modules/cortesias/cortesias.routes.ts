import { Router } from "express";
import { idParamSchema } from "../common/schemas.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { cortesiasController } from "./cortesias.controller.js";
import { cortesiaCreateSchema, cortesiaQuerySchema } from "./cortesias.schemas.js";

export const cortesiasRoutes = Router();

cortesiasRoutes.get("/", validate({ query: cortesiaQuerySchema }), asyncHandler(cortesiasController.listar));
cortesiasRoutes.post("/", validate({ body: cortesiaCreateSchema }), asyncHandler(cortesiasController.criar));
cortesiasRoutes.patch("/:id/cancelar", validate({ params: idParamSchema }), asyncHandler(cortesiasController.cancelar));
