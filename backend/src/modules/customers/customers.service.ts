import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { customerCreateSchema, customerQuerySchema, customerUpdateSchema } from "./customers.schemas.js";

function mapAddress(data: { endereco?: string; cep?: string; rua?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; complemento?: string }) {
  return data.endereco ?? ([data.cep, data.rua, data.numero, data.bairro, data.complemento].filter(Boolean).join(" - ") || undefined);
}

export const customersService = {
  async listar(query: z.infer<typeof customerQuerySchema>) {
    const where: Prisma.CustomerWhereInput = {
      cpf: query.cpf ? { contains: query.cpf, mode: "insensitive" } : undefined,
      telefone: query.telefone ? { contains: query.telefone, mode: "insensitive" } : undefined,
      email: query.email ? { contains: query.email, mode: "insensitive" } : undefined,
      ...(query.search
        ? {
          OR: [
            { nome: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
            { telefone: { contains: query.search, mode: "insensitive" } },
            { cpf: { contains: query.search, mode: "insensitive" } }
          ]
        }
        : {})
    };
    const [data, total] = await Promise.all([
      prisma.customer.findMany({ where, ...getPagination(query), orderBy: { createdAt: "desc" } }),
      prisma.customer.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new AppError("Customer não encontrado", 404);
    return customer;
  },

  async historico(id: number) {
    const customer = await this.buscar(id);
    const [ingressos, inscricoes, pagamentos, cortesias] = await Promise.all([
      prisma.ingresso.findMany({ where: { customerId: id }, include: { evento: true }, orderBy: { createdAt: "desc" } }),
      prisma.inscricao.findMany({ where: { customerId: id }, include: { evento: true }, orderBy: { createdAt: "desc" } }),
      prisma.pagamento.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" } }),
      prisma.cortesia.findMany({ where: { cpf: customer.cpf }, include: { evento: true }, orderBy: { createdAt: "desc" } })
    ]);
    return { ingressos, inscricoes, pagamentos, cortesias };
  },

  criar(data: z.infer<typeof customerCreateSchema>) {
    return prisma.customer.create({
      data: {
        nome: data.nome,
        cpf: data.cpf,
        telefone: data.telefone,
        email: data.email || undefined,
        cidade: data.cidade,
        endereco: mapAddress(data)
      }
    });
  },

  async atualizar(id: number, data: z.infer<typeof customerUpdateSchema>) {
    await this.buscar(id);
    return prisma.customer.update({
      where: { id },
      data: {
        nome: data.nome,
        cpf: data.cpf,
        telefone: data.telefone,
        email: data.email || undefined,
        cidade: data.cidade,
        endereco: mapAddress(data)
      }
    });
  },

  async remover(id: number) {
    await this.buscar(id);
    await prisma.customer.delete({ where: { id } });
    return { ok: true };
  }
};
