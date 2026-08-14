import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { learningSuggestionQuerySchema } from "./agent-learning-suggestions.schemas.js";

type Actor = { colaboradorId: number };

async function auditLog(action: string, entityId: number, actor: Actor, metadata: unknown) {
  await prisma.auditLog.create({
    data: {
      action,
      entity: "AiLearningSuggestion",
      entityId: String(entityId),
      colaboradorId: actor.colaboradorId,
      metadata: metadata as Prisma.InputJsonValue
    }
  });
}

async function transition(id: number, status: "APROVADO" | "REJEITADO", actor: Actor) {
  await agentLearningSuggestionsService.buscar(id);
  const suggestion = await prisma.aiLearningSuggestion.update({
    where: { id },
    data: { status, reviewedById: actor.colaboradorId, reviewedAt: new Date() }
  });
  await auditLog(status === "APROVADO" ? "AGENT_LEARNING_APROVAR" : "AGENT_LEARNING_REJEITAR", id, actor, { status });
  return suggestion;
}

export const agentLearningSuggestionsService = {
  async listar(query: z.infer<typeof learningSuggestionQuerySchema>) {
    const where: Prisma.AiLearningSuggestionWhereInput = { status: query.status };
    const [data, total] = await Promise.all([
      prisma.aiLearningSuggestion.findMany({ where, ...getPagination(query), orderBy: { id: "asc" } }),
      prisma.aiLearningSuggestion.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const suggestion = await prisma.aiLearningSuggestion.findUnique({ where: { id } });
    if (!suggestion) throw new AppError("Sugestão não encontrada", 404);
    return suggestion;
  },

  async aprovar(id: number, actor: Actor) {
    return transition(id, "APROVADO", actor);
  },

  async rejeitar(id: number, actor: Actor) {
    return transition(id, "REJEITADO", actor);
  }
};
