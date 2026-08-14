import type { Request, Response } from "express";
import type { z } from "zod";
import { AppError } from "../../utils/http.js";
import { agentKnowledgeService } from "./agent-knowledge.service.js";
import type { knowledgeCreateSchema, knowledgeStatusSchema, knowledgeUpdateSchema } from "./agent-knowledge.schemas.js";

export const agentKnowledgeController = {
  async listar(req: Request, res: Response) {
    res.json(await agentKnowledgeService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await agentKnowledgeService.buscar(Number(req.params.id)));
  },
  async criar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.status(201).json(await agentKnowledgeService.criar(req.body as z.infer<typeof knowledgeCreateSchema>, req.auth));
  },
  async atualizar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentKnowledgeService.atualizar(Number(req.params.id), req.body as z.infer<typeof knowledgeUpdateSchema>, req.auth));
  },
  async status(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    const body = req.body as z.infer<typeof knowledgeStatusSchema>;
    res.json(await agentKnowledgeService.atualizarStatus(Number(req.params.id), body.status, req.auth));
  },
  async remover(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentKnowledgeService.remover(Number(req.params.id), req.auth));
  }
};
