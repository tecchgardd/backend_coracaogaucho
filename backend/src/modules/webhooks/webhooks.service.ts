import { Prisma, type PagamentoStatus } from "@prisma/client";
import type Stripe from "stripe";
import { env } from "../../env.js";
import { prisma } from "../../lib/prisma.js";
import { stripe } from "../../lib/stripe.js";
import { AppError } from "../../utils/http.js";
import { mapStripeCheckoutStatus } from "../pagamentos/stripe-status.mapper.js";

type PaymentReferences = {
  metadata?: Stripe.Metadata | null;
  checkoutSessionId?: string;
  paymentIntentId?: string;
  chargeId?: string;
};

export const SUPPORTED_STRIPE_EVENTS = [
  "checkout.session.completed",
  "checkout.session.expired",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refunded",
  "charge.refund.updated",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed"
] as const;

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function eventSummary(event: Stripe.Event): Prisma.InputJsonValue {
  return { id: event.id, type: event.type, created: event.created, livemode: event.livemode };
}

function metadataId(metadata: Stripe.Metadata | null | undefined, key: string) {
  const parsed = Number(metadata?.[key]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function expandableId<T extends { id: string }>(value: string | T | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

function safeError(error: unknown) {
  if (error instanceof AppError) return error.message.slice(0, 180);
  if (error && typeof error === "object" && "type" in error) return String((error as { type?: unknown }).type ?? "StripeWebhookError").slice(0, 180);
  return "StripeWebhookError";
}

async function findPayment(references: PaymentReferences) {
  const orderId = metadataId(references.metadata, "orderId");
  const paymentId = metadataId(references.metadata, "paymentId");
  if (orderId) {
    const payment = await prisma.pagamento.findFirst({
      where: { pedidoId: orderId, ...(paymentId ? { id: paymentId } : {}) },
      orderBy: { createdAt: "desc" }
    });
    if (payment) return payment;
  }
  if (references.checkoutSessionId) {
    const payment = await prisma.pagamento.findUnique({ where: { stripeCheckoutSessionId: references.checkoutSessionId } });
    if (payment) return payment;
  }
  if (references.paymentIntentId) {
    const payment = await prisma.pagamento.findUnique({ where: { stripePaymentIntentId: references.paymentIntentId } });
    if (payment) return payment;
  }
  if (references.chargeId) {
    const payment = await prisma.pagamento.findFirst({ where: { OR: [{ stripeChargeId: references.chargeId }, { gatewayId: references.chargeId }] } });
    if (payment) return payment;
  }
  if (paymentId) return prisma.pagamento.findUnique({ where: { id: paymentId } });
  return null;
}

function parseNotes(notes?: string | null) {
  if (!notes) return {};
  try { return JSON.parse(notes) as Record<string, unknown>; } catch { return {}; }
}

export function ticketQrCode(orderId: number, eventId: number, oneBasedIndex: number) {
  return `TKT-${orderId}-${eventId}-${oneBasedIndex}`;
}

export function refundStatus(amount: number, amountRefunded: number): PagamentoStatus {
  return amountRefunded >= amount ? "ESTORNADO" : "PARCIALMENTE_ESTORNADO";
}

export function disputePaymentStatus(status: Stripe.Dispute.Status, previous: PagamentoStatus | null = null): PagamentoStatus {
  if (status === "won" || status === "warning_closed") return previous && !["CONTESTADO", "CONTESTACAO_PERDIDA"].includes(previous) ? previous : "PAGO";
  if (status === "lost") return "CONTESTACAO_PERDIDA";
  return "CONTESTADO";
}

export function webhookEventWasClaimed(updatedRows: number) {
  return updatedRows > 0;
}

export async function finalizePaidOrder(input: {
  paymentId: number;
  providerData: unknown;
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;
  stripeChargeId?: string;
}) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.pagamento.findUnique({
      where: { id: input.paymentId },
      include: { pedido: { include: { items: { include: { evento: true } }, loteIngresso: true } } }
    });
    if (!payment) return;
    const paidAt = payment.paidAt ?? new Date();
    await tx.pagamento.update({
      where: { id: payment.id },
      data: {
        status: "PAGO",
        paidAt,
        stripePaymentIntentId: input.stripePaymentIntentId ?? payment.stripePaymentIntentId,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? payment.stripeCheckoutSessionId,
        stripeChargeId: input.stripeChargeId ?? payment.stripeChargeId,
        failureReason: null,
        rawProviderData: jsonValue(input.providerData)
      }
    });
    const order = payment.pedido;
    if (!order || order.paymentStatus === "PAGO") return;

    await tx.pedido.update({
      where: { id: order.id },
      data: { status: "PAGO", paymentStatus: "PAGO", expiresAt: null, notes: JSON.stringify({ ...parseNotes(order.notes), statusVenda: "PAGO" }) }
    });
    for (const item of order.items) {
      if (!item.eventId || item.evento?.tipo === "CURSO") continue;
      await tx.ingresso.createMany({
        data: Array.from({ length: item.quantity }, (_, index) => ({
          customerId: order.customerId,
          eventoId: item.eventId!,
          orderId: order.id,
          preco: item.unitAmount / 100,
          qrcode: ticketQrCode(order.id, item.eventId!, index + 1),
          status: "PAGO",
          paymentStatus: "PAGO",
          paidAt
        })),
        skipDuplicates: true
      });
    }
    await tx.ingresso.updateMany({ where: { orderId: order.id }, data: { status: "PAGO", paymentStatus: "PAGO", paidAt } });
    await tx.inscricao.updateMany({ where: { orderId: order.id }, data: { status: "CONFIRMADA" } });
    if (order.loteIngresso) {
      await tx.loteIngressoAluno.update({ where: { id: order.loteIngresso.id }, data: { status: "PAGO", paymentStatus: "PAGO" } });
      await tx.ingressoAluno.updateMany({ where: { loteId: order.loteIngresso.id, tipo: "NORMAL" }, data: { status: "PAGO" } });
      await tx.historicoPagamento.create({ data: { loteId: order.loteIngresso.id, action: "PAGAMENTO_STRIPE_CONFIRMADO", toStatus: "PAGO", metadata: { paymentId: payment.id } } });
    }
    await tx.integrationOutbox.createMany({
      data: [
        { topic: "PAYMENT_CONFIRMED_EMAIL", deduplicationKey: `payment:${payment.id}:email`, payload: { orderId: order.id, paymentId: payment.id } },
        { topic: "PAYMENT_CONFIRMED_WHATSAPP", deduplicationKey: `payment:${payment.id}:whatsapp`, payload: { orderId: order.id, paymentId: payment.id } },
        { topic: "PAYMENT_CONFIRMED_N8N", deduplicationKey: `payment:${payment.id}:n8n`, payload: { orderId: order.id, paymentId: payment.id, origin: order.origin } }
      ],
      skipDuplicates: true
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function closeUnpaidPayment(paymentId: number, status: "FALHOU" | "EXPIRADO" | "CANCELADO", reason?: string) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.pagamento.findUnique({ where: { id: paymentId }, include: { pedido: { include: { loteIngresso: true } } } });
    if (!payment || ["PAGO", "ESTORNADO", "PARCIALMENTE_ESTORNADO"].includes(payment.status)) return;
    await tx.pagamento.update({ where: { id: paymentId }, data: { status, failureReason: reason?.slice(0, 180), expiresAt: new Date() } });
    if (!payment.pedido) return;
    await tx.pedido.update({ where: { id: payment.pedido.id }, data: { status, paymentStatus: status, expiresAt: new Date() } });
    await tx.ingresso.updateMany({ where: { orderId: payment.pedido.id, paymentStatus: { not: "PAGO" } }, data: { status: "CANCELADO", paymentStatus: status } });
    await tx.inscricao.updateMany({ where: { orderId: payment.pedido.id, status: "PENDENTE" }, data: { status: "CANCELADA" } });
    if (payment.pedido.loteIngresso) {
      const lotStatus = status === "EXPIRADO" ? "EXPIRADO" : "PENDENTE";
      await tx.loteIngressoAluno.update({ where: { id: payment.pedido.loteIngresso.id }, data: { status: lotStatus, paymentStatus: lotStatus } });
      await tx.ingressoAluno.updateMany({ where: { loteId: payment.pedido.loteIngresso.id, tipo: "NORMAL", status: "PENDENTE" }, data: { status: lotStatus } });
    }
  });
}

async function updateProcessing(paymentId: number, session: Stripe.Checkout.Session) {
  const status = mapStripeCheckoutStatus(session.status, session.payment_status);
  const intentId = expandableId(session.payment_intent);
  await prisma.$transaction(async (tx) => {
    const payment = await tx.pagamento.update({
      where: { id: paymentId },
      data: {
        status,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: intentId,
        stripeCustomerId: expandableId(session.customer),
        rawProviderData: jsonValue({ id: session.id, status: session.status, paymentStatus: session.payment_status })
      }
    });
    if (payment.pedidoId) await tx.pedido.updateMany({ where: { id: payment.pedidoId, paymentStatus: { not: "PAGO" } }, data: { status, paymentStatus: status } });
  });
}

async function updateRefund(refund: Stripe.Refund) {
  const intentId = expandableId(refund.payment_intent);
  const chargeId = expandableId(refund.charge);
  const payment = await findPayment({ metadata: refund.metadata, paymentIntentId: intentId, chargeId });
  if (!payment) return;
  const normalizedStatus = String(refund.status ?? "pending").toUpperCase();
  await prisma.$transaction(async (tx) => {
    await tx.paymentRefund.upsert({
      where: { stripeRefundId: refund.id },
      update: { status: normalizedStatus, amount: refund.amount, rawProviderData: jsonValue({ id: refund.id, status: refund.status, amount: refund.amount }), refundedAt: refund.status === "succeeded" ? new Date() : null },
      create: { pagamentoId: payment.id, stripeRefundId: refund.id, amount: refund.amount, currency: refund.currency, status: normalizedStatus, reason: refund.reason ?? "Atualizacao Stripe", stripeReason: refund.reason, rawProviderData: jsonValue({ id: refund.id, status: refund.status, amount: refund.amount }), refundedAt: refund.status === "succeeded" ? new Date() : null }
    });
    const totals = await tx.paymentRefund.aggregate({ where: { pagamentoId: payment.id, status: "SUCCEEDED" }, _sum: { amount: true } });
    const refundedAmount = totals._sum.amount ?? 0;
    const status = refundedAmount > 0 ? refundStatus(payment.amount, refundedAmount) : payment.status;
    await tx.pagamento.update({ where: { id: payment.id }, data: { status, stripeChargeId: chargeId ?? payment.stripeChargeId, refundedAmount, refundedAt: refundedAmount > 0 ? new Date() : payment.refundedAt } });
    if (payment.pedidoId && refundedAmount > 0) await tx.pedido.update({ where: { id: payment.pedidoId }, data: { status, paymentStatus: status } });
    await tx.auditLog.create({ data: { action: "REEMBOLSO_STRIPE_ATUALIZADO", entity: "Pagamento", entityId: String(payment.id), metadata: { stripeRefundId: refund.id, status: refund.status, amount: refund.amount } } });
  });
}

async function updateRefundedCharge(charge: Stripe.Charge) {
  const intentId = expandableId(charge.payment_intent);
  const payment = await findPayment({ paymentIntentId: intentId, chargeId: charge.id });
  if (!payment) return;
  const status = refundStatus(charge.amount, charge.amount_refunded);
  await prisma.$transaction(async (tx) => {
    await tx.pagamento.update({ where: { id: payment.id }, data: { status, stripeChargeId: charge.id, refundedAmount: charge.amount_refunded, refundedAt: new Date(), rawProviderData: jsonValue({ chargeId: charge.id, amount: charge.amount, amountRefunded: charge.amount_refunded }) } });
    if (payment.pedidoId) await tx.pedido.update({ where: { id: payment.pedidoId }, data: { status, paymentStatus: status } });
    if (status === "ESTORNADO" && payment.pedidoId) await tx.ingresso.updateMany({ where: { orderId: payment.pedidoId }, data: { status: "CANCELADO", paymentStatus: "ESTORNADO" } });
    await tx.auditLog.create({ data: { action: "CHARGE_STRIPE_REEMBOLSADA", entity: "Pagamento", entityId: String(payment.id), metadata: { chargeId: charge.id, refundedAmount: charge.amount_refunded, status } } });
  });
}

async function updateDispute(dispute: Stripe.Dispute, eventType: string) {
  const chargeId = expandableId(dispute.charge);
  const intentId = expandableId(dispute.payment_intent);
  const payment = await findPayment({ paymentIntentId: intentId, chargeId });
  if (!payment) return;
  const previous = payment.statusBeforeDispute ?? payment.status;
  const status = disputePaymentStatus(dispute.status, previous);
  await prisma.$transaction(async (tx) => {
    await tx.pagamento.update({
      where: { id: payment.id },
      data: {
        status,
        stripeChargeId: chargeId ?? payment.stripeChargeId,
        stripeDisputeId: dispute.id,
        disputeStatus: dispute.status,
        disputedAmount: dispute.amount,
        statusBeforeDispute: payment.statusBeforeDispute ?? payment.status,
        rawProviderData: jsonValue({ disputeId: dispute.id, status: dispute.status, amount: dispute.amount, reason: dispute.reason })
      }
    });
    if (payment.pedidoId) await tx.pedido.update({ where: { id: payment.pedidoId }, data: { status, paymentStatus: status } });
    await tx.auditLog.create({ data: { action: eventType.toUpperCase().replace(/\./g, "_"), entity: "Pagamento", entityId: String(payment.id), metadata: { disputeId: dispute.id, status: dispute.status, amount: dispute.amount, reason: dispute.reason } } });
    await tx.integrationOutbox.createMany({ data: [{ topic: "PAYMENT_DISPUTE_ADMIN", deduplicationKey: `dispute:${dispute.id}:${dispute.status}:admin`, payload: { paymentId: payment.id, orderId: payment.pedidoId, disputeId: dispute.id, status: dispute.status } }], skipDuplicates: true });
  });
}

async function processStripeEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const payment = await findPayment({ metadata: session.metadata, checkoutSessionId: session.id, paymentIntentId: expandableId(session.payment_intent) });
      if (!payment) return true;
      if (session.payment_status === "paid") await finalizePaidOrder({ paymentId: payment.id, providerData: { id: session.id, status: session.status, paymentStatus: session.payment_status }, stripeCheckoutSessionId: session.id, stripePaymentIntentId: expandableId(session.payment_intent) });
      else await updateProcessing(payment.id, session);
      return true;
    }
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const payment = await findPayment({ metadata: session.metadata, checkoutSessionId: session.id, paymentIntentId: expandableId(session.payment_intent) });
      if (payment) await finalizePaidOrder({ paymentId: payment.id, providerData: { id: session.id, status: session.status, paymentStatus: session.payment_status }, stripeCheckoutSessionId: session.id, stripePaymentIntentId: expandableId(session.payment_intent) });
      return true;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const payment = await findPayment({ metadata: session.metadata, checkoutSessionId: session.id, paymentIntentId: expandableId(session.payment_intent) });
      if (payment) await closeUnpaidPayment(payment.id, event.type === "checkout.session.expired" ? "EXPIRADO" : "FALHOU", event.type);
      return true;
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const payment = await findPayment({ metadata: intent.metadata, paymentIntentId: intent.id });
      if (payment) await finalizePaidOrder({ paymentId: payment.id, providerData: { id: intent.id, status: intent.status }, stripePaymentIntentId: intent.id, stripeChargeId: expandableId(intent.latest_charge) });
      return true;
    }
    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const payment = await findPayment({ metadata: intent.metadata, paymentIntentId: intent.id });
      if (payment) await closeUnpaidPayment(payment.id, event.type === "payment_intent.canceled" ? "CANCELADO" : "FALHOU", intent.last_payment_error?.code ?? event.type);
      return true;
    }
    case "charge.refunded":
      await updateRefundedCharge(event.data.object as Stripe.Charge);
      return true;
    case "charge.refund.updated":
      await updateRefund(event.data.object as Stripe.Refund);
      return true;
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
      await updateDispute(event.data.object as Stripe.Dispute, event.type);
      return true;
    default:
      return false;
  }
}

export const webhooksService = {
  constructStripeEvent(rawBody: Buffer, signature?: string) {
    if (!signature) throw new AppError("Assinatura do webhook ausente", 400, { code: "INVALID_WEBHOOK_SIGNATURE" });
    try { return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET); }
    catch { throw new AppError("Assinatura do webhook invalida", 400, { code: "INVALID_WEBHOOK_SIGNATURE" }); }
  },

  async stripe(event: Stripe.Event) {
    try {
      await prisma.paymentWebhookEvent.create({ data: { provider: "STRIPE", externalId: event.id, type: event.type, status: "RECEIVED", payload: eventSummary(event) } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    }
    const now = new Date();
    const staleClaim = new Date(now.getTime() - 5 * 60_000);
    const claimed = await prisma.paymentWebhookEvent.updateMany({
      where: {
        externalId: event.id,
        processedAt: null,
        OR: [
          { status: { in: ["RECEIVED", "FAILED"] }, processingAt: null },
          { status: "PROCESSING", processingAt: { lt: staleClaim } }
        ]
      },
      data: { status: "PROCESSING", processingAt: now, attempts: { increment: 1 }, error: null }
    });
    if (!webhookEventWasClaimed(claimed.count)) return { received: true, duplicate: true };
    try {
      const handled = await processStripeEvent(event);
      await prisma.paymentWebhookEvent.update({ where: { externalId: event.id }, data: { status: handled ? "PROCESSED" : "IGNORED", processedAt: new Date(), processingAt: null } });
      return { received: true, ignored: !handled };
    } catch (error) {
      await prisma.paymentWebhookEvent.update({ where: { externalId: event.id }, data: { status: "FAILED", error: safeError(error), processingAt: null } });
      throw error;
    }
  }
};
