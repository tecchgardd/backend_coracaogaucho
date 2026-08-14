import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { ruleCreateSchema, ruleQuerySchema, ruleUpdateSchema } from "./agent-rules.schemas.js";

type Actor = { colaboradorId: number };

async function auditLog(action: string, entityId: number, actor: Actor, metadata: unknown) {
  await prisma.auditLog.create({
    data: {
      action,
      entity: "AiRule",
      entityId: String(entityId),
      colaboradorId: actor.colaboradorId,
      metadata: metadata as Prisma.InputJsonValue
    }
  });
}

export const agentRulesService = {
  async listar(query: z.infer<typeof ruleQuerySchema>) {
    const where: Prisma.AiRuleWhereInput = { status: query.status };
    const [data, total] = await Promise.all([
      prisma.aiRule.findMany({ where, ...getPagination(query), orderBy: [{ priority: "asc" }, { id: "asc" }] }),
      prisma.aiRule.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const rule = await prisma.aiRule.findUnique({ where: { id } });
    if (!rule) throw new AppError("Regra não encontrada", 404);
    return rule;
  },

  async criar(data: z.infer<typeof ruleCreateSchema>, actor: Actor) {
    const rule = await prisma.aiRule.create({ data: { ...data, createdBy: actor.colaboradorId } });
    await auditLog("AGENT_RULE_CRIAR", rule.id, actor, data);
    return rule;
  },

  async atualizar(id: number, data: z.infer<typeof ruleUpdateSchema>, actor: Actor) {
    await this.buscar(id);
    const rule = await prisma.aiRule.update({ where: { id }, data: { ...data, updatedBy: actor.colaboradorId } });
    await auditLog("AGENT_RULE_ATUALIZAR", id, actor, data);
    return rule;
  },

  async atualizarStatus(id: number, status: "ATIVO" | "INATIVO", actor: Actor) {
    return this.atualizar(id, { status }, actor);
  },

  async remover(id: number, actor: Actor) {
    const rule = await this.buscar(id);
    await prisma.aiRule.delete({ where: { id } });
    await auditLog("AGENT_RULE_EXCLUIR", id, actor, rule);
    return { ok: true };
  }
};
