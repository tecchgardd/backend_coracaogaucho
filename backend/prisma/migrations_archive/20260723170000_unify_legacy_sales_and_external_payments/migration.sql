-- Unify legacy confirmed payments with the Pedido-based sales ledger.
-- This migration is additive and preserves every financial record.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'EXTERNO';
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'CORTESIA';

ALTER TABLE "pagamento"
  ADD COLUMN IF NOT EXISTS "method" TEXT,
  ADD COLUMN IF NOT EXISTS "externalReference" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "replacedPaymentId" INTEGER;

-- Older Stripe rows predate provider. gatewayId is retained and no Stripe ID is changed.
UPDATE "pagamento"
SET "provider" = 'STRIPE'
WHERE "provider" IS NULL
  AND ("stripeCheckoutSessionId" IS NOT NULL
    OR "stripePaymentIntentId" IS NOT NULL
    OR "stripeChargeId" IS NOT NULL
    OR "gatewayId" LIKE 'cs_%'
    OR "gatewayId" LIKE 'pi_%');

-- Each orphan financial record receives exactly one central Pedido. The payment id
-- is embedded in the public code, making this backfill safe to rerun.
INSERT INTO "pedido" (
  "code", "type", "customerId", "eventId", "status", "paymentStatus",
  "paymentMethod", "total", "totalAmount", "origin", "createdAt", "updatedAt"
)
SELECT
  'LEG-PAY-' || p."id",
  'EVENT'::"PedidoType",
  p."customerId",
  p."eventoId",
  CASE WHEN p."status" = 'PAGO' THEN 'PAGO' ELSE p."status"::text END,
  p."status"::text,
  COALESCE(p."method", CASE WHEN p."provider" = 'STRIPE' THEN 'STRIPE' ELSE 'EXTERNO' END),
  p."valor",
  p."amount",
  'PAINEL_ADMIN'::"SaleOrigin",
  p."createdAt",
  p."updatedAt"
FROM "pagamento" p
WHERE p."pedidoId" IS NULL
ON CONFLICT ("code") DO NOTHING;

UPDATE "pagamento" p
SET "pedidoId" = o."id"
FROM "pedido" o
WHERE p."pedidoId" IS NULL
  AND o."code" = 'LEG-PAY-' || p."id";

INSERT INTO "pedido_item" (
  "orderId", "eventId", "description", "quantity", "unitPrice", "total",
  "unitAmount", "totalAmount", "createdAt", "updatedAt"
)
SELECT
  o."id",
  p."eventoId",
  COALESCE(e."nome", 'Venda legada'),
  1,
  p."valor",
  p."valor",
  p."amount",
  p."amount",
  p."createdAt",
  p."updatedAt"
FROM "pagamento" p
JOIN "pedido" o ON o."id" = p."pedidoId"
LEFT JOIN "evento" e ON e."id" = p."eventoId"
WHERE o."code" = 'LEG-PAY-' || p."id"
  AND NOT EXISTS (SELECT 1 FROM "pedido_item" i WHERE i."orderId" = o."id");

UPDATE "inscricao" i
SET "orderId" = p."pedidoId"
FROM "pagamento" p
WHERE p."inscricaoId" = i."id"
  AND i."orderId" IS NULL
  AND p."pedidoId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "pagamento_replacedPaymentId_key"
  ON "pagamento"("replacedPaymentId");
CREATE INDEX IF NOT EXISTS "idx_pagamento_provider_status"
  ON "pagamento"("provider", "status");
CREATE INDEX IF NOT EXISTS "idx_pagamento_method"
  ON "pagamento"("method");

DO $$ BEGIN
  ALTER TABLE "pagamento" ADD CONSTRAINT "pagamento_replacedPaymentId_fkey"
    FOREIGN KEY ("replacedPaymentId") REFERENCES "pagamento"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
