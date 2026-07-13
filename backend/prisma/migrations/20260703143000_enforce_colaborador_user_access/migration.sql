ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'STAFF',
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "colaborador"
  ADD COLUMN IF NOT EXISTS "cpf" TEXT;

UPDATE "colaborador"
SET "cpf" = 'PENDENTE-' || "id"
WHERE "cpf" IS NULL OR btrim("cpf") = '';

ALTER TABLE "colaborador"
  ALTER COLUMN "cpf" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "colaborador_cpf_key" ON "colaborador"("cpf");

UPDATE "user" u
SET
  "role" = c."role",
  "mustChangePassword" = COALESCE(u."mustChangePassword", false)
FROM "colaborador" c
WHERE c."userId" = u."id";

UPDATE "colaborador" c
SET "userId" = u."id"
FROM "user" u
WHERE c."userId" IS NULL
  AND lower(u."email") = lower(c."email")
  AND NOT EXISTS (
    SELECT 1
    FROM "colaborador" other
    WHERE other."userId" = u."id"
      AND other."id" <> c."id"
  );

INSERT INTO "user" (
  "id",
  "name",
  "email",
  "emailVerified",
  "role",
  "mustChangePassword",
  "createdAt",
  "updatedAt"
)
SELECT
  'colab_' || c."id" || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16),
  c."nome",
  c."email",
  false,
  c."role",
  true,
  now(),
  now()
FROM "colaborador" c
WHERE c."userId" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "user" u
    WHERE lower(u."email") = lower(c."email")
  );

UPDATE "colaborador" c
SET "userId" = u."id"
FROM "user" u
WHERE c."userId" IS NULL
  AND lower(u."email") = lower(c."email");

ALTER TABLE "colaborador"
  ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "colaborador"
  DROP CONSTRAINT IF EXISTS "colaborador_userId_fkey";

ALTER TABLE "colaborador"
  ADD CONSTRAINT "colaborador_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
