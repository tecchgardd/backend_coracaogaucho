import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { cortesiaCreateSchema, cortesiaQuerySchema } from "./cortesias.schemas.js";

export const cortesiasService = {
  async listar(query: z.infer<typeof cortesiaQuerySchema>) {
    const where: Prisma.CortesiaWhereInput = {
      eventoid: query.eventoId,
      ...(query.search
        ? {
            OR: [
              { nome: { contains: query.search, mode: "insensitive" } },
              { cpf: { contains: query.search, mode: "insensitive" } },
              { telefone: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [data, total] = await Promise.all([
      prisma.cortesia.findMany({
        where,
        ...getPagination(query),
        include: { evento: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.cortesia.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async criar(data: z.infer<typeof cortesiaCreateSchema>, colaboradorId?: number) {
    const cortesia = await prisma.cortesia.create({
      data: {
        nome: data.nome,
        cpf: data.cpf,
        telefone: data.telefone,
        eventoid: data.eventoId
      }
    });
    if (colaboradorId) {
      await prisma.auditLog.create({
        data: { action: "CORTESIA_CRIAR", entity: "cortesia", entityId: String(cortesia.id), colaboradorId }
      });
    }
    return cortesia;
  },

  async cancelar(id: number, colaboradorId?: number) {
    const cortesia = await prisma.cortesia.findUnique({ where: { id } });
    if (!cortesia) throw new AppError("Cortesia não encontrada", 404);
    await prisma.auditLog.create({
      data: { action: "CORTESIA_CANCELAR", entity: "cortesia", entityId: String(id), colaboradorId, metadata: { cortesia } }
    });
    return { ok: true };
  }
};
