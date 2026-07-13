import type { Request, Response } from "express";
import { ingressosService } from "./ingressos.service.js";

export const ingressosController = {
  async listar(req: Request, res: Response) {
    res.json(await ingressosService.listar(req.query as never));
  },
  async listarLotes(req: Request, res: Response) {
    res.json(await ingressosService.listarLotes(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await ingressosService.buscar(Number(req.params.id)));
  },
  async buscarLote(req: Request, res: Response) {
    res.json(await ingressosService.buscarLote(Number(req.params.id)));
  },
  async buscarInscricaoPorCpf(req: Request, res: Response) {
    res.json(await ingressosService.buscarInscricaoPorCpf(req.params.cpf));
  },
  async gerarLote(req: Request, res: Response) {
    res.status(201).json(await ingressosService.gerarLote(req.body, req.auth?.colaboradorId));
  },
  async atualizarIngresso(req: Request, res: Response) {
    res.json(await ingressosService.atualizarIngresso(Number(req.params.id), req.body, req.auth?.colaboradorId));
  },
  async atualizarLote(req: Request, res: Response) {
    res.json(await ingressosService.atualizarLote(Number(req.params.id), req.body, req.auth?.colaboradorId));
  },
  async registrarPagamento(req: Request, res: Response) {
    res.json(await ingressosService.registrarPagamento(Number(req.params.id), req.body, req.auth?.colaboradorId));
  },
  async gerarLinkPagamento(req: Request, res: Response) {
    res.json(await ingressosService.gerarLinkPagamento(Number(req.params.id), req.auth?.colaboradorId));
  },
  async anexarComprovante(req: Request, res: Response) {
    res.status(201).json(await ingressosService.anexarComprovante(Number(req.params.id), req.file as Express.Multer.File, req.auth?.colaboradorId));
  }
};
