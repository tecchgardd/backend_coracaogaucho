import type { Request, Response } from "express";
import { relatoriosService } from "./relatorios.service.js";

export const relatoriosController = {
  async resumo(req: Request, res: Response) {
    res.json(await relatoriosService.resumo(req.query as Record<string, unknown>));
  },
  async financeiro(_req: Request, res: Response) {
    res.json(await relatoriosService.financeiro());
  },
  async eventos(_req: Request, res: Response) {
    res.json(await relatoriosService.eventos());
  },
  async cursos(_req: Request, res: Response) {
    res.json(await relatoriosService.cursos());
  },
  async pedidos(_req: Request, res: Response) {
    res.json(await relatoriosService.pedidos());
  },
  async cadastros(_req: Request, res: Response) {
    res.json(await relatoriosService.cadastros());
  },
  async agrupamentos(_req: Request, res: Response) {
    res.json(await relatoriosService.porCursoCidadeProfessor());
  },
  async exportar(req: Request, res: Response) {
    const format = String(req.params.format ?? "csv") as "csv" | "xlsx" | "pdf";
    const file = await relatoriosService.exportar(format, req.query as Record<string, unknown>);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.body);
  }
};
