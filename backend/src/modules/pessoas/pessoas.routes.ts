import { Router } from "express";
import { asyncHandler, validate } from "../../utils/http.js";
import { pessoasController } from "./pessoas.controller.js";
import { cpfParamSchema } from "./pessoas.schemas.js";

export const pessoasRoutes = Router();

pessoasRoutes.get("/by-cpf/:cpf", validate({ params: cpfParamSchema }), asyncHandler(pessoasController.buscarPorCpf));

