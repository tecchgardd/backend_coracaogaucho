import assert from "node:assert/strict";
import test from "node:test";
import { mapStripeCheckoutStatus } from "./stripe-status.mapper.js";
import { isRetryableOrderStatus } from "./pagamentos.service.js";

test("Stripe checkout statuses map to internal payment statuses", () => {
  assert.equal(mapStripeCheckoutStatus("open", "unpaid"), "PENDENTE");
  assert.equal(mapStripeCheckoutStatus("complete", "paid"), "PAGO");
  assert.equal(mapStripeCheckoutStatus("complete", "processing"), "PROCESSANDO");
  assert.equal(mapStripeCheckoutStatus("expired", "unpaid"), "EXPIRADO");
  assert.equal(mapStripeCheckoutStatus("expired", null), "EXPIRADO");
});

test("retry is allowed only after a terminal unpaid attempt", () => {
  assert.equal(isRetryableOrderStatus("FALHOU"), true);
  assert.equal(isRetryableOrderStatus("CANCELADO"), true);
  assert.equal(isRetryableOrderStatus("EXPIRADO"), true);
  assert.equal(isRetryableOrderStatus("PENDENTE"), false);
  assert.equal(isRetryableOrderStatus("PROCESSANDO"), false);
  assert.equal(isRetryableOrderStatus("PAGO"), false);
});
