import type { PagamentoStatus } from "@prisma/client";

export const stripeCheckoutStatusMap: Record<string, PagamentoStatus> = {
  open: "PENDENTE",
  unpaid: "PENDENTE",
  processing: "PROCESSANDO",
  paid: "PAGO",
  complete: "PROCESSANDO",
  expired: "EXPIRADO"
};

export function mapStripeCheckoutStatus(status?: string | null, paymentStatus?: string | null): PagamentoStatus {
  if (status === "expired") return "EXPIRADO";
  if (paymentStatus && stripeCheckoutStatusMap[paymentStatus]) return stripeCheckoutStatusMap[paymentStatus];
  if (status && stripeCheckoutStatusMap[status]) return stripeCheckoutStatusMap[status];
  return "PENDENTE";
}
