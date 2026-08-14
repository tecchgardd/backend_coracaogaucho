import { Router } from "express";
import { requireRoles } from "../../middlewares/role.middleware.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { idParamSchema } from "../common/schemas.js";
import { agentConfigController } from "./agent-config.controller.js";
import { statusSchema, updateConfigSchema } from "./agent-config.schemas.js";
import { agentChannelsController } from "./agent-channels.controller.js";
import { channelBodySchema, channelParamSchema } from "./agent-channels.schemas.js";
import { agentRulesController } from "./agent-rules.controller.js";
import { ruleCreateSchema, ruleQuerySchema, ruleStatusSchema, ruleUpdateSchema } from "./agent-rules.schemas.js";
import { agentPromptsController } from "./agent-prompts.controller.js";
import { promptCreateSchema, promptQuerySchema, promptStatusSchema, promptUpdateSchema } from "./agent-prompts.schemas.js";

export const agenteIaRoutes = Router();

// Configuração global do Agent IA
agenteIaRoutes.get("/config", asyncHandler(agentConfigController.buscar));
agenteIaRoutes.patch("/config", validate({ body: updateConfigSchema }), asyncHandler(agentConfigController.atualizar));
agenteIaRoutes.patch("/status", requireRoles("ADMIN"), validate({ body: statusSchema }), asyncHandler(agentConfigController.status));

// Canais de atendimento do Agent IA
agenteIaRoutes.get("/channels", asyncHandler(agentChannelsController.listar));
agenteIaRoutes.patch("/channels/:channel", validate({ params: channelParamSchema, body: channelBodySchema }), asyncHandler(agentChannelsController.atualizar));

// Regras do Agent IA
agenteIaRoutes.get("/rules", validate({ query: ruleQuerySchema }), asyncHandler(agentRulesController.listar));
agenteIaRoutes.get("/rules/:id", validate({ params: idParamSchema }), asyncHandler(agentRulesController.buscar));
agenteIaRoutes.post("/rules", validate({ body: ruleCreateSchema }), asyncHandler(agentRulesController.criar));
agenteIaRoutes.patch("/rules/:id", validate({ params: idParamSchema, body: ruleUpdateSchema }), asyncHandler(agentRulesController.atualizar));
agenteIaRoutes.patch("/rules/:id/status", validate({ params: idParamSchema, body: ruleStatusSchema }), asyncHandler(agentRulesController.status));
agenteIaRoutes.delete("/rules/:id", requireRoles("ADMIN"), validate({ params: idParamSchema }), asyncHandler(agentRulesController.remover));

// Prompts do Agent IA
agenteIaRoutes.get("/prompts", validate({ query: promptQuerySchema }), asyncHandler(agentPromptsController.listar));
agenteIaRoutes.get("/prompts/:id", validate({ params: idParamSchema }), asyncHandler(agentPromptsController.buscar));
agenteIaRoutes.post("/prompts", validate({ body: promptCreateSchema }), asyncHandler(agentPromptsController.criar));
agenteIaRoutes.patch("/prompts/:id", validate({ params: idParamSchema, body: promptUpdateSchema }), asyncHandler(agentPromptsController.atualizar));
agenteIaRoutes.patch("/prompts/:id/status", validate({ params: idParamSchema, body: promptStatusSchema }), asyncHandler(agentPromptsController.status));
agenteIaRoutes.delete("/prompts/:id", requireRoles("ADMIN"), validate({ params: idParamSchema }), asyncHandler(agentPromptsController.remover));

// Task 4 adiciona conhecimento e aprendizados abaixo neste mesmo router.
