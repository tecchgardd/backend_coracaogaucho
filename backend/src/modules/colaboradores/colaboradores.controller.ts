import type { Request, Response } from "express";
import { colaboradoresService } from "./colaboradores.service.js";

export const colaboradoresController = {
  async listar(req: Request, res: Response) {
    res.json(await colaboradoresService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await colaboradoresService.buscar(Number(req.params.id)));
  },
  async criar(req: Request, res: Response) {
    res.status(201).json(await colaboradoresService.criar(req.body));
  },
  async atualizar(req: Request, res: Response) {
    res.json(await colaboradoresService.atualizar(Number(req.params.id), req.body));
  },
  async resetarSenha(req: Request, res: Response) {
    res.json(await colaboradoresService.resetarSenha(Number(req.params.id), req.body));
  },
  async remover(req: Request, res: Response) {
    res.json(await colaboradoresService.remover(Number(req.params.id)));
  }
};
