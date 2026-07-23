import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { UploadApiResponse } from "cloudinary";
import { cloudinary } from "../../lib/cloudinary.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import { buildPaymentShareText, pagamentosService } from "../pagamentos/pagamentos.service.js";
import { normalizeCpf } from "../pessoas/pessoas.service.js";
import type { z } from "zod";
import type { atualizarIngressoSchema, atualizarLoteSchema, gerarLoteSchema, ingressoQuerySchema, loteIngressoQuerySchema, registrarPagamentoSchema } from "./ingressos.schemas.js";

const COMPROVANTES_MIMES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

function ticketCode() {
  return `CG-${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`;
}

function includeBatch() {
  return {
    inscricao: { include: { customer: true, evento: true } },
    customer: true,
    evento: true,
    tickets: { orderBy: { id: "asc" } },
    historico: { orderBy: { createdAt: "desc" } },
    comprovantes: { orderBy: { createdAt: "desc" } }
  } satisfies Prisma.LoteIngressoAlunoInclude;
}

function includeTicket() {
  return {
    lote: { include: { inscricao: { include: { customer: true, evento: true } }, customer: true, evento: true } }
  } satisfies Prisma.IngressoAlunoInclude;
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
        ? { lote: { customer: { cpf: { contains: query.cpf, mode: "insensitive" } } } }
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
      and.push({ customer: { cpf: { contains: query.cpf, mode: "insensitive" } } });
    }
    if (query.cidade) {
      and.push({ evento: { cidade: { contains: query.cidade, mode: "insensitive" } } });
    }
    if (query.professor) {
      and.push({
        evento: {
          OR: [
            { atracao: { contains: query.professor, mode: "insensitive" } },
            { observacao: { contains: query.professor, mode: "insensitive" } }
          ]
        }
      });
    }
    if (query.search) {
      and.push({
        OR: [
          { id: Number.isNaN(Number(query.search)) ? undefined : Number(query.search) },
          { customer: { nome: { contains: query.search, mode: "insensitive" } } },
          { customer: { cpf: { contains: query.search, mode: "insensitive" } } },
          { evento: { nome: { contains: query.search, mode: "insensitive" } } }
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
    const customer = data.customerId
      ? await prisma.customer.findUnique({ where: { id: data.customerId } })
      : await prisma.customer.findUnique({ where: { cpf: normalizeCpf(data.cpf ?? "") } });
    if (!customer) throw new AppError("Aluno não encontrado", 404);

    const evento = await prisma.evento.findUnique({ where: { id: data.eventoId } });
    if (!evento) throw new AppError("Evento ou baile não encontrado", 404);
    if (evento.tipo !== "BAILE") throw new AppError("Lote de ingressos é exclusivo para baile", 400);
    if (evento.status !== "ATIVO") throw new AppError("O baile precisa estar ativo", 409);

    const quantidade = data.quantidade;
    const valorUnitario = Number(evento.preco);
    const valorTotal = quantidade * valorUnitario;

    return prisma.$transaction(async (tx) => {
      const eventoAtual = await tx.evento.findUnique({ where: { id: evento.id } });
      if (!eventoAtual || eventoAtual.tipo !== "BAILE" || eventoAtual.status !== "ATIVO") {
        throw new AppError("O baile não está disponível", 409);
      }
      const [ingressosAvulsos, ingressosEmLotes] = await Promise.all([
        tx.ingresso.count({ where: { eventoId: evento.id, status: { notIn: ["CANCELADO", "EXPIRADO"] } } }),
        tx.ingressoAluno.count({ where: { eventoId: evento.id, status: { notIn: ["CANCELADO", "EXPIRADO"] } } })
      ]);
      if (eventoAtual.capacidade != null && ingressosAvulsos + ingressosEmLotes + quantidade > eventoAtual.capacidade) {
        throw new AppError("Quantidade excede a capacidade disponível do evento", 409);
      }

      let pedidoId = data.pedidoId;
      if (pedidoId) {
        const pedido = await tx.pedido.findFirst({
          where: { id: pedidoId, type: "EVENT", customerId: customer.id, eventId: evento.id }
        });
        if (!pedido) throw new AppError("Venda incompatível com o aluno ou evento selecionado", 409);
        const loteExistente = await tx.loteIngressoAluno.findUnique({ where: { pedidoId } });
        if (loteExistente) throw new AppError("A venda já está vinculada a outro lote", 409);
      }

      const pagamentoImediato = data.origemFinanceira === "PAGAMENTO_EXTERNO";
      const cortesia = data.origemFinanceira === "CORTESIA";
      if (data.origemFinanceira === "NOVA_VENDA" || pagamentoImediato) {
        const statusFinanceiro = pagamentoImediato ? "PAGO" : "PENDENTE";
        const pedido = await tx.pedido.create({
          data: {
            code: `VEN-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
            type: "EVENT",
            customerId: customer.id,
            eventId: evento.id,
            status: statusFinanceiro,
            paymentStatus: statusFinanceiro,
            paymentMethod: pagamentoImediato ? data.formaPagamentoExterno : "LINK_PAGAMENTO",
            total: valorTotal,
            totalAmount: Math.round(valorTotal * 100),
            origin: "PAINEL_ADMIN",
            notes: JSON.stringify({ tipoVenda: evento.tipo, source: "LOTE_INGRESSO", observacao: data.observacoes }),
            items: {
              create: [{
                eventId: evento.id,
                description: `Lote de ingressos - ${evento.nome}`,
                quantity: quantidade,
                unitPrice: valorUnitario,
                total: valorTotal,
                unitAmount: Math.round(valorUnitario * 100),
                totalAmount: Math.round(valorTotal * 100)
              }]
            }
          }
        });
        pedidoId = pedido.id;

        if (pagamentoImediato) {
          await tx.pagamento.create({
            data: {
              pedidoId: pedido.id,
              customerId: customer.id,
              eventoId: evento.id,
              nomeCustomer: customer.nome,
              cpfCustomer: customer.cpf,
              valor: valorTotal,
              amount: Math.round(valorTotal * 100),
              status: "PAGO",
              paidAt: new Date(),
              gatewayId: `MANUAL-${randomUUID()}`,
              rawProviderData: {
                source: "PAINEL_ADMIN",
                method: data.formaPagamentoExterno,
                colaboradorId
              }
            }
          });
        }
      }

      const paymentStatus = pagamentoImediato || cortesia || data.origemFinanceira === "SEM_COBRANCA" ? "PAGO" : "PENDENTE";
      const ticketStatus = cortesia ? "CORTESIA" : paymentStatus;
      const lote = await tx.loteIngressoAluno.create({
        data: {
          customerId: customer.id,
          eventoId: evento.id,
          quantidade,
          valorUnitario,
          valorTotal: cortesia || data.origemFinanceira === "SEM_COBRANCA" ? 0 : valorTotal,
          status: paymentStatus,
          paymentStatus,
          origemFinanceira: data.origemFinanceira,
          statusOperacional: "ATIVO",
          dueDate: data.dataLimite,
          pedidoId,
          createdById: colaboradorId,
          notes: data.observacoes
        }
      });

      await tx.ingressoAluno.createMany({
        data: Array.from({ length: quantidade }, () => {
          const codigo = ticketCode();
          return {
            loteId: lote.id,
            customerId: customer.id,
            eventoId: evento.id,
            codigo,
            qrcode: `CGQR:${codigo}`,
            status: ticketStatus,
            tipo: cortesia ? "CORTESIA" : "NORMAL",
            valor: cortesia ? 0 : valorUnitario,
            dueDate: data.dataLimite,
            alunoNome: customer.nome,
            cursoNome: evento.nome,
            cidade: evento.cidade,
            professor: evento.atracao ?? evento.observacao,
            courtesyReason: cortesia ? data.observacoes : undefined,
            courtesyResponsible: cortesia ? String(colaboradorId ?? "ADMIN") : undefined,
            courtesyDate: cortesia ? new Date() : undefined
          };
        })
      });

      await tx.historicoPagamento.create({
        data: {
          loteId: lote.id,
          action: "LOTE_GERADO",
          toStatus: paymentStatus,
          reason: data.observacoes,
          colaboradorId,
          metadata: { quantidade, valorUnitario, valorTotal, origemFinanceira: data.origemFinanceira, pedidoId }
        }
      });
      await tx.auditLog.create({
        data: {
          action: pagamentoImediato ? "LOTE_VENDIDO_PAGAMENTO_EXTERNO" : "LOTE_GERADO",
          entity: "LoteIngressoAluno",
          entityId: String(lote.id),
          colaboradorId,
          metadata: {
            quantidade,
            valorUnitario,
            valorTotal,
            origemFinanceira: data.origemFinanceira,
            pedidoId,
            formaPagamento: data.formaPagamentoExterno
          }
        }
      });

      return tx.loteIngressoAluno.findUniqueOrThrow({ where: { id: lote.id }, include: includeBatch() });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
        await tx.ingressoAluno.updateMany({
          where: {
            loteId: id,
            tipo: "NORMAL",
            ...(ticketStatus === "CANCELADO" || ticketStatus === "EXPIRADO"
              ? { status: { not: "UTILIZADO" } }
              : {})
          },
          data: { status: ticketStatus }
        });
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

    const descricao = `Lote ${lote.id} - ${lote.evento.nome}`;
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
        nome: lote.customer.nome,
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
