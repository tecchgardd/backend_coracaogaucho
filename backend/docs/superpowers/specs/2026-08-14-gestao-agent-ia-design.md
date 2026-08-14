# Gestão do Agent IA — Prompts, Regras, Conhecimento, Aprendizados

## Contexto

Este é o segundo pedaço do sub-projeto "Gestão do Agent IA" (o primeiro,
`AgentConfig`/`AgentChannelConfig`, já está mesclado em `main` — recuperado
de um worktree que continha trabalho não commitado de uma etapa anterior
desta mesma iniciativa). Cobre os 4 models restantes do schema já existente:
`AiRule`, `AiPrompt`, `AiKnowledge`, `AiLearningSuggestion`.

Nenhum desses models é lido pelo agente que atende clientes de verdade hoje
(que roda no n8n e lê `regras_agentes`/`n8n_chat_histories`, tabelas
diferentes) — este CRUD é "produção-inerte": não afeta o atendimento ao
vivo, só prepara a gestão para quando o backend assumir o atendimento de
fato (sub-projetos futuros, hoje bloqueados por falta de credenciais
`OPENAI_API_KEY`/Z-API).

As 4 tabelas estão com 0 linhas (confirmado por contagem direta no banco) —
não há dado legado limitando decisões de formato.

## Padrão a seguir

Mesmo padrão já estabelecido e mesclado em `src/modules/agente-ia/` pelos
recursos `AgentConfig`/`AgentChannelConfig`:

- `agente-ia.routes.ts` é um **barrel único** que registra todas as rotas
  diretamente (`agenteIaRoutes.get("/rules", ...)`, etc.) — não um router
  por recurso.
- Cada recurso ganha `agent-<recurso>.controller.ts` / `.service.ts` /
  `.schemas.ts` / `.service.test.ts` próprios.
- Controllers são finos: extraem `req.body`/`req.params`, checam
  `if (!req.auth) throw new AppError("Não autenticado", 401)`, chamam o
  service, respondem com `res.json(...)`.
- Toda escrita grava `AuditLog` (`action`, `entity` = nome do model,
  `entityId` = id da linha como string, `colaboradorId`, `metadata`).
- Testes rodam contra o Postgres real (mesmo banco do `.env`), direto na
  camada de service (não via HTTP), com limpeza em `try/finally` e um ator
  real obtido via `prisma.colaborador.findFirstOrThrow()`.
- Rotas montadas em `src/routes/index.ts` já existente:
  `routes.use("/admin/agent", authMiddleware, requireRoles("ADMIN", "STAFF"), agenteIaRoutes)`
  — sem mudança nesse mount; ações destrutivas usam `requireRoles("ADMIN")`
  na rota específica, igual ao `/status` do `AgentConfig` já existente.

## Valores fechados (zod enum)

Sem CHECK constraint no banco e sem dado legado — os valores abaixo são
decisão deste sub-projeto, validados via zod, não uma restrição herdada:

- `status` (`AiRule`, `AiKnowledge`, `AiPrompt`): `"ATIVO" | "INATIVO"`
  (mesmo padrão de `Colaborador.status` já usado no código).
- `AiRule.category`: `"GERAL" | "VENDAS" | "INSCRICAO" | "ATENDIMENTO" | "PAGAMENTO"`.
- `AiPrompt.scope`: `"GENERAL" | "VENDAS" | "INSCRICAO"`.
- `AiKnowledge.type`: `"FAQ" | "POLICY" | "EVENT" | "COURSE" | "PAYMENT" | "TICKET" | "OTHER"`.
- `AiLearningSuggestion.status`: `"PENDENTE" | "APROVADO" | "REJEITADO"`.
- `AiPrompt.tone` e `AiLearningSuggestion.suggestedType`: texto livre
  (`z.string().optional()`), sem conjunto fechado — são descritivos, não
  categorias.

## Endpoints

Todos sob `/admin/agent` (já montado com `authMiddleware` +
`requireRoles("ADMIN", "STAFF")`).

### `AiRule` — `/admin/agent/rules`

- `GET /rules` — lista, filtro opcional `?status=`.
- `GET /rules/:id` — 404 via `AppError` se não achar.
- `POST /rules` — body: `name`, `description?`, `category`, `content`,
  `priority?` (default 5), `status?` (default `"ATIVO"`). `createdBy` =
  `actor.colaboradorId` automaticamente.
- `PATCH /rules/:id` — mesmos campos, todos opcionais. `updatedBy` = actor.
- `PATCH /rules/:id/status` — body `{ status: "ATIVO" | "INATIVO" }`.
- `DELETE /rules/:id` — **`requireRoles("ADMIN")`** na rota. Hard delete.

### `AiPrompt` — `/admin/agent/prompts`

Mesmo shape de `AiRule` (`GET` lista/um, `POST`, `PATCH`,
`PATCH /:id/status`, `DELETE` ADMIN-only), com duas diferenças:

- Campos: `name`, `description?`, `content`, `tone?`, `scope`, `status?`,
  `version` (não vem no body).
- `PATCH /prompts/:id` incrementa `version` automaticamente
  (`{ increment: 1 }` na chamada Prisma) — nunca setável diretamente pelo
  cliente.

Fora de escopo (YAGNI, do pedido original): `POST /prompts/:id/duplicate`.

### `AiKnowledge` — `/admin/agent/knowledge`

Mesmo shape (`GET` lista/um, `POST`, `PATCH`, `PATCH /:id/status`, `DELETE`
ADMIN-only). Campos: `title`, `content`, `type`, `source?`, `status?`.
`POST` seta `approvedById` = `actor.colaboradorId` automaticamente (autoria
direta por um admin já conta como aprovação — a necessidade de aprovação
separada só existe para o que a IA sugerir, e isso passa por
`AiLearningSuggestion`, não por criação direta aqui).

### `AiLearningSuggestion` — `/admin/agent/learning`

Só leitura + transição de review — nada de criação manual (é alimentada
pelo loop de IA futuro, sub-projeto ainda não construído):

- `GET /learning` — lista, filtro opcional `?status=`.
- `GET /learning/:id`.
- `PATCH /learning/:id/approve` — `status = "APROVADO"`, `reviewedById` =
  actor, `reviewedAt = now()`.
- `PATCH /learning/:id/reject` — mesma coisa com `"REJEITADO"`.

Fora de escopo (decisão explícita, não esquecimento): aprovar **não** cria
automaticamente um `AiKnowledge`/`AiRule` — só marca o status. A conversão
automática fica para quando o loop de IA que alimenta esta tabela existir
de verdade.

## Erros e validação

- Zod via `validate({ body, params, query })` (middleware já existente,
  `src/utils/http.ts`), mesmo padrão de todo módulo admin.
- `AppError("<Recurso> não encontrado", 404)` em `GET/PATCH/DELETE` por id
  quando a linha não existe.
- `req.auth` sempre presente em tempo de execução (rota já protegida por
  `authMiddleware`) — o `if (!req.auth) throw ...` nos controllers é
  defensivo, mesmo padrão já usado em `agent-config.controller.ts`.

## Fora de escopo

- Qualquer sistema de permissão granular (`AGENT_MANAGE_RULES`, etc.) — RBAC
  continua só por `role` (`ADMIN`/`STAFF`), igual a todo módulo existente.
- Conversão automática de `AiLearningSuggestion` aprovada em
  `AiKnowledge`/`AiRule`/atualização de `AiPrompt`.
- `POST /prompts/:id/duplicate`.
- Qualquer coisa que leia/escreva `regras_agentes`/`n8n_chat_histories`
  (tabelas do n8n) ou que altere o comportamento do agente que atende
  clientes hoje.
- Migrar o conteúdo de `regras_agentes` para `AiRule` — só faz sentido
  quando o backend assumir o atendimento de verdade.

## Testes

Para cada recurso (`AiRule`, `AiPrompt`, `AiKnowledge`): criar, buscar por
id, listar, atualizar, toggle de status, excluir (verificando 404 depois),
tentativa de excluir sem ser ADMIN (403), e confirmar `AuditLog` gravado em
cada escrita com o `colaboradorId` correto.

Para `AiLearningSuggestion`: listar/filtrar por status, aprovar (confirma
`status`/`reviewedById`/`reviewedAt`), rejeitar, confirmar que não existe
rota de criação manual, confirmar `AuditLog` gravado na transição.

Suíte inteira (`npm test`) deve continuar 100% verde (linha de base atual:
60/60) mais os testes novos.
