import "../../env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../lib/prisma.js";
import { agentConfigService } from "./agent-config.service.js";

async function cleanupAgentConfig() {
  await prisma.auditLog.deleteMany({ where: { entity: "AgentConfig", entityId: "1" } });
  await prisma.agentConfig.deleteMany({ where: { id: 1 } });
}

test("getConfig cria a linha id=1 com os defaults corretos e nao duplica em chamadas repetidas", async () => {
  await cleanupAgentConfig();
  try {
    const first = await agentConfigService.getConfig();
    assert.equal(first.id, 1);
    assert.equal(first.aiEnabled, true);
    assert.equal(first.firstResponseMode, "INSTANT");
    assert.equal(first.firstResponseDelaySeconds, 0);
    assert.equal(first.humanQueueSlaSeconds, 600);
    assert.equal(first.updatedById, null);

    const second = await agentConfigService.getConfig();
    assert.equal(second.id, first.id);

    const rows = await prisma.agentConfig.findMany({ where: { id: 1 } });
    assert.equal(rows.length, 1);
  } finally {
    await cleanupAgentConfig();
  }
});

test("updateConfig persiste cada campo e grava um AuditLog com os dados certos", async () => {
  await cleanupAgentConfig();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };

    const changes = {
      aiEnabled: false,
      firstResponseMode: "DELAYED" as const,
      firstResponseDelaySeconds: 30,
      humanQueueSlaSeconds: 900
    };
    const updated = await agentConfigService.updateConfig(changes, actor);

    assert.equal(updated.id, 1);
    assert.equal(updated.aiEnabled, changes.aiEnabled);
    assert.equal(updated.firstResponseMode, changes.firstResponseMode);
    assert.equal(updated.firstResponseDelaySeconds, changes.firstResponseDelaySeconds);
    assert.equal(updated.humanQueueSlaSeconds, changes.humanQueueSlaSeconds);
    assert.equal(updated.updatedById, actor.colaboradorId);

    const log = await prisma.auditLog.findFirst({
      where: { action: "AGENT_CONFIG_ATUALIZAR", entity: "AgentConfig", entityId: "1" },
      orderBy: { id: "desc" }
    });
    assert.ok(log);
    assert.equal(log?.colaboradorId, actor.colaboradorId);
    assert.deepEqual(log?.metadata, changes);
  } finally {
    await cleanupAgentConfig();
  }
});
