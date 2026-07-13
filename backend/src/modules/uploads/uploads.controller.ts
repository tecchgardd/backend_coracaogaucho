import type { Request, Response } from "express";
import { uploadsService } from "./uploads.service.js";

export const uploadsController = {
  async image(req: Request, res: Response) {
    res.status(201).json(await uploadsService.uploadImage(req.file));
  }
};
