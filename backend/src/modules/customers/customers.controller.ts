import type { Request, Response } from "express";
import { customersService } from "./customers.service.js";

export const customersController = {
  async listar(req: Request, res: Response) {
    res.json(await customersService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await customersService.buscar(Number(req.params.id)));
  },
  async historico(req: Request, res: Response) {
    res.json(await customersService.historico(Number(req.params.id)));
  },
  async criar(req: Request, res: Response) {
    res.status(201).json(await customersService.criar(req.body));
  },
  async atualizar(req: Request, res: Response) {
    res.json(await customersService.atualizar(Number(req.params.id), req.body));
  },
  async remover(req: Request, res: Response) {
    res.json(await customersService.remover(Number(req.params.id)));
  }
};
