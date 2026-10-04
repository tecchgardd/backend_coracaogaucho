import type { Request, Response } from "express";
import { dashboardService } from "./dashboard.service.js";

export const dashboardController = {
  async resumo(_req: Request, res: Response) {
    res.json(await dashboardService.getResumo());
  }
};
