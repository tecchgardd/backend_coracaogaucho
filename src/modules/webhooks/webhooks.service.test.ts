import assert from "node:assert/strict";
import test from "node:test";

process.env.STRIPE_SECRET_KEY ||= "sk_test_unit";
process.env.STRIPE_WEBHOOK_SECRET ||= "whsec_unit";
process.env.FRONTEND_URL ||= "http://localhost:3000";
process.env.BACKEND_URL ||= "http://localhost:3333";
process.env.N8N_INTEGRATION_SECRET ||= "unit-integration-secret";

test("Stripe webhook rejects missing and invalid signatures", async () => {
  const { webhooksService } = await import("./webhooks.service.js");
  assert.throws(() => webhooksService.constructStripeEvent(Buffer.from("{}")), /ausente/);
  assert.throws(() => webhooksService.constructStripeEvent(Buffer.from("{}"), "invalid"), /invalida/);
});

test("Stripe webhook accepts an event with a valid test signature", async () => {
  const { stripe } = await import("../../lib/stripe.js");
  const { webhooksService } = await import("./webhooks.service.js");
  const payload = JSON.stringify({ id: "evt_valid_signature", object: "event", type: "payment_intent.succeeded", data: { object: { id: "pi_test", object: "payment_intent" } } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  assert.equal(webhooksService.constructStripeEvent(Buffer.from(payload), signature).id, "evt_valid_signature");
});

test("refund mapping distinguishes total and partial refunds", async () => {
  const { refundStatus } = await import("./webhooks.service.js");
  assert.equal(refundStatus(10_000, 10_000), "ESTORNADO");
  assert.equal(refundStatus(10_000, 2_500), "PARCIALMENTE_ESTORNADO");
});

test("ticket QR codes are deterministic and unique per order item index", async () => {
  const { ticketQrCode } = await import("./webhooks.service.js");
  const first = ticketQrCode(12, 34, 1);
  assert.equal(first, ticketQrCode(12, 34, 1));
  assert.notEqual(first, ticketQrCode(12, 34, 2));
  assert.notEqual(first, ticketQrCode(13, 34, 1));
});

test("only the worker that atomically claims a webhook may process it", async () => {
  const { webhookEventWasClaimed } = await import("./webhooks.service.js");
  assert.equal(webhookEventWasClaimed(1), true);
  assert.equal(webhookEventWasClaimed(0), false);
});

test("all required Stripe events are explicitly supported", async () => {
  const { SUPPORTED_STRIPE_EVENTS } = await import("./webhooks.service.js");
  assert.deepEqual([...SUPPORTED_STRIPE_EVENTS].sort(), [
    "charge.dispute.closed",
    "charge.dispute.created",
    "charge.dispute.updated",
    "charge.refund.updated",
    "charge.refunded",
    "checkout.session.async_payment_failed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.completed",
    "checkout.session.expired",
    "payment_intent.canceled",
    "payment_intent.payment_failed",
    "payment_intent.succeeded"
  ]);
});

test("dispute mapping preserves paid status when won and marks open or lost disputes", async () => {
  const { disputePaymentStatus } = await import("./webhooks.service.js");
  assert.equal(disputePaymentStatus("needs_response", "PAGO"), "CONTESTADO");
  assert.equal(disputePaymentStatus("lost", "PAGO"), "CONTESTACAO_PERDIDA");
  assert.equal(disputePaymentStatus("won", "PAGO"), "PAGO");
  assert.equal(disputePaymentStatus("warning_closed", "PARCIALMENTE_ESTORNADO"), "PARCIALMENTE_ESTORNADO");
});
