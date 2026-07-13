import { Router } from "express";
import multer from "multer";
import { idParamSchema } from "../common/schemas.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { ingressosController } from "./ingressos.controller.js";
import { atualizarIngressoSchema, atualizarLoteSchema, gerarLoteSchema, ingressoQuerySchema, loteIngressoQuerySchema, registrarPagamentoSchema } from "./ingressos.schemas.js";

export const ingressosRoutes = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

ingressosRoutes.get("/", validate({ query: ingressoQuerySchema }), asyncHandler(ingressosController.listar));
ingressosRoutes.get("/inscricao/cpf/:cpf", asyncHandler(ingressosController.buscarInscricaoPorCpf));
ingressosRoutes.get("/lotes", validate({ query: loteIngressoQuerySchema }), asyncHandler(ingressosController.listarLotes));
ingressosRoutes.post("/lotes", validate({ body: gerarLoteSchema }), asyncHandler(ingressosController.gerarLote));
ingressosRoutes.get("/lotes/:id", validate({ params: idParamSchema }), asyncHandler(ingressosController.buscarLote));
ingressosRoutes.patch("/lotes/:id", validate({ params: idParamSchema, body: atualizarLoteSchema }), asyncHandler(ingressosController.atualizarLote));
ingressosRoutes.post("/lotes/:id/pagamento", validate({ params: idParamSchema, body: registrarPagamentoSchema }), asyncHandler(ingressosController.registrarPagamento));
ingressosRoutes.post("/lotes/:id/link-pagamento", validate({ params: idParamSchema }), asyncHandler(ingressosController.gerarLinkPagamento));
ingressosRoutes.post("/lotes/:id/comprovante", validate({ params: idParamSchema }), upload.single("comprovante"), asyncHandler(ingressosController.anexarComprovante));
ingressosRoutes.post("/lotes/:id/comprovantes", validate({ params: idParamSchema }), upload.single("comprovante"), asyncHandler(ingressosController.anexarComprovante));
ingressosRoutes.get("/:id", validate({ params: idParamSchema }), asyncHandler(ingressosController.buscar));
ingressosRoutes.patch("/:id", validate({ params: idParamSchema, body: atualizarIngressoSchema }), asyncHandler(ingressosController.atualizarIngresso));
