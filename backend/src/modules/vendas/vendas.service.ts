import { PedidoType, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import { buildPaymentShareText, pagamentosService } from "../pagamentos/pagamentos.service.js";
import { normalizeCpf, pessoasService } from "../pessoas/pessoas.service.js";
import type { z } from "zod";
import type { vendaCreateSchema, vendaQuerySchema, vendaUpdateSchema } from "./vendas.schemas.js";

type VendaCreate = z.infer<typeof vendaCreateSchema>;
type VendaUpdate = z.infer<typeof vendaUpdateSchema>;

function includeVenda() {
  return {
    customer: true,
    evento: true,
    items: true,
    pagamentos: { orderBy: { createdAt: "desc" as const }, include: { refunds: true } },
    ingressos: true,
    inscricoes: true,
    loteIngresso: { include: { tickets: true } }
  } satisfies Prisma.PedidoInclude;
}

function mapTipo(tipo: string): PedidoType {
  return tipo === "CURSO" || tipo === "EVENTO" || tipo === "BAILE" ? "EVENT" : "STORE";
}

function mapStatus(status?: string) {
  if (status === "CORTESIA") return "PAGO";
  return status;
}

function saleCode() {
  return `VEN-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

function eventLabel(tipo?: string) {
  if (tipo === "CURSO") return "Inscrição de curso";
  if (tipo === "BAILE") return "Ingresso de baile";
  return "Ingresso de evento";
}

function toVenda(pedido: Prisma.PedidoGetPayload<{ include: ReturnType<typeof includeVenda> }>) {
  const item = pedido.items[0];
  const pagamento = pedido.pagamentos.find((value) => value.status === "PAGO")
    ?? pedido.pagamentos.find((value) => value.status === "PARCIALMENTE_ESTORNADO")
    ?? pedido.pagamentos[0];
  const metadata = pedido.notes ? tryParseJson(pedido.notes) : {};
  return {
    id: String(pedido.id),
    codigo: pedido.code,
    tipo: metadata.tipoVenda ?? pedido.evento?.tipo ?? (pedido.type === "EVENT" ? "EVENTO" : "LOJA"),
    status: metadata.statusVenda ?? pedido.paymentStatus ?? pedido.status,
    pessoaId: String(pedido.customerId),
    pessoaTipo: metadata.pessoaTipo ?? "CLIENTE",
    nome: pedido.customer.nome,
    cpf: pedido.customer.cpf,
    email: pedido.customer.email,
    telefone: pedido.customer.telefone,
    cidade: pedido.customer.cidade ?? pedido.evento?.cidade,
    eventoId: pedido.eventId ? String(pedido.eventId) : undefined,
    cursoId: metadata.tipoVenda === "CURSO" && pedido.eventId ? String(pedido.eventId) : undefined,
    inscricaoId: metadata.inscricaoId ? String(metadata.inscricaoId) : undefined,
    eventoNome: pedido.evento?.nome,
    quantidade: item?.quantity ?? 1,
    valorUnitario: Number(item?.unitPrice ?? pedido.total),
    valorTotal: Number(pedido.total),
    desconto: Number(metadata.desconto ?? 0),
    formaPagamento: pagamento?.method ?? pedido.paymentMethod,
    pagamentoId: pagamento ? String(pagamento.id) : metadata.pagamentoId ? String(metadata.pagamentoId) : undefined,
    pagamentoPrincipal: pagamento ? {
      id: String(pagamento.id),
      provider: pagamento.provider,
      forma: pagamento.method ?? pedido.paymentMethod,
      status: pagamento.status,
      valor: pagamento.amount / 100,
      valorReembolsado: pagamento.refundedAmount / 100
    } : null,
    origem: pedido.origin,
    pagoEm: pagamento?.paidAt,
    documentosDisponiveis: [],
    checkoutUrl: metadata.checkoutUrl ? String(metadata.checkoutUrl) : undefined,
    observacao: metadata.observacao,
    createdAt: pedido.createdAt,
    updatedAt: pedido.updatedAt,
    raw: pedido
  };
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { observacao: value };
  }
}

export const vendasService = {
  async listar(query: z.infer<typeof vendaQuerySchema>) {
    const status = query.status ? mapStatus(query.status) : undefined;
    const where: Prisma.PedidoWhereInput = {
      paymentStatus: status,
      code: query.codigo ? { contains: query.codigo, mode: "insensitive" } : undefined,
      eventId: query.eventoId ?? query.cursoId,
      origin: query.origem,
      paymentMethod: query.formaPagamento,
      pagamentos: query.provider ? { some: { provider: query.provider } } : undefined,
      createdAt: query.dataInicial || query.dataFinal ? { gte: query.dataInicial, lte: query.dataFinal } : undefined,
      evento: query.tipo ? { tipo: query.tipo } : undefined,
      ...(query.cpf || query.nome || query.search
        ? {
            OR: [
              ...(query.search ? [
                { code: { contains: query.search, mode: "insensitive" as const } },
                { customer: { nome: { contains: query.search, mode: "insensitive" as const } } },
                { evento: { nome: { contains: query.search, mode: "insensitive" as const } } },
                { items: { some: { description: { contains: query.search, mode: "insensitive" as const } } } },
                { ingressos: { some: { qrcode: { contains: query.search, mode: "insensitive" as const } } } },
                { loteIngresso: { tickets: { some: { OR: [
                  { codigo: { contains: query.search, mode: "insensitive" as const } },
                  { qrcode: { contains: query.search, mode: "insensitive" as const } }
                ] } } } },
                ...(normalizeCpf(query.search) ? [{ customer: { cpf: { contains: normalizeCpf(query.search), mode: "insensitive" as const } } }] : [])
              ] : []),
              ...(query.cpf ? [{ customer: { cpf: { contains: normalizeCpf(query.cpf), mode: "insensitive" as const } } }] : []),
              ...(query.nome ? [{ customer: { nome: { contains: query.nome, mode: "insensitive" as const } } }] : [])
            ]
          }
        : {})
    };

    const [sortField, sortDirection] = query.sort.split(":") as ["createdAt" | "total", "asc" | "desc"];
    const [data, total, summaryRows] = await Promise.all([
      prisma.pedido.findMany({ where, include: includeVenda(), ...getPagination(query), orderBy: { [sortField]: sortDirection } }),
      prisma.pedido.count({ where }),
      prisma.pedido.findMany({ include: { items: true, pagamentos: true } })
    ]);
    const summary = summaryRows.reduce((acc, pedido) => {
      const metadata = pedido.notes ? tryParseJson(pedido.notes) : {};
      const statusVenda = String(metadata.statusVenda ?? pedido.paymentStatus ?? pedido.status);
      const reembolsado = pedido.pagamentos.reduce((sum, payment) => sum + payment.refundedAmount, 0) / 100;
      acc.totalVendido += statusVenda === "PAGO" || statusVenda === "PARCIALMENTE_ESTORNADO"
        ? Math.max(0, Number(pedido.total) - reembolsado)
        : 0;
      if (statusVenda === "PAGO") acc.vendasPagas += 1;
      if (statusVenda === "PENDENTE") acc.vendasPendentes += 1;
      if (statusVenda === "CORTESIA") acc.cortesias += 1;
      return acc;
    }, { totalVendido: 0, vendasPagas: 0, vendasPendentes: 0, cortesias: 0 });

    return {
      data: data.map(toVenda),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      summary: { ...summary, pendentes: summary.vendasPendentes },
      total,
      page: query.page,
      limit: query.limit
    };
  },

  async buscar(id: number) {
    const pedido = await prisma.pedido.findUnique({ where: { id }, include: includeVenda() });
    if (!pedido) throw new AppError("Venda não encontrada", 404);
    return toVenda(pedido);
  },

  async historico(id: number) {
    const venda = await prisma.pedido.findUnique({ where: { id }, select: { id: true, pagamentos: { select: { id: true } }, loteIngresso: { select: { id: true } } } });
    if (!venda) throw new AppError("Venda nao encontrada", 404);
    const paymentIds = venda.pagamentos.map((payment) => String(payment.id));
    const [audit, loteHistory] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          OR: [
            { entity: "Pedido", entityId: String(id) },
            ...(paymentIds.length ? [{ entity: "Pagamento", entityId: { in: paymentIds } }] : [])
          ]
        },
        include: { colaborador: true },
        orderBy: { createdAt: "desc" }
      }),
      venda.loteIngresso
        ? prisma.historicoPagamento.findMany({ where: { loteId: venda.loteIngresso.id }, orderBy: { createdAt: "desc" } })
        : Promise.resolve([])
    ]);
    return [...audit.map((item) => ({
      id: `audit-${item.id}`,
      action: item.action,
      fromStatus: (item.metadata as Record<string, unknown> | null)?.previous && typeof (item.metadata as Record<string, unknown>).previous === "object"
        ? String(((item.metadata as Record<string, unknown>).previous as Record<string, unknown>).status ?? "")
        : undefined,
      toStatus: (item.metadata as Record<string, unknown> | null)?.next && typeof (item.metadata as Record<string, unknown>).next === "object"
        ? String(((item.metadata as Record<string, unknown>).next as Record<string, unknown>).status ?? "")
        : undefined,
      reason: String((item.metadata as Record<string, unknown> | null)?.reason ?? ""),
      createdAt: item.createdAt,
      userName: item.colaborador?.nome
    })), ...loteHistory.map((item) => ({
      id: `lote-${item.id}`,
      action: item.action,
      fromStatus: item.fromStatus,
      toStatus: item.toStatus,
      reason: item.reason,
      createdAt: item.createdAt
    }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async criar(data: VendaCreate) {
    const person = await pessoasService.buscarPorCpf(data.cpf);
    if (!person.success || !person.data) throw new AppError("Pessoa não encontrada pelo CPF informado.", 404);

    const customerId = Number(person.data.id);
    const inscricao = data.inscricaoId
      ? await prisma.inscricao.findUnique({ where: { id: data.inscricaoId }, include: { evento: true } })
      : null;
    if (data.inscricaoId && !inscricao) throw new AppError("Inscrição não encontrada", 404);

    const eventId = data.tipo === "CURSO" ? data.cursoId ?? inscricao?.eventoId : data.eventoId;
    if (!eventId) throw new AppError("Informe eventoId, cursoId ou inscricaoId para a venda", 400);

    const evento = await prisma.evento.findUnique({ where: { id: eventId } });
    if (!evento) throw new AppError("Evento/curso não encontrado", 404);

    if (evento.tipo !== data.tipo) throw new AppError("O item selecionado nao corresponde ao tipo da venda", 409);
    if (evento.status !== "ATIVO") throw new AppError("O item selecionado precisa estar ativo", 409);
    if (data.tipo === "CURSO" && data.quantidade !== 1) {
      throw new AppError("Venda de curso aceita exatamente uma inscricao por aluno", 422);
    }
    if (inscricao && (inscricao.customerId !== customerId || inscricao.eventoId !== eventId)) {
      throw new AppError("A inscricao nao pertence ao aluno e curso informados", 409);
    }
    const desconto = data.desconto ?? 0;
    const unitPrice = Number(evento.preco);
    const grossTotal = data.quantidade * unitPrice;
    if (desconto > grossTotal) throw new AppError("O desconto nao pode superar o subtotal", 422);
    const total = Math.max(0, grossTotal - desconto);
    const external = ["PIX_EXTERNO", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO"].includes(data.formaPagamento ?? "");
    const statusVenda = data.formaPagamento === "CORTESIA" ? "CORTESIA" : external ? "PAGO" : "PENDENTE";

    return prisma.$transaction(async (tx) => {
      const eventoAtual = await tx.evento.findUnique({ where: { id: eventId } });
      if (!eventoAtual || eventoAtual.status !== "ATIVO" || eventoAtual.tipo !== data.tipo) {
        throw new AppError("O item selecionado nao esta disponivel", 409);
      }
      if (data.tipo !== "CURSO" && eventoAtual.capacidade != null) {
        const reservados = await tx.pedidoItem.aggregate({
          where: {
            eventId,
            order: {
              status: { notIn: ["CANCELADO", "EXPIRADO", "FALHOU"] },
              paymentStatus: { in: ["PENDENTE", "PROCESSANDO", "PAGO"] }
            }
          },
          _sum: { quantity: true }
        });
        if ((reservados._sum.quantity ?? 0) + data.quantidade > eventoAtual.capacidade) {
          throw new AppError("Quantidade excede a capacidade disponivel", 409);
        }
      }
      const pedido = await tx.pedido.create({
      data: {
        code: saleCode(),
        type: mapTipo(data.tipo),
        customerId,
        eventId,
        status: statusVenda,
        paymentStatus: mapStatus(statusVenda),
        paymentMethod: data.formaPagamento,
        total,
        isCourtesy: statusVenda === "CORTESIA",
        notes: JSON.stringify({
          tipoVenda: data.tipo,
          statusVenda,
          pessoaTipo: person.data.tipo,
          inscricaoId: data.inscricaoId,
          desconto,
          observacao: data.observacao
        }),
        items: {
          create: [{
            ticketLotId: undefined,
            eventId,
            description: `${eventLabel(data.tipo)} - ${evento.nome}`,
            quantity: data.quantidade,
            unitPrice,
            total,
            unitAmount: Math.round(unitPrice * 100),
            totalAmount: Math.round(total * 100)
          }]
        }
      },
      include: includeVenda()
    });
      let inscricaoVendaId: number | undefined;
      if (data.tipo === "CURSO") {
        const inscricaoVenda = await tx.inscricao.upsert({
        where: { customerId_eventoId: { customerId, eventoId: eventId } },
          update: { orderId: pedido.id, status: statusVenda === "PAGO" || statusVenda === "CORTESIA" ? "CONFIRMADA" : "PENDENTE" },
          create: { customerId, eventoId: eventId, orderId: pedido.id, status: statusVenda === "PAGO" || statusVenda === "CORTESIA" ? "CONFIRMADA" : "PENDENTE" }
        });
        inscricaoVendaId = inscricaoVenda.id;
      } else {
        await tx.ingresso.createMany({
        data: Array.from({ length: data.quantidade }, () => ({
          customerId,
          eventoId: eventId,
          orderId: pedido.id,
          preco: unitPrice,
          qrcode: `TKT-${randomUUID()}`,
          status: statusVenda === "PAGO" || statusVenda === "CORTESIA" ? "PAGO" : "PENDENTE",
          paymentStatus: statusVenda === "PAGO" || statusVenda === "CORTESIA" ? "PAGO" : "PENDENTE",
          paidAt: statusVenda === "PAGO" || statusVenda === "CORTESIA" ? new Date() : undefined
        }))
      });
      }
      if (external || statusVenda === "CORTESIA") {
        await tx.pagamento.create({ data: { inscricaoId: inscricaoVendaId, pedidoId: pedido.id, customerId, eventoId: eventId, nomeCustomer: person.data.nome, cpfCustomer: person.data.cpf ?? normalizeCpf(data.cpf), valor: total, amount: Math.round(total * 100), status: "PAGO", provider: statusVenda === "CORTESIA" ? "CORTESIA" : "EXTERNO", method: data.formaPagamento, paidAt: new Date(), gatewayId: `MANUAL-${randomUUID()}`, rawProviderData: { source: "PAINEL_ADMIN", method: data.formaPagamento } } });
      }
      await tx.auditLog.create({
        data: {
          action: external ? "VENDA_PAGAMENTO_EXTERNO" : "VENDA_CRIADA",
          entity: "Pedido",
          entityId: String(pedido.id),
          metadata: { tipo: data.tipo, customerId, eventId, quantidade: data.quantidade, unitPrice, desconto, total, formaPagamento: data.formaPagamento }
        }
      });
      return toVenda(await tx.pedido.findUniqueOrThrow({ where: { id: pedido.id }, include: includeVenda() }));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  },

  async atualizar(id: number, data: VendaUpdate) {
    const atual = await prisma.pedido.findUnique({ where: { id }, include: includeVenda() });
    if (!atual) throw new AppError("Venda não encontrada", 404);
    const metadata = atual.notes ? tryParseJson(atual.notes) : {};
    const item = atual.items[0];
    const quantity = data.quantidade ?? item?.quantity ?? 1;
    const unitPrice = Number(atual.evento?.preco ?? item?.unitPrice ?? atual.total);
    const desconto = data.desconto ?? Number(metadata.desconto ?? 0);
    const total = data.quantidade || data.desconto
      ? Math.max(0, quantity * unitPrice - desconto)
      : Number(atual.total);
    const statusVenda = data.status ?? String(metadata.statusVenda ?? atual.paymentStatus ?? atual.status);

    const pedido = await prisma.$transaction(async (tx) => {
      if (item && (data.quantidade || data.desconto)) {
        await tx.pedidoItem.update({ where: { id: item.id }, data: { quantity, unitPrice, total } });
      }
      return tx.pedido.update({
        where: { id },
        data: {
          status: statusVenda,
          paymentStatus: mapStatus(statusVenda),
          paymentMethod: data.formaPagamento,
          total,
          isCourtesy: statusVenda === "CORTESIA",
          notes: JSON.stringify({
            ...metadata,
            statusVenda,
            desconto,
            observacao: data.observacao ?? metadata.observacao
          })
        },
        include: includeVenda()
      });
    });
    return toVenda(pedido);
  },

  async gerarLinkPagamento(id: number) {
    const pedido = await prisma.pedido.findUnique({ where: { id }, include: includeVenda() });
    if (!pedido) throw new AppError("Venda nao encontrada", 404);
    if (!pedido.eventId) throw new AppError("Venda sem evento vinculado", 400);
    if (pedido.isCourtesy) throw new AppError("Cortesia nao gera link de pagamento", 400);

    const metadata = pedido.notes ? tryParseJson(pedido.notes) : {};
    const descricao = `${eventLabel(String(metadata.tipoVenda))} - ${pedido.evento?.nome ?? pedido.code}`;
    const pagamento = await pagamentosService.createCheckoutForOrder(pedido.id, "PAINEL_ADMIN", { admin: true });
    const checkoutUrl = pagamento.checkoutUrl;

    const updated = await prisma.pedido.update({
      where: { id },
      data: {
        paymentMethod: "STRIPE",
        paymentStatus: "PENDENTE",
        status: "PENDENTE",
        notes: JSON.stringify({
          ...metadata,
          statusVenda: "PENDENTE",
          paymentId: pagamento.paymentId,
          checkoutSessionId: pagamento.checkoutSessionId,
          checkoutUrl
        })
      },
      include: includeVenda()
    });

    return {
      venda: toVenda(updated),
      pagamento,
      checkoutUrl,
      shareText: buildPaymentShareText({
        nome: pedido.customer.nome,
        descricao,
        valor: Number(pedido.total),
        checkoutUrl
      })
    };
  },

  async remover(id: number) {
    const venda = await this.buscar(id);
    if (["PAGO", "CORTESIA", "PARCIALMENTE_ESTORNADO", "ESTORNADO"].includes(String(venda.status))) {
      throw new AppError("Venda com historico financeiro nao pode ser excluida; use cancelamento ou reembolso", 409);
    }
    return prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.update({
        where: { id },
        data: { status: "CANCELADO", paymentStatus: "CANCELADO", expiresAt: new Date() },
        include: includeVenda()
      });
      await tx.auditLog.create({
        data: { action: "VENDA_CANCELADA", entity: "Pedido", entityId: String(id), metadata: { reason: "Cancelamento administrativo pela rota legada" } }
      });
      return toVenda(pedido);
    });
  }
};
