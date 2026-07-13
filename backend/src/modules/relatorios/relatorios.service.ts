import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

type Filter = {
  cidade?: string;
  cursoId?: number;
  professor?: string;
  eventoId?: number;
  dataInicial?: Date;
  dataFinal?: Date;
  status?: string;
  formaPagamento?: string;
};

function dateWhere(filter: Filter) {
  if (!filter.dataInicial && !filter.dataFinal) return undefined;
  return {
    gte: filter.dataInicial,
    lte: filter.dataFinal
  };
}

function ticketWhere(filter: Filter): Prisma.IngressoAlunoWhereInput {
  return {
    cidade: filter.cidade ? { contains: filter.cidade, mode: "insensitive" } : undefined,
    professor: filter.professor ? { contains: filter.professor, mode: "insensitive" } : undefined,
    eventoId: filter.eventoId ?? filter.cursoId,
    status: filter.status as never,
    createdAt: dateWhere(filter)
  };
}

function parseFilter(raw: Record<string, unknown>): Filter {
  return {
    cidade: raw.cidade ? String(raw.cidade) : undefined,
    cursoId: raw.cursoId ? Number(raw.cursoId) : undefined,
    professor: raw.professor ? String(raw.professor) : undefined,
    eventoId: raw.eventoId ? Number(raw.eventoId) : undefined,
    dataInicial: raw.dataInicial ? new Date(String(raw.dataInicial)) : undefined,
    dataFinal: raw.dataFinal ? new Date(String(raw.dataFinal)) : undefined,
    status: raw.status ? String(raw.status) : undefined,
    formaPagamento: raw.formaPagamento ? String(raw.formaPagamento) : undefined
  };
}

function csv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "metric,value\n";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? "")).join(","))
  ].join("\n");
}

function htmlTable(rows: Array<Record<string, unknown>>) {
  const headers = rows.length ? Object.keys(rows[0]) : ["metric", "value"];
  const body = rows.length ? rows : [{ metric: "Sem dados", value: 0 }];
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}th{background:#111;color:white}</style></head><body><h1>Relatorio Coração Gaúcho</h1><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${headers.map((header) => `<td>${row[header] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}

function escapePdf(value: unknown) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function simplePdf(rows: Array<Record<string, unknown>>) {
  const lines = ["Relatorio Coracao Gaucho", "", ...rows.map((row) => `${row.metric}: ${row.value}`)].slice(0, 42);
  const text = lines.map((line, index) => `BT /F1 11 Tf 50 ${790 - index * 17} Td (${escapePdf(line)}) Tj ET`).join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(text)} >> stream\n${text}\nendstream endobj`
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += `${object}\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

export const relatoriosService = {
  parseFilter,

  async resumo(rawFilter: Record<string, unknown> = {}) {
    const filter = parseFilter(rawFilter);
    const where = ticketWhere(filter);
    const [
      totalAlunos,
      totalInscricoes,
      participantes,
      padrinhosPendentes,
      padrinhosCadastrados,
      lotesGerados,
      totalIngressos,
      pendentes,
      pagos,
      cancelados,
      utilizados,
      expirados,
      cortesias,
      receita
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.inscricao.count(),
      prisma.inscricao.aggregate({ _sum: { quantidadeParticipantes: true } }),
      prisma.inscricao.aggregate({ _sum: { quantidadePadrinhosEsperada: true }, where: { padrinhosStatus: "PENDENTE" } }),
      prisma.inscricao.aggregate({ _sum: { quantidadePadrinhosCadastrada: true } }),
      prisma.loteIngressoAluno.count(),
      prisma.ingressoAluno.count({ where }),
      prisma.ingressoAluno.count({ where: { ...where, status: "PENDENTE" } }),
      prisma.ingressoAluno.count({ where: { ...where, status: "PAGO" } }),
      prisma.ingressoAluno.count({ where: { ...where, status: "CANCELADO" } }),
      prisma.ingressoAluno.count({ where: { ...where, status: "UTILIZADO" } }),
      prisma.ingressoAluno.count({ where: { ...where, status: "EXPIRADO" } }),
      prisma.ingressoAluno.count({ where: { ...where, tipo: "CORTESIA" } }),
      prisma.ingressoAluno.aggregate({ where, _sum: { valor: true } })
    ]);

    const receitaRecebida = await prisma.ingressoAluno.aggregate({ where: { ...where, status: "PAGO" }, _sum: { valor: true } });
    const receitaPendente = await prisma.ingressoAluno.aggregate({ where: { ...where, status: "PENDENTE" }, _sum: { valor: true } });

    return {
      totalAlunos,
      totalInscricoes,
      totalParticipantes: participantes._sum.quantidadeParticipantes ?? 0,
      totalPadrinhosPendentes: Math.max(0, (padrinhosPendentes._sum.quantidadePadrinhosEsperada ?? 0) - (padrinhosCadastrados._sum.quantidadePadrinhosCadastrada ?? 0)),
      totalPadrinhosCadastrados: padrinhosCadastrados._sum.quantidadePadrinhosCadastrada ?? 0,
      totalLotesGerados: lotesGerados,
      totalIngressos,
      ingressosPendentes: pendentes,
      ingressosPagos: pagos,
      ingressosCancelados: cancelados,
      ingressosUtilizados: utilizados,
      ingressosExpirados: expirados,
      cortesias,
      receitaPrevista: receita._sum.valor ?? 0,
      receitaRecebida: receitaRecebida._sum.valor ?? 0,
      receitaPendente: receitaPendente._sum.valor ?? 0
    };
  },

  async financeiro() {
    return this.resumo();
  },

  async eventos() {
    return prisma.evento.findMany({
      where: { tipo: { not: "CURSO" } },
      include: { _count: { select: { ingresso: true, inscricao: true, cortesia: true } } },
      orderBy: { data: "desc" }
    });
  },

  async cursos() {
    const [cursos, resumo] = await Promise.all([
      prisma.evento.findMany({
        where: { tipo: "CURSO" },
        include: { _count: { select: { ingresso: true, inscricao: true } } },
        orderBy: { data: "desc" }
      }),
      this.resumo()
    ]);
    return { cursos, ...resumo };
  },

  async pedidos() {
    return this.resumo();
  },

  async cadastros() {
    const [totalCustomers, recentes, resumo] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.findMany({ take: 50, orderBy: { createdAt: "desc" } }),
      this.resumo()
    ]);
    return { totalCustomers, recentes, ...resumo };
  },

  async porCursoCidadeProfessor() {
    const tickets = await prisma.ingressoAluno.findMany({
      where: { status: "PAGO" },
      select: { cursoNome: true, cidade: true, professor: true, valor: true }
    });
    const group = (key: "cursoNome" | "cidade" | "professor") => Object.values(tickets.reduce<Record<string, { nome: string; valor: number }>>((acc, item) => {
      const name = item[key] || "Nao informado";
      acc[name] ??= { nome: name, valor: 0 };
      acc[name].valor += item.valor;
      return acc;
    }, {}));
    return {
      valorRecebidoPorCurso: group("cursoNome"),
      valorRecebidoPorCidade: group("cidade"),
      valorRecebidoPorProfessor: group("professor")
    };
  },

  async exportar(format: "csv" | "xlsx" | "pdf", rawFilter: Record<string, unknown>) {
    const resumo = await this.resumo(rawFilter);
    const rows = Object.entries(resumo).map(([metric, value]) => ({ metric, value }));
    if (format === "csv") return { contentType: "text/csv", filename: "relatorio-coracao-gaucho.csv", body: csv(rows) };
    if (format === "xlsx") return { contentType: "application/vnd.ms-excel", filename: "relatorio-coracao-gaucho.xls", body: htmlTable(rows) };
    return { contentType: "application/pdf", filename: "relatorio-coracao-gaucho.pdf", body: simplePdf(rows) };
  }
};
