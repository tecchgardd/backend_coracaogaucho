-- Preserve every legacy lot while allowing new event/baile lots to exist
-- independently from course registrations.
ALTER TABLE "lote_ingresso_aluno"
  ALTER COLUMN "inscricaoId" DROP NOT NULL,
  ADD COLUMN "origemFinanceira" TEXT NOT NULL DEFAULT 'LEGADO_CURSO',
  ADD COLUMN "statusOperacional" TEXT NOT NULL DEFAULT 'ATIVO';

ALTER TABLE "ingresso_aluno"
  ALTER COLUMN "inscricaoId" DROP NOT NULL,
  ADD COLUMN "utilizadoEm" TIMESTAMP(6),
  ADD COLUMN "validadoPorId" INTEGER;

ALTER TABLE "lote_ingresso_aluno"
  ADD CONSTRAINT "lote_ingresso_aluno_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customer"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION,
  ADD CONSTRAINT "lote_ingresso_aluno_eventoId_fkey"
    FOREIGN KEY ("eventoId") REFERENCES "evento"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "idx_lote_ingresso_origem_financeira"
  ON "lote_ingresso_aluno"("origemFinanceira");

CREATE INDEX "idx_lote_ingresso_status_operacional"
  ON "lote_ingresso_aluno"("statusOperacional");

CREATE INDEX "idx_ingresso_aluno_validado_por"
  ON "ingresso_aluno"("validadoPorId");

ALTER TABLE "ingresso_aluno"
  ADD CONSTRAINT "ingresso_aluno_validadoPorId_fkey"
    FOREIGN KEY ("validadoPorId") REFERENCES "colaborador"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
