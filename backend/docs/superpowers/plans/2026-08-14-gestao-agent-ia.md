# Gestão do Agent IA (Regras, Prompts, Conhecimento, Aprendizados) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CRUD endpoints for the 4 remaining Agent IA models (`AiRule`, `AiPrompt`, `AiKnowledge`, `AiLearningSuggestion`) under `/admin/agent`, completing the "Gestão do Agent IA" sub-project (the first half, `AgentConfig`/`AgentChannelConfig`, is already merged).

**Architecture:** Exactly the pattern already established and merged in `src/modules/agente-ia/` by `agent-config.*`/`agent-channels.*`: one `.schemas.ts`/`.service.ts`/`.controller.ts`/`.service.test.ts` file set per resource, routes registered directly on the shared `agenteIaRoutes` barrel (no per-resource router), every write logged to `AuditLog`, tests run against the real database at the service layer with `try/finally` cleanup.

**Tech Stack:** TypeScript, Express, Prisma, Zod, `node:test`.

## Global Constraints

- Follow the exact file/module pattern of `src/modules/agente-ia/agent-channels.*` (read it before starting if unfamiliar) — do not invent a different shape.
- `status` fields (`AiRule`, `AiKnowledge`, `AiPrompt`) are `"ATIVO" | "INATIVO"` only.
- `AiRule.category`: `"GERAL" | "VENDAS" | "INSCRICAO" | "ATENDIMENTO" | "PAGAMENTO"`.
- `AiPrompt.scope`: `"GENERAL" | "VENDAS" | "INSCRICAO"`.
- `AiKnowledge.type`: `"FAQ" | "POLICY" | "EVENT" | "COURSE" | "PAYMENT" | "TICKET" | "OTHER"`.
- `AiLearningSuggestion.status`: `"PENDENTE" | "APROVADO" | "REJEITADO"`.
- `AiPrompt.tone` and `AiLearningSuggestion.suggestedType` are free text (`z.string().optional()`), no enum.
- `DELETE` routes (`AiRule`, `AiPrompt`, `AiKnowledge`) use `requireRoles("ADMIN")` on that specific route, matching the existing `PATCH /admin/agent/status` precedent. All other routes stay at the router-mount level (`ADMIN`+`STAFF`, already applied in `src/routes/index.ts` — do not touch that file, it already mounts `agenteIaRoutes`).
- `AiLearningSuggestion` gets **no** create or generic-update endpoint — only list, get-by-id, approve, reject. It is meant to be populated by a future AI loop, not authored by admins.
- Approving an `AiLearningSuggestion` does **not** auto-create an `AiRule`/`AiKnowledge`/`AiPrompt` — status transition only.
- Role-gate behavior itself (`requireRoles` rejecting non-ADMIN) is already covered by `src/middlewares/role.middleware.ts`'s own test — do not add a duplicate per-route 403 test; just wire the route correctly.
- No new environment variables, no calls to OpenAI/Z-API, no changes to `regras_agentes`/`n8n_chat_histories`.

---

### Task 1: `AiRule` CRUD

**Files:**
- Create: `src/modules/agente-ia/agent-rules.schemas.ts`
- Create: `src/modules/agente-ia/agent-rules.service.ts`
- Create: `src/modules/agente-ia/agent-rules.controller.ts`
- Create: `src/modules/agente-ia/agent-rules.service.test.ts`
- Modify: `src/modules/agente-ia/agente-ia.routes.ts`
- Modify: `src/docs/swagger.ts`

**Interfaces:**
- Produces: `agentRulesService` with `listar(query)`, `buscar(id)`, `criar(data, actor)`, `atualizar(id, data, actor)`, `atualizarStatus(id, status, actor)`, `remover(id, actor)` — `actor: { colaboradorId: number }`. `agentRulesController` with `listar`, `buscar`, `criar`, `atualizar`, `status`, `remover`.

- [ ] **Step 1: Create `src/modules/agente-ia/agent-rules.schemas.ts`**

```ts
import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const ruleStatusEnum = z.enum(["ATIVO", "INATIVO"]);
export const ruleCategoryEnum = z.enum(["GERAL", "VENDAS", "INSCRICAO", "ATENDIMENTO", "PAGAMENTO"]);

export const ruleQuerySchema = paginationQuerySchema.extend({
  status: ruleStatusEnum.optional()
});

export const ruleCreateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  category: ruleCategoryEnum.default("GERAL"),
  content: z.string().min(1),
  priority: z.number().int().min(0).default(5),
  status: ruleStatusEnum.default("ATIVO")
});

export const ruleUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  category: ruleCategoryEnum.optional(),
  content: z.string().min(1).optional(),
  priority: z.number().int().min(0).optional(),
  status: ruleStatusEnum.optional()
});

export const ruleStatusSchema = z.object({
  status: ruleStatusEnum
});
```

- [ ] **Step 2: Create `src/modules/agente-ia/agent-rules.service.ts`**

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { ruleCreateSchema, ruleQuerySchema, ruleUpdateSchema } from "./agent-rules.schemas.js";

type Actor = { colaboradorId: number };

async function auditLog(action: string, entityId: number, actor: Actor, metadata: unknown) {
  await prisma.auditLog.create({
    data: {
      action,
      entity: "AiRule",
      entityId: String(entityId),
      colaboradorId: actor.colaboradorId,
      metadata: metadata as Prisma.InputJsonValue
    }
  });
}

export const agentRulesService = {
  async listar(query: z.infer<typeof ruleQuerySchema>) {
    const where: Prisma.AiRuleWhereInput = { status: query.status };
    const [data, total] = await Promise.all([
      prisma.aiRule.findMany({ where, ...getPagination(query), orderBy: [{ priority: "asc" }, { id: "asc" }] }),
      prisma.aiRule.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const rule = await prisma.aiRule.findUnique({ where: { id } });
    if (!rule) throw new AppError("Regra não encontrada", 404);
    return rule;
  },

  async criar(data: z.infer<typeof ruleCreateSchema>, actor: Actor) {
    const rule = await prisma.aiRule.create({ data: { ...data, createdBy: actor.colaboradorId } });
    await auditLog("AGENT_RULE_CRIAR", rule.id, actor, data);
    return rule;
  },

  async atualizar(id: number, data: z.infer<typeof ruleUpdateSchema>, actor: Actor) {
    await this.buscar(id);
    const rule = await prisma.aiRule.update({ where: { id }, data: { ...data, updatedBy: actor.colaboradorId } });
    await auditLog("AGENT_RULE_ATUALIZAR", id, actor, data);
    return rule;
  },

  async atualizarStatus(id: number, status: "ATIVO" | "INATIVO", actor: Actor) {
    return this.atualizar(id, { status }, actor);
  },

  async remover(id: number, actor: Actor) {
    await this.buscar(id);
    await prisma.aiRule.delete({ where: { id } });
    await auditLog("AGENT_RULE_EXCLUIR", id, actor, {});
    return { ok: true };
  }
};
```

- [ ] **Step 3: Create `src/modules/agente-ia/agent-rules.controller.ts`**

```ts
import type { Request, Response } from "express";
import type { z } from "zod";
import { AppError } from "../../utils/http.js";
import { agentRulesService } from "./agent-rules.service.js";
import type { ruleCreateSchema, ruleStatusSchema, ruleUpdateSchema } from "./agent-rules.schemas.js";

export const agentRulesController = {
  async listar(req: Request, res: Response) {
    res.json(await agentRulesService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await agentRulesService.buscar(Number(req.params.id)));
  },
  async criar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.status(201).json(await agentRulesService.criar(req.body as z.infer<typeof ruleCreateSchema>, req.auth));
  },
  async atualizar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentRulesService.atualizar(Number(req.params.id), req.body as z.infer<typeof ruleUpdateSchema>, req.auth));
  },
  async status(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    const body = req.body as z.infer<typeof ruleStatusSchema>;
    res.json(await agentRulesService.atualizarStatus(Number(req.params.id), body.status, req.auth));
  },
  async remover(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentRulesService.remover(Number(req.params.id), req.auth));
  }
};
```

- [ ] **Step 4: Create `src/modules/agente-ia/agent-rules.service.test.ts`**

```ts
import "../../env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../lib/prisma.js";
import { agentRulesService } from "./agent-rules.service.js";

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entity: "AiRule" } });
  await prisma.aiRule.deleteMany({ where: { name: { startsWith: "TEST_" } } });
}

test("criar cria uma regra e grava AuditLog com o criador", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };

    const rule = await agentRulesService.criar(
      { name: "TEST_regra", category: "GERAL", content: "conteudo", priority: 5, status: "ATIVO" },
      actor
    );
    assert.equal(rule.name, "TEST_regra");
    assert.equal(rule.createdBy, actor.colaboradorId);

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_RULE_CRIAR", entity: "AiRule", entityId: String(rule.id) } });
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.colaboradorId, actor.colaboradorId);
  } finally {
    await cleanup();
  }
});

test("buscar lanca 404 quando a regra nao existe", async () => {
  await assert.rejects(
    () => agentRulesService.buscar(999999999),
    (error: unknown) => Boolean(error && typeof error === "object" && "statusCode" in error && error.statusCode === 404)
  );
});

test("atualizar muda campos e grava updatedBy + AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const rule = await agentRulesService.criar({ name: "TEST_regra", category: "GERAL", content: "x", priority: 5, status: "ATIVO" }, actor);

    const updated = await agentRulesService.atualizar(rule.id, { content: "novo conteudo" }, actor);
    assert.equal(updated.content, "novo conteudo");
    assert.equal(updated.updatedBy, actor.colaboradorId);

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_RULE_ATUALIZAR", entity: "AiRule", entityId: String(rule.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("atualizarStatus alterna ATIVO/INATIVO", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const rule = await agentRulesService.criar({ name: "TEST_regra", category: "GERAL", content: "x", priority: 5, status: "ATIVO" }, actor);

    const updated = await agentRulesService.atualizarStatus(rule.id, "INATIVO", actor);
    assert.equal(updated.status, "INATIVO");
  } finally {
    await cleanup();
  }
});

test("remover exclui a regra e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const rule = await agentRulesService.criar({ name: "TEST_regra", category: "GERAL", content: "x", priority: 5, status: "ATIVO" }, actor);

    const result = await agentRulesService.remover(rule.id, actor);
    assert.deepEqual(result, { ok: true });
    await assert.rejects(() => agentRulesService.buscar(rule.id));

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_RULE_EXCLUIR", entity: "AiRule", entityId: String(rule.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("listar filtra por status", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    await agentRulesService.criar({ name: "TEST_ativa", category: "GERAL", content: "x", priority: 5, status: "ATIVO" }, actor);
    await agentRulesService.criar({ name: "TEST_inativa", category: "GERAL", content: "x", priority: 5, status: "INATIVO" }, actor);

    const { data } = await agentRulesService.listar({ page: 1, limit: 20, status: "INATIVO" } as never);
    assert.ok(data.every((rule) => rule.status === "INATIVO"));
    assert.ok(data.some((rule) => rule.name === "TEST_inativa"));
  } finally {
    await cleanup();
  }
});
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `npx tsx --import ./src/test-env.ts --test src/modules/agente-ia/agent-rules.service.test.ts`
Expected: all 6 tests pass.

- [ ] **Step 6: Wire the routes — replace the trailing comment in `src/modules/agente-ia/agente-ia.routes.ts`**

The file currently ends with the line `// Tasks 3 e 4 adicionam suas próprias rotas (regras, prompts, conhecimento, conversas, etc.) abaixo neste mesmo router.` Replace the **entire file content** with:

```ts
import { Router } from "express";
import { requireRoles } from "../../middlewares/role.middleware.js";
import { asyncHandler, validate } from "../../utils/http.js";
import { idParamSchema } from "../common/schemas.js";
import { agentConfigController } from "./agent-config.controller.js";
import { statusSchema, updateConfigSchema } from "./agent-config.schemas.js";
import { agentChannelsController } from "./agent-channels.controller.js";
import { channelBodySchema, channelParamSchema } from "./agent-channels.schemas.js";
import { agentRulesController } from "./agent-rules.controller.js";
import { ruleCreateSchema, ruleQuerySchema, ruleStatusSchema, ruleUpdateSchema } from "./agent-rules.schemas.js";

export const agenteIaRoutes = Router();

// Configuração global do Agent IA
agenteIaRoutes.get("/config", asyncHandler(agentConfigController.buscar));
agenteIaRoutes.patch("/config", validate({ body: updateConfigSchema }), asyncHandler(agentConfigController.atualizar));
agenteIaRoutes.patch("/status", requireRoles("ADMIN"), validate({ body: statusSchema }), asyncHandler(agentConfigController.status));

// Canais de atendimento do Agent IA
agenteIaRoutes.get("/channels", asyncHandler(agentChannelsController.listar));
agenteIaRoutes.patch("/channels/:channel", validate({ params: channelParamSchema, body: channelBodySchema }), asyncHandler(agentChannelsController.atualizar));

// Regras do Agent IA
agenteIaRoutes.get("/rules", validate({ query: ruleQuerySchema }), asyncHandler(agentRulesController.listar));
agenteIaRoutes.get("/rules/:id", validate({ params: idParamSchema }), asyncHandler(agentRulesController.buscar));
agenteIaRoutes.post("/rules", validate({ body: ruleCreateSchema }), asyncHandler(agentRulesController.criar));
agenteIaRoutes.patch("/rules/:id", validate({ params: idParamSchema, body: ruleUpdateSchema }), asyncHandler(agentRulesController.atualizar));
agenteIaRoutes.patch("/rules/:id/status", validate({ params: idParamSchema, body: ruleStatusSchema }), asyncHandler(agentRulesController.status));
agenteIaRoutes.delete("/rules/:id", requireRoles("ADMIN"), validate({ params: idParamSchema }), asyncHandler(agentRulesController.remover));

// Tasks 3 e 4 adicionam suas próprias rotas (prompts, conhecimento, aprendizados) abaixo neste mesmo router.
```

- [ ] **Step 7: Document the new routes in `src/docs/swagger.ts`**

Find the `"/admin/agent/channels/{channel}"` block (added by the already-merged Task 2) and insert this new block **immediately after it** (before the following `"/uploads/image"` entry):

```ts
      "/admin/agent/rules": {
        get: {
          tags: ["Agente IA - Regras"],
          security: [{ cookieAuth: [] }],
          summary: "Lista as regras do Agent IA",
          parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["ATIVO", "INATIVO"] } }],
          responses: { "200": { description: "Lista paginada de regras" }, "401": { description: "Não autenticado" } }
        },
        post: {
          tags: ["Agente IA - Regras"],
          security: [{ cookieAuth: [] }],
          summary: "Cria uma nova regra do Agent IA",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "content"],
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string", enum: ["GERAL", "VENDAS", "INSCRICAO", "ATENDIMENTO", "PAGAMENTO"] },
                    content: { type: "string" },
                    priority: { type: "integer" },
                    status: { type: "string", enum: ["ATIVO", "INATIVO"] }
                  }
                }
              }
            }
          },
          responses: { "201": { description: "Regra criada" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/agent/rules/{id}": {
        get: {
          tags: ["Agente IA - Regras"],
          security: [{ cookieAuth: [] }],
          summary: "Busca uma regra do Agent IA por id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Regra encontrada" }, "404": { description: "Regra não encontrada" } }
        },
        patch: {
          tags: ["Agente IA - Regras"],
          security: [{ cookieAuth: [] }],
          summary: "Atualiza campos de uma regra do Agent IA",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Regra atualizada" }, "404": { description: "Regra não encontrada" } }
        },
        delete: {
          tags: ["Agente IA - Regras"],
          security: [{ cookieAuth: [] }],
          summary: "Exclui uma regra do Agent IA (somente ADMIN)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Regra excluída" }, "403": { description: "Somente ADMIN" }, "404": { description: "Regra não encontrada" } }
        }
      },
      "/admin/agent/rules/{id}/status": {
        patch: {
          tags: ["Agente IA - Regras"],
          security: [{ cookieAuth: [] }],
          summary: "Ativa ou desativa uma regra do Agent IA",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ATIVO", "INATIVO"] } } } } }
          },
          responses: { "200": { description: "Status atualizado" }, "404": { description: "Regra não encontrada" } }
        }
      },
```

- [ ] **Step 8: Run typecheck and the full suite**

Run: `npm run typecheck`
Expected: 0 errors.

Run: `npm test`
Expected: previous count (60) + 6 new = 66 passing.

- [ ] **Step 9: Commit**

```bash
git add src/modules/agente-ia/agent-rules.schemas.ts src/modules/agente-ia/agent-rules.service.ts src/modules/agente-ia/agent-rules.controller.ts src/modules/agente-ia/agent-rules.service.test.ts src/modules/agente-ia/agente-ia.routes.ts src/docs/swagger.ts
git commit -m "feat: adiciona CRUD de regras (AiRule) ao Agent IA"
```

---

### Task 2: `AiPrompt` CRUD

**Files:**
- Create: `src/modules/agente-ia/agent-prompts.schemas.ts`
- Create: `src/modules/agente-ia/agent-prompts.service.ts`
- Create: `src/modules/agente-ia/agent-prompts.controller.ts`
- Create: `src/modules/agente-ia/agent-prompts.service.test.ts`
- Modify: `src/modules/agente-ia/agente-ia.routes.ts`
- Modify: `src/docs/swagger.ts`

**Interfaces:**
- Consumes from Task 1: the current full content of `agente-ia.routes.ts` (Task 1 already replaced it) — this task extends it further, same technique.
- Produces: `agentPromptsService` with `listar(query)`, `buscar(id)`, `criar(data, actor)`, `atualizar(id, data, actor)` (increments `version`), `atualizarStatus(id, status, actor)`, `remover(id, actor)`. `agentPromptsController` with `listar`, `buscar`, `criar`, `atualizar`, `status`, `remover`.

- [ ] **Step 1: Create `src/modules/agente-ia/agent-prompts.schemas.ts`**

```ts
import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const promptStatusEnum = z.enum(["ATIVO", "INATIVO"]);
export const promptScopeEnum = z.enum(["GENERAL", "VENDAS", "INSCRICAO"]);

export const promptQuerySchema = paginationQuerySchema.extend({
  status: promptStatusEnum.optional(),
  scope: promptScopeEnum.optional()
});

export const promptCreateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  content: z.string().min(1),
  tone: z.string().optional(),
  scope: promptScopeEnum.default("GENERAL"),
  status: promptStatusEnum.default("ATIVO")
});

export const promptUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  content: z.string().min(1).optional(),
  tone: z.string().optional(),
  scope: promptScopeEnum.optional(),
  status: promptStatusEnum.optional()
});

export const promptStatusSchema = z.object({
  status: promptStatusEnum
});
```

- [ ] **Step 2: Create `src/modules/agente-ia/agent-prompts.service.ts`**

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { promptCreateSchema, promptQuerySchema, promptUpdateSchema } from "./agent-prompts.schemas.js";

type Actor = { colaboradorId: number };

async function auditLog(action: string, entityId: number, actor: Actor, metadata: unknown) {
  await prisma.auditLog.create({
    data: {
      action,
      entity: "AiPrompt",
      entityId: String(entityId),
      colaboradorId: actor.colaboradorId,
      metadata: metadata as Prisma.InputJsonValue
    }
  });
}

export const agentPromptsService = {
  async listar(query: z.infer<typeof promptQuerySchema>) {
    const where: Prisma.AiPromptWhereInput = { status: query.status, scope: query.scope };
    const [data, total] = await Promise.all([
      prisma.aiPrompt.findMany({ where, ...getPagination(query), orderBy: { id: "asc" } }),
      prisma.aiPrompt.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const prompt = await prisma.aiPrompt.findUnique({ where: { id } });
    if (!prompt) throw new AppError("Prompt não encontrado", 404);
    return prompt;
  },

  async criar(data: z.infer<typeof promptCreateSchema>, actor: Actor) {
    const prompt = await prisma.aiPrompt.create({ data: { ...data, createdById: actor.colaboradorId } });
    await auditLog("AGENT_PROMPT_CRIAR", prompt.id, actor, data);
    return prompt;
  },

  async atualizar(id: number, data: z.infer<typeof promptUpdateSchema>, actor: Actor) {
    await this.buscar(id);
    const prompt = await prisma.aiPrompt.update({
      where: { id },
      data: { ...data, updatedById: actor.colaboradorId, version: { increment: 1 } }
    });
    await auditLog("AGENT_PROMPT_ATUALIZAR", id, actor, data);
    return prompt;
  },

  async atualizarStatus(id: number, status: "ATIVO" | "INATIVO", actor: Actor) {
    return this.atualizar(id, { status }, actor);
  },

  async remover(id: number, actor: Actor) {
    await this.buscar(id);
    await prisma.aiPrompt.delete({ where: { id } });
    await auditLog("AGENT_PROMPT_EXCLUIR", id, actor, {});
    return { ok: true };
  }
};
```

- [ ] **Step 3: Create `src/modules/agente-ia/agent-prompts.controller.ts`**

```ts
import type { Request, Response } from "express";
import type { z } from "zod";
import { AppError } from "../../utils/http.js";
import { agentPromptsService } from "./agent-prompts.service.js";
import type { promptCreateSchema, promptStatusSchema, promptUpdateSchema } from "./agent-prompts.schemas.js";

export const agentPromptsController = {
  async listar(req: Request, res: Response) {
    res.json(await agentPromptsService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await agentPromptsService.buscar(Number(req.params.id)));
  },
  async criar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.status(201).json(await agentPromptsService.criar(req.body as z.infer<typeof promptCreateSchema>, req.auth));
  },
  async atualizar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentPromptsService.atualizar(Number(req.params.id), req.body as z.infer<typeof promptUpdateSchema>, req.auth));
  },
  async status(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    const body = req.body as z.infer<typeof promptStatusSchema>;
    res.json(await agentPromptsService.atualizarStatus(Number(req.params.id), body.status, req.auth));
  },
  async remover(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentPromptsService.remover(Number(req.params.id), req.auth));
  }
};
```

- [ ] **Step 4: Create `src/modules/agente-ia/agent-prompts.service.test.ts`**

```ts
import "../../env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../lib/prisma.js";
import { agentPromptsService } from "./agent-prompts.service.js";

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entity: "AiPrompt" } });
  await prisma.aiPrompt.deleteMany({ where: { name: { startsWith: "TEST_" } } });
}

test("criar cria um prompt com version 1 e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };

    const prompt = await agentPromptsService.criar(
      { name: "TEST_prompt", content: "conteudo", scope: "GENERAL", status: "ATIVO" },
      actor
    );
    assert.equal(prompt.version, 1);
    assert.equal(prompt.createdById, actor.colaboradorId);

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_PROMPT_CRIAR", entity: "AiPrompt", entityId: String(prompt.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("atualizar incrementa version automaticamente e grava updatedById", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const prompt = await agentPromptsService.criar({ name: "TEST_prompt", content: "x", scope: "GENERAL", status: "ATIVO" }, actor);

    const updated = await agentPromptsService.atualizar(prompt.id, { content: "novo" }, actor);
    assert.equal(updated.version, 2);
    assert.equal(updated.content, "novo");
    assert.equal(updated.updatedById, actor.colaboradorId);

    const updatedAgain = await agentPromptsService.atualizar(prompt.id, { tone: "formal" }, actor);
    assert.equal(updatedAgain.version, 3);
  } finally {
    await cleanup();
  }
});

test("buscar lanca 404 quando o prompt nao existe", async () => {
  await assert.rejects(
    () => agentPromptsService.buscar(999999999),
    (error: unknown) => Boolean(error && typeof error === "object" && "statusCode" in error && error.statusCode === 404)
  );
});

test("atualizarStatus alterna ATIVO/INATIVO", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const prompt = await agentPromptsService.criar({ name: "TEST_prompt", content: "x", scope: "GENERAL", status: "ATIVO" }, actor);

    const updated = await agentPromptsService.atualizarStatus(prompt.id, "INATIVO", actor);
    assert.equal(updated.status, "INATIVO");
  } finally {
    await cleanup();
  }
});

test("remover exclui o prompt e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const prompt = await agentPromptsService.criar({ name: "TEST_prompt", content: "x", scope: "GENERAL", status: "ATIVO" }, actor);

    const result = await agentPromptsService.remover(prompt.id, actor);
    assert.deepEqual(result, { ok: true });
    await assert.rejects(() => agentPromptsService.buscar(prompt.id));
  } finally {
    await cleanup();
  }
});

test("listar filtra por scope", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    await agentPromptsService.criar({ name: "TEST_geral", content: "x", scope: "GENERAL", status: "ATIVO" }, actor);
    await agentPromptsService.criar({ name: "TEST_vendas", content: "x", scope: "VENDAS", status: "ATIVO" }, actor);

    const { data } = await agentPromptsService.listar({ page: 1, limit: 20, scope: "VENDAS" } as never);
    assert.ok(data.every((prompt) => prompt.scope === "VENDAS"));
    assert.ok(data.some((prompt) => prompt.name === "TEST_vendas"));
  } finally {
    await cleanup();
  }
});
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `npx tsx --import ./src/test-env.ts --test src/modules/agente-ia/agent-prompts.service.test.ts`
Expected: all 6 tests pass.

- [ ] **Step 6: Wire the routes — add to `src/modules/agente-ia/agente-ia.routes.ts`**

Add this import alongside the existing ones:

```ts
import { agentPromptsController } from "./agent-prompts.controller.js";
import { promptCreateSchema, promptQuerySchema, promptStatusSchema, promptUpdateSchema } from "./agent-prompts.schemas.js";
```

Replace the trailing comment line (`// Tasks 3 e 4 adicionam...`) with:

```ts
// Prompts do Agent IA
agenteIaRoutes.get("/prompts", validate({ query: promptQuerySchema }), asyncHandler(agentPromptsController.listar));
agenteIaRoutes.get("/prompts/:id", validate({ params: idParamSchema }), asyncHandler(agentPromptsController.buscar));
agenteIaRoutes.post("/prompts", validate({ body: promptCreateSchema }), asyncHandler(agentPromptsController.criar));
agenteIaRoutes.patch("/prompts/:id", validate({ params: idParamSchema, body: promptUpdateSchema }), asyncHandler(agentPromptsController.atualizar));
agenteIaRoutes.patch("/prompts/:id/status", validate({ params: idParamSchema, body: promptStatusSchema }), asyncHandler(agentPromptsController.status));
agenteIaRoutes.delete("/prompts/:id", requireRoles("ADMIN"), validate({ params: idParamSchema }), asyncHandler(agentPromptsController.remover));

// Task 4 adiciona conhecimento e aprendizados abaixo neste mesmo router.
```

- [ ] **Step 7: Document the new routes in `src/docs/swagger.ts`**

Insert after the `"/admin/agent/rules/{id}/status"` block added in Task 1 (before `"/uploads/image"`):

```ts
      "/admin/agent/prompts": {
        get: {
          tags: ["Agente IA - Prompts"],
          security: [{ cookieAuth: [] }],
          summary: "Lista os prompts do Agent IA",
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["ATIVO", "INATIVO"] } },
            { name: "scope", in: "query", schema: { type: "string", enum: ["GENERAL", "VENDAS", "INSCRICAO"] } }
          ],
          responses: { "200": { description: "Lista paginada de prompts" }, "401": { description: "Não autenticado" } }
        },
        post: {
          tags: ["Agente IA - Prompts"],
          security: [{ cookieAuth: [] }],
          summary: "Cria um novo prompt do Agent IA",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "content"],
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    content: { type: "string" },
                    tone: { type: "string" },
                    scope: { type: "string", enum: ["GENERAL", "VENDAS", "INSCRICAO"] },
                    status: { type: "string", enum: ["ATIVO", "INATIVO"] }
                  }
                }
              }
            }
          },
          responses: { "201": { description: "Prompt criado" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/agent/prompts/{id}": {
        get: {
          tags: ["Agente IA - Prompts"],
          security: [{ cookieAuth: [] }],
          summary: "Busca um prompt do Agent IA por id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Prompt encontrado" }, "404": { description: "Prompt não encontrado" } }
        },
        patch: {
          tags: ["Agente IA - Prompts"],
          security: [{ cookieAuth: [] }],
          summary: "Atualiza campos de um prompt (incrementa version automaticamente)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Prompt atualizado" }, "404": { description: "Prompt não encontrado" } }
        },
        delete: {
          tags: ["Agente IA - Prompts"],
          security: [{ cookieAuth: [] }],
          summary: "Exclui um prompt do Agent IA (somente ADMIN)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Prompt excluído" }, "403": { description: "Somente ADMIN" }, "404": { description: "Prompt não encontrado" } }
        }
      },
      "/admin/agent/prompts/{id}/status": {
        patch: {
          tags: ["Agente IA - Prompts"],
          security: [{ cookieAuth: [] }],
          summary: "Ativa ou desativa um prompt do Agent IA",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ATIVO", "INATIVO"] } } } } }
          },
          responses: { "200": { description: "Status atualizado" }, "404": { description: "Prompt não encontrado" } }
        }
      },
```

- [ ] **Step 8: Run typecheck and the full suite**

Run: `npm run typecheck`
Expected: 0 errors.

Run: `npm test`
Expected: previous count (66) + 6 new = 72 passing.

- [ ] **Step 9: Commit**

```bash
git add src/modules/agente-ia/agent-prompts.schemas.ts src/modules/agente-ia/agent-prompts.service.ts src/modules/agente-ia/agent-prompts.controller.ts src/modules/agente-ia/agent-prompts.service.test.ts src/modules/agente-ia/agente-ia.routes.ts src/docs/swagger.ts
git commit -m "feat: adiciona CRUD de prompts (AiPrompt) ao Agent IA"
```

---

### Task 3: `AiKnowledge` CRUD

**Files:**
- Create: `src/modules/agente-ia/agent-knowledge.schemas.ts`
- Create: `src/modules/agente-ia/agent-knowledge.service.ts`
- Create: `src/modules/agente-ia/agent-knowledge.controller.ts`
- Create: `src/modules/agente-ia/agent-knowledge.service.test.ts`
- Modify: `src/modules/agente-ia/agente-ia.routes.ts`
- Modify: `src/docs/swagger.ts`

**Interfaces:**
- Produces: `agentKnowledgeService` with `listar(query)`, `buscar(id)`, `criar(data, actor)` (sets `approvedById` = actor), `atualizar(id, data, actor)`, `atualizarStatus(id, status, actor)`, `remover(id, actor)`. `agentKnowledgeController` with `listar`, `buscar`, `criar`, `atualizar`, `status`, `remover`.

- [ ] **Step 1: Create `src/modules/agente-ia/agent-knowledge.schemas.ts`**

```ts
import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const knowledgeStatusEnum = z.enum(["ATIVO", "INATIVO"]);
export const knowledgeTypeEnum = z.enum(["FAQ", "POLICY", "EVENT", "COURSE", "PAYMENT", "TICKET", "OTHER"]);

export const knowledgeQuerySchema = paginationQuerySchema.extend({
  status: knowledgeStatusEnum.optional(),
  type: knowledgeTypeEnum.optional()
});

export const knowledgeCreateSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(1),
  type: knowledgeTypeEnum,
  source: z.string().optional(),
  status: knowledgeStatusEnum.default("ATIVO")
});

export const knowledgeUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  content: z.string().min(1).optional(),
  type: knowledgeTypeEnum.optional(),
  source: z.string().optional(),
  status: knowledgeStatusEnum.optional()
});

export const knowledgeStatusSchema = z.object({
  status: knowledgeStatusEnum
});
```

- [ ] **Step 2: Create `src/modules/agente-ia/agent-knowledge.service.ts`**

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { knowledgeCreateSchema, knowledgeQuerySchema, knowledgeUpdateSchema } from "./agent-knowledge.schemas.js";

type Actor = { colaboradorId: number };

async function auditLog(action: string, entityId: number, actor: Actor, metadata: unknown) {
  await prisma.auditLog.create({
    data: {
      action,
      entity: "AiKnowledge",
      entityId: String(entityId),
      colaboradorId: actor.colaboradorId,
      metadata: metadata as Prisma.InputJsonValue
    }
  });
}

export const agentKnowledgeService = {
  async listar(query: z.infer<typeof knowledgeQuerySchema>) {
    const where: Prisma.AiKnowledgeWhereInput = { status: query.status, type: query.type };
    const [data, total] = await Promise.all([
      prisma.aiKnowledge.findMany({ where, ...getPagination(query), orderBy: { id: "asc" } }),
      prisma.aiKnowledge.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const knowledge = await prisma.aiKnowledge.findUnique({ where: { id } });
    if (!knowledge) throw new AppError("Conhecimento não encontrado", 404);
    return knowledge;
  },

  async criar(data: z.infer<typeof knowledgeCreateSchema>, actor: Actor) {
    const knowledge = await prisma.aiKnowledge.create({ data: { ...data, approvedById: actor.colaboradorId } });
    await auditLog("AGENT_KNOWLEDGE_CRIAR", knowledge.id, actor, data);
    return knowledge;
  },

  async atualizar(id: number, data: z.infer<typeof knowledgeUpdateSchema>, actor: Actor) {
    await this.buscar(id);
    const knowledge = await prisma.aiKnowledge.update({ where: { id }, data });
    await auditLog("AGENT_KNOWLEDGE_ATUALIZAR", id, actor, data);
    return knowledge;
  },

  async atualizarStatus(id: number, status: "ATIVO" | "INATIVO", actor: Actor) {
    return this.atualizar(id, { status }, actor);
  },

  async remover(id: number, actor: Actor) {
    await this.buscar(id);
    await prisma.aiKnowledge.delete({ where: { id } });
    await auditLog("AGENT_KNOWLEDGE_EXCLUIR", id, actor, {});
    return { ok: true };
  }
};
```

- [ ] **Step 3: Create `src/modules/agente-ia/agent-knowledge.controller.ts`**

```ts
import type { Request, Response } from "express";
import type { z } from "zod";
import { AppError } from "../../utils/http.js";
import { agentKnowledgeService } from "./agent-knowledge.service.js";
import type { knowledgeCreateSchema, knowledgeStatusSchema, knowledgeUpdateSchema } from "./agent-knowledge.schemas.js";

export const agentKnowledgeController = {
  async listar(req: Request, res: Response) {
    res.json(await agentKnowledgeService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await agentKnowledgeService.buscar(Number(req.params.id)));
  },
  async criar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.status(201).json(await agentKnowledgeService.criar(req.body as z.infer<typeof knowledgeCreateSchema>, req.auth));
  },
  async atualizar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentKnowledgeService.atualizar(Number(req.params.id), req.body as z.infer<typeof knowledgeUpdateSchema>, req.auth));
  },
  async status(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    const body = req.body as z.infer<typeof knowledgeStatusSchema>;
    res.json(await agentKnowledgeService.atualizarStatus(Number(req.params.id), body.status, req.auth));
  },
  async remover(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentKnowledgeService.remover(Number(req.params.id), req.auth));
  }
};
```

- [ ] **Step 4: Create `src/modules/agente-ia/agent-knowledge.service.test.ts`**

```ts
import "../../env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../lib/prisma.js";
import { agentKnowledgeService } from "./agent-knowledge.service.js";

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entity: "AiKnowledge" } });
  await prisma.aiKnowledge.deleteMany({ where: { title: { startsWith: "TEST_" } } });
}

test("criar cria um conhecimento com approvedById do autor e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };

    const knowledge = await agentKnowledgeService.criar(
      { title: "TEST_faq", content: "conteudo", type: "FAQ", status: "ATIVO" },
      actor
    );
    assert.equal(knowledge.approvedById, actor.colaboradorId);

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_KNOWLEDGE_CRIAR", entity: "AiKnowledge", entityId: String(knowledge.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("buscar lanca 404 quando o conhecimento nao existe", async () => {
  await assert.rejects(
    () => agentKnowledgeService.buscar(999999999),
    (error: unknown) => Boolean(error && typeof error === "object" && "statusCode" in error && error.statusCode === 404)
  );
});

test("atualizar muda campos e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const knowledge = await agentKnowledgeService.criar({ title: "TEST_faq", content: "x", type: "FAQ", status: "ATIVO" }, actor);

    const updated = await agentKnowledgeService.atualizar(knowledge.id, { content: "novo conteudo" }, actor);
    assert.equal(updated.content, "novo conteudo");

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_KNOWLEDGE_ATUALIZAR", entity: "AiKnowledge", entityId: String(knowledge.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("atualizarStatus alterna ATIVO/INATIVO", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const knowledge = await agentKnowledgeService.criar({ title: "TEST_faq", content: "x", type: "FAQ", status: "ATIVO" }, actor);

    const updated = await agentKnowledgeService.atualizarStatus(knowledge.id, "INATIVO", actor);
    assert.equal(updated.status, "INATIVO");
  } finally {
    await cleanup();
  }
});

test("remover exclui o conhecimento e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const knowledge = await agentKnowledgeService.criar({ title: "TEST_faq", content: "x", type: "FAQ", status: "ATIVO" }, actor);

    const result = await agentKnowledgeService.remover(knowledge.id, actor);
    assert.deepEqual(result, { ok: true });
    await assert.rejects(() => agentKnowledgeService.buscar(knowledge.id));
  } finally {
    await cleanup();
  }
});

test("listar filtra por type", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    await agentKnowledgeService.criar({ title: "TEST_faq", content: "x", type: "FAQ", status: "ATIVO" }, actor);
    await agentKnowledgeService.criar({ title: "TEST_policy", content: "x", type: "POLICY", status: "ATIVO" }, actor);

    const { data } = await agentKnowledgeService.listar({ page: 1, limit: 20, type: "POLICY" } as never);
    assert.ok(data.every((knowledge) => knowledge.type === "POLICY"));
    assert.ok(data.some((knowledge) => knowledge.title === "TEST_policy"));
  } finally {
    await cleanup();
  }
});
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `npx tsx --import ./src/test-env.ts --test src/modules/agente-ia/agent-knowledge.service.test.ts`
Expected: all 6 tests pass.

- [ ] **Step 6: Wire the routes — add to `src/modules/agente-ia/agente-ia.routes.ts`**

Add this import alongside the existing ones:

```ts
import { agentKnowledgeController } from "./agent-knowledge.controller.js";
import { knowledgeCreateSchema, knowledgeQuerySchema, knowledgeStatusSchema, knowledgeUpdateSchema } from "./agent-knowledge.schemas.js";
```

Replace the trailing comment line (`// Task 4 adiciona...`) with:

```ts
// Conhecimento do Agent IA
agenteIaRoutes.get("/knowledge", validate({ query: knowledgeQuerySchema }), asyncHandler(agentKnowledgeController.listar));
agenteIaRoutes.get("/knowledge/:id", validate({ params: idParamSchema }), asyncHandler(agentKnowledgeController.buscar));
agenteIaRoutes.post("/knowledge", validate({ body: knowledgeCreateSchema }), asyncHandler(agentKnowledgeController.criar));
agenteIaRoutes.patch("/knowledge/:id", validate({ params: idParamSchema, body: knowledgeUpdateSchema }), asyncHandler(agentKnowledgeController.atualizar));
agenteIaRoutes.patch("/knowledge/:id/status", validate({ params: idParamSchema, body: knowledgeStatusSchema }), asyncHandler(agentKnowledgeController.status));
agenteIaRoutes.delete("/knowledge/:id", requireRoles("ADMIN"), validate({ params: idParamSchema }), asyncHandler(agentKnowledgeController.remover));

// Task 4 adiciona aprendizados abaixo neste mesmo router.
```

- [ ] **Step 7: Document the new routes in `src/docs/swagger.ts`**

Insert after the `"/admin/agent/prompts/{id}/status"` block added in Task 2 (before `"/uploads/image"`):

```ts
      "/admin/agent/knowledge": {
        get: {
          tags: ["Agente IA - Conhecimento"],
          security: [{ cookieAuth: [] }],
          summary: "Lista os itens de conhecimento do Agent IA",
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["ATIVO", "INATIVO"] } },
            { name: "type", in: "query", schema: { type: "string", enum: ["FAQ", "POLICY", "EVENT", "COURSE", "PAYMENT", "TICKET", "OTHER"] } }
          ],
          responses: { "200": { description: "Lista paginada de conhecimento" }, "401": { description: "Não autenticado" } }
        },
        post: {
          tags: ["Agente IA - Conhecimento"],
          security: [{ cookieAuth: [] }],
          summary: "Cria um novo item de conhecimento do Agent IA",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "content", "type"],
                  properties: {
                    title: { type: "string" },
                    content: { type: "string" },
                    type: { type: "string", enum: ["FAQ", "POLICY", "EVENT", "COURSE", "PAYMENT", "TICKET", "OTHER"] },
                    source: { type: "string" },
                    status: { type: "string", enum: ["ATIVO", "INATIVO"] }
                  }
                }
              }
            }
          },
          responses: { "201": { description: "Conhecimento criado" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/agent/knowledge/{id}": {
        get: {
          tags: ["Agente IA - Conhecimento"],
          security: [{ cookieAuth: [] }],
          summary: "Busca um item de conhecimento do Agent IA por id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Conhecimento encontrado" }, "404": { description: "Conhecimento não encontrado" } }
        },
        patch: {
          tags: ["Agente IA - Conhecimento"],
          security: [{ cookieAuth: [] }],
          summary: "Atualiza campos de um item de conhecimento",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Conhecimento atualizado" }, "404": { description: "Conhecimento não encontrado" } }
        },
        delete: {
          tags: ["Agente IA - Conhecimento"],
          security: [{ cookieAuth: [] }],
          summary: "Exclui um item de conhecimento (somente ADMIN)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Conhecimento excluído" }, "403": { description: "Somente ADMIN" }, "404": { description: "Conhecimento não encontrado" } }
        }
      },
      "/admin/agent/knowledge/{id}/status": {
        patch: {
          tags: ["Agente IA - Conhecimento"],
          security: [{ cookieAuth: [] }],
          summary: "Ativa ou desativa um item de conhecimento",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ATIVO", "INATIVO"] } } } } }
          },
          responses: { "200": { description: "Status atualizado" }, "404": { description: "Conhecimento não encontrado" } }
        }
      },
```

- [ ] **Step 8: Run typecheck and the full suite**

Run: `npm run typecheck`
Expected: 0 errors.

Run: `npm test`
Expected: previous count (72) + 6 new = 78 passing.

- [ ] **Step 9: Commit**

```bash
git add src/modules/agente-ia/agent-knowledge.schemas.ts src/modules/agente-ia/agent-knowledge.service.ts src/modules/agente-ia/agent-knowledge.controller.ts src/modules/agente-ia/agent-knowledge.service.test.ts src/modules/agente-ia/agente-ia.routes.ts src/docs/swagger.ts
git commit -m "feat: adiciona CRUD de conhecimento (AiKnowledge) ao Agent IA"
```

---

### Task 4: `AiLearningSuggestion` — leitura + aprovação/rejeição

**Files:**
- Create: `src/modules/agente-ia/agent-learning-suggestions.schemas.ts`
- Create: `src/modules/agente-ia/agent-learning-suggestions.service.ts`
- Create: `src/modules/agente-ia/agent-learning-suggestions.controller.ts`
- Create: `src/modules/agente-ia/agent-learning-suggestions.service.test.ts`
- Modify: `src/modules/agente-ia/agente-ia.routes.ts`
- Modify: `src/docs/swagger.ts`

**Interfaces:**
- Produces: `agentLearningSuggestionsService` with `listar(query)`, `buscar(id)`, `aprovar(id, actor)`, `rejeitar(id, actor)`. **No `criar`/`atualizar`/`remover`** — intentional, per Global Constraints. `agentLearningSuggestionsController` with `listar`, `buscar`, `aprovar`, `rejeitar`.

- [ ] **Step 1: Create `src/modules/agente-ia/agent-learning-suggestions.schemas.ts`**

```ts
import { z } from "zod";
import { paginationQuerySchema } from "../common/schemas.js";

export const learningSuggestionStatusEnum = z.enum(["PENDENTE", "APROVADO", "REJEITADO"]);

export const learningSuggestionQuerySchema = paginationQuerySchema.extend({
  status: learningSuggestionStatusEnum.optional()
});
```

- [ ] **Step 2: Create `src/modules/agente-ia/agent-learning-suggestions.service.ts`**

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { getPagination } from "../common/schemas.js";
import type { z } from "zod";
import type { learningSuggestionQuerySchema } from "./agent-learning-suggestions.schemas.js";

type Actor = { colaboradorId: number };

async function auditLog(action: string, entityId: number, actor: Actor, metadata: unknown) {
  await prisma.auditLog.create({
    data: {
      action,
      entity: "AiLearningSuggestion",
      entityId: String(entityId),
      colaboradorId: actor.colaboradorId,
      metadata: metadata as Prisma.InputJsonValue
    }
  });
}

async function transition(id: number, status: "APROVADO" | "REJEITADO", actor: Actor) {
  await agentLearningSuggestionsService.buscar(id);
  const suggestion = await prisma.aiLearningSuggestion.update({
    where: { id },
    data: { status, reviewedById: actor.colaboradorId, reviewedAt: new Date() }
  });
  await auditLog(status === "APROVADO" ? "AGENT_LEARNING_APROVAR" : "AGENT_LEARNING_REJEITAR", id, actor, { status });
  return suggestion;
}

export const agentLearningSuggestionsService = {
  async listar(query: z.infer<typeof learningSuggestionQuerySchema>) {
    const where: Prisma.AiLearningSuggestionWhereInput = { status: query.status };
    const [data, total] = await Promise.all([
      prisma.aiLearningSuggestion.findMany({ where, ...getPagination(query), orderBy: { id: "asc" } }),
      prisma.aiLearningSuggestion.count({ where })
    ]);
    return { data, total, page: query.page, limit: query.limit };
  },

  async buscar(id: number) {
    const suggestion = await prisma.aiLearningSuggestion.findUnique({ where: { id } });
    if (!suggestion) throw new AppError("Sugestão não encontrada", 404);
    return suggestion;
  },

  async aprovar(id: number, actor: Actor) {
    return transition(id, "APROVADO", actor);
  },

  async rejeitar(id: number, actor: Actor) {
    return transition(id, "REJEITADO", actor);
  }
};
```

- [ ] **Step 3: Create `src/modules/agente-ia/agent-learning-suggestions.controller.ts`**

```ts
import type { Request, Response } from "express";
import { AppError } from "../../utils/http.js";
import { agentLearningSuggestionsService } from "./agent-learning-suggestions.service.js";

export const agentLearningSuggestionsController = {
  async listar(req: Request, res: Response) {
    res.json(await agentLearningSuggestionsService.listar(req.query as never));
  },
  async buscar(req: Request, res: Response) {
    res.json(await agentLearningSuggestionsService.buscar(Number(req.params.id)));
  },
  async aprovar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentLearningSuggestionsService.aprovar(Number(req.params.id), req.auth));
  },
  async rejeitar(req: Request, res: Response) {
    if (!req.auth) throw new AppError("Não autenticado", 401);
    res.json(await agentLearningSuggestionsService.rejeitar(Number(req.params.id), req.auth));
  }
};
```

- [ ] **Step 4: Create `src/modules/agente-ia/agent-learning-suggestions.service.test.ts`**

There is no `criar` on the service (intentional — see Global Constraints), so tests seed fixture rows directly via `prisma.aiLearningSuggestion.create(...)`.

```ts
import "../../env.js";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../../lib/prisma.js";
import { agentLearningSuggestionsService } from "./agent-learning-suggestions.service.js";

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entity: "AiLearningSuggestion" } });
  await prisma.aiLearningSuggestion.deleteMany({ where: { title: { startsWith: "TEST_" } } });
}

async function seed(overrides: Partial<{ title: string; status: string }> = {}) {
  return prisma.aiLearningSuggestion.create({
    data: {
      title: overrides.title ?? "TEST_sugestao",
      description: "descricao de teste",
      status: overrides.status ?? "PENDENTE"
    }
  });
}

test("buscar lanca 404 quando a sugestao nao existe", async () => {
  await assert.rejects(
    () => agentLearningSuggestionsService.buscar(999999999),
    (error: unknown) => Boolean(error && typeof error === "object" && "statusCode" in error && error.statusCode === 404)
  );
});

test("aprovar marca status APROVADO, reviewedById e reviewedAt, e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const suggestion = await seed();

    const updated = await agentLearningSuggestionsService.aprovar(suggestion.id, actor);
    assert.equal(updated.status, "APROVADO");
    assert.equal(updated.reviewedById, actor.colaboradorId);
    assert.ok(updated.reviewedAt);

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_LEARNING_APROVAR", entity: "AiLearningSuggestion", entityId: String(suggestion.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("rejeitar marca status REJEITADO e grava AuditLog", async () => {
  await cleanup();
  try {
    const colaborador = await prisma.colaborador.findFirstOrThrow();
    const actor = { colaboradorId: colaborador.id };
    const suggestion = await seed();

    const updated = await agentLearningSuggestionsService.rejeitar(suggestion.id, actor);
    assert.equal(updated.status, "REJEITADO");

    const logs = await prisma.auditLog.findMany({ where: { action: "AGENT_LEARNING_REJEITAR", entity: "AiLearningSuggestion", entityId: String(suggestion.id) } });
    assert.equal(logs.length, 1);
  } finally {
    await cleanup();
  }
});

test("listar filtra por status", async () => {
  await cleanup();
  try {
    await seed({ title: "TEST_pendente", status: "PENDENTE" });
    await seed({ title: "TEST_aprovada", status: "APROVADO" });

    const { data } = await agentLearningSuggestionsService.listar({ page: 1, limit: 20, status: "APROVADO" } as never);
    assert.ok(data.every((suggestion) => suggestion.status === "APROVADO"));
    assert.ok(data.some((suggestion) => suggestion.title === "TEST_aprovada"));
  } finally {
    await cleanup();
  }
});
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `npx tsx --import ./src/test-env.ts --test src/modules/agente-ia/agent-learning-suggestions.service.test.ts`
Expected: all 4 tests pass.

- [ ] **Step 6: Wire the routes — add to `src/modules/agente-ia/agente-ia.routes.ts`**

Add this import alongside the existing ones:

```ts
import { agentLearningSuggestionsController } from "./agent-learning-suggestions.controller.js";
import { learningSuggestionQuerySchema } from "./agent-learning-suggestions.schemas.js";
```

Replace the trailing comment line (`// Task 4 adiciona...`) with:

```ts
// Aprendizados sugeridos do Agent IA
agenteIaRoutes.get("/learning", validate({ query: learningSuggestionQuerySchema }), asyncHandler(agentLearningSuggestionsController.listar));
agenteIaRoutes.get("/learning/:id", validate({ params: idParamSchema }), asyncHandler(agentLearningSuggestionsController.buscar));
agenteIaRoutes.patch("/learning/:id/approve", validate({ params: idParamSchema }), asyncHandler(agentLearningSuggestionsController.aprovar));
agenteIaRoutes.patch("/learning/:id/reject", validate({ params: idParamSchema }), asyncHandler(agentLearningSuggestionsController.rejeitar));
```

(No trailing comment needed after this — it's the last resource in this sub-project.)

- [ ] **Step 7: Document the new routes in `src/docs/swagger.ts`**

Insert after the `"/admin/agent/knowledge/{id}/status"` block added in Task 3 (before `"/uploads/image"`):

```ts
      "/admin/agent/learning": {
        get: {
          tags: ["Agente IA - Aprendizados"],
          security: [{ cookieAuth: [] }],
          summary: "Lista as sugestões de aprendizado do Agent IA",
          parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["PENDENTE", "APROVADO", "REJEITADO"] } }],
          responses: { "200": { description: "Lista paginada de sugestões" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/agent/learning/{id}": {
        get: {
          tags: ["Agente IA - Aprendizados"],
          security: [{ cookieAuth: [] }],
          summary: "Busca uma sugestão de aprendizado por id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Sugestão encontrada" }, "404": { description: "Sugestão não encontrada" } }
        }
      },
      "/admin/agent/learning/{id}/approve": {
        patch: {
          tags: ["Agente IA - Aprendizados"],
          security: [{ cookieAuth: [] }],
          summary: "Aprova uma sugestão de aprendizado (não cria conhecimento/regra automaticamente)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Sugestão aprovada" }, "404": { description: "Sugestão não encontrada" } }
        }
      },
      "/admin/agent/learning/{id}/reject": {
        patch: {
          tags: ["Agente IA - Aprendizados"],
          security: [{ cookieAuth: [] }],
          summary: "Rejeita uma sugestão de aprendizado",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Sugestão rejeitada" }, "404": { description: "Sugestão não encontrada" } }
        }
      },
```

- [ ] **Step 8: Run typecheck and the full suite**

Run: `npm run typecheck`
Expected: 0 errors.

Run: `npm test`
Expected: previous count (78) + 4 new = 82 passing.

- [ ] **Step 9: Commit**

```bash
git add src/modules/agente-ia/agent-learning-suggestions.schemas.ts src/modules/agente-ia/agent-learning-suggestions.service.ts src/modules/agente-ia/agent-learning-suggestions.controller.ts src/modules/agente-ia/agent-learning-suggestions.service.test.ts src/modules/agente-ia/agente-ia.routes.ts src/docs/swagger.ts
git commit -m "feat: adiciona leitura e aprovacao de aprendizados sugeridos (AiLearningSuggestion) ao Agent IA"
```
