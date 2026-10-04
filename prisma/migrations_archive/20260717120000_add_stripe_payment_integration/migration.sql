-- Incremental Stripe lifecycle support. No existing data is deleted.
ALTER TYPE "PagamentoStatus" ADD VALUE IF NOT EXISTS 'CONTESTADO';
ALTER TYPE "PagamentoStatus" ADD VALUE IF NOT EXISTS 'CONTESTACAO_PERDIDA';

ALTER TABLE "pagamento"
  ADD COLUMN IF NOT EXISTS "stripeChargeId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeDisputeId" TEXT,
  ADD COLUMN IF NOT EXISTS "refundedAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS "disputedAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "disputeStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "statusBeforeDispute" "PagamentoStatus";

ALTER TABLE "payment_webhook_event"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "error" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "payment_refund" (
  "id" TEXT NOT NULL,
  "pagamentoId" INTEGER NOT NULL,
  "stripeRefundId" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'brl',
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "reason" TEXT NOT NULL,
  "stripeReason" TEXT,
  "requestedById" INTEGER,
  "failureReason" TEXT,
  "rawProviderData" JSONB,
  "refundedAt" TIMESTAMP(6),
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "payment_refund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "pagamento_stripeChargeId_key" ON "pagamento"("stripeChargeId");
CREATE UNIQUE INDEX IF NOT EXISTS "pagamento_stripeDisputeId_key" ON "pagamento"("stripeDisputeId");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refund_stripeRefundId_key" ON "payment_refund"("stripeRefundId");
CREATE INDEX IF NOT EXISTS "payment_refund_pagamentoId_createdAt_idx" ON "payment_refund"("pagamentoId", "createdAt");
CREATE INDEX IF NOT EXISTS "payment_refund_status_idx" ON "payment_refund"("status");

DO $$ BEGIN
  ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_pagamentoId_fkey"
    FOREIGN KEY ("pagamentoId") REFERENCES "pagamento"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
