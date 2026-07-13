import type { Request, Response } from "express";
import { AppError } from "../../utils/http.js";
import { scannerService } from "./scanner.service.js";

export const scannerController = {
  async validar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await scannerService.validar(req.body.codigo, req.auth.colaboradorId));
  },
  async digitarCodigo(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await scannerService.validar(req.body.codigo, req.auth.colaboradorId));
  },
  async historico(req: Request, res: Response) {
    res.json(await scannerService.historico(req.query as never));
  }
};
