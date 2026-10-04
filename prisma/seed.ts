import "dotenv/config";
import { auth } from "../src/lib/auth.js";
import { prisma } from "../src/lib/prisma.js";

const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@coracaogaucho.com.br").toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
const adminName = process.env.ADMIN_NAME ?? "Administrador";
const adminCpf = (process.env.ADMIN_CPF ?? "00000000000").replace(/\D/g, "");

async function main() {
  let user = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!user) {
    const result = await auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
        name: adminName
      }
    });

    user = await prisma.user.findUnique({ where: { id: result.user.id } });
  }

  if (!user) {
    throw new Error("Nao foi possivel criar o usuario ADMIN inicial");
  }

  user = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: adminName,
      email: adminEmail,
      role: "ADMIN",
      mustChangePassword: false
    }
  });

  await prisma.colaborador.upsert({
    where: { email: adminEmail },
    create: {
      nome: adminName,
      cpf: adminCpf,
      email: adminEmail,
      role: "ADMIN",
      status: "ATIVO",
      userId: user.id
    },
    update: {
      nome: adminName,
      cpf: adminCpf,
      email: adminEmail,
      role: "ADMIN",
      status: "ATIVO",
      userId: user.id
    }
  });

  console.log(`Admin pronto: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
