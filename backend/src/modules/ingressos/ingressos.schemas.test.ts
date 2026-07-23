import assert from "node:assert/strict";
import test from "node:test";
import { gerarLoteSchema } from "./ingressos.schemas.js";

const base = {
  customerId: 10,
  eventoId: 20,
  quantidade: 3,
  valorUnitario: 50
};

test("lote exige aluno e uma quantidade positiva", () => {
  assert.equal(gerarLoteSchema.safeParse({
    eventoId: 20,
    quantidade: 1,
    origemFinanceira: "NOVA_VENDA"
  }).success, false);
  assert.equal(gerarLoteSchema.safeParse({
    ...base,
    quantidade: 0,
    origemFinanceira: "NOVA_VENDA"
  }).success, false);
});

test("lote sem cobrança e cortesia exigem justificativa administrativa", () => {
  assert.equal(gerarLoteSchema.safeParse({ ...base, origemFinanceira: "SEM_COBRANCA" }).success, false);
  assert.equal(gerarLoteSchema.safeParse({
    ...base,
    origemFinanceira: "CORTESIA",
    observacoes: "Cortesia autorizada"
  }).success, true);
});

test("venda existente exige a venda e pagamento externo exige sua forma", () => {
  assert.equal(gerarLoteSchema.safeParse({ ...base, origemFinanceira: "VENDA_EXISTENTE" }).success, false);
  assert.equal(gerarLoteSchema.safeParse({
    ...base,
    origemFinanceira: "VENDA_EXISTENTE",
    pedidoId: 30
  }).success, true);
  assert.equal(gerarLoteSchema.safeParse({ ...base, origemFinanceira: "PAGAMENTO_EXTERNO" }).success, false);
  assert.equal(gerarLoteSchema.safeParse({
    ...base,
    origemFinanceira: "PAGAMENTO_EXTERNO",
    formaPagamentoExterno: "PIX_EXTERNO"
  }).success, true);
});

test("lote aceita todas as formas externas suportadas e nao exige preco do cliente", () => {
  for (const formaPagamentoExterno of ["PIX_EXTERNO", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO"]) {
    const parsed = gerarLoteSchema.parse({
      customerId: 10,
      eventoId: 20,
      quantidade: 2,
      origemFinanceira: "PAGAMENTO_EXTERNO",
      formaPagamentoExterno
    });
    assert.equal(parsed.valorUnitario, undefined);
  }
});
