# Exclusão de vendas com refresh de registros vinculados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir excluir vendas (produto/loja, curso, baile, evento) que hoje ficam bloqueadas por terem histórico financeiro, e ao excluir reconciliar (dar "refresh" em) ingressos, inscrições e pagamentos vinculados, mantendo o bloqueio apenas para pagamentos Stripe ainda não estornados.

**Architecture:** Mudança contida em `src/modules/vendas/vendas.service.ts`. Duas funções puras novas decidem (a) se um pagamento Stripe pago bloqueia a exclusão e (b) para qual status cada pagamento deve migrar ao excluir a venda. O método `remover()` passa a usar essas funções e, dentro da mesma transação Prisma que já existe, além de cancelar o `Pedido`, atualiza `Ingresso`, `Inscricao` e `Pagamento` vinculados e grava um `AuditLog` mais detalhado. Nenhuma rota nova, nenhum endpoint de "refresh": capacidade de eventos e dashboard já são calculados ao vivo, então passam a refletir a exclusão automaticamente assim que os status forem atualizados.

**Tech Stack:** TypeScript, Express, Prisma (Postgres), `node:test` (test runner nativo já usado no projeto — sem mocks de Prisma, testes cobrem apenas funções puras, seguindo o padrão já existente em `webhooks.service.test.ts` e `public.service.test.ts`).

## Global Constraints

- Mensagens de erro e nomes de `AuditLog.action` seguem o padrão em português maiúsculo já usado no arquivo (`VENDA_CRIADA`, `VENDA_CANCELADA`, etc.).
- Nenhuma mudança de frontend/painel-admin — repositório separado, fora de escopo.
- Nenhuma chamada automática a `stripe.refunds.create` a partir da exclusão de venda — pagamento Stripe pago/parcialmente estornado continua exigindo o fluxo de reembolso manual existente.
- Não criar model de estoque/produto nem endpoint de "refresh" — capacidade e dashboard já são calculados ao vivo (sem cache) e não precisam de nenhuma ação extra.
- Seguir o padrão de testes do repositório: `node:test` + `assert/strict`, testando funções exportadas puras (sem banco real), como em `src/modules/webhooks/webhooks.service.test.ts` e `src/modules/public/public.service.test.ts`.

---

### Task 1: Funções puras de decisão para exclusão de venda

**Files:**
- Modify: `src/modules/vendas/vendas.service.ts:26-43` (junto às demais funções auxiliares de módulo, como `mapTipo`/`mapStatus`/`eventLabel`)
- Test: `src/modules/vendas/vendas.service.test.ts` (novo arquivo)

**Interfaces:**
- Produces: `pagamentoBloqueiaExclusaoDeVenda(pagamento: { status: string; stripePaymentIntentId: string | null }): boolean` — `true` quando o pagamento é Stripe (`stripePaymentIntentId` presente) e está `PAGO` ou `PARCIALMENTE_ESTORNADO`.
- Produces: `statusPagamentoAoExcluirVenda(pagamento: { status: string; stripePaymentIntentId: string | null }): "CANCELADO" | "ESTORNADO" | null` — `"CANCELADO"` para `PENDENTE`/`PROCESSANDO`; `"ESTORNADO"` para `PAGO` sem `stripePaymentIntentId` (pagamento manual/externo/cortesia já liquidado fora do gateway); `null` (sem alteração) para qualquer outro status (`CANCELADO`, `ESTORNADO`, `FALHOU`, `EXPIRADO`, `PARCIALMENTE_ESTORNADO`, ou `PAGO` com `stripePaymentIntentId` — este último nunca chega aqui pois é bloqueado antes).

- [ ] **Step 1: Escrever o teste com as regras de bloqueio e de transição de status**

Criar `src/modules/vendas/vendas.service.test.ts`:

```typescript
import assert from "node:assert/strict";
import test from "node:test";

process.env.STRIPE_SECRET_KEY ||= "sk_test_unit";

test("pagamento Stripe pago ou parcialmente estornado bloqueia exclusao da venda", async () => {
  const { pagamentoBloqueiaExclusaoDeVenda } = await import("./vendas.service.js");
  assert.equal(pagamentoBloqueiaExclusaoDeVenda({ status: "PAGO", stripePaymentIntentId: "pi_123" }), true);
  assert.equal(pagamentoBloqueiaExclusaoDeVenda({ status: "PARCIALMENTE_ESTORNADO", stripePaymentIntentId: "pi_123" }), true);
});

test("pagamento pago sem stripePaymentIntentId nao bloqueia exclusao (manual/externo/cortesia)", async () => {
  const { pagamentoBloqueiaExclusaoDeVenda } = await import("./vendas.service.js");
  assert.equal(pagamentoBloqueiaExclusaoDeVenda({ status: "PAGO", stripePaymentIntentId: null }), false);
});

test("pagamento pendente ou ja cancelado nao bloqueia exclusao", async () => {
  const { pagamentoBloqueiaExclusaoDeVenda } = await import("./vendas.service.js");
  assert.equal(pagamentoBloqueiaExclusaoDeVenda({ status: "PENDENTE", stripePaymentIntentId: null }), false);
  assert.equal(pagamentoBloqueiaExclusaoDeVenda({ status: "CANCELADO", stripePaymentIntentId: null }), false);
});

test("statusPagamentoAoExcluirVenda cancela pagamentos pendentes ou em processamento", async () => {
  const { statusPagamentoAoExcluirVenda } = await import("./vendas.service.js");
  assert.equal(statusPagamentoAoExcluirVenda({ status: "PENDENTE", stripePaymentIntentId: null }), "CANCELADO");
  assert.equal(statusPagamentoAoExcluirVenda({ status: "PROCESSANDO", stripePaymentIntentId: null }), "CANCELADO");
});

test("statusPagamentoAoExcluirVenda estorna pagamento pago sem gateway Stripe", async () => {
  const { statusPagamentoAoExcluirVenda } = await import("./vendas.service.js");
  assert.equal(statusPagamentoAoExcluirVenda({ status: "PAGO", stripePaymentIntentId: null }), "ESTORNADO");
});

test("statusPagamentoAoExcluirVenda nao altera pagamento ja finalizado", async () => {
  const { statusPagamentoAoExcluirVenda } = await import("./vendas.service.js");
  assert.equal(statusPagamentoAoExcluirVenda({ status: "CANCELADO", stripePaymentIntentId: null }), null);
  assert.equal(statusPagamentoAoExcluirVenda({ status: "ESTORNADO", stripePaymentIntentId: null }), null);
  assert.equal(statusPagamentoAoExcluirVenda({ status: "FALHOU", stripePaymentIntentId: null }), null);
  assert.equal(statusPagamentoAoExcluirVenda({ status: "EXPIRADO", stripePaymentIntentId: null }), null);
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham (funções ainda não existem)**

Run: `npx tsx --import ./src/test-env.ts --test src/modules/vendas/vendas.service.test.ts`
Expected: FAIL — `pagamentoBloqueiaExclusaoDeVenda is not a function` / `statusPagamentoAoExcluirVenda is not a function` (ou erro de import, já que o módulo ainda não exporta esses nomes).

- [ ] **Step 3: Implementar as duas funções em `vendas.service.ts`**

Adicionar logo após `eventLabel` (por volta da linha 43 atual), como exports de nível de módulo:

```typescript
export function pagamentoBloqueiaExclusaoDeVenda(pagamento: { status: string; stripePaymentIntentId: string | null }): boolean {
  return ["PAGO", "PARCIALMENTE_ESTORNADO"].includes(pagamento.status) && Boolean(pagamento.stripePaymentIntentId);
}

export function statusPagamentoAoExcluirVenda(pagamento: { status: string; stripePaymentIntentId: string | null }): "CANCELADO" | "ESTORNADO" | null {
  if (["PENDENTE", "PROCESSANDO"].includes(pagamento.status)) return "CANCELADO";
  if (pagamento.status === "PAGO" && !pagamento.stripePaymentIntentId) return "ESTORNADO";
  return null;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx tsx --import ./src/test-env.ts --test src/modules/vendas/vendas.service.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add src/modules/vendas/vendas.service.ts src/modules/vendas/vendas.service.test.ts
git commit -m "feat: adiciona regras puras de bloqueio e transicao de pagamento na exclusao de venda"
```

---

### Task 2: Rewire `remover()` para cascata de exclusão + auditoria

**Files:**
- Modify: `src/modules/vendas/vendas.service.ts:413-429` (método `remover` dentro de `vendasService`)
- Modify: `src/docs/swagger.ts:208-213` (doc do `DELETE /admin/vendas/{id}`)

**Interfaces:**
- Consumes: `pagamentoBloqueiaExclusaoDeVenda` e `statusPagamentoAoExcluirVenda` de Task 1 (mesmo arquivo).
- Consumes: `AppError` de `../../utils/http.js` (já importado no topo do arquivo).
- Consumes: `venda.raw` — o objeto `Pedido` completo retornado por `this.buscar(id)` (via `toVenda`), que inclui `pagamentos`, `ingressos` e `inscricoes` (de `includeVenda()`).
- Produces: `vendasService.remover(id: number)` continua retornando `Promise<VendaDTO>` (o formato de `toVenda`), mas agora lança `AppError(..., 409)` apenas quando há pagamento Stripe pago/parcialmente estornado, e a venda retornada reflete `Ingresso`/`Inscricao`/`Pagamento` já atualizados.

- [ ] **Step 1: Substituir o corpo de `remover()`**

Localizar em `vendas.service.ts` (linhas 413-429 no estado atual):

```typescript
  async remover(id: number) {
    const venda = await this.buscar(id);
    if (["PAGO", "CORTESIA", "PARCIALMENTE_ESTORNADO", "ESTORNADO"].includes(String(venda.status))) {
      throw new AppError("Venda com historico financeiro nao pode ser excluida; use cancelamento ou reembolso", 409);
    }
    return prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.update({
        where: { id },
        data: { status: "CANCELADO", paymentStatus: "CANCELADO", expiresAt: new Date() },
        include: includeVenda()
      });
      await tx.auditLog.create({
        data: { action: "VENDA_CANCELADA", entity: "Pedido", entityId: String(id), metadata: { reason: "Cancelamento administrativo pela rota legada" } }
      });
      return toVenda(pedido);
    });
  }
```

Substituir por:

```typescript
  async remover(id: number) {
    const venda = await this.buscar(id);
    const pagamentos = venda.raw.pagamentos;
    if (pagamentos.some(pagamentoBloqueiaExclusaoDeVenda)) {
      throw new AppError("Pagamento via Stripe pago precisa ser estornado antes da exclusao; use o fluxo de reembolso", 409);
    }
    return prisma.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id },
        data: { status: "CANCELADO", paymentStatus: "CANCELADO", expiresAt: new Date() }
      });
      await tx.ingresso.updateMany({ where: { orderId: id }, data: { status: "CANCELADO" } });
      await tx.inscricao.updateMany({ where: { orderId: id }, data: { status: "CANCELADA" } });
      for (const pagamento of pagamentos) {
        const novoStatus = statusPagamentoAoExcluirVenda(pagamento);
        if (novoStatus) await tx.pagamento.update({ where: { id: pagamento.id }, data: { status: novoStatus } });
      }
      await tx.auditLog.create({
        data: {
          action: "VENDA_EXCLUIDA",
          entity: "Pedido",
          entityId: String(id),
          metadata: {
            ingressoIds: venda.raw.ingressos.map((ingresso) => ingresso.id),
            inscricaoIds: venda.raw.inscricoes.map((inscricao) => inscricao.id),
            pagamentoIds: pagamentos.map((pagamento) => pagamento.id)
          }
        }
      });
      const pedidoAtualizado = await tx.pedido.findUniqueOrThrow({ where: { id }, include: includeVenda() });
      return toVenda(pedidoAtualizado);
    });
  }
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sem erros. Se o TS reclamar do tipo de `pagamentos.some(pagamentoBloqueiaExclusaoDeVenda)` (por causa de campos extras no objeto `Pagamento` do Prisma), confirmar que `pagamentoBloqueiaExclusaoDeVenda`/`statusPagamentoAoExcluirVenda` aceitam um objeto com campos além de `status`/`stripePaymentIntentId` — TypeScript permite isso por structural typing, então não deve haver erro.

- [ ] **Step 3: Atualizar a documentação Swagger do endpoint**

Em `src/docs/swagger.ts`, localizar o bloco `delete` dentro de `/admin/vendas/{id}` (linhas 208-213 no estado atual):

```typescript
        delete: {
          tags: ["Vendas"],
          summary: "Cancela venda sem apagar o histórico financeiro",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Venda removida" }, "404": { description: "Venda não encontrada" } }
        }
```

Substituir por:

```typescript
        delete: {
          tags: ["Vendas"],
          summary: "Cancela a venda e sincroniza ingressos, inscrições e pagamentos vinculados",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: {
            "200": { description: "Venda removida" },
            "404": { description: "Venda não encontrada" },
            "409": { description: "Pagamento via Stripe pago precisa ser estornado antes da exclusão" }
          }
        }
```

- [ ] **Step 4: Smoke test manual contra banco local**

Não há infraestrutura de teste de integração com banco neste repositório (todos os testes existentes cobrem apenas funções puras, sem Prisma real — ver `src/modules/webhooks/webhooks.service.test.ts` e `src/modules/public/public.service.test.ts`). Validar manualmente:

```bash
npm run db:up
npm run prisma:migrate:dev
npm run dev
```

Em outro terminal, autenticado como admin (usar um token válido do painel, ou o fluxo de login já existente), exercitar os quatro casos abaixo via curl/HTTP client contra `http://localhost:3333`:

1. Criar uma venda pendente (`POST /admin/vendas`) e excluí-la (`DELETE /admin/vendas/:id`) → esperar `200`, e conferir no banco (`npx prisma studio` ou `psql`) que `Pedido.status = CANCELADO`.
2. Criar uma venda com `formaPagamento` externo (ex: `DINHEIRO`) — fica `PAGO` sem `stripePaymentIntentId` — e excluí-la → esperar `200`, e conferir que o `Pagamento` associado virou `ESTORNADO` e o `Ingresso`/`Inscricao` associado virou `CANCELADO`/`CANCELADA`.
3. Criar uma venda de curso ou evento com capacidade limitada, excluí-la, e criar uma nova venda para o mesmo evento/curso preenchendo a capacidade total → esperar sucesso, confirmando que a vaga foi liberada automaticamente (sem nenhuma ação extra de "refresh").
4. Se houver um pagamento Stripe `PAGO` de teste disponível (com `stripePaymentIntentId` real, via checkout de teste), tentar excluir a venda associada → esperar `409` com a mensagem sobre usar o fluxo de reembolso.

Registrar o resultado desses 4 casos antes de prosseguir; se algum falhar, corrigir o código de `remover()` antes de commitar.

- [ ] **Step 5: Rodar a suíte completa de testes**

Run: `npm test`
Expected: todos os testes passam, incluindo os novos de Task 1.

- [ ] **Step 6: Commit**

```bash
git add src/modules/vendas/vendas.service.ts src/docs/swagger.ts
git commit -m "feat: exclusao de venda cancela ingressos, inscricoes e pagamentos vinculados"
```

---

## Self-Review Notes

- **Cobertura da spec:** regra de bloqueio revisada (Task 2, Step 1), cascata para `Ingresso`/`Inscricao`/`Pagamento` (Task 2, Step 1), `AuditLog` com metadata detalhada (Task 2, Step 1), confirmação de que capacidade/dashboard não precisam de endpoint de refresh (documentado no `Architecture` acima, sem código adicional pois já é comportamento existente), casos de teste da tabela da spec cobertos pelo smoke test manual (Task 2, Step 4) já que não há infraestrutura de teste de integração no repositório.
- **Sem placeholders:** todos os steps têm código completo, sem "TBD"/"similar to".
- **Consistência de tipos:** `statusPagamentoAoExcluirVenda` retorna `"CANCELADO" | "ESTORNADO" | null`, usado de forma consistente em Task 2; `pagamentoBloqueiaExclusaoDeVenda` retorna `boolean`, usado com `.some()` em Task 2.
