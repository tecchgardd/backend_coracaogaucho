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
