import QRCode from "qrcode";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { renderHtmlToJpeg } from "../../lib/html-screenshot.js";
import { buildIngressoHtml } from "./ingresso-imagem.html.js";

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

export interface ImagemIngressoResultado {
  ticketId: number;
  codigo: string;
  eventoNome: string;
  telefone: string;
  imageBase64: string;
}

const LARGURA_IMAGEM_PX = 1000;

export const ingressoImagemService = {
  async gerarImagens(paymentId: number): Promise<ImagemIngressoResultado[]> {
    const pagamento = await prisma.pagamento.findUnique({
      where: { id: paymentId },
      include: {
        customer: true,
        evento: true,
        pedido: { include: { ingressos: true, loteIngresso: { include: { tickets: true } } } }
      }
    });
    if (!pagamento) throw new AppError("Pagamento não encontrado", 404);
    if (!pagamento.pedido) throw new AppError("Pagamento sem venda vinculada", 404);

    const tickets = resolveTickets(pagamento.pedido);
    if (tickets.length === 0) throw new AppError("Nenhum ingresso encontrado para este pagamento", 404);

    const resultados: ImagemIngressoResultado[] = [];
    for (const ticket of tickets) {
      const qrDataUrl = await QRCode.toDataURL(ticket.qrPayload, { width: 300, margin: 1 });
      const html = buildIngressoHtml({
        eventoNome: pagamento.evento.nome,
        eventoLocal: pagamento.evento.local,
        eventoCidade: pagamento.evento.cidade,
        eventoData: pagamento.evento.data,
        eventoBanner: pagamento.evento.banner,
        customerNome: pagamento.customer.nome,
        customerCpf: pagamento.customer.cpf,
        valor: ticket.valor,
        codigo: ticket.codigo,
        qrDataUrl
      });
      const jpeg = await renderHtmlToJpeg(html, LARGURA_IMAGEM_PX);
      resultados.push({
        ticketId: ticket.ticketId,
        codigo: ticket.codigo,
        eventoNome: pagamento.evento.nome,
        telefone: pagamento.customer.telefone,
        imageBase64: `data:image/jpeg;base64,${jpeg.toString("base64")}`
      });
    }
    return resultados;
  }
};
