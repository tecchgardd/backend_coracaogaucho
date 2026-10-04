import type { Request, Response } from "express";
import type { z } from "zod";
import { AppError } from "../../utils/http.js";
import { agentPromptsService } from "./agent-prompts.service.js";
import type { promptCreateSchema, promptStatusSchema, promptUpdateSchema } from "./agent-prompts.schemas.js";

export const agentPromptsController = {
  async listar(req: Request, res: Response) {
    res.json(await agentPromptsService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await agentPromptsService.buscar(Number(req.params.id)));
  },
  async criar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.status(201).json(await agentPromptsService.criar(req.body as z.infer<typeof promptCreateSchema>, req.auth));
  },
  async atualizar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentPromptsService.atualizar(Number(req.params.id), req.body as z.infer<typeof promptUpdateSchema>, req.auth));
  },
  async status(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    const body = req.body as z.infer<typeof promptStatusSchema>;
    res.json(await agentPromptsService.atualizarStatus(Number(req.params.id), body.status, req.auth));
  },
  async remover(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentPromptsService.remover(Number(req.params.id), req.auth));
  }
};
