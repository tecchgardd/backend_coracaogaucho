CREATE TYPE "PadrinhosStatus" AS ENUM ('PENDENTE', 'COMPLETO');
CREATE TYPE "LoteIngressoStatus" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO', 'EXPIRADO');
CREATE TYPE "PagamentoLoteStatus" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO', 'EXPIRADO');
CREATE TYPE "IngressoAlunoStatus" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO', 'EXPIRADO', 'CORTESIA', 'UTILIZADO');
CREATE TYPE "IngressoAlunoTipo" AS ENUM ('NORMAL', 'CORTESIA');

ALTER TABLE "inscricao"
  ADD COLUMN "quantidadeParticipantes" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "quantidadePadrinhosEsperada" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "quantidadePadrinhosCadastrada" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "padrinhosStatus" "PadrinhosStatus" NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN "padrinhos" JSONB;

CREATE TABLE "lote_ingresso_aluno" (
  "id" SERIAL NOT NULL,
  "inscricaoId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "eventoId" INTEGER NOT NULL,
  "quantidade" INTEGER NOT NULL,
  "valorUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "LoteIngressoStatus" NOT NULL DEFAULT 'PENDENTE',
  "paymentStatus" "PagamentoLoteStatus" NOT NULL DEFAULT 'PENDENTE',
  "paymentUrl" TEXT,
  "boletoUrl" TEXT,
  "pixQrCode" TEXT,
  "gatewayId" TEXT,
  "dueDate" TIMESTAMP(6),
  "notificationStatus" TEXT NOT NULL DEFAULT 'PENDENTE',
  "createdById" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "lote_ingresso_aluno_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ingresso_aluno" (
  "id" SERIAL NOT NULL,
  "loteId" INTEGER NOT NULL,
  "inscricaoId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "eventoId" INTEGER NOT NULL,
  "codigo" TEXT NOT NULL,
  "qrcode" TEXT NOT NULL,
  "status" "IngressoAlunoStatus" NOT NULL DEFAULT 'PENDENTE',
  "tipo" "IngressoAlunoTipo" NOT NULL DEFAULT 'NORMAL',
  "valor" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "issuedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(6),
  "alunoNome" TEXT NOT NULL,
  "cursoNome" TEXT NOT NULL,
  "cidade" TEXT,
  "professor" TEXT,
  "courtesyReason" TEXT,
  "courtesyResponsible" TEXT,
  "courtesyDate" TIMESTAMP(6),
  "notes" TEXT,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "ingresso_aluno_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "historico_pagamento" (
  "id" SERIAL NOT NULL,
  "loteId" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "colaboradorId" INTEGER,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "historico_pagamento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "comprovante_pagamento" (
  "id" SERIAL NOT NULL,
  "loteId" INTEGER NOT NULL,
  "originalName" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "secureUrl" TEXT NOT NULL,
  "format" TEXT,
  "bytes" INTEGER,
  "uploadedById" INTEGER,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comprovante_pagamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lote_ingresso_aluno_inscricaoId_key" ON "lote_ingresso_aluno"("inscricaoId");
CREATE UNIQUE INDEX "ingresso_aluno_codigo_key" ON "ingresso_aluno"("codigo");
CREATE UNIQUE INDEX "ingresso_aluno_qrcode_key" ON "ingresso_aluno"("qrcode");

CREATE INDEX "idx_lote_ingresso_customer" ON "lote_ingresso_aluno"("customerId");
CREATE INDEX "idx_lote_ingresso_evento" ON "lote_ingresso_aluno"("eventoId");
CREATE INDEX "idx_lote_ingresso_status" ON "lote_ingresso_aluno"("status");
CREATE INDEX "idx_lote_ingresso_payment_status" ON "lote_ingresso_aluno"("paymentStatus");
CREATE INDEX "idx_ingresso_aluno_lote" ON "ingresso_aluno"("loteId");
CREATE INDEX "idx_ingresso_aluno_inscricao" ON "ingresso_aluno"("inscricaoId");
CREATE INDEX "idx_ingresso_aluno_customer" ON "ingresso_aluno"("customerId");
CREATE INDEX "idx_ingresso_aluno_evento" ON "ingresso_aluno"("eventoId");
CREATE INDEX "idx_ingresso_aluno_status" ON "ingresso_aluno"("status");
CREATE INDEX "idx_ingresso_aluno_tipo" ON "ingresso_aluno"("tipo");
CREATE INDEX "idx_historico_pagamento_lote" ON "historico_pagamento"("loteId");
CREATE INDEX "idx_historico_pagamento_colaborador" ON "historico_pagamento"("colaboradorId");
CREATE INDEX "idx_comprovante_pagamento_lote" ON "comprovante_pagamento"("loteId");
CREATE INDEX "idx_comprovante_pagamento_user" ON "comprovante_pagamento"("uploadedById");

ALTER TABLE "lote_ingresso_aluno"
  ADD CONSTRAINT "lote_ingresso_aluno_inscricaoId_fkey"
  FOREIGN KEY ("inscricaoId") REFERENCES "inscricao"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "ingresso_aluno"
  ADD CONSTRAINT "ingresso_aluno_loteId_fkey"
  FOREIGN KEY ("loteId") REFERENCES "lote_ingresso_aluno"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "historico_pagamento"
  ADD CONSTRAINT "historico_pagamento_loteId_fkey"
  FOREIGN KEY ("loteId") REFERENCES "lote_ingresso_aluno"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "comprovante_pagamento"
  ADD CONSTRAINT "comprovante_pagamento_loteId_fkey"
  FOREIGN KEY ("loteId") REFERENCES "lote_ingresso_aluno"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
