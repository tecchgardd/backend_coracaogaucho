import { Router } from "express";
import { requireRoles } from "../../middlewares/role.middleware.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { agentConfigController } from "./agent-config.controller.js";
import { statusSchema, updateConfigSchema } from "./agent-config.schemas.js";
import { agentChannelsController } from "./agent-channels.controller.js";
import { channelBodySchema, channelParamSchema } from "./agent-channels.schemas.js";

export const agenteIaRoutes = Router();

// Configuração global do Agent IA (Task 2)
agenteIaRoutes.get("/config", asyncHandler(agentConfigController.buscar));
agenteIaRoutes.patch("/config", validate({ body: updateConfigSchema }), asyncHandler(agentConfigController.atualizar));
agenteIaRoutes.patch("/status", requireRoles("ADMIN"), validate({ body: statusSchema }), asyncHandler(agentConfigController.status));

// Canais de atendimento do Agent IA (Task 2)
agenteIaRoutes.get("/channels", asyncHandler(agentChannelsController.listar));
agenteIaRoutes.patch("/channels/:channel", validate({ params: channelParamSchema, body: channelBodySchema }), asyncHandler(agentChannelsController.atualizar));

// Tasks 3 e 4 adicionam suas próprias rotas (regras, prompts, conhecimento, conversas, etc.) abaixo neste mesmo router.
