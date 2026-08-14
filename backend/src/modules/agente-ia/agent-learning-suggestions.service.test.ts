import "../../env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../lib/prisma.js";
import { agentLearningSuggestionsService } from "./agent-learning-suggestions.service.js";

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entity: "AiLearningSuggestion" } });
  await prisma.aiLearningSuggestion.deleteMany({ where: { title: { startsWith: "TEST_" } } });
}

async function seed(overrides: Partial<{ title: string; status: string }> = {}) {
  return prisma.aiLearningSuggestion.create({
    data: {
      title: overrides.title ?? "TEST_sugestao",
      description: "descricao de teste",
      status: overrides.status ?? "PENDENTE"
    }
  });
}

test("buscar lanca 404 quando a sugestao nao existe", async () => {
  await assert.rejects(
    () => agentLearningSuggestionsService.buscar(999999999),
    (error: unknown) => Boolean(error && typeof error === "object" && "statusCode" in error && error.statusCode === 404)
  );
});

test("aprovar marca status APROVADO, reviewedById e reviewedAt, e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const suggestion = await seed();

    const updated = await agentLearningSuggestionsService.aprovar(suggestion.id, actor);
    assert.equal(updated.status, "APROVADO");
    assert.equal(updated.reviewedById, actor.colaboradorId);
    assert.ok(updated.reviewedAt);

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_LEARNING_APROVAR", entity: "AiLearningSuggestion", entityId: String(suggestion.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("rejeitar marca status REJEITADO e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const suggestion = await seed();

    const updated = await agentLearningSuggestionsService.rejeitar(suggestion.id, actor);
    assert.equal(updated.status, "REJEITADO");

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_LEARNING_REJEITAR", entity: "AiLearningSuggestion", entityId: String(suggestion.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("listar filtra por status", async () => {
  await cleanup();
  try {
    await seed({ title: "TEST_pendente", status: "PENDENTE" });
    await seed({ title: "TEST_aprovada", status: "APROVADO" });

    const { data } = await agentLearningSuggestionsService.listar({ page: 1, limit: 20, status: "APROVADO" } as never);
    assert.ok(data.every((suggestion) => suggestion.status === "APROVADO"));
    assert.ok(data.some((suggestion) => suggestion.title === "TEST_aprovada"));
  } finally {
    await cleanup();
  }
});
