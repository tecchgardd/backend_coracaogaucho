import "../../env.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ConversationChannel } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { agentChannelsService } from "./agent-channels.service.js";

const ALL_CHANNELS: ConversationChannel[] = ["WHATSAPP", "EMAIL", "INSTAGRAM", "FACEBOOK", "WEBSITE"];

async function cleanupAgentChannels() {
  await prisma.auditLog.deleteMany({ where: { entity: "AgentChannelConfig", entityId: { in: ALL_CHANNELS } } });
  await prisma.agentChannelConfig.deleteMany({ where: { channel: { in: ALL_CHANNELS } } });
}

test("listAll sempre retorna as 5 linhas de canal, mesmo antes de qualquer PATCH", async () => {
  await cleanupAgentChannels();
  try {
    const rows = await agentChannelsService.listAll();
    assert.equal(rows.length, 5);
    // Postgres ordena enums pela ordem declarada no tipo (schema.prisma: WHATSAPP, EMAIL,
    // INSTAGRAM, FACEBOOK, WEBSITE), nao alfabeticamente.
    assert.deepEqual(
      rows.map((row) => row.channel),
      ALL_CHANNELS
    );
    for (const row of rows) {
      assert.equal(row.enabled, false);
    }
  } finally {
    await cleanupAgentChannels();
  }
});

test("upsert cria/atualiza o canal corretamente e grava um AuditLog", async () => {
  await cleanupAgentChannels();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };

    const created = await agentChannelsService.upsert("WHATSAPP", { enabled: true }, actor);
    assert.equal(created.channel, "WHATSAPP");
    assert.equal(created.enabled, true);

    const updated = await agentChannelsService.upsert("WHATSAPP", { enabled: false }, actor);
    assert.equal(updated.id, created.id);
    assert.equal(updated.enabled, false);

    const logs = await prisma.auditLog.findMany({
      where: { action: "AGENT_CHANNEL_ATUALIZAR", entity: "AgentChannelConfig", entityId: "WHATSAPP" },
      orderBy: { id: "asc" }
    });
    assert.equal(logs.length, 2);
    assert.equal(logs[0]?.colaboradorId, actor.colaboradorId);
    assert.deepEqual(logs[0]?.metadata, { enabled: true });
    assert.deepEqual(logs[1]?.metadata, { enabled: false });
  } finally {
    await cleanupAgentChannels();
  }
});
