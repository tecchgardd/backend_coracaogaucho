import type { Request, Response } from "express";
import { eventosService } from "./eventos.service.js";

export const eventosController = {
  async listar(req: Request, res: Response) {
    res.json(await eventosService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await eventosService.buscar(Number(req.params.id)));
  },
  async criar(req: Request, res: Response) {
    res.status(201).json(await eventosService.criar(req.body));
  },
  async atualizar(req: Request, res: Response) {
    res.json(await eventosService.atualizar(Number(req.params.id), req.body));
  },
  async remover(req: Request, res: Response) {
    res.json(await eventosService.remover(Number(req.params.id)));
  }
};
