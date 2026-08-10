# Geração da imagem do ingresso no backend

## Contexto

Hoje o envio do "ingresso" (imagem enviada por WhatsApp após confirmação de pagamento de um
baile) é feito inteiramente por uma automação n8n (`outbox_consumidor_pagamento_n8n`, com um
subworkflow reutilizável equivalente `enviar_comprovante_subworkflow`):

1. Um scheduler lê a fila `integration_outbox` (tópico `PAYMENT_CONFIRMED_N8N`, criado em
   `webhooks.service.ts:173` quando o Stripe confirma um pagamento).
2. Um node Postgres busca dados do pagamento com uma query SQL manual, fazendo `JOIN` apenas
   nas tabelas legadas `ingresso` e `inscricao`.
3. Um node de código monta HTML/CSS inline (função `htmlIngresso()`, entre outras).
4. Um node HTTP chama um Gotenberg (`http://gotenberg:3000`, hostname interno do Docker do
   servidor onde o n8n roda) para renderizar esse HTML como screenshot JPEG.
5. Um node HTTP envia a imagem via Z-API (WhatsApp).

O backend (`coracao-gaucho-admin-backend`) hoje **não participa** dessa geração — só emite o
evento de outbox. Ele roda serverless na Vercel (`api/index.ts` + `vercel.json`), então não
tem acesso de rede ao Gotenberg interno do n8n.

### Causa raiz dos problemas relatados

- **Banner vazio no ingresso**: `evento.banner` está vazio para o evento em questão (campo
  existe e funciona no backend — confirmado em `eventos.schemas.ts`/`eventos.service.ts` e nos
  testes de `eventos.images.test.ts`), e o template n8n não tem nenhum fallback visual quando
  `evento_banner` vem nulo — o poster fica com fundo escuro vazio.
- **Query desatualizada**: a query SQL do n8n só faz `JOIN` nas tabelas legadas `ingresso` /
  `inscricao`, nunca em `ingresso_aluno` / `lote_ingresso_aluno` — o modelo que
  `ingressosService.gerarLote()` (`src/modules/ingressos/ingressos.service.ts`) usa para
  vender ingressos em lote pelo painel admin. Como resultado:
  - Lotes pagos sem passar pelo webhook do Stripe (PIX externo, cortesia, comprovante manual
    confirmado por um colaborador via `atualizarLote()`) **nunca disparam** o envio, porque o
    outbox `PAYMENT_CONFIRMED_N8N` só é criado em `webhooks.service.ts` (fluxo Stripe).
  - Mesmo quando dispara (pagamento via Stripe), a query une pela tabela `ingresso` legada,
    que só é populada por `webhooks.service.ts:148` — não pela tabela `ingresso_aluno`, que é
    a fonte de verdade usada pelo scanner (`scanner.service.ts`) e pelo painel admin.
- **`LIMIT 1` na query**: cada pagamento gera no máximo 1 imagem, mesmo quando o lote tem
  `quantidade > 1` — ingressos adicionais do mesmo lote nunca recebem imagem própria com seu
  próprio QR code.

## Decisões (validadas com o usuário)

- O backend passa a **gerar a imagem** (não só dados) — a renderização HTML→JPEG sai do
  Gotenberg do n8n e entra na função serverless da Vercel, usando `puppeteer-core` +
  `@sparticuz/chromium` (Chromium empacotado para ambiente serverless, sem dependência de rede
  externa nem de infraestrutura do n8n).
- O formato de saída continua sendo **imagem JPEG** (não um PDF de verdade) — mantém
  compatibilidade com o envio atual via Z-API (`send-image`, que recebe uma data URI).
- Quando o lote/pedido tem mais de um ingresso, o endpoint gera **uma imagem por ingresso**
  (não mais uma imagem genérica por pagamento).
- O n8n deixa de fazer a query SQL manual e a chamada ao Gotenberg; passa a chamar um novo
  endpoint deste backend e iterar sobre a lista retornada para enviar uma mensagem por
  ingresso. (Ajuste do workflow em si fica fora deste repositório — documentado aqui, não
  implementado por mim.)

## Novo endpoint

`GET /integrations/payments/:paymentId/tickets-image`

- Módulo: `src/modules/ingressos/` (novo arquivo `ingresso-imagem.service.ts` + rota exposta
  via `ingressos.controller.ts`/`ingressos.routes.ts`, montada em `integrationsRoutes`
  — mesma árvore de `/integrations/whatsapp/checkout` e `/integrations/payment-status`).
- Autenticação: mesmo padrão já existente — header `x-integration-secret`, validado com
  `integrationSecretIsValid` (`pagamentos.controller.ts`), reaproveitado sem duplicação.
- Resolução dos ingressos, dado `paymentId`:
  1. Busca `Pagamento` (por `id`) incluindo `pedido` (com `items.evento` e `loteIngresso`),
     igual ao que `webhooks.service.ts:handleCheckoutCompleted` já faz.
  2. Se `pedido.loteIngresso` existir → usa `loteIngresso.tickets` (`IngressoAluno[]`,
     excluindo `status: CANCELADO`).
  3. Senão → usa `Ingresso[]` vinculados a `pedido.id` (`where: { orderId: pedido.id }`,
     excluindo `CANCELADO`).
  4. Se nenhum ingresso for encontrado → 404 (`AppError`).
- Para cada ingresso: monta o HTML do template de ingresso e renderiza uma imagem JPEG.
- Resposta:
  ```json
  {
    "success": true,
    "data": [
      {
        "ticketId": 123,
        "codigo": "CG-XXXXXXXXXXXXXX",
        "eventoNome": "Baile do Ano",
        "telefone": "5548999999999",
        "imageBase64": "data:image/jpeg;base64,..."
      }
    ]
  }
  ```

## Template de renderização

Porta o HTML/CSS de `htmlIngresso()` (recebido do export do n8n) para uma função TypeScript
(`buildIngressoHtml(ticket)`), mantendo o mesmo layout visual já validado pelo usuário
(poster do evento, cards de data/início/local, bloco do portador, QR + aviso de entrada,
canhoto lateral com o código). Duas mudanças de conteúdo:

1. **Fallback de banner**: quando `evento.banner` for vazio, o poster usa um fundo em
   gradiente com as cores da marca (verde/dourado, consistentes com `.tagline`/`.aviso-ent`
   já usados no template) em vez de ficar em branco/vazio.
2. **QR code local**: gerado com o pacote `qrcode` (renderiza um PNG/data-URL localmente),
   substituindo a chamada atual a `api.qrserver.com` — remove uma dependência de rede externa
   e evita expor o payload do QR (código do ingresso) a um serviço terceiro.

O restante do layout (fontes, cores, grid do portador, cartão de aviso, canhoto) permanece
igual ao que já existe no template do n8n.

## Fora de escopo

- Editar o workflow do n8n em si (fica em outro sistema, fora deste repositório). O
  comportamento esperado do lado do n8n fica documentado aqui para quem for ajustar o
  workflow: trocar os nodes "Montar HTML do comprovante" + "Gerar imagem (Gotenberg)" por uma
  chamada HTTP a `GET /integrations/payments/:paymentId/tickets-image`, e iterar sobre
  `data[]` para enviar uma mensagem por ingresso.
- Documento de "comprovante de inscrição" (curso) e "recibo/comprovante de pagamento" — o
  pedido do usuário foi especificamente sobre o ingresso do baile; os outros dois documentos
  do template n8n não são portados nesta mudança.
- Emitir o outbox `PAYMENT_CONFIRMED_N8N` (ou equivalente) para pagamentos de lote confirmados
  manualmente (`atualizarLote()`/`registrarPagamento()`) — hoje esses lotes nunca disparam
  envio de WhatsApp, o que é uma lacuna real, mas separada do problema de layout relatado.
  Fica registrado aqui como um gap conhecido para decisão futura.
- Upload/persistência da imagem gerada (ex.: Cloudinary) — a imagem é gerada sob demanda e
  devolvida na resposta, sem guardar cópia, espelhando o comportamento atual (a imagem só
  existe durante o envio pelo WhatsApp).

## Riscos / pontos a validar na implementação

- **Timeout serverless da Vercel**: cold start do Chromium empacotado + renderização de N
  imagens numa única chamada pode se aproximar do limite padrão da function. Pode ser
  necessário configurar `maxDuration` para a function em `vercel.json`/rota. A ser validado
  durante a implementação, testando localmente e no preview da Vercel.
- **Tamanho do build**: `@sparticuz/chromium` é um pacote grande; validar que o bundle da
  function fica dentro do limite da Vercel.

## Testes

- Resolução de ingressos por `paymentId`: pedido com `loteIngresso` → usa `IngressoAluno[]`;
  pedido sem `loteIngresso` → usa `Ingresso[]` legado; `paymentId` inexistente → 404.
- Endpoint rejeita requisição sem `x-integration-secret` válido (mesmo padrão dos outros
  endpoints de integração — reaproveita `integrationSecretIsValid`).
- Lote com `quantidade > 1` gera uma entrada em `data[]` por ingresso, cada uma com seu
  próprio `codigo`.
- Ingresso `CANCELADO` dentro de um lote é excluído da lista gerada.
- Template renderiza sem erro quando `evento.banner` é `null` (fallback de gradiente).
