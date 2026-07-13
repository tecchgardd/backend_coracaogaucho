import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { inscricaoCreateSchema, inscricaoQuerySchema, inscricaoUpdateSchema } from "./inscricoes.schemas.js";

type InscricaoInput = z.infer<typeof inscricaoCreateSchema> | z.infer<typeof inscricaoUpdateSchema>;
type InscricaoStatusInput = "PENDENTE" | "CONFIRMADA" | "CONFIRMADO" | "CANCELADA" | "CANCELADO" | "ATIVO";

function normalizeStatus(status?: InscricaoStatusInput) {
  if (status === "CONFIRMADO" || status === "ATIVO") return "CONFIRMADA";
  if (status === "CANCELADO") return "CANCELADA";
  return status ?? "PENDENTE";
}

function mapAddress(data: InscricaoInput) {
  return [data.cep, data.rua, data.numero, data.bairro, data.complemento, data.estado].filter(Boolean).join(" - ") || undefined;
}

async function resolveCustomerId(data: InscricaoInput) {
  if (data.customerId) return data.customerId;
  if (!data.cpf) throw new AppError("Informe customerId ou CPF do aluno", 400);
  const customer = await prisma.customer.upsert({
    where: { cpf: data.cpf },
    update: {
      nome: data.nome ?? undefined,
      telefone: data.telefone ?? undefined,
      email: data.email || undefined,
      cidade: data.cidade ?? undefined,
      endereco: mapAddress(data)
    },
    create: {
      cpf: data.cpf,
      nome: data.nome ?? "Aluno sem nome",
      telefone: data.telefone ?? "",
      email: data.email || undefined,
      cidade: data.cidade,
      endereco: mapAddress(data)
    }
  });
  return customer.id;
}

function resolveEventoId(data: InscricaoInput) {
  const eventoId = data.eventoId ?? data.cursoId;
  if (!eventoId) throw new AppError("Informe o evento/curso da inscricao", 400);
  return eventoId;
}

function getParticipants(data: InscricaoInput) {
  const explicit = Number(data.quantidadeParticipantes ?? 0);
  if (explicit > 0) return explicit;
  const adicionais = Array.isArray(data.adicionais) ? data.adicionais.length : Number(data.quantidadeAdicionais ?? 0);
  return Math.max(1, 1 + adicionais);
}

function normalizePadrinhos(data: InscricaoInput) {
  const participantes = getParticipants(data);
  const esperada = participantes * 2;
  const raw = Array.isArray(data.padrinhos) ? data.padrinhos : [];
  const padded = Array.from({ length: esperada }, (_, index) => ({
    nome: String((raw[index] as { nome?: string } | undefined)?.nome ?? "").trim()
  }));
  const cadastrada = padded.filter((item) => item.nome).length;
  return {
    quantidadeParticipantes: participantes,
    quantidadePadrinhosEsperada: esperada,
    quantidadePadrinhosCadastrada: cadastrada,
    padrinhosStatus: cadastrada >= esperada ? "COMPLETO" as const : "PENDENTE" as const,
    padrinhos: padded
  };
}

async function mapInscricaoCreateData(data: z.infer<typeof inscricaoCreateSchema>): Promise<Prisma.InscricaoUncheckedCreateInput> {
  const padrinhos = normalizePadrinhos(data);
  return {
    eventoId: resolveEventoId(data),
    customerId: await resolveCustomerId(data),
    status: normalizeStatus(data.status),
    nomePar: data.nomePar,
    observacao: data.observacao ?? data.cursoCidadeAnterior,
    padrinho: data.padrinho,
    madrinha: data.madrinha,
    quantidadeParticipantes: padrinhos.quantidadeParticipantes,
    quantidadePadrinhosEsperada: padrinhos.quantidadePadrinhosEsperada,
    quantidadePadrinhosCadastrada: padrinhos.quantidadePadrinhosCadastrada,
    padrinhosStatus: padrinhos.padrinhosStatus,
    padrinhos: padrinhos.padrinhos
  };
}

async function mapInscricaoUpdateData(data: z.infer<typeof inscricaoUpdateSchema>): Promise<Prisma.InscricaoUncheckedUpdateInput> {
  const padrinhos = data.padrinhos || data.quantidadeParticipantes || data.quantidadeAdicionais || data.adicionais
    ? normalizePadrinhos(data)
    : null;
  const next: Prisma.InscricaoUncheckedUpdateInput = {
    status: data.status ? normalizeStatus(data.status) : undefined,
    nomePar: data.nomePar,
    observacao: data.observacao ?? data.cursoCidadeAnterior,
    padrinho: data.padrinho,
    madrinha: data.madrinha,
    quantidadeParticipantes: padrinhos?.quantidadeParticipantes,
    quantidadePadrinhosEsperada: padrinhos?.quantidadePadrinhosEsperada,
    quantidadePadrinhosCadastrada: padrinhos?.quantidadePadrinhosCadastrada,
    padrinhosStatus: padrinhos?.padrinhosStatus,
    padrinhos: padrinhos?.padrinhos
  };
  if (data.eventoId || data.cursoId) next.eventoId = resolveEventoId(data);
  if (data.customerId || data.cpf) next.customerId = await resolveCustomerId(data);
  return next;
}

export const inscricoesService = {
  async listar(query: z.infer<typeof inscricaoQuerySchema>) {
    const where: Prisma.InscricaoWhereInput = {
      eventoId: query.eventoId,
      customerId: query.customerId,
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { customer: { nome: { contains: query.search, mode: "insensitive" } } },
              { customer: { email: { contains: query.search, mode: "insensitive" } } },
              { evento: { nome: { contains: query.search, mode: "insensitive" } } }
            ]
          }
        : {})
    };
    const [data, total] = await Promise.all([
      prisma.inscricao.findMany({
        where,
        ...getPagination(query),
        include: { evento: true, customer: true, pagamento: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.inscricao.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const inscricao = await prisma.inscricao.findUnique({
      where: { id },
      include: { evento: true, customer: true, pagamento: true }
    });
    if (!inscricao) throw new AppError("Inscrição não encontrada", 404);
    return inscricao;
  },

  async criar(data: z.infer<typeof inscricaoCreateSchema>) {
    return prisma.inscricao.create({
      data: await mapInscricaoCreateData(data),
      include: { evento: true, customer: true, pagamento: true }
    });
  },

  async atualizar(id: number, data: z.infer<typeof inscricaoUpdateSchema>) {
    await this.buscar(id);
    return prisma.inscricao.update({
      where: { id },
      data: await mapInscricaoUpdateData(data),
      include: { evento: true, customer: true, pagamento: true }
    });
  },

  async atualizarStatus(id: number, status: InscricaoStatusInput) {
    await this.buscar(id);
    return prisma.inscricao.update({ where: { id }, data: { status: normalizeStatus(status) } });
  },

  async remover(id: number) {
    await this.buscar(id);
    await prisma.inscricao.delete({ where: { id } });
    return { ok: true };
  }
};
