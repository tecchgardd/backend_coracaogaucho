ALTER TABLE "ingresso"
ADD COLUMN IF NOT EXISTS "validadoEm" TIMESTAMP(6),
ADD COLUMN IF NOT EXISTS "validadoPorId" INTEGER;

CREATE INDEX IF NOT EXISTS "ingresso_validadoPorId_idx" ON "ingresso"("validadoPorId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ingresso_validadoPorId_fkey') THEN
    ALTER TABLE "ingresso"
    ADD CONSTRAINT "ingresso_validadoPorId_fkey"
    FOREIGN KEY ("validadoPorId") REFERENCES "colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
