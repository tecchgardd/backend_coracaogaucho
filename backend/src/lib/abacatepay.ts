import { env } from "../env.js";

type AbacatePayPayload = Record<string, unknown>;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!env.ABACATEPAY_API_KEY) {
    throw Object.assign(new Error("ABACATEPAY_API_KEY não configurada"), { statusCode: 500 });
  }

  const response = await fetch(`${env.ABACATEPAY_API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.ABACATEPAY_API_KEY}`,
      ...(options.headers ?? {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw Object.assign(new Error("Erro na comunicação com AbacatePay"), {
      statusCode: response.status,
      details: data
    });
  }

  return data as T;
}

export const abacatePay = {
  criarCobranca(payload: AbacatePayPayload) {
    return request<AbacatePayPayload>("/billing/create", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  consultarCobranca(id: string) {
    return request<AbacatePayPayload>(`/billing/${id}`, { method: "GET" });
  },

  cancelarCobranca(id: string) {
    return request<AbacatePayPayload>(`/billing/${id}/cancel`, { method: "POST" });
  }
};
