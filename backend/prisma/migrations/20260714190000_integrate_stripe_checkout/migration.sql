-- Preserve legacy payment history while making all new attempts
-- explicit, integer-valued Stripe payments linked to an internal order.
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE');
CREATE TYPE "SaleOrigin" AS ENUM ('SITE', 'WHATSAPP', 'PAINEL_ADMIN');

ALTER TYPE "PagamentoStatus" ADD VALUE IF NOT EXISTS 'PROCESSANDO';
ALTER TYPE "PagamentoStatus" ADD VALUE IF NOT EXISTS 'CANCELADO';
ALTER TYPE "PagamentoStatus" ADD VALUE IF NOT EXISTS 'EXPIRADO';
ALTER TYPE "PagamentoStatus" ADD VALUE IF NOT EXISTS 'PARCIALMENTE_ESTORNADO';

-- Prisma may have created this uniqueness rule as a PostgreSQL constraint,
-- whose backing index cannot be dropped directly. Support both legacy shapes.
ALTER TABLE "pagamento" DROP CONSTRAINT IF EXISTS "pagamento_inscricaoId_key";
DROP INDEX IF EXISTS "pagamento_inscricaoId_key";

ALTER TABLE "pagamento"
  ADD COLUMN "pedidoId" INTEGER,
  ADD COLUMN "provider" "PaymentProvider",
  ADD COLUMN "amount" INTEGER,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'brl',
  ADD COLUMN "stripeCheckoutSessionId" TEXT,
  ADD COLUMN "stripePaymentIntentId" TEXT,
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(6),
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "rawProviderData" JSONB;

UPDATE "pagamento" SET "amount" = ROUND("valor" * 100)::INTEGER WHERE "amount" IS NULL;
ALTER TABLE "pagamento" ALTER COLUMN "amount" SET NOT NULL;

ALTER TABLE "pedido"
  ADD COLUMN "totalAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "origin" "SaleOrigin",
  ADD COLUMN "expiresAt" TIMESTAMP(6);
UPDATE "pedido" SET "totalAmount" = ROUND("total" * 100)::INTEGER;

ALTER TABLE "pedido_item"
  ADD COLUMN "unitAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalAmount" INTEGER NOT NULL DEFAULT 0;
UPDATE "pedido_item"
SET "unitAmount" = ROUND("unitPrice" * 100)::INTEGER,
    "totalAmount" = ROUND("total" * 100)::INTEGER;

ALTER TABLE "lote_ingresso_aluno" ADD COLUMN "pedidoId" INTEGER;

CREATE TABLE "payment_webhook_event" (
  "id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "externalId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processingAt" TIMESTAMP(6),
  "processedAt" TIMESTAMP(6),
  "payload" JSONB,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_webhook_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_outbox" (
  "id" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "deduplicationKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "processedAt" TIMESTAMP(6),
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "integration_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pagamento_stripeCheckoutSessionId_key" ON "pagamento"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "pagamento_stripePaymentIntentId_key" ON "pagamento"("stripePaymentIntentId");
CREATE INDEX "idx_pagamento_pedido" ON "pagamento"("pedidoId");
CREATE INDEX "idx_pagamento_inscricao" ON "pagamento"("inscricaoId");
CREATE INDEX "idx_pedido_origin" ON "pedido"("origin");
CREATE INDEX "idx_pedido_expires_at" ON "pedido"("expiresAt");
CREATE UNIQUE INDEX "lote_ingresso_aluno_pedidoId_key" ON "lote_ingresso_aluno"("pedidoId");
CREATE UNIQUE INDEX "payment_webhook_event_externalId_key" ON "payment_webhook_event"("externalId");
CREATE INDEX "payment_webhook_event_provider_type_idx" ON "payment_webhook_event"("provider", "type");
CREATE INDEX "payment_webhook_event_processedAt_idx" ON "payment_webhook_event"("processedAt");
CREATE UNIQUE INDEX "integration_outbox_deduplicationKey_key" ON "integration_outbox"("deduplicationKey");
CREATE INDEX "integration_outbox_status_createdAt_idx" ON "integration_outbox"("status", "createdAt");

ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "lote_ingresso_aluno" ADD CONSTRAINT "lote_ingresso_aluno_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
