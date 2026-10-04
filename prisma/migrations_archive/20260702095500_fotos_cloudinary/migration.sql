CREATE TABLE IF NOT EXISTS "foto" (
  "id" TEXT PRIMARY KEY,
  "originalName" TEXT NOT NULL,
  "publicId" TEXT NOT NULL UNIQUE,
  "url" TEXT NOT NULL,
  "secureUrl" TEXT NOT NULL,
  "format" TEXT,
  "bytes" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "folder" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_foto_folder" ON "foto"("folder");
CREATE INDEX IF NOT EXISTS "idx_foto_created_at" ON "foto"("createdAt");
CREATE INDEX IF NOT EXISTS "idx_foto_uploaded_by" ON "foto"("uploadedById");
