-- Prevents concurrent checkout calls from creating more than one active (non-terminal)
-- Pedido for the same customer+event, closing the race behind the WhatsApp double-checkout bug.
-- "Active" = any status other than CANCELADO/EXPIRADO/FALHOU. expiresAt is intentionally not part
-- of the predicate because partial index predicates must be immutable (can't reference now());
-- expired-but-not-yet-transitioned pending orders are still expected to move to EXPIRADO/FALHOU
-- via the existing application-level flows.
CREATE UNIQUE INDEX "uq_pedido_customer_event_active" ON "pedido" ("customerId", "eventId")
WHERE "status" NOT IN ('CANCELADO', 'EXPIRADO', 'FALHOU') AND "eventId" IS NOT NULL;
