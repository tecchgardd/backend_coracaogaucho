# Coração Gaúcho Backend

API em Node.js, TypeScript, Express, Prisma, PostgreSQL, Better Auth e Stripe Checkout hospedado.

## Requisitos e configuração

- Node.js 24
- PostgreSQL
- Conta Stripe com os meios de pagamento desejados ativados
- Stripe CLI para testar webhooks localmente

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

Configure as variáveis abaixo no ambiente local e na Vercel. Nunca exponha as duas credenciais Stripe no frontend, em logs ou respostas:

```dotenv
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_CURRENCY=brl
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3333
N8N_INTEGRATION_SECRET=
```

O arquivo `.env.example` contém também as configurações de banco, autenticação, CORS, Google e Cloudinary.

## Fluxo de pagamentos

O PostgreSQL é a fonte oficial de clientes, eventos, lotes, preços, disponibilidade, pedidos, inscrições e ingressos. O backend recalcula os itens em centavos, cria ou renova a reserva, registra uma tentativa em `Pagamento` e só então cria uma Stripe Checkout Session usando `price_data`.

A página de sucesso nunca confirma o pagamento. O frontend consulta `GET /api/payments/:orderId/status`; somente webhooks assinados confirmam o pedido e liberam ingresso ou inscrição. A finalização transacional é idempotente, e notificações de e-mail, WhatsApp, n8n e contestação administrativa são gravadas em `integration_outbox` com chave de deduplicação.

Rotas principais:

- `POST /api/payments/checkout` — cliente autenticado; recebe somente IDs e quantidades.
- `POST /api/payments/:orderId/retry` — cliente dono; revalida e cria nova tentativa.
- `GET /api/payments/:orderId/status` — cliente dono; retorna somente o estado interno permitido.
- `POST /api/integrations/whatsapp/checkout` — n8n com `x-integration-secret`; origem `WHATSAPP`.
- `PATCH /api/admin/pagamentos/:id/cancelar` — `ADMIN` ou `STAFF`, somente antes da confirmação.
- `POST /api/admin/pagamentos/:id/reembolsar` — somente `ADMIN`; `amount` opcional em centavos.
- `POST /api/stripe/webhook` — público exclusivamente para a Stripe, corpo bruto e `stripe-signature` obrigatórios.
- `GET /health` e `GET /api/health` — saúde da API e indicador booleano `stripeConfigured`.

URLs do checkout:

- sucesso: `${FRONTEND_URL}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`
- cancelamento: `${FRONTEND_URL}/checkout/cancelado?orderId={orderId}`

## Webhook Stripe

Destino de produção:

```text
Nome: Coração Gaúcho - Produção
URL: https://backend-coracaogaucho.vercel.app/api/stripe/webhook
Descrição: Webhook de produção para confirmação de pagamentos, expiração de checkout, falhas, reembolsos e contestações do sistema Coração Gaúcho.
```

Marque exatamente estes eventos no Workbench/Dashboard:

- `checkout.session.completed`
- `checkout.session.expired`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.canceled`
- `charge.refunded`
- `charge.refund.updated`
- `charge.dispute.created`
- `charge.dispute.updated`
- `charge.dispute.closed`

O endpoint deve permanecer sem autenticação de usuário e sem redirect. A assinatura é validada sobre o `Buffer` antes de `express.json()`. Eventos são reivindicados atomicamente por `event.id`, recebem os estados `RECEIVED`, `PROCESSING`, `PROCESSED`, `FAILED` ou `IGNORED`, e duplicatas respondem HTTP 200.

## Teste local da Stripe

```bash
stripe login
stripe listen --forward-to localhost:3333/api/stripe/webhook
```

Copie o `whsec_...` retornado para o `.env` local como `STRIPE_WEBHOOK_SECRET`. Em outra janela:

```bash
stripe trigger checkout.session.completed
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded
```

Os triggers validam entrega e assinatura, mas seus objetos artificiais podem não conter os metadados internos. Faça também um teste ponta a ponta: autentique um cliente, crie a Checkout Session pela API, abra `checkoutUrl` e conclua com um meio de pagamento de teste.

## Banco, testes e deploy

As migrations são incrementais e não removem pagamentos antigos:

- `20260714190000_integrate_stripe_checkout`
- `20260717120000_add_stripe_payment_integration`

Revise o SQL e aplique no ambiente correto antes de publicar:

```bash
npx prisma migrate deploy
npx prisma generate
npm run typecheck
npm run lint
npm test
npm run build
```

Nunca execute `prisma migrate reset` em banco compartilhado ou de produção.

Na Vercel, selecione esta pasta como Root Directory, configure todas as variáveis de `.env.example` e use as credenciais live da Stripe apenas em produção. `FRONTEND_URL`, `BACKEND_URL`, `BETTER_AUTH_URL`, CORS e o endpoint Stripe precisam usar HTTPS e domínios públicos, sem `:3333`. O Express é exportado por `api/index.ts`; Swagger fica em `/docs`.
