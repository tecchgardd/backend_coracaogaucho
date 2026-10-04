import { Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type {
  colaboradorCreateSchema,
  colaboradorQuerySchema,
  colaboradorResetPasswordSchema,
  colaboradorUpdateSchema
} from "./colaboradores.schemas.js";

function normalizeCpf(cpf: string) {
  return cpf.replace(/\D/g, "");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$!";
  return Array.from({ length: 14 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function mapPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : String(error.meta?.target ?? "");
    if (target.includes("email")) throw new AppError("Email ja cadastrado", 409);
    if (target.includes("cpf")) throw new AppError("CPF ja cadastrado", 409);
    if (target.includes("userId")) throw new AppError("Usuario ja vinculado a outro colaborador", 409);
    throw new AppError("Registro duplicado", 409, error.meta);
  }
  throw error;
}

export const colaboradoresService = {
  async listar(query: z.infer<typeof colaboradorQuerySchema>) {
    const where: Prisma.ColaboradorWhereInput = {
      role: query.role,
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { nome: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { cpf: { contains: normalizeCpf(query.search) } }
            ]
          }
        : {})
    };
    const [data, total] = await Promise.all([
      prisma.colaborador.findMany({ where, include: { user: true }, ...getPagination(query), orderBy: { createdAt: "desc" } }),
      prisma.colaborador.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const colaborador = await prisma.colaborador.findUnique({ where: { id }, include: { user: true } });
    if (!colaborador) throw new AppError("Colaborador nao encontrado", 404);
    return colaborador;
  },

  async criar(data: z.infer<typeof colaboradorCreateSchema>) {
    const email = normalizeEmail(data.email);
    const cpf = normalizeCpf(data.cpf);
    const password = data.password || generateTemporaryPassword();
    const hashedPassword = await hashPassword(password);

    try {
      const colaborador = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: data.nome,
            email,
            role: data.role,
            mustChangePassword: data.mustChangePassword,
            accounts: {
              create: {
                accountId: "",
                providerId: "credential",
                password: hashedPassword
              }
            }
          }
        });

        await tx.account.updateMany({
          where: { userId: user.id, providerId: "credential" },
          data: { accountId: user.id }
        });

        return tx.colaborador.create({
          data: {
            nome: data.nome,
            cpf,
            email,
            role: data.role,
            status: data.status,
            userId: user.id
          },
          include: { user: true }
        });
      });

      return {
        data: colaborador,
        temporaryPassword: data.password ? undefined : password
      };
    } catch (error) {
      mapPrismaError(error);
    }
  },

  async atualizar(id: number, data: z.infer<typeof colaboradorUpdateSchema>) {
    const atual = await this.buscar(id);
    if (!atual.userId) throw new AppError("Colaborador sem usuario vinculado. Corrija o cadastro antes de editar.", 409);

    const colaboradorData: Prisma.ColaboradorUpdateInput = {};
    const userData: Prisma.UserUpdateInput = {};

    if (data.nome !== undefined) {
      colaboradorData.nome = data.nome;
      userData.name = data.nome;
    }
    if (data.cpf !== undefined) colaboradorData.cpf = normalizeCpf(data.cpf);
    if (data.email !== undefined) {
      const email = normalizeEmail(data.email);
      colaboradorData.email = email;
      userData.email = email;
    }
    if (data.role !== undefined) {
      colaboradorData.role = data.role;
      userData.role = data.role;
    }
    if (data.status !== undefined) colaboradorData.status = data.status;

    try {
      return await prisma.$transaction(async (tx) => {
        if (Object.keys(userData).length) {
          await tx.user.update({ where: { id: atual.userId }, data: userData });
        }
        return tx.colaborador.update({
          where: { id },
          data: colaboradorData,
          include: { user: true }
        });
      });
    } catch (error) {
      mapPrismaError(error);
    }
  },

  async resetarSenha(id: number, data: z.infer<typeof colaboradorResetPasswordSchema>) {
    const colaborador = await this.buscar(id);
    if (!colaborador.userId) throw new AppError("Colaborador sem usuario vinculado. Nao e possivel resetar senha.", 409);

    const temporaryPassword = data.password || generateTemporaryPassword();
    const hashedPassword = await hashPassword(temporaryPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: colaborador.userId },
        data: { mustChangePassword: true }
      });

      const credential = await tx.account.findFirst({
        where: { userId: colaborador.userId, providerId: "credential" }
      });

      if (credential) {
        await tx.account.update({
          where: { id: credential.id },
          data: { password: hashedPassword, accountId: colaborador.userId }
        });
      } else {
        await tx.account.create({
          data: {
            userId: colaborador.userId,
            accountId: colaborador.userId,
            providerId: "credential",
            password: hashedPassword
          }
        });
      }

      await tx.session.deleteMany({ where: { userId: colaborador.userId } });
    });

    return {
      data: await this.buscar(id),
      temporaryPassword
    };
  },

  async remover(id: number) {
    const colaborador = await this.buscar(id);
    await prisma.$transaction(async (tx) => {
      await tx.colaborador.delete({ where: { id } });
      await tx.user.delete({ where: { id: colaborador.userId } });
    });
    return { ok: true };
  }
};
