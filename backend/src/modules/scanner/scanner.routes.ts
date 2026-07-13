import { Router } from "express";
import { asyncHandler, validate } from "../../utils/http.js";
import { scannerController } from "./scanner.controller.js";
import { scannerCodigoSchema, scannerHistoricoQuerySchema } from "./scanner.schemas.js";

export const scannerRoutes = Router();

scannerRoutes.post("/validar", validate({ body: scannerCodigoSchema }), asyncHandler(scannerController.validar));
scannerRoutes.post("/digitar-codigo", validate({ body: scannerCodigoSchema }), asyncHandler(scannerController.digitarCodigo));
scannerRoutes.get("/historico", validate({ query: scannerHistoricoQuerySchema }), asyncHandler(scannerController.historico));
