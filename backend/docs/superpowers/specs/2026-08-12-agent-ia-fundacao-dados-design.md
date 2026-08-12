# Agent IA — Sub-projeto 1: Fundação de dados

## Contexto

O usuário pediu um módulo grande de "Agent IA" (atendimento por WhatsApp/e-mail com IA,
prompts, regras, base de conhecimento, SLA, transferência para humano, RBAC, canais). É um
programa de vários sub-projetos independentes, não uma feature única — este documento cobre
apenas o primeiro: a fundação de dados que todos os outros sub-projetos vão depender.

### O que já existe (levantado nos workflows n8n reais compartilhados nesta conversa)

Já existe um agente de IA **em produção**, rodando inteiramente no n8n, não neste backend:

- **Webhook** (`Webhook Z-API1`) recebe texto/áudio/imagem da Z-API, normaliza, deduplica
  (guarda `messageId`/`phone+moment+conteúdo` numa janela de 30 min via
  `$getWorkflowStaticData`), e monta `sessionId = whatsapp:<telefone>`.
- **Memória de conversa**: node nativo `@n8n/n8n-nodes-langchain.memoryPostgresChat`, gravando
  em `n8n_chat_histories` (`id`, `session_id`, `message: Json` — **sem coluna de timestamp**).
  Formato da mensagem é o do LangChain: `{ type: "ai"|"human"|"tool", content, tool_calls,
  name, tool_call_id, additional_kwargs, response_metadata }`.
- **Agente roteador** ("Assistente_gauchinho1", modelo `gpt-4.1-mini`) decide entre responder
  direto (dúvidas sobre curso/evento, usando `buscar_eventos`) ou acionar um subagente:
  - `Registrar_inscricao1` (`gpt-4o-mini`) — cursos: valida/cadastra customer por CPF, cria/
    atualiza/cancela inscrição, consulta pagamento.
  - `Agente_de_vendas1` (`gpt-5-mini`) — ingressos/bailes: mesmo fluxo de customer, cria
    ingresso, consulta pagamento.
- **Regras dinâmicas**: tool `Carregar_Regras_Dinamicas`, `SELECT ... FROM regras_agentes
  WHERE ativo = true ORDER BY tipo, prioridade`. Tabela **vazia hoje** (0 linhas) — existe no
  schema mas nunca foi populada.
- **Pagamento já passa pelo backend**: os dois subagentes chamam um subworkflow
  `fluxo_pagamentos`, que por sua vez chama `POST /integrations/whatsapp/checkout` e
  `GET /integrations/payment-status` — endpoints que **já existem** neste backend
  (`src/modules/pagamentos/pagamentos.controller.ts`). Só as ferramentas de customer/
  inscrição/regras é que são SQL direto no Postgres, sem passar pelo backend.
- **Envio de ingresso/comprovante**: workflow `enviar_comprovante` (versão antiga, já
  substituída pelo endpoint `/integrations/payments/:paymentId/tickets-image` que este
  backend passou a expor — ver spec `2026-08-10-imagem-ingresso-backend-design.md`).

Amostra real de `n8n_chat_histories` (consultada nesta sessão): 386 linhas, **todas da mesma
sessão** (`whatsapp:554899084537`), conteúdo real de venda de ingresso (busca de evento,
tool-calling, geração de link Stripe, confirmação). `regras_agentes`: 0 linhas.

### Decisões já validadas com o usuário

- O backend deve **migrar e assumir posse** de `n8n_chat_histories` e `regras_agentes`
  (não manter duas fontes de verdade permanentemente).
- O backend deve, a médio prazo, **assumir a camada de canal** (webhook WhatsApp + envio via
  Z-API), tirando esse papel do n8n.
- Este sub-projeto (1 de N) cobre **só a fundação de dados**: os novos modelos Prisma e uma
  migração/backfill do histórico existente. **Não** mexe no webhook, no agente, nas tools SQL
  do n8n, nem em RBAC/endpoints novos — isso fica para os sub-projetos seguintes (canal
  WhatsApp, roteamento humano, prompts/regras/conhecimento, integração OpenAI). O n8n
  **continua funcionando exatamente como hoje** depois deste sub-projeto; nada é desligado.

## Modelos novos (Prisma)

```prisma
enum ConversationChannel {
  WHATSAPP
  EMAIL
  INSTAGRAM
  FACEBOOK
  WEBSITE
}

enum ConversationStatus {
  OPEN
  AI
  QUEUE
  HUMAN
  CLOSED
}

enum ConversationOwnerType {
  AI
  HUMAN
  NONE
}

enum ConversationSenderType {
  CUSTOMER
  AI
  HUMAN
  SYSTEM
}

model Conversation {
  id                     Int                    @id @default(autoincrement())
  customerId             Int?
  channel                ConversationChannel
  externalConversationId String
  status                 ConversationStatus     @default(OPEN)
  ownerType              ConversationOwnerType  @default(NONE)
  ownerId                Int?
  aiEnabled              Boolean                @default(true)
  createdAt              DateTime               @default(now()) @db.Timestamp(6)
  updatedAt              DateTime               @updatedAt @db.Timestamp(6)
  lastMessageAt          DateTime?              @db.Timestamp(6)
  queuedAt               DateTime?              @db.Timestamp(6)
  humanAssignedAt         DateTime?              @db.Timestamp(6)
  closedAt               DateTime?              @db.Timestamp(6)
  customer               Customer?              @relation(fields: [customerId], references: [id], onDelete: SetNull)
  owner                  Colaborador?           @relation(fields: [ownerId], references: [id], onDelete: SetNull)
  messages               ConversationMessage[]

  @@unique([channel, externalConversationId])
  @@index([customerId], map: "idx_conversation_customer")
  @@index([status], map: "idx_conversation_status")
  @@map("conversation")
}

model ConversationMessage {
  id             Int                    @id @default(autoincrement())
  conversationId Int
  senderType     ConversationSenderType
  senderId       Int?
  content        String
  metadata       Json?
  createdAt      DateTime               @default(now()) @db.Timestamp(6)
  conversation   Conversation           @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt], map: "idx_conversation_message_conversation_created")
  @@map("conversation_message")
}

model AiRule {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  category    String   @default("GERAL")
  content     String
  priority    Int      @default(5)
  status      String   @default("ATIVO")
  createdBy   Int?
  updatedBy   Int?
  createdAt   DateTime @default(now()) @db.Timestamp(6)
  updatedAt   DateTime @updatedAt @db.Timestamp(6)

  @@index([status], map: "idx_ai_rule_status")
  @@map("ai_rule")
}
```

Adições reciprocas nos modelos existentes:
- `Customer`: `conversations Conversation[]`
- `Colaborador`: `conversations Conversation[]` (via `ownerId`)

Notas de design:
- `Conversation.customerId` é **opcional** — muita conversa começa antes do CPF ser validado
  (o próprio prompt do agente hoje só pede CPF quando o cliente confirma que quer comprar/se
  inscrever). O vínculo é preenchido quando um customer é resolvido.
- `externalConversationId` guarda o telefone (só dígitos, com DDI) para WhatsApp; a unicidade
  é por `(channel, externalConversationId)`, não globalmente, para não colidir com outros
  canais no futuro.
- `ConversationMessage.senderId` é polimórfico e sem FK (por design — pode apontar para
  `Customer.id` quando `senderType: CUSTOMER` ou `Colaborador.id` quando `senderType: HUMAN`;
  fica `null` para `AI`/`SYSTEM`). Para o backfill deste sub-projeto, sempre fica `null` — o
  histórico do n8n não distingue qual colaborador respondeu, porque não existe transferência
  para humano nesse sistema ainda.
- `ConversationMessage.metadata` (JSON) preserva sem perda o formato original da mensagem
  (`tool_calls`, `name`, `tool_call_id`, etc.) sem precisar modelar cada campo como coluna —
  esse formato ainda vai evoluir nos próximos sub-projetos (integração OpenAI de verdade).
- `AiRule` é um modelo novo, canonicamente diferente de `regras_agentes` (que tem só `tipo`/
  `prioridade`/`texto_regra`/`ativo`/`criado_por`/`data_criacao`) — mapeamento:
  `tipo`→`category`, `texto_regra`→`content`, `ativo`→`status` (`true`→`"ATIVO"`,
  `false`→`"INATIVO"`), `prioridade`→`priority`, `criado_por`→`createdBy` (seria preciso
  resolver para um `Colaborador.id`; como a tabela está vazia, não há nada para mapear agora).
- **`n8n_chat_histories` e `regras_agentes` não são removidas nem renomeadas neste
  sub-projeto** — o n8n continua lendo/escrevendo nelas normalmente. Elas só deixam de ser a
  fonte de verdade quando um sub-projeto futuro trocar as tools do n8n para chamar o backend
  em vez de SQL direto.
- Nenhuma variável de ambiente nova é necessária — este sub-projeto não faz nenhuma chamada
  externa (nem OpenAI, nem Z-API, nem e-mail); é só schema + um script de leitura/escrita no
  próprio Postgres já configurado (`DATABASE_URL`/`DIRECT_URL`, já existentes).

## Migração/backfill do histórico

Script único em `prisma/backfill-conversation-history.ts` (mesmo padrão de `prisma/seed.ts`,
rodado manualmente uma vez via `npx tsx prisma/backfill-conversation-history.ts`, não uma
rota HTTP), com um flag `--dry-run` que faz todo o mapeamento e imprime um resumo (quantas
`Conversation`/`ConversationMessage` seriam criadas, quantos telefones casaram com um
`Customer`) sem escrever nada — para rodar contra o Postgres de produção (Neon) com segurança
antes de aplicar de verdade:

1. Agrupar `n8n_chat_histories` por `session_id`.
2. Ignorar (e logar) qualquer `session_id` que não siga o formato `whatsapp:<dígitos>` — hoje
   só existe esse formato, mas o script não deve quebrar se aparecer outro no meio.
3. Para cada `session_id` no formato `whatsapp:<telefone>`:
   - Normalizar o telefone (mesma lógica `normalizarTelefone` já usada nos workflows n8n:
     remove não-dígitos; se tiver ≤11 dígitos, prefixa `55`).
   - Tentar casar com `Customer.telefone` (que hoje é guardado **sem** o prefixo `55` — ver
     amostra real: `Customer.telefone = "48999084537"`, `session_id` gravado como
     `whatsapp:554899084537`). Resolver `customerId` se achar; deixar `null` se não achar.
   - Criar um `Conversation` (`channel: WHATSAPP`, `externalConversationId`: telefone com DDI,
     `status: CLOSED`, `lastMessageAt: null` — é histórico e não se sabe o horário real da
     última mensagem, então não faz sentido preencher com a hora do backfill).
   - Para cada linha de `n8n_chat_histories` daquele `session_id`, ordenada por `id`: criar um
     `ConversationMessage` com `senderType` mapeado de `message.type`
     (`human`→`CUSTOMER`, `ai`→`AI`, `tool`→`SYSTEM`), `content` = `message.content` (string;
     se vier vazio/ausente, usar `""`), `metadata` = o objeto `message` original completo.
4. **Limitação conhecida, documentada no código**: `n8n_chat_histories` não tem coluna de
   timestamp — só existe o `id` autoincremental. `ConversationMessage.createdAt` para os
   registros migrados não reflete o horário real de envio; a ordem relativa (via `id`
   crescente) é preservada, mas o timestamp absoluto é apenas o momento em que o backfill
   rodou. Isso é aceitável para este backfill (é uma migração de continuidade histórica, não
   uma fonte para cálculo de SLA retroativo).

## Fora de escopo

- Qualquer mudança no webhook, no agente (n8n) ou nas tools SQL atuais — o n8n continua
  operando exatamente como hoje.
- Endpoints novos, RBAC/permissões novas, prompts, base de conhecimento, sugestões de
  aprendizado, SLA, config global de IA, canais extras — cada um é um sub-projeto futuro
  próprio, com seu próprio spec.
- Remover, renomear ou parar de popular `n8n_chat_histories`/`regras_agentes`.
- Qualquer integração com OpenAI, Z-API de saída, ou envio de mensagem.

## Testes

- Migration do Prisma aplica limpo (`prisma migrate dev`) e `prisma validate` passa.
- Lógica de agrupamento/normalização/mapeamento do backfill (agrupar por `session_id`,
  normalizar telefone, mapear `message.type`→`senderType`) é extraída em funções puras
  testáveis sem banco, seguindo o padrão já usado no resto do projeto (funções exportadas e
  testadas por `node:test`, ver `src/modules/webhooks/webhooks.service.test.ts` como
  referência) — cobrindo: telefone com/sem prefixo `55`, `session_id` fora do formato
  esperado (ignorado, não derruba o script), e os três valores de `message.type`.
- `--dry-run` rodado contra os dados reais de teste: confirma que a contagem de
  `ConversationMessage` que seriam criadas bate com a contagem de linhas de
  `n8n_chat_histories` processadas, e que o telefone de teste conhecido
  (`554899084537` → customer com `telefone = "48999084537"`) resolve para o `customerId`
  certo.
- Rodar o script sem `--dry-run` duas vezes seguidas não duplica dados (idempotência —
  antes de criar, checar se já existe `Conversation` com aquele
  `(channel: WHATSAPP, externalConversationId)`; se existir, pular aquele `session_id`
  inteiro em vez de recriar).
