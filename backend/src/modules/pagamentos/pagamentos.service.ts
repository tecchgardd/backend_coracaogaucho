import { Prisma } from "@prisma/client";
import { abacatePay } from "../../lib/abacatepay.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { criarCobrancaSchema, pagamentoQuerySchema } from "./pagamentos.schemas.js";

function nestedData(response: Record<string, unknown>) {
  return typeof response.data === "object" && response.data !== null
    ? (response.data as Record<string, unknown>)
    : {};
}

function pickExternalId(response: Record<string, unknown>) {
  const data = nestedData(response);
  return String(response.id ?? response.externalId ?? data.id ?? data.billingId ?? "");
}

function pickCheckoutUrl(response: Record<string, unknown>) {
  const data = nestedData(response);
  return String(response.checkoutUrl ?? response.url ?? data.checkoutUrl ?? data.url ?? "");
}

function toCents(value: number) {
  return Math.round(Number(value) * 100);
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
    const where: Prisma.PagamentoWhereInput = {
      status: query.status,
      customerId: query.customerId
    };
    const [data, total] = await Promise.all([
      prisma.pagamento.findMany({
        where,
        ...getPagination(query),
        include: { customer: true, evento: true, inscricao: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.pagamento.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const pagamento = await prisma.pagamento.findUnique({
      where: { id },
      include: { customer: true, evento: true, inscricao: true }
    });
    if (!pagamento) throw new AppError("Pagamento nao encontrado", 404);
    return pagamento;
  },

  async criarCobranca(data: z.infer<typeof criarCobrancaSchema>) {
    const externalId = String(data.metadata.externalId ?? data.metadata.pedidoId ?? data.metadata.loteId ?? `pagamento-${Date.now()}`);
    const response = await abacatePay.criarCobranca({
      frequency: "ONE_TIME",
      methods: data.metodos,
      description: data.descricao,
      products: data.itens.length
        ? data.itens
        : [{
            externalId,
            name: data.descricao ?? "Pagamento Coracao Gaucho",
            description: data.descricao ?? "Pagamento Coracao Gaucho",
            quantity: 1,
            price: toCents(data.valor)
          }],
      externalId,
      metadata: data.metadata,
      allowCoupons: false
    });

    const raw = response as Record<string, unknown>;
    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new AppError("Customer nao encontrado", 404);

    return prisma.pagamento.create({
      data: {
        customerId: data.customerId,
        eventoId: data.eventoId,
        inscricaoId: data.inscricaoId,
        nomeCustomer: customer.nome,
        cpfCustomer: customer.cpf,
        valor: data.valor,
        gatewayId: pickExternalId(raw) || undefined,
        checkoutUrl: pickCheckoutUrl(raw),
        rawWebhook: JSON.stringify({ request: data, response: raw })
      }
    });
  },

  async confirmar(id: number) {
    const pagamento = await this.buscar(id);
    const atualizado = await prisma.pagamento.update({
      where: { id },
      data: {
        status: "PAGO",
        paidAt: new Date()
      }
    });
    await prisma.ingresso.updateMany({ where: { customerId: pagamento.customerId, eventoId: pagamento.eventoId }, data: { status: "PAGO", paymentStatus: "PAGO" } });
    if (pagamento.inscricaoId) {
      await prisma.inscricao.update({ where: { id: pagamento.inscricaoId }, data: { status: "CONFIRMADA" } });
    }
    return atualizado;
  },

  async cancelar(id: number) {
    const pagamento = await this.buscar(id);
    if (pagamento.gatewayId) {
      await abacatePay.cancelarCobranca(pagamento.gatewayId);
    }
    return prisma.pagamento.update({
      where: { id },
      data: { status: "FALHOU" }
    });
  }
};
