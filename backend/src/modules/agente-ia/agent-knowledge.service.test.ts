import "../../env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../lib/prisma.js";
import { agentKnowledgeService } from "./agent-knowledge.service.js";

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entity: "AiKnowledge" } });
  await prisma.aiKnowledge.deleteMany({ where: { title: { startsWith: "TEST_" } } });
}

test("criar cria um conhecimento com approvedById do autor e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };

    const knowledge = await agentKnowledgeService.criar(
      { title: "TEST_faq", content: "conteudo", type: "FAQ", status: "ATIVO" },
      actor
    );
    assert.equal(knowledge.approvedById, actor.colaboradorId);

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_KNOWLEDGE_CRIAR", entity: "AiKnowledge", entityId: String(knowledge.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("buscar lanca 404 quando o conhecimento nao existe", async () => {
  await assert.rejects(
    () => agentKnowledgeService.buscar(999999999),
    (error: unknown) => Boolean(error && typeof error === "object" && "statusCode" in error && error.statusCode === 404)
  );
});

test("atualizar muda campos e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const knowledge = await agentKnowledgeService.criar({ title: "TEST_faq", content: "x", type: "FAQ", status: "ATIVO" }, actor);

    const updated = await agentKnowledgeService.atualizar(knowledge.id, { content: "novo conteudo" }, actor);
    assert.equal(updated.content, "novo conteudo");

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_KNOWLEDGE_ATUALIZAR", entity: "AiKnowledge", entityId: String(knowledge.id) } });
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
    const knowledge = await agentKnowledgeService.criar({ title: "TEST_faq", content: "x", type: "FAQ", status: "ATIVO" }, actor);

    const updated = await agentKnowledgeService.atualizarStatus(knowledge.id, "INATIVO", actor);
    assert.equal(updated.status, "INATIVO");
  } finally {
    await cleanup();
  }
});

test("remover exclui o conhecimento e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const knowledge = await agentKnowledgeService.criar({ title: "TEST_faq", content: "x", type: "FAQ", status: "ATIVO" }, actor);

    const result = await agentKnowledgeService.remover(knowledge.id, actor);
    assert.deepEqual(result, { ok: true });
    await assert.rejects(() => agentKnowledgeService.buscar(knowledge.id));
  } finally {
    await cleanup();
  }
});

test("listar filtra por type", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    await agentKnowledgeService.criar({ title: "TEST_faq", content: "x", type: "FAQ", status: "ATIVO" }, actor);
    await agentKnowledgeService.criar({ title: "TEST_policy", content: "x", type: "POLICY", status: "ATIVO" }, actor);

    const { data } = await agentKnowledgeService.listar({ page: 1, limit: 20, type: "POLICY" } as never);
    assert.ok(data.every((knowledge) => knowledge.type === "POLICY"));
    assert.ok(data.some((knowledge) => knowledge.title === "TEST_policy"));
  } finally {
    await cleanup();
  }
});
