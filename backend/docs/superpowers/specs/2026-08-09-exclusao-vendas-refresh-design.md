# Exclusão de vendas com refresh de registros vinculados

## Contexto

O módulo de vendas (`src/modules/vendas`) já expõe `DELETE /vendas/:id`, roteado para
`vendas.controller.ts:remover` → `vendas.service.ts:remover`. Essa rota atende de forma
uniforme todos os "tipos" de venda percebidos pelo usuário (produto/loja, curso, baile,
evento), pois todos são representados pelo mesmo model `Pedido` — a diferenciação de tipo
vem de `Pedido.type` (`STORE`/`EVENT`) e de `Evento.tipo` (`CURSO`/`BAILE`/`EVENTO`).

Hoje, `remover()`:

- Bloqueia (HTTP 409) a exclusão sempre que `venda.status` está em
  `["PAGO", "CORTESIA", "PARCIALMENTE_ESTORNADO", "ESTORNADO"]`, direcionando o usuário a
  usar "cancelamento ou reembolso" em vez disso.
- Quando permite a exclusão, apenas atualiza o `Pedido` para `status: CANCELADO`,
  `paymentStatus: CANCELADO`, `expiresAt: now`, e grava um `AuditLog`.
- Não toca em `Ingresso`, `Inscricao` nem `Pagamento` vinculados ao pedido.

Como a maioria das vendas reais termina em `PAGO`, na prática a exclusão está indisponível
para vendas de qualquer tipo — o que motivou este ajuste.

Adicionalmente, como nada é cacheado no backend (capacidade de eventos e os números do
dashboard são sempre calculados ao vivo via agregações Prisma, filtrando pedidos com
`status: CANCELADO`), não existe necessidade de um endpoint de "refresh" separado: uma vez
que o `Pedido` (e os registros vinculados) mudam de status corretamente, a próxima consulta
já reflete o estado atualizado automaticamente. O "refresh" pedido consiste em garantir que
**todos os registros vinculados** — não só o `Pedido` — sejam reconciliados no momento da
exclusão.

Este é um ajuste apenas de backend. Não há chamador de `DELETE /vendas/:id` no frontend
atualmente; nenhuma mudança de frontend está no escopo deste trabalho.

## Comportamento atual vs. desejado

| Situação | Hoje | Depois |
|---|---|---|
| Venda pendente/processando/falhou/expirada | Cancela só o Pedido | Cancela Pedido + ingressos/inscrições/pagamentos vinculados |
| Venda cortesia | Bloqueada (409) | Permitida, com cascata |
| Venda paga manualmente (dinheiro, PIX externo, cartão externo — sem `stripePaymentIntentId`) | Bloqueada (409) | Permitida, com cascata; pagamento marcado `ESTORNADO` |
| Venda paga via Stripe (`stripePaymentIntentId` presente, status `PAGO`/`PARCIALMENTE_ESTORNADO`) | Bloqueada (409) | **Continua bloqueada** — precisa passar pelo fluxo de reembolso Stripe (`POST /pagamentos/:id/refund`) primeiro |
| Venda já cancelada/estornada | Bloqueada (409) | Permitida (idempotente) |

A regra de bloqueio deixa de ser "tem qualquer histórico financeiro" e passa a ser
especificamente "tem pagamento Stripe pago/parcialmente estornado ainda não revertido". Isso
preserva a garantia de segurança financeira (dinheiro que passou por gateway externo exige
reembolso explícito) sem impedir a exclusão nos demais casos.

## Mudança em `vendas.service.ts: remover`

1. **Buscar a venda com os pagamentos vinculados** (já incluído via `includeVenda()`).
2. **Nova checagem de bloqueio**: se existir algum `Pagamento` do pedido com
   `status IN (PAGO, PARCIALMENTE_ESTORNADO)` **e** `stripePaymentIntentId` não nulo, lançar
   `AppError("Pagamento via Stripe pago precisa ser estornado antes da exclusão; use o fluxo de reembolso", 409)`.
   Caso contrário, prosseguir.
3. **Dentro da mesma transação Prisma** (`prisma.$transaction`):
   - `Pedido` → `status: CANCELADO`, `paymentStatus: CANCELADO`, `expiresAt: new Date()`
     (comportamento já existente, mantido).
   - `Ingresso` (`where: { orderId: id }`) → `updateMany({ status: "CANCELADO" })`.
   - `Inscricao` (`where: { orderId: id }`) → `updateMany({ status: "CANCELADA" })`.
   - `Pagamento` vinculados ao pedido:
     - os com `status IN (PENDENTE, PROCESSANDO)` → `CANCELADO`.
     - os com `status: PAGO` **sem** `stripePaymentIntentId` (pagamento manual/externo já
       liquidado fora do gateway) → `ESTORNADO` (sinaliza que o valor deve ser devolvido
       manualmente pela equipe; não há chamada a provedor externo).
     - os já `CANCELADO`/`ESTORNADO`/`FALHOU`/`EXPIRADO` → inalterados.
   - `AuditLog` com `action: "VENDA_EXCLUIDA"`, `entity: "Pedido"`, `entityId`, e
     `metadata` listando os ids de ingressos, inscrições e pagamentos afetados.
4. Retornar a venda atualizada (`toVenda(pedido)`), como hoje.

Nenhuma rota nova é criada; `DELETE /vendas/:id` continua sendo o único ponto de entrada.
Nenhum "endpoint de refresh" é necessário — capacidade de eventos e dashboard já leem o
estado atualizado na próxima consulta, pois nunca foram cacheados.

## Fora de escopo

- Reembolso automático de pagamentos Stripe pagos (permanece manual, via fluxo de reembolso
  já existente em `pagamentos.service.ts: refund`).
- Qualquer alteração de frontend/painel-admin (repositório separado, não tocado aqui).
- Qualquer noção de estoque de produto físico — não existe model de produto/estoque no
  schema atual; "recalcular estoque" nesta feature se refere a vagas/capacidade de evento,
  que já é calculada ao vivo.

## Testes

- Excluir venda `PENDENTE`/`PROCESSANDO`/`FALHOU`/`EXPIRADA` → sucesso, cascata aplicada.
- Excluir venda `CORTESIA` → sucesso, cascata aplicada.
- Excluir venda paga manualmente (sem `stripePaymentIntentId`) → sucesso, `Pagamento` vira
  `ESTORNADO`.
- Excluir venda paga via Stripe (`stripePaymentIntentId` presente) → 409, mensagem indicando
  uso do fluxo de reembolso.
- Excluir venda já `CANCELADO`/`ESTORNADO` → sucesso (idempotente).
- Após exclusão, verificar que `Ingresso.status` e `Inscricao.status` vinculados mudaram.
- Após exclusão de venda de evento com capacidade limitada, verificar que uma nova venda
  consegue reservar a vaga liberada (confirma que o cálculo de capacidade já reflete o
  cancelamento sem nenhuma ação extra).
