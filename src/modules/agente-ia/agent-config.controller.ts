import type { Request, Response } from "express";
import type { z } from "zod";
import { AppError } from "../../utils/http.js";
import { agentConfigService } from "./agent-config.service.js";
import type { statusSchema, updateConfigSchema } from "./agent-config.schemas.js";

export const agentConfigController = {
  async buscar(_req: Request, res: Response) {
    res.json(await agentConfigService.getConfig());
  },
  async atualizar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentConfigService.updateConfig(req.body as z.infer<typeof updateConfigSchema>, req.auth));
  },
  async status(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    const body = req.body as z.infer<typeof statusSchema>;
    res.json(await agentConfigService.updateConfig({ aiEnabled: body.enabled }, req.auth));
  }
};
