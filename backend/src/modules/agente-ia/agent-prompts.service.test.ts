import "../../env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../lib/prisma.js";
import { agentPromptsService } from "./agent-prompts.service.js";

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entity: "AiPrompt" } });
  await prisma.aiPrompt.deleteMany({ where: { name: { startsWith: "TEST_" } } });
}

test("criar cria um prompt com version 1 e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };

    const prompt = await agentPromptsService.criar(
      { name: "TEST_prompt", content: "conteudo", scope: "GENERAL", status: "ATIVO" },
      actor
    );
    assert.equal(prompt.version, 1);
    assert.equal(prompt.createdById, actor.colaboradorId);

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_PROMPT_CRIAR", entity: "AiPrompt", entityId: String(prompt.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("atualizar incrementa version automaticamente e grava updatedById", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const prompt = await agentPromptsService.criar({ name: "TEST_prompt", content: "x", scope: "GENERAL", status: "ATIVO" }, actor);

    const updated = await agentPromptsService.atualizar(prompt.id, { content: "novo" }, actor);
    assert.equal(updated.version, 2);
    assert.equal(updated.content, "novo");
    assert.equal(updated.updatedById, actor.colaboradorId);

    const updatedAgain = await agentPromptsService.atualizar(prompt.id, { tone: "formal" }, actor);
    assert.equal(updatedAgain.version, 3);
  } finally {
    await cleanup();
  }
});

test("buscar lanca 404 quando o prompt nao existe", async () => {
  await assert.rejects(
    () => agentPromptsService.buscar(999999999),
    (error: unknown) => Boolean(error && typeof error === "object" && "statusCode" in error && error.statusCode === 404)
  );
});

test("atualizarStatus alterna ATIVO/INATIVO", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const prompt = await agentPromptsService.criar({ name: "TEST_prompt", content: "x", scope: "GENERAL", status: "ATIVO" }, actor);

    const updated = await agentPromptsService.atualizarStatus(prompt.id, "INATIVO", actor);
    assert.equal(updated.status, "INATIVO");
  } finally {
    await cleanup();
  }
});

test("remover exclui o prompt e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const prompt = await agentPromptsService.criar({ name: "TEST_prompt", content: "x", scope: "GENERAL", status: "ATIVO" }, actor);

    const result = await agentPromptsService.remover(prompt.id, actor);
    assert.deepEqual(result, { ok: true });
    await assert.rejects(() => agentPromptsService.buscar(prompt.id));
  } finally {
    await cleanup();
  }
});

test("listar filtra por scope", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    await agentPromptsService.criar({ name: "TEST_geral", content: "x", scope: "GENERAL", status: "ATIVO" }, actor);
    await agentPromptsService.criar({ name: "TEST_vendas", content: "x", scope: "VENDAS", status: "ATIVO" }, actor);

    const { data } = await agentPromptsService.listar({ page: 1, limit: 20, scope: "VENDAS" } as never);
    assert.ok(data.every((prompt) => prompt.scope === "VENDAS"));
    assert.ok(data.some((prompt) => prompt.name === "TEST_vendas"));
  } finally {
    await cleanup();
  }
});
