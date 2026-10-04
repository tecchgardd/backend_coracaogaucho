import type { Request, Response } from "express";
import { empresasService } from "./empresas.service.js";

export const empresasController = {
  async listar(req: Request, res: Response) { res.json(await empresasService.listar(req.query as never)); },
  async buscar(req: Request, res: Response) { res.json(await empresasService.buscar(req.params.id)); },
  async criar(req: Request, res: Response) { res.status(201).json(await empresasService.criar(req.body, req.file)); },
  async atualizar(req: Request, res: Response) { res.json(await empresasService.atualizar(req.params.id, req.body, req.file)); },
  async remover(req: Request, res: Response) { res.json(await empresasService.remover(req.params.id)); }
};
