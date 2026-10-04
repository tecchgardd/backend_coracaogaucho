import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { promptCreateSchema, promptQuerySchema, promptUpdateSchema } from "./agent-prompts.schemas.js";

type Actor = { colaboradorId: number };

async function auditLog(action: string, entityId: number, actor: Actor, metadata: unknown) {
  await prisma.auditLog.create({
    data: {
      action,
      entity: "AiPrompt",
      entityId: String(entityId),
      colaboradorId: actor.colaboradorId,
      metadata: metadata as Prisma.InputJsonValue
    }
  });
}

export const agentPromptsService = {
  async listar(query: z.infer<typeof promptQuerySchema>) {
    const where: Prisma.AiPromptWhereInput = { status: query.status, scope: query.scope };
    const [data, total] = await Promise.all([
      prisma.aiPrompt.findMany({ where, ...getPagination(query), orderBy: { id: "asc" } }),
      prisma.aiPrompt.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const prompt = await prisma.aiPrompt.findUnique({ where: { id } });
    if (!prompt) throw new AppError("Prompt não encontrado", 404);
    return prompt;
  },

  async criar(data: z.infer<typeof promptCreateSchema>, actor: Actor) {
    const prompt = await prisma.aiPrompt.create({ data: { ...data, createdById: actor.colaboradorId } });
    await auditLog("AGENT_PROMPT_CRIAR", prompt.id, actor, data);
    return prompt;
  },

  async atualizar(id: number, data: z.infer<typeof promptUpdateSchema>, actor: Actor) {
    await this.buscar(id);
    const prompt = await prisma.aiPrompt.update({
      where: { id },
      data: { ...data, updatedById: actor.colaboradorId, version: { increment: 1 } }
    });
    await auditLog("AGENT_PROMPT_ATUALIZAR", id, actor, data);
    return prompt;
  },

  async atualizarStatus(id: number, status: "ATIVO" | "INATIVO", actor: Actor) {
    await this.buscar(id);
    const prompt = await prisma.aiPrompt.update({
      where: { id },
      data: { status, updatedById: actor.colaboradorId }
    });
    await auditLog("AGENT_PROMPT_ATUALIZAR", id, actor, { status });
    return prompt;
  },

  async remover(id: number, actor: Actor) {
    const prompt = await this.buscar(id);
    await prisma.aiPrompt.delete({ where: { id } });
    await auditLog("AGENT_PROMPT_EXCLUIR", id, actor, prompt);
    return { ok: true };
  }
};
