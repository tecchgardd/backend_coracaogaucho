import { prisma } from "../../lib/prisma.js";
import type { z } from "zod";
import type { updateConfigSchema } from "./agent-config.schemas.js";

export const agentConfigService = {
  async getConfig() {
    const config = await prisma.agentConfig.findUnique({ where: { id: 1 } });
    if (config) return config;
    return prisma.agentConfig.create({ data: { id: 1 } });
  },

  async updateConfig(data: z.infer<typeof updateConfigSchema>, actor: { colaboradorId: number }) {
    await this.getConfig();
    const config = await prisma.agentConfig.update({
      where: { id: 1 },
      data: { ...data, updatedById: actor.colaboradorId }
    });
    await prisma.auditLog.create({
      data: {
        action: "AGENT_CONFIG_ATUALIZAR",
        entity: "AgentConfig",
        entityId: "1",
        colaboradorId: actor.colaboradorId,
        metadata: data
      }
    });
    return config;
  }
};
