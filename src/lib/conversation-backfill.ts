export type ConversationSenderTypeValue = "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM";

export interface N8nChatHistoryRow {
  id: number;
  sessionId: string;
  message: unknown;
}

export interface PlannedMessage {
  sourceId: number;
  senderType: ConversationSenderTypeValue;
  content: string;
  metadata: unknown;
}

export interface PlannedConversation {
  sessionId: string;
  phoneWithDdi: string;
  messages: PlannedMessage[];
}

export interface CustomerPhoneRecord {
  id: number;
  telefone: string;
}

export function parseWhatsappSessionId(sessionId: string): string | null {
  const match = /^whatsapp:(\d+)$/.exec(sessionId);
  return match ? match[1] : null;
}

export function phoneWithoutCountryCode(digits: string): string {
  return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
}

export function candidatePhoneVariants(digitsWithoutDdi: string): string[] {
  const variants = new Set<string>([digitsWithoutDdi]);
  if (digitsWithoutDdi.length === 10) {
    variants.add(digitsWithoutDdi.slice(0, 2) + "9" + digitsWithoutDdi.slice(2));
  } else if (digitsWithoutDdi.length === 11 && digitsWithoutDdi[2] === "9") {
    variants.add(digitsWithoutDdi.slice(0, 2) + digitsWithoutDdi.slice(3));
  }
  return [...variants];
}

export function resolveCustomerId(phoneWithDdi: string, customers: CustomerPhoneRecord[]): number | null {
  const withoutDdi = phoneWithoutCountryCode(phoneWithDdi);
  const variants = new Set(candidatePhoneVariants(withoutDdi));
  const matches = customers.filter((c) => variants.has(c.telefone.replace(/\D/g, "")));
  // Only bind when exactly one customer matches. candidatePhoneVariants widens the match set
  // to cover the 9th-digit ambiguity, which raises the chance two different customers'
  // numbers collide -- an arbitrary pick would attach history to the wrong person.
  return matches.length === 1 ? matches[0].id : null;
}

export function mapSenderType(messageType: unknown): ConversationSenderTypeValue {
  if (messageType === "human") return "CUSTOMER";
  if (messageType === "ai") return "AI";
  return "SYSTEM";
}

export function extractContent(message: unknown): string {
  if (message && typeof message === "object" && "content" in (message as Record<string, unknown>)) {
    const content = (message as Record<string, unknown>).content;
    if (typeof content === "string") return content;
    if (content === null || content === undefined) return "";
    return JSON.stringify(content);
  }
  return "";
}

export function groupBySession(rows: N8nChatHistoryRow[]): Map<string, N8nChatHistoryRow[]> {
  const groups = new Map<string, N8nChatHistoryRow[]>();
  for (const row of rows) {
    const list = groups.get(row.sessionId);
    if (list) list.push(row);
    else groups.set(row.sessionId, [row]);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.id - b.id);
  }
  return groups;
}

export function planConversations(rows: N8nChatHistoryRow[]): PlannedConversation[] {
  const groups = groupBySession(rows);
  const planned: PlannedConversation[] = [];
  for (const [sessionId, sessionRows] of groups) {
    const phoneWithDdi = parseWhatsappSessionId(sessionId);
    if (!phoneWithDdi) continue;
    const messages: PlannedMessage[] = sessionRows.map((row) => ({
      sourceId: row.id,
      senderType: mapSenderType((row.message as Record<string, unknown> | null)?.type),
      content: extractContent(row.message),
      metadata: row.message
    }));
    planned.push({ sessionId, phoneWithDdi, messages });
  }
  return planned;
}

// Distinct session_ids that planConversations silently drops because they don't match the
// whatsapp:<digits> format. A data migration must report what it declined to process instead
// of just reporting success on whatever it did handle.
export function findSkippedSessionIds(rows: N8nChatHistoryRow[]): string[] {
  const seen = new Set<string>();
  const skipped: string[] = [];
  for (const row of rows) {
    if (parseWhatsappSessionId(row.sessionId)) continue;
    if (seen.has(row.sessionId)) continue;
    seen.add(row.sessionId);
    skipped.push(row.sessionId);
  }
  return skipped;
}
