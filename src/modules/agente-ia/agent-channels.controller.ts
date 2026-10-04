import type { Request, Response } from "express";
import type { ConversationChannel } from "@prisma/client";
import type { z } from "zod";
import { AppError } from "../../utils/http.js";
import { agentChannelsService } from "./agent-channels.service.js";
import type { channelBodySchema } from "./agent-channels.schemas.js";

export const agentChannelsController = {
  async listar(_req: Request, res: Response) {
    res.json(await agentChannelsService.listAll());
  },
  async atualizar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    const channel = req.params.channel as ConversationChannel;
    res.json(await agentChannelsService.upsert(channel, req.body as z.infer<typeof channelBodySchema>, req.auth));
  }
};
