import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { env } from "../../env.js";
import { timingSafeEqual } from "node:crypto";

function secretsMatch(received?: string) {
  if (!env.ABACATEPAY_WEBHOOK_SECRET || !received) return false;
  const expectedBuffer = Buffer.from(env.ABACATEPAY_WEBHOOK_SECRET);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function readExternalId(payload: Record<string, unknown>) {
  const data = payload.data as Record<string, unknown> | undefined;
  return String(payload.id ?? payload.billingId ?? payload.externalId ?? data?.id ?? data?.billingId ?? "");
}

function readStatus(payload: Record<string, unknown>) {
  const data = payload.data as Record<string, unknown> | undefined;
  const status = String(payload.status ?? payload.event ?? data?.status ?? "").toUpperCase();
  if (["PAID", "PAGO", "PAYMENT_CONFIRMED", "BILLING_PAID", "PAID_BILLING"].includes(status)) return "PAGO";
  if (["FAILED", "FALHOU", "CANCELED", "CANCELADO", "EXPIRED"].includes(status)) return "FALHOU";
  if (["REFUNDED", "ESTORNADO"].includes(status)) return "ESTORNADO";
  if (["PENDING", "PENDENTE", "CREATED", "BILLING_CREATED"].includes(status)) return "PENDENTE";
  return null;
}

function tryParseJson(value?: string | null) {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readMetadata(payload: Record<string, unknown>, pagamentoRaw?: string | null) {
  const data = payload.data as Record<string, unknown> | undefined;
  const currentRaw = tryParseJson(pagamentoRaw);
  const request = currentRaw.request as Record<string, unknown> | undefined;
  return {
    ...(request?.metadata as Record<string, unknown> | undefined),
    ...(payload.metadata as Record<string, unknown> | undefined),
    ...(data?.metadata as Record<string, unknown> | undefined)
  };
}

export const webhooksService = {
  async abacatePay(payload: Record<string, unknown>, receivedSecret?: string) {
    if (env.NODE_ENV === "production" && !env.ABACATEPAY_WEBHOOK_SECRET) {
      throw new AppError("Webhook secret nao configurado", 503);
    }
    if (env.ABACATEPAY_WEBHOOK_SECRET && !secretsMatch(receivedSecret)) {
      throw new AppError("Webhook secret inválido", 401);
    }

    const externalId = readExternalId(payload);

    if (!externalId) {
      return { received: true, ignored: true, reason: "externalId ausente" };
    }

    const pagamento = await prisma.pagamento.findUnique({ where: { gatewayId: externalId } });
    if (!pagamento) return { received: true, ignored: true, reason: "pagamento não encontrado" };

    const status = readStatus(payload);
    const metadata = readMetadata(payload, pagamento.rawWebhook);

    if (!status) {
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { rawWebhook: JSON.stringify(payload) }
      });
      return { received: true, ignored: true, reason: "evento desconhecido" };
    }

    await prisma.pagamento.update({
      where: { id: pagamento.id },
      data: {
        status,
        paidAt: status === "PAGO" ? new Date() : pagamento.paidAt,
        rawWebhook: JSON.stringify(payload)
      }
    });

    if (status === "PAGO") {
      await prisma.ingresso.updateMany({
        where: { customerId: pagamento.customerId, eventoId: pagamento.eventoId },
        data: { status: "PAGO", paymentStatus: "PAGO", paidAt: new Date() }
      });
      if (pagamento.inscricaoId) {
        await prisma.inscricao.update({ where: { id: pagamento.inscricaoId }, data: { status: "CONFIRMADA" } });
      }
      if (metadata.pedidoId) {
        const pedidoId = Number(metadata.pedidoId);
        const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId }, include: { items: { include: { evento: true } } } });
        if (!pedido) throw new AppError("Pedido do webhook nao encontrado", 404);
        const pedidoMetadata = tryParseJson(pedido?.notes);
        await prisma.pedido.update({
          where: { id: pedidoId },
          data: {
            status: "PAGO",
            paymentStatus: "PAGO",
            notes: JSON.stringify({ ...pedidoMetadata, statusVenda: "PAGO" })
          }
        });
        for (const item of pedido.items) {
          if (!item.eventId || item.evento?.tipo === "CURSO") continue;
          await prisma.ingresso.createMany({
            data: Array.from({ length: item.quantity }, (_, index) => ({
              customerId: pedido.customerId,
              eventoId: item.eventId!,
              orderId: pedido.id,
              preco: Number(item.unitPrice),
              qrcode: `TKT-${pedido.id}-${item.eventId}-${index + 1}`,
              status: "PAGO",
              paymentStatus: "PAGO",
              paidAt: new Date()
            })),
            skipDuplicates: true
          });
        }
        await prisma.ingresso.updateMany({
          where: { orderId: pedidoId },
          data: { status: "PAGO", paymentStatus: "PAGO", paidAt: new Date() }
        });
        await prisma.inscricao.updateMany({
          where: { orderId: pedidoId },
          data: { status: "CONFIRMADA" }
        });
      }
      if (metadata.loteId) {
        const loteId = Number(metadata.loteId);
        await prisma.loteIngressoAluno.update({
          where: { id: loteId },
          data: {
            status: "PAGO",
            paymentStatus: "PAGO"
          }
        });
        await prisma.ingressoAluno.updateMany({
          where: { loteId, tipo: "NORMAL" },
          data: { status: "PAGO" }
        });
      }
    }

    if (metadata.pedidoId && status !== "PAGO") {
      const pedidoId = Number(metadata.pedidoId);
      const orderStatus = status === "PENDENTE" ? "PENDENTE" : status;
      await prisma.pedido.updateMany({ where: { id: pedidoId }, data: { status: orderStatus, paymentStatus: status } });
      if (status === "FALHOU" || status === "ESTORNADO") {
        await prisma.ingresso.updateMany({ where: { orderId: pedidoId }, data: { status: "CANCELADO", paymentStatus: status } });
        await prisma.inscricao.updateMany({ where: { orderId: pedidoId, status: "PENDENTE" }, data: { status: "CANCELADA" } });
      }
    }

    return { received: true, updated: true, status };
  }
};
