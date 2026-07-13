import { PedidoType, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { pedidoCreateSchema, pedidoQuerySchema, pedidoUpdateSchema } from "./pedidos.schemas.js";

type PedidoCreate = z.infer<typeof pedidoCreateSchema>;
type PedidoUpdate = z.infer<typeof pedidoUpdateSchema>;

function normalizeType(data: { type?: string; tipo?: string }): PedidoType {
  const value = data.type ?? data.tipo ?? "STORE";
  return value === "EVENT" || value === "EVENTO" ? "EVENT" : "STORE";
}

function normalizeItems(data: PedidoCreate | PedidoUpdate) {
  const items = data.items ?? data.itens ?? [];
  return items.map((item) => {
    const quantity = Number(item.quantity ?? item.quantidade ?? item.qtd ?? 1);
    const unitPrice = Number(item.unitPrice ?? item.valor ?? 0);
    return {
      productId: item.productId,
      ticketLotId: item.ticketLotId,
      description: item.description ?? item.nome ?? item.lote ?? "Item do pedido",
      quantity,
      unitPrice,
      total: Number(item.total ?? quantity * unitPrice)
    };
  });
}

async function resolveCustomer(data: PedidoCreate | PedidoUpdate) {
  if (data.customerId) return data.customerId;
  if (!data.cpf) throw new AppError("Informe customerId ou CPF do cliente", 400);
  const customer = await prisma.customer.upsert({
    where: { cpf: data.cpf },
    update: {
      nome: data.cliente ?? undefined,
      telefone: data.telefone ?? undefined
    },
    create: {
      cpf: data.cpf,
      nome: data.cliente ?? "Cliente sem nome",
      telefone: data.telefone ?? ""
    }
  });
  return customer.id;
}

function includePedido() {
  return {
    customer: true,
    evento: true,
    items: true
  } satisfies Prisma.PedidoInclude;
}

export const pedidosService = {
  async listar(query: z.infer<typeof pedidoQuerySchema>) {
    const type = query.type ?? query.tipo;
    const eventId = query.eventId ?? query.eventoId;
    const where: Prisma.PedidoWhereInput = {
      type: type as PedidoType | undefined,
      status: query.status,
      paymentStatus: query.paymentStatus,
      eventId,
      ...(query.cpf || query.cliente || query.search
        ? {
            customer: {
              OR: [
                { cpf: { contains: query.cpf ?? query.search ?? "", mode: "insensitive" } },
                { nome: { contains: query.cliente ?? query.search ?? "", mode: "insensitive" } }
              ]
            }
          }
        : {}),
      ...(query.data
        ? {
            createdAt: {
              gte: query.data,
              lt: new Date(query.data.getTime() + 24 * 60 * 60 * 1000)
            }
          }
        : {})
    };

    const [data, total] = await Promise.all([
      prisma.pedido.findMany({ where, include: includePedido(), ...getPagination(query), orderBy: { createdAt: "desc" } }),
      prisma.pedido.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const pedido = await prisma.pedido.findUnique({ where: { id }, include: includePedido() });
    if (!pedido) throw new AppError("Pedido nao encontrado", 404);
    return pedido;
  },

  async criar(data: PedidoCreate) {
    const items = normalizeItems(data);
    const customerId = await resolveCustomer(data);
    const type = normalizeType(data);
    const total = Number(data.total ?? items.reduce((sum, item) => sum + item.total, 0));
    return prisma.pedido.create({
      data: {
        code: data.code ?? `PED-${randomUUID().slice(0, 8).toUpperCase()}`,
        type,
        customerId,
        eventId: data.eventId ?? data.eventoId,
        status: data.status,
        paymentStatus: data.paymentStatus ?? data.statusPagamento ?? "PENDENTE",
        paymentMethod: data.paymentMethod ?? data.formaPagamento,
        total,
        isCourtesy: data.isCourtesy ?? data.cortesia ?? false,
        courtesyReason: data.courtesyReason ?? data.motivoCortesia,
        courtesyResponsible: data.courtesyResponsible ?? data.responsavelCortesia,
        notes: data.notes ?? data.observacoes,
        items: { create: items }
      },
      include: includePedido()
    });
  },

  async atualizar(id: number, data: PedidoUpdate) {
    await this.buscar(id);
    const items = normalizeItems(data);
    const updateData: Prisma.PedidoUpdateInput = {
      type: data.type || data.tipo ? normalizeType(data) : undefined,
      evento: data.eventId || data.eventoId ? { connect: { id: data.eventId ?? data.eventoId } } : undefined,
      status: data.status,
      paymentStatus: data.paymentStatus ?? data.statusPagamento,
      paymentMethod: data.paymentMethod ?? data.formaPagamento,
      total: data.total,
      isCourtesy: data.isCourtesy ?? data.cortesia,
      courtesyReason: data.courtesyReason ?? data.motivoCortesia,
      courtesyResponsible: data.courtesyResponsible ?? data.responsavelCortesia,
      notes: data.notes ?? data.observacoes
    };
    if (data.customerId || data.cpf) {
      updateData.customer = { connect: { id: await resolveCustomer(data) } };
    }
    return prisma.$transaction(async (tx) => {
      if (items.length) {
        await tx.pedidoItem.deleteMany({ where: { orderId: id } });
        await tx.pedidoItem.createMany({ data: items.map((item) => ({ ...item, orderId: id })) });
      }
      return tx.pedido.update({ where: { id }, data: updateData, include: includePedido() });
    });
  },

  async cancelar(id: number, notes?: string) {
    await this.buscar(id);
    return prisma.pedido.update({ where: { id }, data: { status: "CANCELADO", notes }, include: includePedido() });
  },

  async remover(id: number) {
    await this.buscar(id);
    await prisma.pedido.delete({ where: { id } });
    return { ok: true };
  }
};
