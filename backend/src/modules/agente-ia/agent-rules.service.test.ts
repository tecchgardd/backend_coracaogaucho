import "../../env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../lib/prisma.js";
import { agentRulesService } from "./agent-rules.service.js";

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entity: "AiRule" } });
  await prisma.aiRule.deleteMany({ where: { name: { startsWith: "TEST_" } } });
}

test("criar cria uma regra e grava AuditLog com o criador", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };

    const rule = await agentRulesService.criar(
      { name: "TEST_regra", category: "GERAL", content: "conteudo", priority: 5, status: "ATIVO" },
      actor
    );
    assert.equal(rule.name, "TEST_regra");
    assert.equal(rule.createdBy, actor.colaboradorId);

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_RULE_CRIAR", entity: "AiRule", entityId: String(rule.id) } });
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.colaboradorId, actor.colaboradorId);
  } finally {
    await cleanup();
  }
});

test("buscar lanca 404 quando a regra nao existe", async () => {
  await assert.rejects(
    () => agentRulesService.buscar(999999999),
    (error: unknown) => Boolean(error && typeof error === "object" && "statusCode" in error && error.statusCode === 404)
  );
});

test("atualizar muda campos e grava updatedBy + AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const rule = await agentRulesService.criar({ name: "TEST_regra", category: "GERAL", content: "x", priority: 5, status: "ATIVO" }, actor);

    const updated = await agentRulesService.atualizar(rule.id, { content: "novo conteudo" }, actor);
    assert.equal(updated.content, "novo conteudo");
    assert.equal(updated.updatedBy, actor.colaboradorId);

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_RULE_ATUALIZAR", entity: "AiRule", entityId: String(rule.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("atualizarStatus alterna ATIVO/INATIVO", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const rule = await agentRulesService.criar({ name: "TEST_regra", category: "GERAL", content: "x", priority: 5, status: "ATIVO" }, actor);

    const updated = await agentRulesService.atualizarStatus(rule.id, "INATIVO", actor);
    assert.equal(updated.status, "INATIVO");
  } finally {
    await cleanup();
  }
});

test("remover exclui a regra e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const rule = await agentRulesService.criar({ name: "TEST_regra", category: "GERAL", content: "x", priority: 5, status: "ATIVO" }, actor);

    const result = await agentRulesService.remover(rule.id, actor);
    assert.deepEqual(result, { ok: true });
    await assert.rejects(() => agentRulesService.buscar(rule.id));

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_RULE_EXCLUIR", entity: "AiRule", entityId: String(rule.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("listar filtra por status", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    await agentRulesService.criar({ name: "TEST_ativa", category: "GERAL", content: "x", priority: 5, status: "ATIVO" }, actor);
    await agentRulesService.criar({ name: "TEST_inativa", category: "GERAL", content: "x", priority: 5, status: "INATIVO" }, actor);

    const { data } = await agentRulesService.listar({ page: 1, limit: 20, status: "INATIVO" } as never);
    assert.ok(data.every((rule) => rule.status === "INATIVO"));
    assert.ok(data.some((rule) => rule.name === "TEST_inativa"));
  } finally {
    await cleanup();
  }
});
