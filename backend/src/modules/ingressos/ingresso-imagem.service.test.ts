import assert from "node:assert/strict";
import test from "node:test";

test("uses IngressoAluno tickets when the order has a lote, ignoring cancelled ones", async () => {
  const { resolveTickets } = await import("./ingresso-imagem.service.js");
  const pedido = {
    ingressos: [],
    loteIngresso: {
      tickets: [
        { id: 1, codigo: "CG-AAA", qrcode: "CGQR:CG-AAA", valor: 35, status: "PAGO" },
        { id: 2, codigo: "CG-BBB", qrcode: "CGQR:CG-BBB", valor: 35, status: "CANCELADO" },
        { id: 3, codigo: "CG-CCC", qrcode: "CGQR:CG-CCC", valor: 35, status: "CORTESIA" }
      ]
    }
  };
  const tickets = resolveTickets(pedido);
  assert.deepEqual(tickets, [
    { ticketId: 1, codigo: "CG-AAA", qrPayload: "CGQR:CG-AAA", valor: 35 },
    { ticketId: 3, codigo: "CG-CCC", qrPayload: "CGQR:CG-CCC", valor: 35 }
  ]);
});

test("falls back to legacy Ingresso rows when there is no lote, ignoring cancelled ones", async () => {
  const { resolveTickets } = await import("./ingresso-imagem.service.js");
  const pedido = {
    ingressos: [
      { id: 10, qrcode: "TKT-xxxx", preco: 35, status: "PAGO" },
      { id: 11, qrcode: "TKT-yyyy", preco: 35, status: "CANCELADO" }
    ],
    loteIngresso: null
  };
  const tickets = resolveTickets(pedido);
  assert.deepEqual(tickets, [
    { ticketId: 10, codigo: "ING-000010", qrPayload: "TKT-xxxx", valor: 35 }
  ]);
});

test("returns an empty list when there are no tickets at all", async () => {
  const { resolveTickets } = await import("./ingresso-imagem.service.js");
  assert.deepEqual(resolveTickets({ ingressos: [], loteIngresso: null }), []);
});
