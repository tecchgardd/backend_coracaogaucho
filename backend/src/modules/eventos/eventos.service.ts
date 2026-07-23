import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { eventoCreateSchema, eventoQuerySchema, eventoUpdateSchema } from "./eventos.schemas.js";

export function mapEventoData(data: z.infer<typeof eventoUpdateSchema>) {
  const banner = data.banner !== undefined ? data.banner : data.imagemUrl;

  return {
    nome: data.nome ?? data.titulo,
    tipo: data.tipo,
    local: data.local,
    cidade: data.cidade,
    data: data.data ?? data.dataInicio,
    status: data.status,
    capacidade: data.capacidade,
    preco: data.preco,
    qrcode: data.qrcode,
    ...(banner !== undefined ? { banner } : {}),
    observacao: data.observacao ?? data.descricao,
    atracao: data.atracao,
    dataLimiteInscricao: data.dataLimiteInscricao,
    precoAntecipado: data.precoAntecipado,
    dataLimiteAntecipado: data.dataLimiteAntecipado
  };
}

export const eventosService = {
  async listar(query: z.infer<typeof eventoQuerySchema>) {
    const where: Prisma.EventoWhereInput = {
      status: query.status,
      tipo: query.tipo,
      ...(query.search
        ? {
            OR: [
              { nome: { contains: query.search, mode: "insensitive" } },
              { observacao: { contains: query.search, mode: "insensitive" } },
              { local: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [data, total] = await Promise.all([
      prisma.evento.findMany({
        where,
        ...getPagination(query),
        orderBy: { data: "desc" }
      }),
      prisma.evento.count({ where })
    ]);

    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const evento = await prisma.evento.findUnique({
      where: { id },
      include: { _count: { select: { ingresso: true, inscricao: true, cortesia: true } } }
    });
    if (!evento) throw new AppError("Evento não encontrado", 404);
    return evento;
  },

  criar(data: z.infer<typeof eventoCreateSchema>) {
    return prisma.evento.create({
      data: {
        ...mapEventoData(data),
        nome: data.nome ?? data.titulo ?? "",
        data: data.data ?? data.dataInicio ?? new Date(),
        tipo: data.tipo,
        local: data.local,
        preco: data.preco,
        qrcode: data.qrcode ?? `EVT-${randomUUID()}`,
        banner: data.banner !== undefined ? data.banner : data.imagemUrl ?? null
      }
    });
  },

  async atualizar(id: number, data: z.infer<typeof eventoUpdateSchema>) {
    await this.buscar(id);
    return prisma.evento.update({ where: { id }, data: mapEventoData(data) });
  },

  async remover(id: number) {
    await this.buscar(id);
    await prisma.evento.delete({ where: { id } });
    return { ok: true };
  }
};
