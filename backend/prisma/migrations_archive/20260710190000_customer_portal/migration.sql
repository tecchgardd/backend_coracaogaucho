ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CUSTOMER';

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "pedido_item" ADD COLUMN IF NOT EXISTS "eventId" INTEGER;
ALTER TABLE "ingresso" ADD COLUMN IF NOT EXISTS "orderId" INTEGER;
ALTER TABLE "inscricao" ADD COLUMN IF NOT EXISTS "orderId" INTEGER;

ALTER TABLE "ingresso" DROP CONSTRAINT IF EXISTS "ingresso_customerId_eventoId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "customer_userId_key" ON "customer"("userId");
CREATE INDEX IF NOT EXISTS "pedido_userId_idx" ON "pedido"("userId");
CREATE INDEX IF NOT EXISTS "pedido_item_eventId_idx" ON "pedido_item"("eventId");
CREATE INDEX IF NOT EXISTS "ingresso_customerId_eventoId_idx" ON "ingresso"("customerId", "eventoId");
CREATE INDEX IF NOT EXISTS "ingresso_orderId_idx" ON "ingresso"("orderId");
CREATE INDEX IF NOT EXISTS "inscricao_orderId_idx" ON "inscricao"("orderId");

ALTER TABLE "customer" ADD CONSTRAINT "customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pedido" ADD CONSTRAINT "pedido_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pedido_item" ADD CONSTRAINT "pedido_item_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "evento"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "ingresso" ADD CONSTRAINT "ingresso_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inscricao" ADD CONSTRAINT "inscricao_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;
