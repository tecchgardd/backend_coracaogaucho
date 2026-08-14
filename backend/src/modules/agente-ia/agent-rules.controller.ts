import type { Request, Response } from "express";
import type { z } from "zod";
import { AppError } from "../../utils/http.js";
import { agentRulesService } from "./agent-rules.service.js";
import type { ruleCreateSchema, ruleStatusSchema, ruleUpdateSchema } from "./agent-rules.schemas.js";

export const agentRulesController = {
  async listar(req: Request, res: Response) {
    res.json(await agentRulesService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await agentRulesService.buscar(Number(req.params.id)));
  },
  async criar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.status(201).json(await agentRulesService.criar(req.body as z.infer<typeof ruleCreateSchema>, req.auth));
  },
  async atualizar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentRulesService.atualizar(Number(req.params.id), req.body as z.infer<typeof ruleUpdateSchema>, req.auth));
  },
  async status(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    const body = req.body as z.infer<typeof ruleStatusSchema>;
    res.json(await agentRulesService.atualizarStatus(Number(req.params.id), body.status, req.auth));
  },
  async remover(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentRulesService.remover(Number(req.params.id), req.auth));
  }
};
