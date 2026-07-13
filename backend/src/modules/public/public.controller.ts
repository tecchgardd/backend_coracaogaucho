import type { Request, Response } from "express";
import { publicService } from "./public.service.js";
import type { z } from "zod";
import type { publicAlbumPhotosQuerySchema, publicAlbumQuerySchema, publicEventQuerySchema } from "./public.schemas.js";
import { empresasService } from "../empresas/empresas.service.js";

export const publicController = {
  async events(req: Request, res: Response) {
    res.json(await publicService.listEvents(req.query as unknown as z.infer<typeof publicEventQuerySchema>));
  },
  async event(req: Request, res: Response) {
    res.json(await publicService.getEvent(Number(req.params.id)));
  },
  async albums(req: Request, res: Response) {
    res.json(await publicService.listAlbums(req.query as unknown as z.infer<typeof publicAlbumQuerySchema>));
  },
  async album(req: Request, res: Response) {
    res.json(await publicService.getAlbum(req.params.slug));
  },
  async albumPhotos(req: Request, res: Response) {
    res.json(await publicService.getAlbumPhotos(req.params.slug, req.query as unknown as z.infer<typeof publicAlbumPhotosQuerySchema>));
  },
  async sponsors(_req: Request, res: Response) {
    res.json(await empresasService.listarPublicas());
  }
};
