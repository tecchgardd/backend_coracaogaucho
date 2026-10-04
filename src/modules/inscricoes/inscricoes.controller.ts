import type { Request, Response } from "express";
import { inscricoesService } from "./inscricoes.service.js";

export const inscricoesController = {
  async listar(req: Request, res: Response) {
    res.json(await inscricoesService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await inscricoesService.buscar(Number(req.params.id)));
  },
  async criar(req: Request, res: Response) {
    res.status(201).json(await inscricoesService.criar(req.body));
  },
  async atualizar(req: Request, res: Response) {
    res.json(await inscricoesService.atualizar(Number(req.params.id), req.body));
  },
  async atualizarStatus(req: Request, res: Response) {
    res.json(await inscricoesService.atualizarStatus(Number(req.params.id), req.body.status));
  },
  async remover(req: Request, res: Response) {
    res.json(await inscricoesService.remover(Number(req.params.id)));
  }
};
