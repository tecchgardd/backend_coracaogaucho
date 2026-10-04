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

      if (!ingresso) {
        const ingressoLote = await tx.ingressoAluno.findFirst({
          where: { OR: [{ qrcode: codigo }, { codigo }] },
          include: { lote: { include: { evento: true, customer: true } }, validadoPor: true }
        });
        if (!ingressoLote) return { status: "NAO_ENCONTRADO" satisfies ScannerStatus };
        if (ingressoLote.status === "CANCELADO") return { status: "CANCELADO" satisfies ScannerStatus, ingresso: ingressoLote };
        if (ingressoLote.status === "UTILIZADO" || ingressoLote.utilizadoEm) {
          return { status: "JA_UTILIZADO" satisfies ScannerStatus, ingresso: ingressoLote };
        }

        const now = new Date();
        const evento = ingressoLote.lote.evento;
        if (evento.status === "ENCERRADO" || evento.status === "CANCELADO" || evento.data < now) {
          return { status: "EVENTO_EXPIRADO" satisfies ScannerStatus, ingresso: ingressoLote };
        }
        if (!["PAGO", "CORTESIA"].includes(ingressoLote.status)) {
          return { status: "CANCELADO" satisfies ScannerStatus, ingresso: ingressoLote };
        }

        const claimed = await tx.ingressoAluno.updateMany({
          where: { id: ingressoLote.id, utilizadoEm: null, status: { in: ["PAGO", "CORTESIA"] } },
          data: { status: "UTILIZADO", utilizadoEm: now, validadoPorId: colaboradorId }
        });
        if (claimed.count !== 1) return { status: "JA_UTILIZADO" satisfies ScannerStatus, ingresso: ingressoLote };
        const atualizado = await tx.ingressoAluno.findUniqueOrThrow({
          where: { id: ingressoLote.id },
          include: { lote: { include: { evento: true, customer: true } }, validadoPor: true }
        });
        const disponiveis = await tx.ingressoAluno.count({
          where: { loteId: ingressoLote.loteId, status: { in: ["PAGO", "CORTESIA"] } }
        });
        await tx.loteIngressoAluno.update({
          where: { id: ingressoLote.loteId },
          data: { statusOperacional: disponiveis === 0 ? "ESGOTADO" : "PARCIALMENTE_UTILIZADO" }
        });
        await tx.auditLog.create({
          data: {
            action: "SCANNER_VALIDAR",
            entity: "ingresso_aluno",
            entityId: String(ingressoLote.id),
            colaboradorId,
            metadata: { codigo, loteId: ingressoLote.loteId, status: "VALIDO" }
          }
        });
        return { status: "VALIDO" satisfies ScannerStatus, ingresso: atualizado };
      }
      if (ingresso.status === "CANCELADO") return { status: "CANCELADO" satisfies ScannerStatus, ingresso };
      if (ingresso.status === "VALIDADO" || ingresso.validadoEm) {
        return { status: "JA_UTILIZADO" satisfies ScannerStatus, ingresso };
      }
      if (!["PAGO", "CORTESIA"].includes(ingresso.status) || ingresso.paymentStatus === "PENDENTE") {
        return { status: "CANCELADO" satisfies ScannerStatus, ingresso };
      }

      const now = new Date();
      const eventoExpirado =
        ingresso.evento.status === "ENCERRADO" ||
        ingresso.evento.status === "CANCELADO" ||
        ingresso.evento.data < now;

      if (eventoExpirado) return { status: "EVENTO_EXPIRADO" satisfies ScannerStatus, ingresso };

      const claimed = await tx.ingresso.updateMany({
        where: { id: ingresso.id, validadoEm: null, status: { in: ["PAGO", "CORTESIA"] } },
        data: {
          status: "VALIDADO",
          validadoEm: now,
          validadoPorId: colaboradorId
        }
      });
      if (claimed.count !== 1) return { status: "JA_UTILIZADO" satisfies ScannerStatus, ingresso };
      const atualizado = await tx.ingresso.findUniqueOrThrow({
        where: { id: ingresso.id },
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
