import type { Request, Response } from "express";
import { pagamentosService } from "./pagamentos.service.js";

export const pagamentosController = {
  async listar(req: Request, res: Response) {
    res.json(await pagamentosService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await pagamentosService.buscar(Number(req.params.id)));
  },
  async criarCobranca(req: Request, res: Response) {
    res.status(201).json(await pagamentosService.criarCobranca(req.body));
  },
  async confirmar(req: Request, res: Response) {
    res.json(await pagamentosService.confirmar(Number(req.params.id)));
  },
  async cancelar(req: Request, res: Response) {
    res.json(await pagamentosService.cancelar(Number(req.params.id)));
  }
};
