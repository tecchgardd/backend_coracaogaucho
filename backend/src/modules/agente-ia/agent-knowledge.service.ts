import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { knowledgeCreateSchema, knowledgeQuerySchema, knowledgeUpdateSchema } from "./agent-knowledge.schemas.js";

type Actor = { colaboradorId: number };

async function auditLog(action: string, entityId: number, actor: Actor, metadata: unknown) {
  await prisma.auditLog.create({
    data: {
      action,
      entity: "AiKnowledge",
      entityId: String(entityId),
      colaboradorId: actor.colaboradorId,
      metadata: metadata as Prisma.InputJsonValue
    }
  });
}

export const agentKnowledgeService = {
  async listar(query: z.infer<typeof knowledgeQuerySchema>) {
    const where: Prisma.AiKnowledgeWhereInput = { status: query.status, type: query.type };
    const [data, total] = await Promise.all([
      prisma.aiKnowledge.findMany({ where, ...getPagination(query), orderBy: { id: "asc" } }),
      prisma.aiKnowledge.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const knowledge = await prisma.aiKnowledge.findUnique({ where: { id } });
    if (!knowledge) throw new AppError("Conhecimento não encontrado", 404);
    return knowledge;
  },

  async criar(data: z.infer<typeof knowledgeCreateSchema>, actor: Actor) {
    const knowledge = await prisma.aiKnowledge.create({ data: { ...data, approvedById: actor.colaboradorId } });
    await auditLog("AGENT_KNOWLEDGE_CRIAR", knowledge.id, actor, data);
    return knowledge;
  },

  async atualizar(id: number, data: z.infer<typeof knowledgeUpdateSchema>, actor: Actor) {
    await this.buscar(id);
    const knowledge = await prisma.aiKnowledge.update({ where: { id }, data });
    await auditLog("AGENT_KNOWLEDGE_ATUALIZAR", id, actor, data);
    return knowledge;
  },

  async atualizarStatus(id: number, status: "ATIVO" | "INATIVO", actor: Actor) {
    return this.atualizar(id, { status }, actor);
  },

  async remover(id: number, actor: Actor) {
    const knowledge = await this.buscar(id);
    await prisma.aiKnowledge.delete({ where: { id } });
    await auditLog("AGENT_KNOWLEDGE_EXCLUIR", id, actor, knowledge);
    return { ok: true };
  }
};
