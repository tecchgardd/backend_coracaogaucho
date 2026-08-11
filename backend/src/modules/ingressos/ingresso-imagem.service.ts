export interface TicketResolvido {
  ticketId: number;
  codigo: string;
  qrPayload: string;
  valor: number;
}

export interface PedidoParaImagem {
  ingressos: { id: number; qrcode: string; preco: number; status: string }[];
  loteIngresso: { tickets: { id: number; codigo: string; qrcode: string; valor: number; status: string }[] } | null;
}

export function resolveTickets(pedido: PedidoParaImagem): TicketResolvido[] {
  if (pedido.loteIngresso) {
    return pedido.loteIngresso.tickets
      .filter((ticket) => ticket.status !== "CANCELADO")
      .map((ticket) => ({ ticketId: ticket.id, codigo: ticket.codigo, qrPayload: ticket.qrcode, valor: ticket.valor }));
  }
  return pedido.ingressos
    .filter((ingresso) => ingresso.status !== "CANCELADO")
    .map((ingresso) => ({
      ticketId: ingresso.id,
      codigo: `ING-${String(ingresso.id).padStart(6, "0")}`,
      qrPayload: ingresso.qrcode,
      valor: ingresso.preco
    }));
}
