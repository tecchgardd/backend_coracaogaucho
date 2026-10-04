import type { Request, Response } from "express";
import { pedidosService } from "./pedidos.service.js";

export const pedidosController = {
  async listar(req: Request, res: Response) {
    res.json(await pedidosService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await pedidosService.buscar(Number(req.params.id)));
  },
  async criar(req: Request, res: Response) {
    res.status(201).json(await pedidosService.criar(req.body));
  },
  async atualizar(req: Request, res: Response) {
    res.json(await pedidosService.atualizar(Number(req.params.id), req.body));
  },
  async cancelar(req: Request, res: Response) {
    res.json(await pedidosService.cancelar(Number(req.params.id), req.body?.notes));
  },
  async remover(req: Request, res: Response) {
    res.json(await pedidosService.remover(Number(req.params.id)));
  }
};
