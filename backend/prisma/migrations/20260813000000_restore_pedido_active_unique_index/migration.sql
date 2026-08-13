-- Restores a partial unique index that Prisma's schema-diff baselining cannot represent
-- (partial indexes with a WHERE predicate aren't expressible in schema.prisma), so it was
-- silently omitted when prisma/migrations/0_baseline was generated from the live database.
-- The index still physically exists in production (this is IF NOT EXISTS, so applying it
-- there is a safe no-op) -- this migration exists so every OTHER database built from
-- prisma/migrations/ from now on (CI, fresh local dev, migrate dev's shadow database) also
-- gets it. See prisma/migrations_archive/20260802203519_add_pedido_active_unique_constraint
-- for the original migration and src/modules/pagamentos/pagamentos.service.ts:153 for what
-- depends on it (recovering from a lost race on this exact constraint name).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pedido_customer_event_active" ON "pedido" ("customerId", "eventId")
WHERE "status" NOT IN ('CANCELADO', 'EXPIRADO', 'FALHOU') AND "eventId" IS NOT NULL;
