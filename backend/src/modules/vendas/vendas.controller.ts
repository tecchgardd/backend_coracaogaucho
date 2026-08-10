import type { Request, Response } from "express";
import { AppError } from "../../utils/http.js";
import { vendasService } from "./vendas.service.js";

export const vendasController = {
  async listar(req: Request, res: Response) {
    res.json(await vendasService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await vendasService.buscar(Number(req.params.id)));
  },
  async historico(req: Request, res: Response) {
    res.json(await vendasService.historico(Number(req.params.id)));
  },
  async criar(req: Request, res: Response) {
    res.status(201).json(await vendasService.criar(req.body));
  },
  async atualizar(req: Request, res: Response) {
    res.json(await vendasService.atualizar(Number(req.params.id), req.body));
  },
  async gerarLinkPagamento(req: Request, res: Response) {
    res.json(await vendasService.gerarLinkPagamento(Number(req.params.id)));
  },
  async remover(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Nao autenticado", 401);
    res.json(await vendasService.remover(Number(req.params.id), req.auth));
  }
};
