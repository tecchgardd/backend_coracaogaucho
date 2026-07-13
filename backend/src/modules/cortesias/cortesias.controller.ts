import type { Request, Response } from "express";
import { cortesiasService } from "./cortesias.service.js";

export const cortesiasController = {
  async listar(req: Request, res: Response) {
    res.json(await cortesiasService.listar(req.query as never));
  },
  async criar(req: Request, res: Response) {
    res.status(201).json(await cortesiasService.criar(req.body, req.auth?.colaboradorId));
  },
  async cancelar(req: Request, res: Response) {
    res.json(await cortesiasService.cancelar(Number(req.params.id), req.auth?.colaboradorId));
  }
};
