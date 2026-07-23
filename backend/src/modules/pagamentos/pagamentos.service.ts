import { randomUUID } from "node:crypto";
import { Prisma, type SaleOrigin } from "@prisma/client";
import type Stripe from "stripe";
import type { z } from "zod";
import { env } from "../../env.js";
import { prisma } from "../../lib/prisma.js";
import { stripe } from "../../lib/stripe.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import { normalizeCpf } from "../pessoas/pessoas.service.js";
import type { cancelPaymentSchema, editPaymentSchema, manualSettlementSchema, pagamentoQuerySchema, refundPaymentSchema, whatsappCheckoutSchema } from "./pagamentos.schemas.js";

const RESERVATION_MINUTES = 30;
const MAX_TICKETS_PER_CUSTOMER_EVENT = 10;

type PaymentActor = {
  customerId?: number;
  userId?: string;
  admin?: boolean;
};

type AdminActor = {
  userId: string;
  colaboradorId: number;
  role: string;
  email: string;
  name: string;
};

type DynamicLineItem = {
  eventId: number;
  description: string;
  quantity: number;
  unitAmount: number;
};

function paymentError(code: string, message: string, statusCode: number, details?: unknown) {
  return new AppError(message, statusCode, { code, ...(details ? { details } : {}) });
}

export function toCents(value: number) {
  return Math.round(Number(value) * 100);
}

function fromCents(value: number) {
  return value / 100;
}

function eventPriceInCents(event: { preco: number; precoAntecipado: number | null; dataLimiteAntecipado: Date | null }, now = new Date()) {
  const value = event.precoAntecipado != null && event.dataLimiteAntecipado && event.dataLimiteAntecipado > now
    ? event.precoAntecipado
    : event.preco;
  return toCents(value);
}

function safeProviderMessage(error: unknown) {
  if (error && typeof error === "object" && "type" in error) return String((error as { type?: unknown }).type ?? "StripeError").slice(0, 120);
  return "StripeError";
}

function allowedActions(payment: { status: string; provider: string | null; stripePaymentIntentId: string | null }) {
  const unpaid = ["PENDENTE", "PROCESSANDO", "FALHOU", "EXPIRADO"].includes(payment.status);
  const refundable = ["PAGO", "PARCIALMENTE_ESTORNADO"].includes(payment.status);
  return {
    view: true,
    edit: payment.provider !== "STRIPE",
    manualSettlement: unpaid,
    replaceWithExternal: payment.provider === "STRIPE" && unpaid,
    refund: refundable && Boolean(payment.stripePaymentIntentId),
    cancel: unpaid,
    resendLink: payment.provider === "STRIPE" && unpaid
  };
}

function activeReservationWhere(now: Date, excludedOrderId?: number): Prisma.PedidoWhereInput {
  return {
    id: excludedOrderId ? { not: excludedOrderId } : undefined,
    status: { notIn: ["CANCELADO", "EXPIRADO", "FALHOU"] },
    OR: [
      { paymentStatus: "PAGO" },
      { paymentStatus: { in: ["PENDENTE", "PROCESSANDO"] }, expiresAt: null },
      { paymentStatus: { in: ["PENDENTE", "PROCESSANDO"] }, expiresAt: { gt: now } }
    ]
  };
}

export function isRetryableOrderStatus(status?: string | null) {
  return ["FALHOU", "CANCELADO", "EXPIRADO"].includes(status ?? "");
}

async function validateAndRepriceOrder(tx: Prisma.TransactionClient, orderId: number) {
  const now = new Date();
  const order = await tx.pedido.findUnique({
    where: { id: orderId },
    include: { customer: true, evento: true, items: { include: { evento: true } }, loteIngresso: true }
  });
  if (!order) throw paymentError("ORDER_NOT_FOUND", "Pedido nao encontrado", 404);
  if (order.paymentStatus === "PAGO") throw paymentError("ORDER_ALREADY_PAID", "Pedido ja esta pago", 409);
  if (!order.customer.email) throw paymentError("INVALID_ORDER_STATUS", "Cliente sem e-mail para o checkout", 422);
  if (!order.items.length) throw paymentError("INVALID_ORDER_STATUS", "Pedido sem itens", 409);
  if (order.loteIngresso && (order.loteIngresso.status === "CANCELADO" || (order.loteIngresso.dueDate && order.loteIngresso.dueDate <= now))) {
    throw paymentError("LOT_NOT_AVAILABLE", "Lote indisponivel para pagamento", 409, { lotId: order.loteIngresso.id });
  }

  const lines: DynamicLineItem[] = [];
  for (const item of order.items) {
    const event = item.evento ?? order.evento;
    if (!event || event.status !== "ATIVO" || event.data <= now || (event.dataLimiteInscricao && event.dataLimiteInscricao <= now)) {
      throw paymentError("EVENT_NOT_AVAILABLE", "Evento indisponivel para venda", 409, { eventId: item.eventId });
    }
    if (item.quantity < 1 || (!order.loteIngresso && item.quantity > MAX_TICKETS_PER_CUSTOMER_EVENT)) {
      throw paymentError("INVALID_ORDER_STATUS", "Quantidade de ingressos invalida", 422, { eventId: event.id });
    }

    const [reserved, customerQuantity] = await Promise.all([
      tx.pedidoItem.aggregate({
        where: { eventId: event.id, order: activeReservationWhere(now, order.id) },
        _sum: { quantity: true }
      }),
      tx.pedidoItem.aggregate({
        where: {
          eventId: event.id,
          order: { ...activeReservationWhere(now, order.id), customerId: order.customerId }
        },
        _sum: { quantity: true }
      })
    ]);
    if (event.capacidade != null && (reserved._sum.quantity ?? 0) + item.quantity > event.capacidade) {
      throw paymentError("INSUFFICIENT_CAPACITY", "Quantidade indisponivel", 409, { eventId: event.id });
    }
    if (!order.loteIngresso && (customerQuantity._sum.quantity ?? 0) + item.quantity > MAX_TICKETS_PER_CUSTOMER_EVENT) {
      throw paymentError("INSUFFICIENT_CAPACITY", "Limite de ingressos por cliente excedido", 409, { eventId: event.id });
    }

    const unitAmount = order.loteIngresso && item.ticketLotId === order.loteIngresso.id
      ? toCents(Number(order.loteIngresso.valorUnitario))
      : eventPriceInCents(event, now);
    lines.push({ eventId: event.id, description: item.description, quantity: item.quantity, unitAmount });
    await tx.pedidoItem.update({
      where: { id: item.id },
      data: { eventId: event.id, unitAmount, totalAmount: unitAmount * item.quantity, unitPrice: fromCents(unitAmount), total: fromCents(unitAmount * item.quantity) }
    });
  }

  const amount = lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0);
  if (amount <= 0) throw paymentError("INVALID_ORDER_STATUS", "Pedido sem valor para cobranca", 409);
  const expiresAt = new Date(now.getTime() + RESERVATION_MINUTES * 60_000);
  const updated = await tx.pedido.update({
    where: { id: order.id },
    data: {
      totalAmount: amount,
      total: fromCents(amount),
      status: "PENDENTE",
      paymentStatus: "PENDENTE",
      paymentMethod: "STRIPE",
      expiresAt
    }
  });
  if (order.loteIngresso) {
    await tx.loteIngressoAluno.update({ where: { id: order.loteIngresso.id }, data: { status: "PENDENTE", paymentStatus: "PENDENTE", paymentUrl: null } });
  }
  return { order: { ...order, ...updated }, lines, amount, expiresAt };
}

async function createStripeAttempt(orderId: number, origin: SaleOrigin, actor: PaymentActor) {
  const prepared = await prisma.$transaction(async (tx) => {
    const current = await tx.pedido.findUnique({ where: { id: orderId } });
    if (!current) throw paymentError("ORDER_NOT_FOUND", "Pedido nao encontrado", 404);
    if (!actor.admin && (current.customerId !== actor.customerId || (actor.userId && current.userId !== actor.userId))) {
      throw paymentError("ORDER_NOT_FOUND", "Pedido nao encontrado", 404);
    }
    const activeAttempt = await tx.pagamento.findFirst({
      where: { pedidoId: orderId, status: { in: ["PENDENTE", "PROCESSANDO"] }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
    });
    if (activeAttempt) throw paymentError("INVALID_ORDER_STATUS", "Pedido ja possui uma tentativa de pagamento ativa", 409, { paymentId: activeAttempt.id });
    const validated = await validateAndRepriceOrder(tx, orderId);
    const firstEventId = validated.lines[0]?.eventId;
    if (!firstEventId) throw paymentError("INVALID_ORDER_STATUS", "Pedido sem evento", 409);
    const enrollment = await tx.inscricao.findFirst({ where: { orderId } });
    const payment = await tx.pagamento.create({
      data: {
        pedidoId: orderId,
        customerId: validated.order.customerId,
        eventoId: firstEventId,
        inscricaoId: enrollment?.id,
        nomeCustomer: validated.order.customer.nome,
        cpfCustomer: validated.order.customer.cpf,
        valor: fromCents(validated.amount),
        amount: validated.amount,
        currency: env.STRIPE_CURRENCY,
        provider: "STRIPE",
        status: "PENDENTE",
        expiresAt: validated.expiresAt
      }
    });
    await tx.pedido.update({ where: { id: orderId }, data: { origin } });
    return { ...validated, payment };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const metadata: Record<string, string> = {
    orderId: String(orderId),
    paymentId: String(prepared.payment.id),
    customerId: String(prepared.order.customerId),
    origin,
    orderType: prepared.order.type
  };
  if (prepared.order.eventId) metadata.eventId = String(prepared.order.eventId);
  if (prepared.order.loteIngresso?.id) metadata.lotId = String(prepared.order.loteIngresso.id);
  if (prepared.payment.inscricaoId) metadata.registrationId = String(prepared.payment.inscricaoId);
  const course = prepared.order.items.find((item) => item.evento?.tipo === "CURSO");
  if (course?.eventId) metadata.courseId = String(course.eventId);

  try {
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: prepared.lines.map((line) => ({
        price_data: {
          currency: env.STRIPE_CURRENCY,
          unit_amount: line.unitAmount,
          product_data: { name: line.description.slice(0, 120), description: `Pedido ${prepared.order.code}` }
        },
        quantity: line.quantity
      })),
      customer_email: prepared.order.customer.email ?? undefined,
      client_reference_id: String(orderId),
      metadata,
      payment_intent_data: { metadata },
      success_url: `${env.FRONTEND_URL}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/checkout/cancelado?orderId=${orderId}`,
      expires_at: Math.floor(prepared.expiresAt.getTime() / 1000)
    };
    const session = await stripe.checkout.sessions.create(params, { idempotencyKey: `checkout-payment-${prepared.payment.id}` });
    if (!session.url) throw new Error("Checkout Session sem URL");
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    const payment = await prisma.pagamento.update({
      where: { id: prepared.payment.id },
      data: {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
        checkoutUrl: session.url,
        rawProviderData: { id: session.id, status: session.status, paymentStatus: session.payment_status }
      }
    });
    return { orderId, paymentId: payment.id, checkoutSessionId: session.id, checkoutUrl: session.url, status: payment.status };
  } catch (error) {
    const failureReason = safeProviderMessage(error);
    await prisma.$transaction([
      prisma.pagamento.update({ where: { id: prepared.payment.id }, data: { status: "FALHOU", failureReason } }),
      prisma.pedido.update({ where: { id: orderId }, data: { status: "FALHOU", paymentStatus: "FALHOU", expiresAt: new Date() } })
    ]);
    throw paymentError("CHECKOUT_CREATION_FAILED", "Nao foi possivel iniciar o pagamento", 503);
  }
}

export function buildPaymentShareText(data: { nome: string; descricao: string; valor: number; checkoutUrl: string }) {
  return [
    `Ola, ${data.nome}!`,
    `Segue o link de pagamento do Coracao Gaucho para ${data.descricao}.`,
    `Valor: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.valor)}`,
    data.checkoutUrl
  ].join("\n");
}

export const pagamentosService = {
  async listar(query: z.infer<typeof pagamentoQuerySchema>) {
    const createdAt = query.dataInicio || query.dataFim
      ? { gte: query.dataInicio, lte: query.dataFim }
      : undefined;
    const where: Prisma.PagamentoWhereInput = {
      status: query.status,
      provider: query.provider,
      method: query.forma,
      eventoId: query.eventoId ?? query.cursoId,
      customerId: query.customerId,
      cpfCustomer: query.cpf ? { contains: normalizeCpf(query.cpf), mode: "insensitive" } : undefined,
      nomeCustomer: query.nome ? { contains: query.nome, mode: "insensitive" } : undefined,
      pedido: {
        code: query.codigo ? { contains: query.codigo, mode: "insensitive" } : undefined,
        origin: query.origem,
        items: query.item ? { some: { description: { contains: query.item, mode: "insensitive" } } } : undefined
      },
      createdAt,
      ...(query.search ? {
        OR: [
          { nomeCustomer: { contains: query.search, mode: "insensitive" } },
          { evento: { nome: { contains: query.search, mode: "insensitive" } } },
          { pedido: { code: { contains: query.search, mode: "insensitive" } } },
          { gatewayId: { contains: query.search, mode: "insensitive" } },
          { externalReference: { contains: query.search, mode: "insensitive" } },
          ...(normalizeCpf(query.search) ? [{ cpfCustomer: { contains: normalizeCpf(query.search), mode: "insensitive" as const } }] : [])
        ]
      } : {})
    };
    const [data, total] = await Promise.all([
      prisma.pagamento.findMany({
        where,
        ...getPagination(query),
        include: {
          customer: true,
          evento: true,
          inscricao: true,
          pedido: { include: { items: true, loteIngresso: true } },
          refunds: { orderBy: { createdAt: "desc" } }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.pagamento.count({ where })
    ]);
    return {
      data: data.map((payment) => ({ ...payment, allowedActions: allowedActions(payment) })),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      total,
      page: query.page,
      limit: query.limit
    };
  },

  async buscar(id: number) {
    const payment = await prisma.pagamento.findUnique({ where: { id }, include: { customer: true, evento: true, inscricao: true, pedido: { include: { items: true, ingressos: true, inscricoes: true, loteIngresso: { include: { tickets: true } } } }, refunds: true, replacedPayment: true, replacementPayment: true } });
    if (!payment) throw paymentError("ORDER_NOT_FOUND", "Pagamento nao encontrado", 404);
    return { ...payment, allowedActions: allowedActions(payment) };
  },

  async edit(id: number, actor: AdminActor, data: z.infer<typeof editPaymentSchema>) {
    const current = await prisma.pagamento.findUnique({ where: { id } });
    if (!current) throw paymentError("ORDER_NOT_FOUND", "Pagamento nao encontrado", 404);
    if (current.provider === "STRIPE") {
      throw paymentError("INVALID_PAYMENT_PROVIDER", "Dados financeiros da Stripe nao podem ser editados manualmente", 409);
    }
    const paid = data.status === "PAGO";
    await prisma.$transaction(async (tx) => {
      await tx.pagamento.update({
        where: { id },
        data: {
          method: data.method,
          status: data.status,
          amount: data.amount,
          valor: data.amount / 100,
          paidAt: paid ? data.paidAt ?? current.paidAt ?? new Date() : null,
          externalReference: data.reference,
          notes: data.observation
        }
      });
      if (current.pedidoId) {
        await tx.pedido.update({
          where: { id: current.pedidoId },
          data: { status: data.status, paymentStatus: data.status, paymentMethod: data.method }
        });
        await tx.ingresso.updateMany({
          where: { orderId: current.pedidoId },
          data: { status: paid ? "PAGO" : data.status, paymentStatus: data.status, paidAt: paid ? data.paidAt ?? current.paidAt ?? new Date() : null }
        });
      }
      if (current.inscricaoId) {
        await tx.inscricao.update({ where: { id: current.inscricaoId }, data: { status: paid ? "CONFIRMADA" : data.status === "CANCELADO" ? "CANCELADA" : "PENDENTE" } });
      }
      await tx.auditLog.create({
        data: {
          action: "PAGAMENTO_EDITADO",
          entity: "Pagamento",
          entityId: String(id),
          colaboradorId: actor.colaboradorId,
          metadata: {
            reason: data.reason,
            previous: { method: current.method, status: current.status, amount: current.amount, paidAt: current.paidAt },
            next: { method: data.method, status: data.status, amount: data.amount, paidAt: data.paidAt },
            orderId: current.pedidoId
          }
        }
      });
    });
    return this.buscar(id);
  },

  createCheckoutForOrder(orderId: number, origin: SaleOrigin, actor: PaymentActor) {
    return createStripeAttempt(orderId, origin, actor);
  },

  async retry(orderId: number, actor: PaymentActor) {
    const order = await prisma.pedido.findFirst({ where: { id: orderId, ...(actor.admin ? {} : { customerId: actor.customerId, userId: actor.userId }) } });
    if (!order) throw paymentError("ORDER_NOT_FOUND", "Pedido nao encontrado", 404);
    if (order.paymentStatus === "PAGO") throw paymentError("ORDER_ALREADY_PAID", "Pedido ja esta pago", 409);
    if (!isRetryableOrderStatus(order.paymentStatus ?? order.status)) {
      throw paymentError("INVALID_ORDER_STATUS", "Pedido ainda possui uma tentativa ativa", 409);
    }
    return createStripeAttempt(orderId, "SITE", actor);
  },

  async status(orderId: number, actor: PaymentActor) {
    const order = await prisma.pedido.findFirst({
      where: { id: orderId, ...(actor.admin ? {} : { customerId: actor.customerId, userId: actor.userId }) },
      include: { pagamentos: { orderBy: { createdAt: "desc" }, take: 1 } }
    });
    if (!order) throw paymentError("ORDER_NOT_FOUND", "Pedido nao encontrado", 404);
    const attempt = order.pagamentos[0];
    return {
      orderId: order.id,
      orderStatus: order.status,
      paymentStatus: attempt?.status ?? order.paymentStatus ?? order.status,
      checkoutStatus: attempt?.status === "EXPIRADO" ? "expired" : attempt?.status === "PAGO" ? "complete" : attempt?.status === "PROCESSANDO" ? "processing" : "open",
      paidAt: attempt?.paidAt ?? null,
      paymentId: attempt?.id ?? null
    };
  },

  async createWhatsappOrder(data: z.infer<typeof whatsappCheckoutSchema>) {
    const customer = await prisma.customer.upsert({
      where: { cpf: data.customer.cpf },
      update: { nome: data.customer.name, email: data.customer.email, telefone: data.customer.phone },
      create: { nome: data.customer.name, cpf: data.customer.cpf, email: data.customer.email, telefone: data.customer.phone }
    });
    const event = await prisma.evento.findUnique({ where: { id: data.eventId } });
    if (!event || event.status !== "ATIVO" || event.data <= new Date()) throw paymentError("EVENT_NOT_AVAILABLE", "Evento indisponivel", 409);
    const unitAmount = eventPriceInCents(event);
    const totalAmount = unitAmount * data.quantity;
    const order = await prisma.pedido.create({
      data: {
        code: `WPP-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
        type: "EVENT",
        customerId: customer.id,
        eventId: event.id,
        status: "PENDENTE",
        paymentStatus: "PENDENTE",
        paymentMethod: "STRIPE",
        total: fromCents(totalAmount),
        totalAmount,
        origin: "WHATSAPP",
        notes: JSON.stringify({ source: "WHATSAPP_CHECKOUT" }),
        items: { create: [{ eventId: event.id, description: `${event.tipo} - ${event.nome}`, quantity: data.quantity, unitPrice: fromCents(unitAmount), total: fromCents(totalAmount), unitAmount, totalAmount }] }
      }
    });
    if (totalAmount === 0) {
      try {
        await prisma.$transaction(async (tx) => {
          const current = await tx.evento.findUnique({ where: { id: event.id } });
          const reserved = await tx.pedidoItem.aggregate({ where: { eventId: event.id, order: activeReservationWhere(new Date(), order.id) }, _sum: { quantity: true } });
          if (!current || current.status !== "ATIVO" || (current.capacidade != null && (reserved._sum.quantity ?? 0) + data.quantity > current.capacidade)) {
            throw paymentError("INSUFFICIENT_CAPACITY", "Quantidade indisponivel", 409, { eventId: event.id });
          }
          await tx.pedido.update({ where: { id: order.id }, data: { status: "PAGO", paymentStatus: "PAGO", paymentMethod: "GRATUITO" } });
          if (event.tipo === "CURSO") {
            await tx.inscricao.upsert({
              where: { customerId_eventoId: { customerId: customer.id, eventoId: event.id } },
              update: { orderId: order.id, status: "CONFIRMADA", quantidadeParticipantes: data.quantity },
              create: { customerId: customer.id, eventoId: event.id, orderId: order.id, status: "CONFIRMADA", quantidadeParticipantes: data.quantity }
            });
          } else {
            await tx.ingresso.createMany({
              data: Array.from({ length: data.quantity }, () => ({ customerId: customer.id, eventoId: event.id, orderId: order.id, preco: 0, qrcode: `TKT-${randomUUID()}`, status: "PAGO", paymentStatus: "PAGO", paidAt: new Date() })),
              skipDuplicates: true
            });
          }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return { orderId: order.id, paymentId: null, checkoutSessionId: null, checkoutUrl: null, status: "PAGO" as const };
      } catch (error) {
        await prisma.pedido.update({ where: { id: order.id }, data: { status: "FALHOU", paymentStatus: "FALHOU", expiresAt: new Date() } });
        throw error;
      }
    }
    try {
      return await createStripeAttempt(order.id, "WHATSAPP", { customerId: customer.id });
    } catch (error) {
      await prisma.pedido.update({ where: { id: order.id }, data: { status: "FALHOU", paymentStatus: "FALHOU", expiresAt: new Date() } });
      throw error;
    }
  },

  async cancel(id: number, actor: AdminActor, data: z.infer<typeof cancelPaymentSchema>) {
    const payment = await this.buscar(id);
    if (["PAGO", "PARCIALMENTE_ESTORNADO", "ESTORNADO", "CONTESTADO", "CONTESTACAO_PERDIDA"].includes(payment.status)) {
      throw paymentError("ORDER_ALREADY_PAID", "Pagamento confirmado nao pode ser cancelado; use o fluxo de reembolso", 409);
    }
    if (payment.stripeCheckoutSessionId) {
      try {
        const session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId);
        if (session.payment_status === "paid") throw paymentError("ORDER_ALREADY_PAID", "Pagamento ja confirmado", 409);
        if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw paymentError("PAYMENT_PROVIDER_UNAVAILABLE", "Nao foi possivel cancelar a sessao de pagamento", 503);
      }
    }
    if (payment.stripePaymentIntentId) {
      try {
        const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
        if (intent.status === "succeeded") throw paymentError("ORDER_ALREADY_PAID", "Pagamento ja confirmado", 409);
        if (["requires_payment_method", "requires_confirmation", "requires_action", "requires_capture", "processing"].includes(intent.status)) {
          await stripe.paymentIntents.cancel(intent.id);
        }
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw paymentError("PAYMENT_PROVIDER_UNAVAILABLE", "Nao foi possivel cancelar o PaymentIntent", 503);
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.pagamento.update({ where: { id }, data: { status: "CANCELADO", expiresAt: new Date(), failureReason: data.reason } });
      if (payment.pedidoId) await tx.pedido.update({ where: { id: payment.pedidoId }, data: { status: "CANCELADO", paymentStatus: "CANCELADO", expiresAt: new Date() } });
      await tx.auditLog.create({ data: { action: "PAGAMENTO_CANCELADO", entity: "Pagamento", entityId: String(id), colaboradorId: actor.colaboradorId, metadata: { reason: data.reason, orderId: payment.pedidoId } } });
    });
    return this.buscar(id);
  },

  async settleExternally(id: number, actor: AdminActor, data: z.infer<typeof manualSettlementSchema>) {
    const payment = await this.buscar(id);
    if (!["PENDENTE", "PROCESSANDO", "FALHOU", "EXPIRADO"].includes(payment.status)) {
      throw paymentError("INVALID_ORDER_STATUS", "Somente cobrancas nao pagas podem receber baixa externa", 409);
    }
    if (payment.stripeCheckoutSessionId) {
      const session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId);
      if (session.payment_status === "paid") throw paymentError("ORDER_ALREADY_PAID", "A Stripe ja confirmou este pagamento", 409);
      if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
    }
    if (payment.stripePaymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
      if (intent.status === "succeeded") throw paymentError("ORDER_ALREADY_PAID", "A Stripe ja confirmou este pagamento", 409);
      if (["requires_payment_method", "requires_confirmation", "requires_action", "requires_capture", "processing"].includes(intent.status)) {
        await stripe.paymentIntents.cancel(intent.id);
      }
    }
    const amount = data.amount ?? payment.amount;
    if (amount !== payment.amount) throw paymentError("INVALID_PAYMENT_AMOUNT", "A baixa parcial ainda nao e suportada", 422);

    return prisma.$transaction(async (tx) => {
      await tx.pagamento.update({
        where: { id },
        data: { status: "CANCELADO", expiresAt: new Date(), failureReason: `SUBSTITUIDO_POR_PAGAMENTO_EXTERNO: ${data.reason}` }
      });
      const manual = await tx.pagamento.create({
        data: {
          inscricaoId: payment.inscricaoId,
          pedidoId: payment.pedidoId,
          customerId: payment.customerId,
          eventoId: payment.eventoId,
          nomeCustomer: payment.nomeCustomer,
          cpfCustomer: payment.cpfCustomer,
          valor: amount / 100,
          amount,
          currency: payment.currency,
          status: "PAGO",
          provider: "EXTERNO",
          method: data.method,
          externalReference: data.reference,
          notes: data.observation,
          replacedPaymentId: id,
          paidAt: data.paidAt,
          gatewayId: `MANUAL-${randomUUID()}`,
          rawProviderData: { source: "MANUAL", method: data.method, reason: data.reason, replacedPaymentId: id }
        }
      });
      if (payment.pedidoId) {
        await tx.pedido.update({ where: { id: payment.pedidoId }, data: { status: "PAGO", paymentStatus: "PAGO", paymentMethod: data.method, expiresAt: null } });
        await tx.ingresso.updateMany({ where: { orderId: payment.pedidoId }, data: { status: "PAGO", paymentStatus: "PAGO", paidAt: data.paidAt } });
        const lote = await tx.loteIngressoAluno.findUnique({ where: { pedidoId: payment.pedidoId } });
        if (lote) {
          await tx.loteIngressoAluno.update({ where: { id: lote.id }, data: { status: "PAGO", paymentStatus: "PAGO" } });
          await tx.ingressoAluno.updateMany({ where: { loteId: lote.id, tipo: "NORMAL" }, data: { status: "PAGO" } });
        }
      }
      if (payment.inscricaoId) await tx.inscricao.update({ where: { id: payment.inscricaoId }, data: { status: "CONFIRMADA" } });
      await tx.auditLog.create({ data: { action: "PAGAMENTO_BAIXA_EXTERNA", entity: "Pagamento", entityId: String(manual.id), colaboradorId: actor.colaboradorId, metadata: { replacedPaymentId: id, method: data.method, amount, reason: data.reason } } });
      return manual;
    });
  },

  async refund(id: number, actor: AdminActor, data: z.infer<typeof refundPaymentSchema>) {
    const payment = await prisma.pagamento.findUnique({ where: { id }, include: { refunds: true } });
    if (!payment) throw paymentError("ORDER_NOT_FOUND", "Pagamento nao encontrado", 404);
    if (!payment.stripePaymentIntentId || !["PAGO", "PARCIALMENTE_ESTORNADO"].includes(payment.status)) {
      throw paymentError("INVALID_ORDER_STATUS", "Pagamento nao esta disponivel para reembolso", 409);
    }
    const remaining = payment.amount - payment.refundedAmount;
    const amount = data.amount ?? remaining;
    if (amount <= 0 || amount > remaining) throw paymentError("INVALID_REFUND_AMOUNT", "Valor de reembolso invalido", 422, { remaining });

    const localRefund = await prisma.paymentRefund.create({
      data: {
        pagamentoId: payment.id,
        amount,
        currency: payment.currency,
        reason: data.reason,
        stripeReason: data.stripeReason,
        requestedById: actor.colaboradorId
      }
    });
    try {
      const refund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount,
        reason: data.stripeReason,
        metadata: { paymentId: String(payment.id), orderId: String(payment.pedidoId ?? ""), refundId: localRefund.id }
      }, { idempotencyKey: `payment-refund-${localRefund.id}` });
      const succeeded = refund.status === "succeeded";
      const refundedAmount = succeeded ? payment.refundedAmount + refund.amount : payment.refundedAmount;
      const nextStatus = succeeded ? (refundedAmount >= payment.amount ? "ESTORNADO" : "PARCIALMENTE_ESTORNADO") : payment.status;
      await prisma.$transaction(async (tx) => {
        await tx.paymentRefund.update({
          where: { id: localRefund.id },
          data: { stripeRefundId: refund.id, status: String(refund.status ?? "pending").toUpperCase(), rawProviderData: { id: refund.id, status: refund.status, amount: refund.amount }, refundedAt: succeeded ? new Date() : null }
        });
        await tx.pagamento.update({ where: { id: payment.id }, data: { status: nextStatus, refundedAmount, refundedAt: succeeded ? new Date() : payment.refundedAt } });
        if (payment.pedidoId && succeeded) await tx.pedido.update({ where: { id: payment.pedidoId }, data: { status: nextStatus, paymentStatus: nextStatus } });
        await tx.auditLog.create({ data: { action: "REEMBOLSO_STRIPE_SOLICITADO", entity: "Pagamento", entityId: String(payment.id), colaboradorId: actor.colaboradorId, metadata: { refundId: localRefund.id, stripeRefundId: refund.id, amount, reason: data.reason, status: refund.status } } });
      });
      return { success: true, data: { paymentId: payment.id, refundId: localRefund.id, stripeRefundId: refund.id, amount, currency: payment.currency, status: refund.status } };
    } catch (error) {
      const failureReason = safeProviderMessage(error);
      await prisma.paymentRefund.update({ where: { id: localRefund.id }, data: { status: "FALHOU", failureReason } });
      throw paymentError("PAYMENT_PROVIDER_UNAVAILABLE", "Nao foi possivel solicitar o reembolso", 503);
    }
  }
};
