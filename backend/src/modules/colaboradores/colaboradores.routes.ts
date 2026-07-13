import { Router } from "express";
import { idParamSchema } from "../common/schemas.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { colaboradoresController } from "./colaboradores.controller.js";
import {
  colaboradorCreateSchema,
  colaboradorQuerySchema,
  colaboradorResetPasswordSchema,
  colaboradorUpdateSchema
} from "./colaboradores.schemas.js";

export const colaboradoresRoutes = Router();

colaboradoresRoutes.get("/", validate({ query: colaboradorQuerySchema }), asyncHandler(colaboradoresController.listar));
colaboradoresRoutes.get("/:id", validate({ params: idParamSchema }), asyncHandler(colaboradoresController.buscar));
colaboradoresRoutes.post("/", validate({ body: colaboradorCreateSchema }), asyncHandler(colaboradoresController.criar));
colaboradoresRoutes.put("/:id", validate({ params: idParamSchema, body: colaboradorUpdateSchema }), asyncHandler(colaboradoresController.atualizar));
colaboradoresRoutes.post(
  "/:id/reset-password",
  validate({ params: idParamSchema, body: colaboradorResetPasswordSchema }),
  asyncHandler(colaboradoresController.resetarSenha)
);
colaboradoresRoutes.delete("/:id", validate({ params: idParamSchema }), asyncHandler(colaboradoresController.remover));
