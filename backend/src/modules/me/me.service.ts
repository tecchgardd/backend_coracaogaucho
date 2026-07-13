import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { pagamentosService } from "../pagamentos/pagamentos.service.js";
import { calculateEventUnitPrice, soldQuantity } from "../public/public.service.js";
import type { cartSchema, profileUpdateSchema } from "./me.schemas.js";

type CustomerSession = { userId: string; customerId?: number; email: string; name: string };
type Cart = z.infer<typeof cartSchema>;

function orderInclude() {
  return { items: { include: { evento: true } }, evento: true, ingressos: { include: { evento: true } }, inscricoes: { include: { evento: true } } } as const;
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = { PENDENTE: "Aguardando pagamento", PAGO: "Pago", CONFIRMADA: "Confirmado", CANCELADO: "Cancelado", EXPIRADO: "Expirado", ESTORNADO: "Reembolsado", GRATUITO: "Gratuito", UTILIZADO: "Utilizado" };
  return labels[String(status)] ?? status ?? "Pendente";
}

function profileComplete(customer: {
  cpf: string; telefone: string; dataNascimento: Date | null; sexo: string | null; cep: string | null;
  endereco: string | null; numero: string | null; bairro: string | null; estado: string | null; cidade: string | null;
} | null | undefined) {
  return Boolean(customer?.cpf && customer.telefone && customer.dataNascimento && customer.sexo && customer.cep && customer.endereco && customer.numero && customer.bairro && customer.estado && customer.cidade);
}

function profileResponse(user: { id: string; name: string; email: string; phone: string | null; customer: {
  cpf: string; telefone: string; dataNascimento: Date | null; sexo: string | null; cep: string | null; endereco: string | null;
  numero: string | null; complemento: string | null; bairro: string | null; estado: string | null; cidade: string | null;
} | null }) {
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.customer?.telefone ?? user.phone ?? "",
    cpf: user.customer?.cpf ?? "",
    birthDate: user.customer?.dataNascimento?.toISOString().slice(0, 10) ?? "",
    gender: user.customer?.sexo ?? "",
    cep: user.customer?.cep ?? "",
    address: user.customer?.endereco ?? "",
    number: user.customer?.numero ?? "",
    complement: user.customer?.complemento ?? "",
    neighborhood: user.customer?.bairro ?? "",
    state: user.customer?.estado ?? "",
    city: user.customer?.cidade ?? "",
    complete: profileComplete(user.customer)
  };
}

export const meService = {
  async profile(session: CustomerSession) {
    const user = await prisma.user.findUnique({ where: { id: session.userId }, include: { customer: true } });
    if (!user) throw new AppError("Usuario nao encontrado", 404);
    return profileResponse(user);
  },

  async updateProfile(session: CustomerSession, data: z.infer<typeof profileUpdateSchema>) {
    const conflicting = await prisma.customer.findUnique({ where: { cpf: data.cpf } });
    if (conflicting?.userId && conflicting.userId !== session.userId) throw new AppError("CPF ja vinculado a outra conta", 409);
    const customer = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: session.userId }, data: { name: data.name, phone: data.phone } });
      if (session.customerId) {
        return tx.customer.update({ where: { id: session.customerId }, data: { nome: data.name, cpf: data.cpf, telefone: data.phone, email: session.email, dataNascimento: data.birthDate, sexo: data.gender, cep: data.cep, endereco: data.address, numero: data.number, complemento: data.complement, bairro: data.neighborhood, estado: data.state, cidade: data.city } });
      }
      if (conflicting) {
        return tx.customer.update({ where: { id: conflicting.id }, data: { userId: session.userId, nome: data.name, telefone: data.phone, email: session.email, dataNascimento: data.birthDate, sexo: data.gender, cep: data.cep, endereco: data.address, numero: data.number, complemento: data.complement, bairro: data.neighborhood, estado: data.state, cidade: data.city } });
      }
      return tx.customer.create({ data: { userId: session.userId, nome: data.name, cpf: data.cpf, telefone: data.phone, email: session.email, dataNascimento: data.birthDate, sexo: data.gender, cep: data.cep, endereco: data.address, numero: data.number, complemento: data.complement, bairro: data.neighborhood, estado: data.state, cidade: data.city } });
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId }, include: { customer: true } });
    return profileResponse(user);
  },

  async validateCart(cart: Cart) {
    const quantities = new Map<number, number>();
    for (const item of cart.items) quantities.set(item.eventId, (quantities.get(item.eventId) ?? 0) + item.quantity);
    const events = await prisma.evento.findMany({ where: { id: { in: [...quantities.keys()] } } });
    const byId = new Map(events.map((event) => [event.id, event]));
    const validItems: Array<Record<string, unknown>> = [];
    const invalidItems: Array<Record<string, unknown>> = [];
    let subtotal = 0;

    for (const [eventId, selectedQuantity] of quantities) {
      const event = byId.get(eventId);
      if (!event) { invalidItems.push({ eventId, reason: "Item nao encontrado" }); continue; }
      if (event.status !== "ATIVO" || event.data < new Date() || (event.dataLimiteInscricao && event.dataLimiteInscricao < new Date())) {
        invalidItems.push({ eventId, name: event.nome, reason: "Vendas ou inscricoes encerradas" }); continue;
      }
      const quantity = selectedQuantity;
      const sold = await soldQuantity(event.id);
      const available = event.capacidade == null ? null : Math.max(0, event.capacidade - sold);
      if (available !== null && available < 1) { invalidItems.push({ eventId, name: event.nome, reason: "Esgotado" }); continue; }
      const adjustedQuantity = available === null ? quantity : Math.min(quantity, available);
      const unitPrice = calculateEventUnitPrice(event);
      const total = adjustedQuantity * unitPrice;
      subtotal += total;
      validItems.push({
        eventId,
        itemType: event.tipo === "CURSO" ? "COURSE" : event.tipo === "BAILE" ? "DANCE" : "EVENT",
        name: event.nome,
        type: event.tipo,
        banner: event.banner,
        startsAt: event.data,
        city: event.cidade,
        venue: event.local,
        requestedQuantity: selectedQuantity,
        quantity: adjustedQuantity,
        quantityAdjusted: adjustedQuantity !== selectedQuantity,
        unitPrice,
        total,
        available,
        free: unitPrice === 0
      });
    }
    return { validItems, invalidItems, subtotal, fee: 0, total: subtotal, changed: invalidItems.length > 0 || validItems.some((item) => item.quantityAdjusted) };
  },

  async checkout(session: CustomerSession, cart: Cart) {
    if (!session.customerId) throw new AppError("Complete seu perfil antes de finalizar", 422);
    const customer = await prisma.customer.findUnique({ where: { id: session.customerId } });
    if (!profileComplete(customer)) throw new AppError("Complete todos os dados obrigatorios do perfil antes de finalizar", 422);
    const validation = await this.validateCart(cart);
    if (validation.invalidItems.length || !validation.validItems.length) throw new AppError("Carrinho possui itens indisponiveis", 409, validation);
    const eventIds = validation.validItems.map((item) => Number(item.eventId));
    const duplicate = await prisma.pedido.findFirst({ where: { userId: session.userId, status: { notIn: ["CANCELADO", "EXPIRADO", "FALHOU"] }, items: { some: { eventId: { in: eventIds } } } } });
    if (duplicate) throw new AppError("Ja existe um pedido ativo com um destes itens", 409, { orderId: duplicate.id });
    const code = `WEB-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const free = validation.total === 0;

    const order = await prisma.$transaction(async (tx) => {
      for (const item of validation.validItems) {
        const eventId = Number(item.eventId);
        const current = await tx.evento.findUnique({ where: { id: eventId } });
        if (!current || current.status !== "ATIVO" || current.data < new Date()) throw new AppError("Item ficou indisponivel", 409);
        const reserved = await tx.pedidoItem.aggregate({ where: { eventId, order: { status: { notIn: ["CANCELADO", "EXPIRADO", "FALHOU"] }, paymentStatus: { in: ["PENDENTE", "PAGO"] } } }, _sum: { quantity: true } });
        if (current.capacidade != null && (reserved._sum.quantity ?? 0) + Number(item.quantity) > current.capacidade) throw new AppError("Quantidade indisponivel", 409, { eventId });
      }
      const created = await tx.pedido.create({
        data: {
          code,
          type: "EVENT",
          userId: session.userId,
          customerId: session.customerId!,
          eventId: eventIds.length === 1 ? eventIds[0] : null,
          status: free ? "PAGO" : "PENDENTE",
          paymentStatus: free ? "PAGO" : "PENDENTE",
          paymentMethod: free ? "GRATUITO" : "ABACATEPAY",
          total: validation.total,
          notes: JSON.stringify({ source: "CUSTOMER_CHECKOUT", statusVenda: free ? "PAGO" : "PENDENTE" }),
          items: { create: validation.validItems.map((item) => ({ eventId: Number(item.eventId), description: `${item.type} - ${item.name}`, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), total: Number(item.total) })) }
        }
      });
      for (const item of validation.validItems) {
        const eventId = Number(item.eventId);
        if (item.type === "CURSO") {
          const existing = await tx.inscricao.findUnique({ where: { customerId_eventoId: { customerId: session.customerId!, eventoId: eventId } } });
          if (existing && existing.status !== "CANCELADA") throw new AppError("Voce ja possui inscricao neste curso", 409);
          if (existing) await tx.inscricao.update({ where: { id: existing.id }, data: { orderId: created.id, status: free ? "CONFIRMADA" : "PENDENTE" } });
          else await tx.inscricao.create({ data: { customerId: session.customerId!, eventoId: eventId, orderId: created.id, status: free ? "CONFIRMADA" : "PENDENTE", quantidadeParticipantes: Number(item.quantity) } });
        } else {
          if (free) await tx.ingresso.createMany({ data: Array.from({ length: Number(item.quantity) }, (_, index) => ({ customerId: session.customerId!, eventoId: eventId, orderId: created.id, preco: Number(item.unitPrice), qrcode: `TKT-${created.id}-${eventId}-${index + 1}`, status: "PAGO", paymentStatus: "PAGO", paidAt: new Date() })), skipDuplicates: true });
        }
      }
      return tx.pedido.findUniqueOrThrow({ where: { id: created.id }, include: { items: true, customer: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (free) return { orderId: order.id, orderCode: order.code, status: "PAGO", free: true, total: 0, checkoutUrl: null };
    try {
      const first = validation.validItems[0];
      const payment = await pagamentosService.criarCobranca({
        customerId: session.customerId,
        eventoId: Number(first.eventId),
        valor: validation.total,
        descricao: `Pedido ${order.code} - Coracao Gaucho`,
        metodos: ["PIX", "CARD"],
        metadata: { externalId: order.code, pedidoId: order.id, tipo: "CUSTOMER_CHECKOUT" },
        itens: order.items.map((item) => ({ externalId: `pedido-item-${item.id}`, name: item.description, description: item.description, quantity: item.quantity, price: Math.round(Number(item.unitPrice) * 100) }))
      });
      await prisma.pedido.update({ where: { id: order.id }, data: { notes: JSON.stringify({ source: "CUSTOMER_CHECKOUT", pagamentoId: payment.id, gatewayId: payment.gatewayId, checkoutUrl: payment.checkoutUrl }) } });
      return { orderId: order.id, orderCode: order.code, status: "PENDENTE", free: false, total: validation.total, checkoutUrl: payment.checkoutUrl };
    } catch (error) {
      await prisma.$transaction([
        prisma.pedido.update({ where: { id: order.id }, data: { status: "FALHOU", paymentStatus: "FALHOU" } }),
        prisma.ingresso.updateMany({ where: { orderId: order.id }, data: { status: "CANCELADO", paymentStatus: "FALHOU" } }),
        prisma.inscricao.updateMany({ where: { orderId: order.id }, data: { status: "CANCELADA" } })
      ]);
      throw error;
    }
  },

  async orders(session: CustomerSession) {
    const data = await prisma.pedido.findMany({ where: { userId: session.userId }, include: orderInclude(), orderBy: { createdAt: "desc" } });
    return { data: data.map((order) => ({ ...order, statusLabel: statusLabel(order.paymentStatus ?? order.status) })) };
  },

  async order(session: CustomerSession, id: number) {
    const order = await prisma.pedido.findFirst({ where: { id, userId: session.userId }, include: orderInclude() });
    if (!order) throw new AppError("Pedido nao encontrado", 404);
    return { ...order, statusLabel: statusLabel(order.paymentStatus ?? order.status) };
  },

  async tickets(session: CustomerSession) {
    if (!session.customerId) return { data: [] };
    const data = await prisma.ingresso.findMany({ where: { customerId: session.customerId, status: { in: ["PAGO", "UTILIZADO"] }, order: { userId: session.userId } }, include: { evento: true }, orderBy: { createdAt: "desc" } });
    return { data: data.map((ticket) => ({ ...ticket, statusLabel: statusLabel(ticket.status) })) };
  },

  async enrollments(session: CustomerSession) {
    if (!session.customerId) return { data: [] };
    const data = await prisma.inscricao.findMany({ where: { customerId: session.customerId, order: { userId: session.userId } }, include: { evento: true, pagamento: true }, orderBy: { createdAt: "desc" } });
    return { data: data.map((enrollment) => ({ ...enrollment, statusLabel: statusLabel(enrollment.status) })) };
  }
};
