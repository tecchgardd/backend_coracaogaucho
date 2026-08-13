import type { ConversationChannel } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { z } from "zod";
import type { channelBodySchema } from "./agent-channels.schemas.js";

const ALL_CHANNELS: ConversationChannel[] = ["WHATSAPP", "EMAIL", "INSTAGRAM", "FACEBOOK", "WEBSITE"];

export const agentChannelsService = {
  async listAll() {
    await Promise.all(
      ALL_CHANNELS.map((channel) => prisma.agentChannelConfig.upsert({ where: { channel }, update: {}, create: { channel } }))
    );
    return prisma.agentChannelConfig.findMany({ orderBy: { channel: "asc" } });
  },

  async upsert(channel: ConversationChannel, data: z.infer<typeof channelBodySchema>, actor: { colaboradorId: number }) {
    const config = await prisma.agentChannelConfig.upsert({
      where: { channel },
      update: { enabled: data.enabled },
      create: { channel, enabled: data.enabled }
    });
    await prisma.auditLog.create({
      data: {
        action: "AGENT_CHANNEL_ATUALIZAR",
        entity: "AgentChannelConfig",
        entityId: channel,
        colaboradorId: actor.colaboradorId,
        metadata: { enabled: data.enabled }
      }
    });
    return config;
  }
};
