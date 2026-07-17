import assert from "node:assert/strict";
import test from "node:test";
import { checkoutSchema, refundPaymentSchema, whatsappCheckoutSchema } from "./pagamentos.schemas.js";

test("site checkout accepts identifiers and strips client-supplied prices", () => {
  const parsed = checkoutSchema.parse({ eventId: 10, quantity: 2, origin: "SITE", amount: 1, total: 1, status: "PAGO" });
  assert.deepEqual(parsed, { eventId: 10, quantity: 2, origin: "SITE" });
  assert.equal("amount" in parsed, false);
});

test("site checkout rejects forged origins and invalid quantities", () => {
  assert.equal(checkoutSchema.safeParse({ eventId: 10, quantity: 0, origin: "WHATSAPP" }).success, false);
  assert.equal(checkoutSchema.safeParse({ origin: "SITE" }).success, false);
});

test("whatsapp checkout normalizes customer identifiers and fixes origin", () => {
  const parsed = whatsappCheckoutSchema.parse({
    eventId: 8,
    quantity: 1,
    customer: { name: "Joao da Silva", email: "joao@example.com", cpf: "529.982.247-25", phone: "(48) 99999-9999" }
  });
  assert.equal(parsed.origin, "WHATSAPP");
  assert.equal(parsed.customer.cpf, "52998224725");
  assert.equal(parsed.customer.phone, "48999999999");
});

test("whatsapp checkout rejects unsupported origins and ticket limits", () => {
  const customer = { name: "Joao da Silva", email: "joao@example.com", cpf: "52998224725", phone: "48999999999" };
  assert.equal(whatsappCheckoutSchema.safeParse({ eventId: 8, quantity: 11, customer }).success, false);
  assert.equal(whatsappCheckoutSchema.safeParse({ eventId: 8, quantity: 1, customer, origin: "PAINEL_ADMIN" }).success, false);
});

test("refund accepts a positive cent amount or defaults to the remaining total", () => {
  const partial = refundPaymentSchema.parse({ amount: 2500, reason: "Solicitado pelo cliente" });
  assert.equal(partial.amount, 2500);
  assert.equal(partial.stripeReason, "requested_by_customer");
  assert.equal(refundPaymentSchema.parse({ reason: "Pedido duplicado", stripeReason: "duplicate" }).amount, undefined);
});

test("refund rejects non-integer, zero and unsupported Stripe reasons", () => {
  assert.equal(refundPaymentSchema.safeParse({ amount: 0, reason: "Solicitado pelo cliente" }).success, false);
  assert.equal(refundPaymentSchema.safeParse({ amount: 10.5, reason: "Solicitado pelo cliente" }).success, false);
  assert.equal(refundPaymentSchema.safeParse({ amount: 100, reason: "Solicitado pelo cliente", stripeReason: "other" }).success, false);
});
