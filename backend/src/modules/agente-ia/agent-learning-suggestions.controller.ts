import type { Request, Response } from "express";
import { AppError } from "../../utils/http.js";
import { agentLearningSuggestionsService } from "./agent-learning-suggestions.service.js";

export const agentLearningSuggestionsController = {
  async listar(req: Request, res: Response) {
    res.json(await agentLearningSuggestionsService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await agentLearningSuggestionsService.buscar(Number(req.params.id)));
  },
  async aprovar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentLearningSuggestionsService.aprovar(Number(req.params.id), req.auth));
  },
  async rejeitar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentLearningSuggestionsService.rejeitar(Number(req.params.id), req.auth));
  }
};
