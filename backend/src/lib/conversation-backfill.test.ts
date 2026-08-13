import assert from "node:assert/strict";
import test from "node:test";
import {
  parseWhatsappSessionId,
  phoneWithoutCountryCode,
  candidatePhoneVariants,
  resolveCustomerId,
  mapSenderType,
  extractContent,
  groupBySession,
  planConversations,
  findSkippedSessionIds
} from "./conversation-backfill.js";

test("parseWhatsappSessionId extracts digits from a whatsapp session id", () => {
  assert.equal(parseWhatsappSessionId("whatsapp:554899084537"), "554899084537");
});

test("parseWhatsappSessionId returns null for unrecognized session id formats", () => {
  assert.equal(parseWhatsappSessionId("email:someone@example.com"), null);
  assert.equal(parseWhatsappSessionId("whatsapp:"), null);
  assert.equal(parseWhatsappSessionId("whatsapp:abc123"), null);
});

test("phoneWithoutCountryCode strips a leading 55 only from long numbers", () => {
  assert.equal(phoneWithoutCountryCode("554899084537"), "4899084537");
  assert.equal(phoneWithoutCountryCode("4899084537"), "4899084537");
});

test("candidatePhoneVariants inserts and removes the mobile 9th digit", () => {
  assert.deepEqual(new Set(candidatePhoneVariants("4899084537")), new Set(["4899084537", "48999084537"]));
  assert.deepEqual(new Set(candidatePhoneVariants("48999084537")), new Set(["48999084537", "4899084537"]));
  assert.deepEqual(new Set(candidatePhoneVariants("123")), new Set(["123"]));
});

test("resolveCustomerId matches a customer even when the 9th digit differs", () => {
  const customers = [{ id: 84, telefone: "48999084537" }];
  assert.equal(resolveCustomerId("554899084537", customers), 84);
});

test("resolveCustomerId matches when the customer record has no 9th digit either", () => {
  const customers = [{ id: 5, telefone: "4899084537" }];
  assert.equal(resolveCustomerId("554899084537", customers), 5);
});

test("resolveCustomerId returns null when no customer matches", () => {
  assert.equal(resolveCustomerId("554899084537", []), null);
  assert.equal(resolveCustomerId("554899084537", [{ id: 1, telefone: "11222223333" }]), null);
});

test("resolveCustomerId returns null when the phone is ambiguous between two customers", () => {
  const customers = [
    { id: 1, telefone: "4899084537" },
    { id: 2, telefone: "48999084537" }
  ];
  assert.equal(resolveCustomerId("554899084537", customers), null);
});

test("phoneWithoutCountryCode does not strip an 11-digit number in DDD 55 (Santa Maria/RS)", () => {
  assert.equal(phoneWithoutCountryCode("55999084537"), "55999084537");
});

test("mapSenderType maps human/ai to CUSTOMER/AI and anything else to SYSTEM", () => {
  assert.equal(mapSenderType("human"), "CUSTOMER");
  assert.equal(mapSenderType("ai"), "AI");
  assert.equal(mapSenderType("tool"), "SYSTEM");
  assert.equal(mapSenderType(undefined), "SYSTEM");
  assert.equal(mapSenderType("something-unexpected"), "SYSTEM");
});

test("extractContent returns the string content field or stringifies non-string content", () => {
  assert.equal(extractContent({ type: "human", content: "oi" }), "oi");
  assert.equal(extractContent({ type: "ai", content: null }), "");
  assert.equal(extractContent({ type: "tool", content: [{ output: "x" }] }), JSON.stringify([{ output: "x" }]));
  assert.equal(extractContent("not an object"), "");
  assert.equal(extractContent(null), "");
});

test("groupBySession groups rows by sessionId and sorts each group by id ascending", () => {
  const rows = [
    { id: 3, sessionId: "whatsapp:1", message: {} },
    { id: 1, sessionId: "whatsapp:1", message: {} },
    { id: 2, sessionId: "whatsapp:2", message: {} }
  ];
  const groups = groupBySession(rows);
  assert.deepEqual(groups.get("whatsapp:1")!.map((r) => r.id), [1, 3]);
  assert.deepEqual(groups.get("whatsapp:2")!.map((r) => r.id), [2]);
});

test("planConversations skips session ids that are not whatsapp:<digits>", () => {
  const rows = [
    { id: 1, sessionId: "whatsapp:554899084537", message: { type: "human", content: "oi" } },
    { id: 2, sessionId: "email:x@example.com", message: { type: "human", content: "oi" } }
  ];
  const planned = planConversations(rows);
  assert.equal(planned.length, 1);
  assert.equal(planned[0].sessionId, "whatsapp:554899084537");
  assert.equal(planned[0].phoneWithDdi, "554899084537");
});

test("planConversations preserves message order and maps sender types", () => {
  const rows = [
    { id: 2, sessionId: "whatsapp:1", message: { type: "ai", content: "resposta" } },
    { id: 1, sessionId: "whatsapp:1", message: { type: "human", content: "pergunta" } }
  ];
  const [conv] = planConversations(rows);
  assert.deepEqual(
    conv.messages.map((m) => [m.sourceId, m.senderType, m.content]),
    [
      [1, "CUSTOMER", "pergunta"],
      [2, "AI", "resposta"]
    ]
  );
  assert.deepEqual(conv.messages[0].metadata, { type: "human", content: "pergunta" });
});

test("findSkippedSessionIds reports distinct session ids that don't match the whatsapp:<digits> format", () => {
  const rows = [
    { id: 1, sessionId: "whatsapp:554899084537", message: { type: "human", content: "oi" } },
    { id: 2, sessionId: "email:x@example.com", message: { type: "human", content: "oi" } },
    { id: 3, sessionId: "email:x@example.com", message: { type: "human", content: "oi de novo" } },
    { id: 4, sessionId: "whatsapp:+5548999999999", message: { type: "human", content: "oi" } }
  ];
  assert.deepEqual(findSkippedSessionIds(rows), ["email:x@example.com", "whatsapp:+5548999999999"]);
});

test("findSkippedSessionIds returns an empty array when every session id matches", () => {
  const rows = [{ id: 1, sessionId: "whatsapp:554899084537", message: { type: "human", content: "oi" } }];
  assert.deepEqual(findSkippedSessionIds(rows), []);
});
