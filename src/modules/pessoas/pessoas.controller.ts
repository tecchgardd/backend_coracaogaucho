import type { Request, Response } from "express";
import { pessoasService } from "./pessoas.service.js";

export const pessoasController = {
  async buscarPorCpf(req: Request, res: Response) {
    const result = await pessoasService.buscarPorCpf(req.params.cpf);
    res.status(result.success ? 200 : 404).json(result);
  }
};

