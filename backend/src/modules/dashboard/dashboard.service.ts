import { prisma } from "../../lib/prisma.js";

export const dashboardService = {
  async getResumo() {
    const now = new Date();
    const inicioDia = new Date(now);
    inicioDia.setHours(0, 0, 0, 0);
    const fimDia = new Date(now);
    fimDia.setHours(23, 59, 59, 999);
    const [
      eventosAtivos,
      bailesAtivos,
      cursosAtivos,
      proximoEvento,
      capacidadeAtiva,
      receitaDia,
      ingressosVendidosHoje,
      pedidosPendentes,
      clientes,
      inscricoesPendentes,
      ingressosValidadosHoje,
      pagamentosPendentes,
      cortesiasLiberadas,
      ultimoCheckin,
      eventosProximos
    ] = await Promise.all([
      prisma.evento.count({ where: { status: "ATIVO", data: { gte: now } } }),
      prisma.evento.count({ where: { status: "ATIVO", tipo: "BAILE", data: { gte: now } } }),
      prisma.evento.count({ where: { status: "ATIVO", tipo: "CURSO", data: { gte: now } } }),
      prisma.evento.findFirst({ where: { status: "ATIVO", data: { gte: now } }, orderBy: { data: "asc" }, select: { nome: true, data: true } }),
      prisma.evento.aggregate({ where: { status: "ATIVO", data: { gte: now } }, _sum: { capacidade: true } }),
      prisma.pagamento.aggregate({ where: { status: "PAGO", paidAt: { gte: inicioDia, lte: fimDia } }, _sum: { valor: true } }),
      prisma.ingresso.count({ where: { status: "PAGO", paidAt: { gte: inicioDia, lte: fimDia } } }),
      prisma.pedido.count({ where: { status: "PENDENTE" } }),
      prisma.customer.count(),
      prisma.inscricao.count({ where: { status: "PENDENTE" } }),
      prisma.ingresso.count({ where: { status: "VALIDADO", validadoEm: { gte: inicioDia, lte: fimDia } } }),
      prisma.pagamento.count({ where: { status: "PENDENTE" } }),
      prisma.cortesia.count(),
      prisma.ingresso.findFirst({
        where: { status: "VALIDADO", validadoEm: { not: null } },
        orderBy: { validadoEm: "desc" },
        include: { customer: true }
      }),
      prisma.evento.count({
        where: {
          status: "ATIVO",
          data: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    return {
      eventosAtivos,
      bailesAtivos,
      cursosAtivos,
      proximoEvento: proximoEvento
        ? { nome: proximoEvento.nome, data: proximoEvento.data }
        : null,
      capacidadeAtiva: capacidadeAtiva._sum.capacidade ?? 0,
      receitaDia: receitaDia._sum.valor ?? 0,
      ingressosVendidosHoje,
      pedidosPendentes,
      clientes,
      inscricoesPendentes,
      ingressosValidadosHoje,
      pagamentosPendentes,
      cortesiasLiberadas,
      ultimoCheckin: ultimoCheckin
        ? { horario: ultimoCheckin.validadoEm, cliente: ultimoCheckin.customer.nome }
        : null,
      eventosProximos
    };
  }
};
