import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { requireRoles } from "../../middlewares/role.middleware.js";

test("n8n integration rejects missing and invalid secrets", async () => {
  const { env } = await import("../../env.js");
  const { integrationSecretIsValid } = await import("./pagamentos.controller.js");
  assert.equal(integrationSecretIsValid(), false);
  assert.equal(integrationSecretIsValid("invalid"), false);
  assert.equal(integrationSecretIsValid(env.N8N_INTEGRATION_SECRET), true);
});

test("refund role guard accepts ADMIN and rejects STAFF", () => {
  const guard = requireRoles("ADMIN");
  let called = false;
  const next = (() => { called = true; }) as NextFunction;
  const baseAuth = { userId: "user", colaboradorId: 1, email: "admin@example.com", name: "Admin" };
  guard({ auth: { ...baseAuth, role: "ADMIN" } } as Request, {} as Response, next);
  assert.equal(called, true);
  assert.throws(
    () => guard({ auth: { ...baseAuth, role: "STAFF" } } as Request, {} as Response, next),
    (error: unknown) => Boolean(error && typeof error === "object" && "statusCode" in error && error.statusCode === 403)
  );
});
