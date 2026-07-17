import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import { buildPaymentShareText, pagamentosService } from "../pagamentos/pagamentos.service.js";
import type { z } from "zod";
import type { atualizarIngressoSchema, atualizarLoteSchema, gerarLoteSchema, ingressoQuerySchema, loteIngressoQuerySchema, registrarPagamentoSchema } from "./ingressos.schemas.js";

const INGRESSOS_POR_PARTICIPANTE = 10;
const COMPROVANTES_MIMES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function ticketCode() {
  return `CG-${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`;
}

function includeBatch() {
  return {
    inscricao: { include: { customer: true, evento: true } },
    tickets: { orderBy: { id: "asc" } },
    historico: { orderBy: { createdAt: "desc" } },
    comprovantes: { orderBy: { createdAt: "desc" } }
  } satisfies Prisma.LoteIngressoAlunoInclude;
}

function includeTicket() {
  return {
    lote: { include: { inscricao: { include: { customer: true, evento: true } } } }
  } satisfies Prisma.IngressoAlunoInclude;
}

function getPixPayload(loteId: number) {
  return `PIX-PENDENTE-CORACAO-GAUCHO-LOTE-${loteId}`;
}

function tryParseJson(value?: string | null) {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { observacao: value };
  }
}

async function history(loteId: number, action: string, data: { fromStatus?: string; toStatus?: string; reason?: string; colaboradorId?: number; metadata?: unknown } = {}) {
  return prisma.historicoPagamento.create({
    data: {
      loteId,
      action,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      reason: data.reason,
      colaboradorId: data.colaboradorId,
      metadata: data.metadata === undefined ? undefined : data.metadata as Prisma.InputJsonValue
    }
  });
}

async function uploadProof(file: Express.Multer.File) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: "coracao-gaucho/comprovantes",
        resource_type: file.mimetype === "application/pdf" ? "raw" : "image"
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Cloudinary nao retornou resultado"));
        resolve(result);
      }
    );
    Readable.from(file.buffer).pipe(upload);
  });
}

export const ingressosService = {
  async listar(query: z.infer<typeof ingressoQuerySchema>) {
    const where: Prisma.IngressoAlunoWhereInput = {
      eventoId: query.eventoId,
      customerId: query.customerId,
      status: query.status as never,
      cidade: query.cidade ? { contains: query.cidade, mode: "insensitive" } : undefined,
      professor: query.professor ? { contains: query.professor, mode: "insensitive" } : undefined,
      ...(query.cpf
        ? { lote: { inscricao: { customer: { cpf: { contains: query.cpf, mode: "insensitive" } } } } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { codigo: { contains: query.search, mode: "insensitive" } },
              { qrcode: { contains: query.search, mode: "insensitive" } },
              { alunoNome: { contains: query.search, mode: "insensitive" } },
              { cursoNome: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [data] = await Promise.all([
      prisma.ingressoAluno.findMany({
        where,
        ...getPagination(query),
        include: includeTicket(),
        orderBy: { createdAt: "desc" }
      })
    ]);
    return data;
  },

  async listarLotes(query: z.infer<typeof loteIngressoQuerySchema>) {
    const and: Prisma.LoteIngressoAlunoWhereInput[] = [];
    if (query.cpf) {
      and.push({ inscricao: { customer: { cpf: { contains: query.cpf, mode: "insensitive" } } } });
    }
    if (query.cidade) {
      and.push({ inscricao: { evento: { cidade: { contains: query.cidade, mode: "insensitive" } } } });
    }
    if (query.professor) {
      and.push({
        inscricao: {
          evento: {
            OR: [
              { atracao: { contains: query.professor, mode: "insensitive" } },
              { observacao: { contains: query.professor, mode: "insensitive" } }
            ]
          }
        }
      });
    }
    if (query.search) {
      and.push({
        OR: [
          { id: Number.isNaN(Number(query.search)) ? undefined : Number(query.search) },
          { inscricao: { customer: { nome: { contains: query.search, mode: "insensitive" } } } },
          { inscricao: { customer: { cpf: { contains: query.search, mode: "insensitive" } } } },
          { inscricao: { evento: { nome: { contains: query.search, mode: "insensitive" } } } }
        ].filter(Boolean) as Prisma.LoteIngressoAlunoWhereInput[]
      });
    }

    const where: Prisma.LoteIngressoAlunoWhereInput = {
      eventoId: query.eventoId,
      customerId: query.customerId,
      paymentStatus: query.status as never,
      AND: and.length ? and : undefined
    };

    return prisma.loteIngressoAluno.findMany({
      where,
      ...getPagination(query),
      include: includeBatch(),
      orderBy: { createdAt: "desc" }
    });
  },

  async buscar(id: number) {
    const ingresso = await prisma.ingressoAluno.findUnique({ where: { id }, include: includeTicket() });
    if (!ingresso) throw new AppError("Ingresso nao encontrado", 404);
    return ingresso;
  },

  async buscarLote(id: number) {
    const lote = await prisma.loteIngressoAluno.findUnique({ where: { id }, include: includeBatch() });
    if (!lote) throw new AppError("Lote nao encontrado", 404);
    return lote;
  },

  async buscarInscricaoPorCpf(cpf: string) {
    const customer = await prisma.customer.findUnique({ where: { cpf } });
    if (!customer) throw new AppError("Aluno nao encontrado", 404);
    const inscricao = await prisma.inscricao.findFirst({
      where: { customerId: customer.id },
      include: { customer: true, evento: true, lotesIngressos: { include: { tickets: true } } },
      orderBy: { createdAt: "desc" }
    });
    if (!inscricao) throw new AppError("Inscricao nao encontrada para este CPF", 404);
    return inscricao;
  },

  async gerarLote(data: z.infer<typeof gerarLoteSchema>, colaboradorId?: number) {
    const inscricao = await this.buscarInscricaoPorCpf(data.cpf);
    if (inscricao.lotesIngressos.length) {
      throw new AppError("Esta inscricao ja possui lote de ingressos gerado", 409);
    }

    const participantes = Math.max(1, inscricao.quantidadeParticipantes ?? 1);
    const quantidade = participantes * INGRESSOS_POR_PARTICIPANTE;
    const valorUnitario = Number(data.valorUnitario ?? 0);
    const valorTotal = quantidade * valorUnitario;

    return prisma.$transaction(async (tx) => {
      const lote = await tx.loteIngressoAluno.create({
        data: {
          inscricaoId: inscricao.id,
          customerId: inscricao.customerId,
          eventoId: inscricao.eventoId,
          quantidade,
          valorUnitario,
          valorTotal,
          dueDate: data.dataLimite,
          paymentUrl: `PENDENTE_GATEWAY_LOTE_${inscricao.id}`,
          boletoUrl: `PENDENTE_BOLETO_LOTE_${inscricao.id}`,
          pixQrCode: getPixPayload(inscricao.id),
          createdById: colaboradorId,
          notes: data.observacoes
        }
      });

      await tx.ingressoAluno.createMany({
        data: Array.from({ length: quantidade }, () => {
          const codigo = ticketCode();
          return {
            loteId: lote.id,
            inscricaoId: inscricao.id,
            customerId: inscricao.customerId,
            eventoId: inscricao.eventoId,
            codigo,
            qrcode: `CGQR:${codigo}`,
            status: "PENDENTE",
            tipo: "NORMAL",
            valor: valorUnitario,
            dueDate: data.dataLimite,
            alunoNome: inscricao.customer.nome,
            cursoNome: inscricao.evento.nome,
            cidade: inscricao.evento.cidade,
            professor: inscricao.evento.atracao ?? inscricao.evento.observacao
          };
        })
      });

      await tx.historicoPagamento.create({
        data: {
          loteId: lote.id,
          action: "LOTE_GERADO",
          toStatus: "PENDENTE",
          reason: data.observacoes,
          colaboradorId,
          metadata: { quantidade, participantes, valorUnitario, valorTotal }
        }
      });

      return tx.loteIngressoAluno.findUniqueOrThrow({ where: { id: lote.id }, include: includeBatch() });
    });
  },

  async atualizarIngresso(id: number, data: z.infer<typeof atualizarIngressoSchema>, colaboradorId?: number) {
    const atual = await this.buscar(id);
    const isCourtesy = data.tipo === "CORTESIA" || data.status === "CORTESIA";
    const nextStatus = isCourtesy ? "CORTESIA" : data.status;
    const ingresso = await prisma.ingressoAluno.update({
      where: { id },
      data: {
        status: nextStatus,
        tipo: isCourtesy ? "CORTESIA" : data.tipo,
        valor: isCourtesy ? 0 : data.valor,
        dueDate: data.dueDate,
        courtesyReason: isCourtesy ? data.motivo : undefined,
        courtesyResponsible: isCourtesy ? data.responsavel : undefined,
        courtesyDate: isCourtesy ? new Date() : undefined,
        notes: data.notes
      },
      include: includeTicket()
    });
    await history(atual.loteId, "INGRESSO_ATUALIZADO", {
      fromStatus: atual.status,
      toStatus: ingresso.status,
      reason: data.motivo ?? data.notes,
      colaboradorId,
      metadata: { ingressoId: id }
    });
    return ingresso;
  },

  async atualizarLote(id: number, data: z.infer<typeof atualizarLoteSchema>, colaboradorId?: number) {
    const lote = await prisma.loteIngressoAluno.findUnique({ where: { id }, include: { tickets: true } });
    if (!lote) throw new AppError("Lote nao encontrado", 404);
    const paymentStatus = data.paymentStatus;
    const ticketStatus = paymentStatus === "PAGO"
      ? "PAGO"
      : paymentStatus === "CANCELADO"
        ? "CANCELADO"
        : paymentStatus === "EXPIRADO"
          ? "EXPIRADO"
          : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.loteIngressoAluno.update({
        where: { id },
        data: {
          paymentStatus,
          status: paymentStatus as never,
          dueDate: data.dueDate,
          notes: data.notes
        }
      });
      if (ticketStatus) {
        await tx.ingressoAluno.updateMany({ where: { loteId: id, tipo: "NORMAL" }, data: { status: ticketStatus } });
      }
      await tx.historicoPagamento.create({
        data: {
          loteId: id,
          action: "LOTE_ATUALIZADO",
          fromStatus: lote.paymentStatus,
          toStatus: paymentStatus,
          reason: data.reason ?? data.notes,
          colaboradorId
        }
      });
      return next;
    });
    return prisma.loteIngressoAluno.findUniqueOrThrow({ where: { id: updated.id }, include: includeBatch() });
  },

  async registrarPagamento(id: number, data: z.infer<typeof registrarPagamentoSchema>, colaboradorId?: number) {
    return this.atualizarLote(id, {
      paymentStatus: data.paymentStatus,
      reason: data.reason ?? "Pagamento registrado manualmente",
      notes: data.notes
    }, colaboradorId);
  },

  async gerarLinkPagamento(id: number, colaboradorId?: number) {
    const lote = await this.buscarLote(id);
    if (lote.paymentStatus === "PAGO") throw new AppError("Lote ja esta pago", 400);
    if (Number(lote.valorTotal) <= 0) throw new AppError("Lote sem valor para cobranca", 400);

    const descricao = `Lote ${lote.id} - ${lote.inscricao.evento.nome}`;
    let pedidoId = lote.pedidoId;
    if (!pedidoId) {
      const totalAmount = Math.round(Number(lote.valorTotal) * 100);
      const unitAmount = Math.round(Number(lote.valorUnitario) * 100);
      const pedido = await prisma.pedido.create({
        data: {
          code: `LOT-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
          type: "EVENT",
          customerId: lote.customerId,
          eventId: lote.eventoId,
          status: "PENDENTE",
          paymentStatus: "PENDENTE",
          paymentMethod: "STRIPE",
          total: Number(lote.valorTotal),
          totalAmount,
          origin: "PAINEL_ADMIN",
          notes: JSON.stringify({ source: "LOTE_INGRESSO", loteId: lote.id, inscricaoId: lote.inscricaoId }),
          items: { create: [{ ticketLotId: lote.id, eventId: lote.eventoId, description: descricao, quantity: lote.quantidade, unitPrice: Number(lote.valorUnitario), total: Number(lote.valorTotal), unitAmount, totalAmount }] }
        }
      });
      pedidoId = pedido.id;
      await prisma.loteIngressoAluno.update({ where: { id }, data: { pedidoId } });
    }
    const pagamento = await pagamentosService.createCheckoutForOrder(pedidoId, "PAINEL_ADMIN", { admin: true });
    const checkoutUrl = pagamento.checkoutUrl;

    const metadata = tryParseJson(lote.notes);
    const updated = await prisma.loteIngressoAluno.update({
      where: { id },
      data: {
        paymentUrl: checkoutUrl,
        paymentStatus: "PENDENTE",
        status: "PENDENTE",
        notes: JSON.stringify({
          ...metadata,
          paymentId: pagamento.paymentId,
          checkoutSessionId: pagamento.checkoutSessionId,
          checkoutUrl
        })
      },
      include: includeBatch()
    });

    await history(id, "LINK_PAGAMENTO_GERADO", {
      colaboradorId,
      metadata: { paymentId: pagamento.paymentId, checkoutSessionId: pagamento.checkoutSessionId, checkoutUrl }
    });

    return {
      lote: updated,
      pagamento,
      checkoutUrl,
      shareText: buildPaymentShareText({
        nome: lote.inscricao.customer.nome,
        descricao,
        valor: Number(lote.valorTotal),
        checkoutUrl
      })
    };
  },

  async anexarComprovante(id: number, file: Express.Multer.File, colaboradorId?: number) {
    const lote = await prisma.loteIngressoAluno.findUnique({ where: { id } });
    if (!lote) throw new AppError("Lote nao encontrado", 404);
    if (!COMPROVANTES_MIMES.has(file.mimetype)) throw new AppError("Formato de comprovante nao permitido", 400);

    const uploaded = await uploadProof(file);
    const comprovante = await prisma.comprovantePagamento.create({
      data: {
        loteId: id,
        originalName: file.originalname,
        url: uploaded.url,
        secureUrl: uploaded.secure_url,
        format: uploaded.format,
        bytes: uploaded.bytes,
        uploadedById: colaboradorId
      }
    });
    await history(id, "COMPROVANTE_ANEXADO", { colaboradorId, metadata: { comprovanteId: comprovante.id } });
    return comprovante;
  }
};
