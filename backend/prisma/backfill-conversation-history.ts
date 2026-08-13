import "dotenv/config";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { planConversations, resolveCustomerId, findSkippedSessionIds } from "../src/lib/conversation-backfill.js";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const rawRows = await prisma.n8nChatHistory.findMany({ orderBy: { id: "asc" } });
  const rows = rawRows.map((row) => ({ id: row.id, sessionId: row.sessionId, message: row.message }));
  const planned = planConversations(rows);

  const skippedSessionIds = findSkippedSessionIds(rows);
  if (skippedSessionIds.length > 0) {
    console.log(`Ignorando ${skippedSessionIds.length} session_id(s) fora do formato whatsapp:<digitos>:`);
    for (const sessionId of skippedSessionIds) console.log(`  - ${sessionId}`);
  }

  if (planned.length === 0) {
    console.log("Nenhuma sessao whatsapp:<telefone> encontrada em n8n_chat_histories. Nada a fazer.");
    return;
  }

  const customers = await prisma.customer.findMany({ select: { id: true, telefone: true } });

  let created = 0;
  let skipped = 0;
  let matchedCustomer = 0;

  for (const conversation of planned) {
    const existing = await prisma.conversation.findUnique({
      where: {
        channel_externalConversationId: {
          channel: "WHATSAPP",
          externalConversationId: conversation.phoneWithDdi
        }
      }
    });
    if (existing) {
      skipped += 1;
      console.log(`Pulando ${conversation.sessionId}: ja existe Conversation ${existing.id}`);
      continue;
    }

    const customerId = resolveCustomerId(conversation.phoneWithDdi, customers);
    if (customerId) matchedCustomer += 1;

    console.log(
      `${DRY_RUN ? "[dry-run] " : ""}${conversation.sessionId} -> ${conversation.messages.length} mensagens, customerId=${customerId ?? "null"}`
    );

    if (DRY_RUN) {
      created += 1;
      continue;
    }

    await prisma.conversation.create({
      data: {
        customerId: customerId ?? undefined,
        channel: "WHATSAPP",
        externalConversationId: conversation.phoneWithDdi,
        status: "CLOSED",
        messages: {
          create: conversation.messages.map((message) => ({
            senderType: message.senderType,
            content: message.content,
            // message.metadata is a JSONB column value read back from n8n_chat_histories.message
            // (NOT NULL there), but Prisma's JSON scalar rejects a bare JS `null` for a nullable
            // Json field -- it must be the sentinel Prisma.JsonNull instead.
            metadata: (message.metadata === null ? Prisma.JsonNull : message.metadata) as Prisma.InputJsonValue
          }))
        }
      }
    });
    created += 1;
  }

  console.log(
    `\nResumo: ${created} conversa(s) ${DRY_RUN ? "seriam criadas" : "criadas"}, ${skipped} pulada(s) (ja existiam), ${matchedCustomer} com customer resolvido.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
