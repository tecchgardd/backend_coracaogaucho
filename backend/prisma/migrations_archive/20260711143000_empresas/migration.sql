CREATE TABLE "empresa" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "imagemUrl" TEXT NOT NULL,
  "imagemPublicId" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "publicado" BOOLEAN NOT NULL DEFAULT true,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "empresa_imagemPublicId_key" ON "empresa"("imagemPublicId");
CREATE INDEX "idx_empresa_ativo" ON "empresa"("ativo");
CREATE INDEX "idx_empresa_publicado" ON "empresa"("publicado");
CREATE INDEX "idx_empresa_ordem" ON "empresa"("ordem");
