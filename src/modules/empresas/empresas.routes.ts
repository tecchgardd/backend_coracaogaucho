import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { asyncHandler, validate } from "../../utils/http.js";
import { empresasController } from "./empresas.controller.js";
import { empresaBodySchema, empresaQuerySchema, empresaUpdateSchema } from "./empresas.schemas.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const params = z.object({ id: z.string().cuid() });
export const empresasRoutes = Router();
empresasRoutes.get("/", validate({ query: empresaQuerySchema }), asyncHandler(empresasController.listar));
empresasRoutes.get("/:id", validate({ params }), asyncHandler(empresasController.buscar));
empresasRoutes.post("/", upload.single("imagem"), validate({ body: empresaBodySchema }), asyncHandler(empresasController.criar));
empresasRoutes.patch("/:id", upload.single("imagem"), validate({ params, body: empresaUpdateSchema }), asyncHandler(empresasController.atualizar));
empresasRoutes.delete("/:id", validate({ params }), asyncHandler(empresasController.remover));
