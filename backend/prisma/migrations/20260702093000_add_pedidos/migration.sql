DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PedidoType') THEN
    CREATE TYPE "PedidoType" AS ENUM ('STORE', 'EVENT');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "pedido" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "type" "PedidoType" NOT NULL,
  "customerId" INTEGER NOT NULL,
  "eventId" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "paymentStatus" TEXT DEFAULT 'PENDENTE',
  "paymentMethod" TEXT,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isCourtesy" BOOLEAN NOT NULL DEFAULT false,
  "courtesyReason" TEXT,
  "courtesyResponsible" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pedido_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "pedido_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "evento"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS "pedido_item" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL,
  "productId" INTEGER,
  "ticketLotId" INTEGER,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "total" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pedido_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "pedido"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_pedido_type" ON "pedido"("type");
CREATE INDEX IF NOT EXISTS "idx_pedido_status" ON "pedido"("status");
CREATE INDEX IF NOT EXISTS "idx_pedido_payment_status" ON "pedido"("paymentStatus");
CREATE INDEX IF NOT EXISTS "idx_pedido_customer" ON "pedido"("customerId");
CREATE INDEX IF NOT EXISTS "idx_pedido_event" ON "pedido"("eventId");
CREATE INDEX IF NOT EXISTS "idx_pedido_created_at" ON "pedido"("createdAt");
CREATE INDEX IF NOT EXISTS "idx_pedido_item_order" ON "pedido_item"("orderId");
CREATE INDEX IF NOT EXISTS "idx_pedido_item_product" ON "pedido_item"("productId");
CREATE INDEX IF NOT EXISTS "idx_pedido_item_ticket_lot" ON "pedido_item"("ticketLotId");
