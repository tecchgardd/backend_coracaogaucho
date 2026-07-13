import { prisma } from "../../lib/prisma.js";

export function normalizeCpf(cpf: string) {
  return cpf.replace(/\D/g, "");
}

function sameCpf(storedCpf: string | null | undefined, cpf: string) {
  return normalizeCpf(storedCpf ?? "") === cpf;
}

function mapPerson(customer: Awaited<ReturnType<typeof prisma.customer.findMany>>[number], tipo: "ALUNO" | "CLIENTE" | "COLABORADOR", raw: unknown) {
  return {
    id: String(customer.id),
    tipo,
    nome: customer.nome,
    cpf: customer.cpf,
    email: customer.email,
    telefone: customer.telefone,
    cidade: customer.cidade,
    raw
  };
}

export const pessoasService = {
  async buscarPorCpf(inputCpf: string) {
    const cpf = normalizeCpf(inputCpf);
    if (!cpf) {
      return { success: false, message: "Pessoa não encontrada pelo CPF informado." };
    }

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { cpf: inputCpf },
          { cpf: cpf },
          { cpf: { contains: inputCpf, mode: "insensitive" } },
          { cpf: { contains: cpf, mode: "insensitive" } }
        ]
      },
      include: {
        colaborador: true,
        inscricao: { include: { evento: true }, orderBy: { createdAt: "desc" } }
      },
      take: 25
    });

    const fallbackCustomers = customers.length
      ? customers
      : await prisma.customer.findMany({
          include: {
            colaborador: true,
            inscricao: { include: { evento: true }, orderBy: { createdAt: "desc" } }
          },
          orderBy: { updatedAt: "desc" },
          take: 500
        });

    const customer = fallbackCustomers.find((item) => sameCpf(item.cpf, cpf));
    if (customer) {
      const tipo = customer.colaborador ? "COLABORADOR" : customer.inscricao.length ? "ALUNO" : "CLIENTE";
      return { success: true, data: mapPerson(customer, tipo, customer) };
    }

    const cortesias = await prisma.cortesia.findMany({
      where: {
        OR: [
          { cpf: inputCpf },
          { cpf },
          { cpf: { contains: inputCpf, mode: "insensitive" } },
          { cpf: { contains: cpf, mode: "insensitive" } }
        ]
      },
      include: { evento: true },
      take: 25
    });
    const cortesia = cortesias.find((item) => sameCpf(item.cpf, cpf));
    if (cortesia) {
      return {
        success: true,
        data: {
          id: String(cortesia.id),
          tipo: "CLIENTE" as const,
          nome: cortesia.nome,
          cpf: cortesia.cpf,
          email: null,
          telefone: cortesia.telefone,
          cidade: cortesia.evento?.cidade,
          raw: cortesia
        }
      };
    }

    return { success: false, message: "Pessoa não encontrada pelo CPF informado." };
  }
};

