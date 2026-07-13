import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { scannerHistoricoQuerySchema } from "./scanner.schemas.js";

export type ScannerStatus = "VALIDO" | "JA_UTILIZADO" | "CANCELADO" | "NAO_ENCONTRADO" | "EVENTO_EXPIRADO";

export const scannerService = {
  async validar(codigo: string, colaboradorId: number) {
    return prisma.$transaction(async (tx) => {
      const ingresso = await tx.ingresso.findUnique({
        where: { qrcode: codigo },
        include: { evento: true, customer: true }
      });

      if (!ingresso) return { status: "NAO_ENCONTRADO" satisfies ScannerStatus };
      if (ingresso.status === "CANCELADO") return { status: "CANCELADO" satisfies ScannerStatus, ingresso };
      if (ingresso.status === "VALIDADO" || ingresso.validadoEm) {
        return { status: "JA_UTILIZADO" satisfies ScannerStatus, ingresso };
      }

      const now = new Date();
      const eventoExpirado =
        ingresso.evento.status === "ENCERRADO" ||
        ingresso.evento.status === "CANCELADO" ||
        ingresso.evento.data < now;

      if (eventoExpirado) return { status: "EVENTO_EXPIRADO" satisfies ScannerStatus, ingresso };

      const atualizado = await tx.ingresso.update({
        where: { id: ingresso.id },
        data: {
          status: "VALIDADO",
          validadoEm: now,
          validadoPorId: colaboradorId
        },
        include: { evento: true, customer: true, validadoPor: true }
      });

      await tx.auditLog.create({
        data: {
          action: "SCANNER_VALIDAR",
          entity: "ingresso",
          entityId: String(ingresso.id),
          colaboradorId,
          metadata: { codigo, status: "VALIDO" }
        }
      });

      return { status: "VALIDO" satisfies ScannerStatus, ingresso: atualizado };
    });
  },

  historico(query: z.infer<typeof scannerHistoricoQuerySchema>) {
    const where: Prisma.IngressoWhereInput = {
      status: "VALIDADO",
      validadoEm: { not: null },
      eventoId: query.eventoId,
      ...(query.search ? { qrcode: { contains: query.search, mode: "insensitive" } } : {})
    };

    return prisma.ingresso.findMany({
      where,
      ...getPagination(query),
      include: { evento: true, customer: true, validadoPor: true },
      orderBy: { validadoEm: "desc" }
    });
  }
};
