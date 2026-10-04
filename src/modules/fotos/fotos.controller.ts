import type { Request, Response } from "express";
import { fotosService } from "./fotos.service.js";

export const fotosController = {
  async upload(req: Request, res: Response) {
    res.status(201).json(await fotosService.upload(req.files as Express.Multer.File[] ?? [], req.body?.folder, req.auth?.userId));
  }
};
