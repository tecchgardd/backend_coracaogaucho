import assert from "node:assert/strict";
import test from "node:test";
import { eventoCreateSchema, eventoUpdateSchema } from "./eventos.schemas.js";
import { mapEventoData } from "./eventos.service.js";

const banner = "https://res.cloudinary.com/dky1ozpdn/image/upload/v1234567890/banner.jpg";
const replacement = "https://res.cloudinary.com/dky1ozpdn/image/upload/v1234567891/banner-novo.jpg";

test("create validation preserves a valid Cloudinary URL and accepts explicit null", () => {
  const base = { nome: "Curso de Dancas", local: "CTG", data: "2026-08-01T20:00:00.000Z", preco: 10 };
  assert.equal(eventoCreateSchema.parse({ ...base, banner }).banner, banner);
  assert.equal(eventoCreateSchema.parse({ ...base, banner: null }).banner, null);
});

test("event image validation rejects invalid, empty and non-HTTPS URLs", () => {
  assert.equal(eventoUpdateSchema.safeParse({ banner: "nao-e-url" }).success, false);
  assert.equal(eventoUpdateSchema.safeParse({ banner: "" }).success, false);
  assert.equal(eventoUpdateSchema.safeParse({ banner: "http://res.cloudinary.com/demo/image/upload/banner.jpg" }).success, false);
});

test("text-only update omits banner and cannot overwrite the persisted image", () => {
  const parsed = eventoUpdateSchema.parse({ nome: "Nome atualizado" });
  const prismaData = mapEventoData(parsed);
  assert.equal("banner" in parsed, false);
  assert.equal("banner" in prismaData, false);
});

test("update preserves the three banner states: undefined, null and URL", () => {
  assert.equal("banner" in mapEventoData(eventoUpdateSchema.parse({})), false);
  assert.equal(mapEventoData(eventoUpdateSchema.parse({ banner: null })).banner, null);
  assert.equal(mapEventoData(eventoUpdateSchema.parse({ banner: replacement })).banner, replacement);
});

test("legacy imagemUrl is normalized to the Prisma banner field without changing the URL", () => {
  const parsed = eventoUpdateSchema.parse({ imagemUrl: banner });
  assert.equal(mapEventoData(parsed).banner, banner);
});
