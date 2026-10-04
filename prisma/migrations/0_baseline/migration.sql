-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ConversationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'INSTAGRAM', 'FACEBOOK', 'WEBSITE');

-- CreateEnum
CREATE TYPE "public"."ConversationOwnerType" AS ENUM ('AI', 'HUMAN', 'NONE');

-- CreateEnum
CREATE TYPE "public"."ConversationSenderType" AS ENUM ('CUSTOMER', 'AI', 'HUMAN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "public"."ConversationStatus" AS ENUM ('OPEN', 'AI', 'QUEUE', 'HUMAN', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."EventoStatus" AS ENUM ('ATIVO', 'INATIVO', 'CANCELADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "public"."FirstResponseMode" AS ENUM ('INSTANT', 'DELAYED');

-- CreateEnum
CREATE TYPE "public"."IngressoAlunoStatus" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO', 'EXPIRADO', 'CORTESIA', 'UTILIZADO');

-- CreateEnum
CREATE TYPE "public"."IngressoAlunoTipo" AS ENUM ('NORMAL', 'CORTESIA');

-- CreateEnum
CREATE TYPE "public"."InscricaoStatus" AS ENUM ('PENDENTE', 'CONFIRMADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "public"."LoteIngressoStatus" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "public"."PadrinhosStatus" AS ENUM ('PENDENTE', 'COMPLETO');

-- CreateEnum
CREATE TYPE "public"."PagamentoLoteStatus" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "public"."PagamentoStatus" AS ENUM ('PENDENTE', 'PAGO', 'FALHOU', 'ESTORNADO', 'PROCESSANDO', 'CANCELADO', 'EXPIRADO', 'PARCIALMENTE_ESTORNADO', 'CONTESTADO', 'CONTESTACAO_PERDIDA');

-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('STRIPE', 'EXTERNO', 'CORTESIA');

-- CreateEnum
CREATE TYPE "public"."PedidoType" AS ENUM ('STORE', 'EVENT');

-- CreateEnum
CREATE TYPE "public"."SaleOrigin" AS ENUM ('SITE', 'WHATSAPP', 'PAINEL_ADMIN');

-- CreateEnum
CREATE TYPE "public"."TipoEvento" AS ENUM ('BAILE', 'CURSO', 'EVENTO');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'STAFF', 'CHECKIN', 'CUSTOMER');

-- CreateTable
CREATE TABLE "public"."account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(6),
    "refreshTokenExpiresAt" TIMESTAMP(6),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_channel_config" (
    "id" SERIAL NOT NULL,
    "channel" "public"."ConversationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "agent_channel_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_config" (
    "id" SERIAL NOT NULL,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "firstResponseMode" "public"."FirstResponseMode" NOT NULL DEFAULT 'INSTANT',
    "firstResponseDelaySeconds" INTEGER NOT NULL DEFAULT 0,
    "humanQueueSlaSeconds" INTEGER NOT NULL DEFAULT 600,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "agent_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_knowledge" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "approvedById" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ai_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_learning_suggestion" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "suggestedType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ai_learning_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_prompt" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "tone" TEXT,
    "scope" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ai_prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_rule" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GERAL',
    "content" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ai_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."atendimento_staff_lock" (
    "telefone" TEXT NOT NULL,
    "bloqueado_ate" TIMESTAMPTZ(6) NOT NULL,
    "ultima_mensagem_staff" TEXT,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atendimento_staff_lock_pkey" PRIMARY KEY ("telefone")
);

-- CreateTable
CREATE TABLE "public"."audit_log" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "colaboradorId" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."colaborador" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'STAFF',
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "userId" TEXT NOT NULL,
    "customerId" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "cpf" TEXT NOT NULL,

    CONSTRAINT "colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."comprovante_pagamento" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "format" TEXT,
    "bytes" INTEGER,
    "uploadedById" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprovante_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversation" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "channel" "public"."ConversationChannel" NOT NULL,
    "externalConversationId" TEXT NOT NULL,
    "status" "public"."ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "ownerType" "public"."ConversationOwnerType" NOT NULL DEFAULT 'NONE',
    "ownerId" INTEGER,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "lastMessageAt" TIMESTAMP(6),
    "queuedAt" TIMESTAMP(6),
    "humanAssignedAt" TIMESTAMP(6),
    "closedAt" TIMESTAMP(6),
    "pendingAiReplyAt" TIMESTAMP(6),

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversation_message" (
    "id" SERIAL NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "senderType" "public"."ConversationSenderType" NOT NULL,
    "senderId" INTEGER,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cortesia" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "telefone" TEXT,
    "eventoid" INTEGER,
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cortesia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customer" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "endereco" TEXT,
    "cidade" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "cep" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "estado" TEXT,
    "dataNascimento" DATE,
    "sexo" TEXT,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "imagemUrl" TEXT NOT NULL,
    "imagemPublicId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."evento" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "public"."TipoEvento" NOT NULL,
    "local" TEXT NOT NULL,
    "cidade" TEXT,
    "data" TIMESTAMP(6) NOT NULL,
    "preco" DOUBLE PRECISION NOT NULL,
    "capacidade" INTEGER,
    "qrcode" TEXT NOT NULL,
    "status" "public"."EventoStatus" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "banner" TEXT,
    "observacao" TEXT,
    "atracao" TEXT,
    "dataLimiteInscricao" TIMESTAMP(6),
    "precoAntecipado" DOUBLE PRECISION,
    "dataLimiteAntecipado" TIMESTAMP(6),

    CONSTRAINT "evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."foto" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secureUrl" TEXT NOT NULL,
    "format" TEXT,
    "bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "folder" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "foto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."historico_pagamento" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "colaboradorId" INTEGER,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ingresso" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "eventoId" INTEGER NOT NULL,
    "preco" DOUBLE PRECISION NOT NULL,
    "qrcode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkoutId" TEXT,
    "paymentStatus" TEXT,
    "paidAt" TIMESTAMP(6),
    "validadoEm" TIMESTAMP(6),
    "validadoPorId" INTEGER,
    "orderId" INTEGER,

    CONSTRAINT "ingresso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ingresso_aluno" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER NOT NULL,
    "inscricaoId" INTEGER,
    "customerId" INTEGER NOT NULL,
    "eventoId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "qrcode" TEXT NOT NULL,
    "status" "public"."IngressoAlunoStatus" NOT NULL DEFAULT 'PENDENTE',
    "tipo" "public"."IngressoAlunoTipo" NOT NULL DEFAULT 'NORMAL',
    "valor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(6),
    "alunoNome" TEXT NOT NULL,
    "cursoNome" TEXT NOT NULL,
    "cidade" TEXT,
    "professor" TEXT,
    "courtesyReason" TEXT,
    "courtesyResponsible" TEXT,
    "courtesyDate" TIMESTAMP(6),
    "notes" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "utilizadoEm" TIMESTAMP(6),
    "validadoPorId" INTEGER,

    CONSTRAINT "ingresso_aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inscricao" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "eventoId" INTEGER NOT NULL,
    "nomePar" TEXT,
    "observacao" TEXT,
    "status" "public"."InscricaoStatus" NOT NULL DEFAULT 'CONFIRMADA',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "padrinho" TEXT,
    "madrinha" TEXT,
    "quantidadeParticipantes" INTEGER NOT NULL DEFAULT 1,
    "quantidadePadrinhosEsperada" INTEGER NOT NULL DEFAULT 2,
    "quantidadePadrinhosCadastrada" INTEGER NOT NULL DEFAULT 0,
    "padrinhosStatus" "public"."PadrinhosStatus" NOT NULL DEFAULT 'PENDENTE',
    "padrinhos" JSONB,
    "orderId" INTEGER,

    CONSTRAINT "inscricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."integration_outbox" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "integration_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lote_ingresso_aluno" (
    "id" SERIAL NOT NULL,
    "inscricaoId" INTEGER,
    "customerId" INTEGER NOT NULL,
    "eventoId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "public"."LoteIngressoStatus" NOT NULL DEFAULT 'PENDENTE',
    "paymentStatus" "public"."PagamentoLoteStatus" NOT NULL DEFAULT 'PENDENTE',
    "paymentUrl" TEXT,
    "boletoUrl" TEXT,
    "pixQrCode" TEXT,
    "gatewayId" TEXT,
    "dueDate" TIMESTAMP(6),
    "notificationStatus" TEXT NOT NULL DEFAULT 'PENDENTE',
    "createdById" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "pedidoId" INTEGER,
    "origemFinanceira" TEXT NOT NULL DEFAULT 'LEGADO_CURSO',
    "statusOperacional" TEXT NOT NULL DEFAULT 'ATIVO',

    CONSTRAINT "lote_ingresso_aluno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."n8n_chat_histories" (
    "id" SERIAL NOT NULL,
    "session_id" VARCHAR(255) NOT NULL,
    "message" JSONB NOT NULL,

    CONSTRAINT "n8n_chat_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pagamento" (
    "id" SERIAL NOT NULL,
    "inscricaoId" INTEGER,
    "customerId" INTEGER NOT NULL,
    "eventoId" INTEGER NOT NULL,
    "nomeCustomer" TEXT NOT NULL,
    "cpfCustomer" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "status" "public"."PagamentoStatus" NOT NULL DEFAULT 'PENDENTE',
    "gatewayId" TEXT,
    "checkoutUrl" TEXT,
    "rawWebhook" TEXT,
    "paidAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pedidoId" INTEGER,
    "provider" "public"."PaymentProvider",
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'brl',
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "stripeCustomerId" TEXT,
    "expiresAt" TIMESTAMP(6),
    "failureReason" TEXT,
    "rawProviderData" JSONB,
    "stripeChargeId" TEXT,
    "stripeDisputeId" TEXT,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "refundedAt" TIMESTAMP(6),
    "disputedAmount" INTEGER NOT NULL DEFAULT 0,
    "disputeStatus" TEXT,
    "statusBeforeDispute" "public"."PagamentoStatus",
    "method" TEXT,
    "externalReference" TEXT,
    "notes" TEXT,
    "replacedPaymentId" INTEGER,
    "tipo" TEXT,
    "modo" TEXT,
    "cpf" TEXT,
    "nome" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "quantidade" INTEGER DEFAULT 1,
    "valorUnitario" DECIMAL(12,2) DEFAULT 0,
    "valorTotal" DECIMAL(12,2) DEFAULT 0,
    "moeda" TEXT DEFAULT 'brl',
    "checkoutId" TEXT,
    "paymentIntentId" TEXT,
    "paymentUrl" TEXT,

    CONSTRAINT "pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment_refund" (
    "id" TEXT NOT NULL,
    "pagamentoId" INTEGER NOT NULL,
    "stripeRefundId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'brl',
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "reason" TEXT NOT NULL,
    "stripeReason" TEXT,
    "requestedById" INTEGER,
    "failureReason" TEXT,
    "rawProviderData" JSONB,
    "refundedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "payment_refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment_webhook_event" (
    "id" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processingAt" TIMESTAMP(6),
    "processedAt" TIMESTAMP(6),
    "payload" JSONB,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pedido" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."PedidoType" NOT NULL,
    "customerId" INTEGER NOT NULL,
    "eventId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "paymentStatus" TEXT DEFAULT 'PENDENTE',
    "paymentMethod" TEXT,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isCourtesy" BOOLEAN NOT NULL DEFAULT false,
    "courtesyReason" TEXT,
    "courtesyResponsible" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "userId" TEXT,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "origin" "public"."SaleOrigin",
    "expiresAt" TIMESTAMP(6),

    CONSTRAINT "pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pedido_item" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER,
    "ticketLotId" INTEGER,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "eventId" INTEGER,
    "unitAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pedido_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."regras_agentes" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'GERAL',
    "prioridade" INTEGER NOT NULL DEFAULT 5,
    "texto_regra" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_por" TEXT,
    "data_criacao" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regras_agentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."repescagem_atendimento" (
    "id" BIGSERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "nome" TEXT,
    "cpf" TEXT,
    "cidade" TEXT,
    "assunto" TEXT NOT NULL DEFAULT 'GERAL',
    "etapa" TEXT NOT NULL DEFAULT 'EM_ATENDIMENTO',
    "resumo" TEXT,
    "ultima_mensagem_cliente" TEXT,
    "ultima_interacao" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "convertido" BOOLEAN NOT NULL DEFAULT false,
    "followups_enviados" INTEGER NOT NULL DEFAULT 0,
    "ultimo_followup" TIMESTAMPTZ(6),
    "respondeu_apos_followup" BOOLEAN NOT NULL DEFAULT false,
    "evento_id" INTEGER,
    "origem" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repescagem_atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."repescagem_log" (
    "id" BIGSERIAL NOT NULL,
    "atendimento_id" BIGINT,
    "telefone" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "mensagem" TEXT,
    "motivo" TEXT,
    "nivel_interesse" TEXT,
    "dados" JSONB NOT NULL DEFAULT '{}',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repescagem_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(6) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sync_google_sheets_config" (
    "chave" TEXT NOT NULL,
    "spreadsheet_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_google_sheets_config_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "public"."user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'STAFF',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(6) NOT NULL,
    "createdAt" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6),

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "public"."account"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "agent_channel_config_channel_key" ON "public"."agent_channel_config"("channel" ASC);

-- CreateIndex
CREATE INDEX "ai_knowledge_status_idx" ON "public"."ai_knowledge"("status" ASC);

-- CreateIndex
CREATE INDEX "ai_knowledge_type_idx" ON "public"."ai_knowledge"("type" ASC);

-- CreateIndex
CREATE INDEX "ai_learning_suggestion_status_idx" ON "public"."ai_learning_suggestion"("status" ASC);

-- CreateIndex
CREATE INDEX "ai_prompt_scope_idx" ON "public"."ai_prompt"("scope" ASC);

-- CreateIndex
CREATE INDEX "ai_prompt_status_idx" ON "public"."ai_prompt"("status" ASC);

-- CreateIndex
CREATE INDEX "ai_rule_createdBy_idx" ON "public"."ai_rule"("createdBy" ASC);

-- CreateIndex
CREATE INDEX "ai_rule_updatedBy_idx" ON "public"."ai_rule"("updatedBy" ASC);

-- CreateIndex
CREATE INDEX "idx_ai_rule_status" ON "public"."ai_rule"("status" ASC);

-- CreateIndex
CREATE INDEX "audit_log_colaboradorId_idx" ON "public"."audit_log"("colaboradorId" ASC);

-- CreateIndex
CREATE INDEX "audit_log_entity_entityId_idx" ON "public"."audit_log"("entity" ASC, "entityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_cpf_key" ON "public"."colaborador"("cpf" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_customerId_key" ON "public"."colaborador"("customerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_email_key" ON "public"."colaborador"("email" ASC);

-- CreateIndex
CREATE INDEX "colaborador_role_idx" ON "public"."colaborador"("role" ASC);

-- CreateIndex
CREATE INDEX "colaborador_status_idx" ON "public"."colaborador"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_userId_key" ON "public"."colaborador"("userId" ASC);

-- CreateIndex
CREATE INDEX "idx_comprovante_pagamento_lote" ON "public"."comprovante_pagamento"("loteId" ASC);

-- CreateIndex
CREATE INDEX "idx_comprovante_pagamento_user" ON "public"."comprovante_pagamento"("uploadedById" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_channel_externalConversationId_key" ON "public"."conversation"("channel" ASC, "externalConversationId" ASC);

-- CreateIndex
CREATE INDEX "idx_conversation_channel" ON "public"."conversation"("channel" ASC);

-- CreateIndex
CREATE INDEX "idx_conversation_customer" ON "public"."conversation"("customerId" ASC);

-- CreateIndex
CREATE INDEX "idx_conversation_owner_type" ON "public"."conversation"("ownerType" ASC);

-- CreateIndex
CREATE INDEX "idx_conversation_pending_reply" ON "public"."conversation"("pendingAiReplyAt" ASC);

-- CreateIndex
CREATE INDEX "idx_conversation_status" ON "public"."conversation"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_conversation_message_conversation_created" ON "public"."conversation_message"("conversationId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_cpf_key" ON "public"."customer"("cpf" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "customer_userId_key" ON "public"."customer"("userId" ASC);

-- CreateIndex
CREATE INDEX "idx_customer_cpf" ON "public"."customer"("cpf" ASC);

-- CreateIndex
CREATE INDEX "idx_customer_telefone" ON "public"."customer"("telefone" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_imagemPublicId_key" ON "public"."empresa"("imagemPublicId" ASC);

-- CreateIndex
CREATE INDEX "idx_empresa_ativo" ON "public"."empresa"("ativo" ASC);

-- CreateIndex
CREATE INDEX "idx_empresa_ordem" ON "public"."empresa"("ordem" ASC);

-- CreateIndex
CREATE INDEX "idx_empresa_publicado" ON "public"."empresa"("publicado" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "evento_qrcode_key" ON "public"."evento"("qrcode" ASC);

-- CreateIndex
CREATE INDEX "idx_evento_cidade" ON "public"."evento"("cidade" ASC);

-- CreateIndex
CREATE INDEX "idx_evento_data" ON "public"."evento"("data" ASC);

-- CreateIndex
CREATE INDEX "idx_evento_status" ON "public"."evento"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_evento_tipo" ON "public"."evento"("tipo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "foto_publicId_key" ON "public"."foto"("publicId" ASC);

-- CreateIndex
CREATE INDEX "idx_foto_created_at" ON "public"."foto"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "idx_foto_folder" ON "public"."foto"("folder" ASC);

-- CreateIndex
CREATE INDEX "idx_foto_uploaded_by" ON "public"."foto"("uploadedById" ASC);

-- CreateIndex
CREATE INDEX "idx_historico_pagamento_colaborador" ON "public"."historico_pagamento"("colaboradorId" ASC);

-- CreateIndex
CREATE INDEX "idx_historico_pagamento_lote" ON "public"."historico_pagamento"("loteId" ASC);

-- CreateIndex
CREATE INDEX "idx_ingresso_customer" ON "public"."ingresso"("customerId" ASC);

-- CreateIndex
CREATE INDEX "idx_ingresso_evento" ON "public"."ingresso"("eventoId" ASC);

-- CreateIndex
CREATE INDEX "ingresso_customerId_eventoId_idx" ON "public"."ingresso"("customerId" ASC, "eventoId" ASC);

-- CreateIndex
CREATE INDEX "ingresso_orderId_idx" ON "public"."ingresso"("orderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ingresso_qrcode_key" ON "public"."ingresso"("qrcode" ASC);

-- CreateIndex
CREATE INDEX "ingresso_validadoPorId_idx" ON "public"."ingresso"("validadoPorId" ASC);

-- CreateIndex
CREATE INDEX "idx_ingresso_aluno_customer" ON "public"."ingresso_aluno"("customerId" ASC);

-- CreateIndex
CREATE INDEX "idx_ingresso_aluno_evento" ON "public"."ingresso_aluno"("eventoId" ASC);

-- CreateIndex
CREATE INDEX "idx_ingresso_aluno_inscricao" ON "public"."ingresso_aluno"("inscricaoId" ASC);

-- CreateIndex
CREATE INDEX "idx_ingresso_aluno_lote" ON "public"."ingresso_aluno"("loteId" ASC);

-- CreateIndex
CREATE INDEX "idx_ingresso_aluno_status" ON "public"."ingresso_aluno"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_ingresso_aluno_tipo" ON "public"."ingresso_aluno"("tipo" ASC);

-- CreateIndex
CREATE INDEX "idx_ingresso_aluno_validado_por" ON "public"."ingresso_aluno"("validadoPorId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ingresso_aluno_codigo_key" ON "public"."ingresso_aluno"("codigo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ingresso_aluno_qrcode_key" ON "public"."ingresso_aluno"("qrcode" ASC);

-- CreateIndex
CREATE INDEX "idx_inscricao_customer" ON "public"."inscricao"("customerId" ASC);

-- CreateIndex
CREATE INDEX "idx_inscricao_evento" ON "public"."inscricao"("eventoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "inscricao_customerId_eventoId_key" ON "public"."inscricao"("customerId" ASC, "eventoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "inscricao_customer_evento_unique" ON "public"."inscricao"("customerId" ASC, "eventoId" ASC);

-- CreateIndex
CREATE INDEX "inscricao_orderId_idx" ON "public"."inscricao"("orderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "integration_outbox_deduplicationKey_key" ON "public"."integration_outbox"("deduplicationKey" ASC);

-- CreateIndex
CREATE INDEX "integration_outbox_status_createdAt_idx" ON "public"."integration_outbox"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "idx_lote_ingresso_customer" ON "public"."lote_ingresso_aluno"("customerId" ASC);

-- CreateIndex
CREATE INDEX "idx_lote_ingresso_evento" ON "public"."lote_ingresso_aluno"("eventoId" ASC);

-- CreateIndex
CREATE INDEX "idx_lote_ingresso_origem_financeira" ON "public"."lote_ingresso_aluno"("origemFinanceira" ASC);

-- CreateIndex
CREATE INDEX "idx_lote_ingresso_payment_status" ON "public"."lote_ingresso_aluno"("paymentStatus" ASC);

-- CreateIndex
CREATE INDEX "idx_lote_ingresso_status" ON "public"."lote_ingresso_aluno"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_lote_ingresso_status_operacional" ON "public"."lote_ingresso_aluno"("statusOperacional" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "lote_ingresso_aluno_inscricaoId_key" ON "public"."lote_ingresso_aluno"("inscricaoId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "lote_ingresso_aluno_pedidoId_key" ON "public"."lote_ingresso_aluno"("pedidoId" ASC);

-- CreateIndex
CREATE INDEX "idx_pagamento_customer" ON "public"."pagamento"("customerId" ASC);

-- CreateIndex
CREATE INDEX "idx_pagamento_evento" ON "public"."pagamento"("eventoId" ASC);

-- CreateIndex
CREATE INDEX "idx_pagamento_gateway" ON "public"."pagamento"("gatewayId" ASC);

-- CreateIndex
CREATE INDEX "idx_pagamento_inscricao" ON "public"."pagamento"("inscricaoId" ASC);

-- CreateIndex
CREATE INDEX "idx_pagamento_method" ON "public"."pagamento"("method" ASC);

-- CreateIndex
CREATE INDEX "idx_pagamento_pedido" ON "public"."pagamento"("pedidoId" ASC);

-- CreateIndex
CREATE INDEX "idx_pagamento_provider_status" ON "public"."pagamento"("provider" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "idx_pagamento_status" ON "public"."pagamento"("status" ASC);

-- CreateIndex
CREATE INDEX "pagamento_checkout_idx" ON "public"."pagamento"("checkoutId" ASC);

-- CreateIndex
CREATE INDEX "pagamento_evento_cpf_idx" ON "public"."pagamento"("eventoId" ASC, "cpf" ASC);

-- CreateIndex
CREATE INDEX "pagamento_evento_customer_idx" ON "public"."pagamento"("eventoId" ASC, "customerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_gatewayId_key" ON "public"."pagamento"("gatewayId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_replacedPaymentId_key" ON "public"."pagamento"("replacedPaymentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_stripeChargeId_key" ON "public"."pagamento"("stripeChargeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_stripeCheckoutSessionId_key" ON "public"."pagamento"("stripeCheckoutSessionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_stripeDisputeId_key" ON "public"."pagamento"("stripeDisputeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_stripePaymentIntentId_key" ON "public"."pagamento"("stripePaymentIntentId" ASC);

-- CreateIndex
CREATE INDEX "payment_refund_pagamentoId_createdAt_idx" ON "public"."payment_refund"("pagamentoId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "payment_refund_status_idx" ON "public"."payment_refund"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_refund_stripeRefundId_key" ON "public"."payment_refund"("stripeRefundId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_event_externalId_key" ON "public"."payment_webhook_event"("externalId" ASC);

-- CreateIndex
CREATE INDEX "payment_webhook_event_processedAt_idx" ON "public"."payment_webhook_event"("processedAt" ASC);

-- CreateIndex
CREATE INDEX "payment_webhook_event_provider_type_idx" ON "public"."payment_webhook_event"("provider" ASC, "type" ASC);

-- CreateIndex
CREATE INDEX "idx_pedido_created_at" ON "public"."pedido"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "idx_pedido_customer" ON "public"."pedido"("customerId" ASC);

-- CreateIndex
CREATE INDEX "idx_pedido_event" ON "public"."pedido"("eventId" ASC);

-- CreateIndex
CREATE INDEX "idx_pedido_expires_at" ON "public"."pedido"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "idx_pedido_origin" ON "public"."pedido"("origin" ASC);

-- CreateIndex
CREATE INDEX "idx_pedido_payment_status" ON "public"."pedido"("paymentStatus" ASC);

-- CreateIndex
CREATE INDEX "idx_pedido_status" ON "public"."pedido"("status" ASC);

-- CreateIndex
CREATE INDEX "idx_pedido_type" ON "public"."pedido"("type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "pedido_code_key" ON "public"."pedido"("code" ASC);

-- CreateIndex
CREATE INDEX "pedido_userId_idx" ON "public"."pedido"("userId" ASC);

-- CreateIndex
CREATE INDEX "idx_pedido_item_order" ON "public"."pedido_item"("orderId" ASC);

-- CreateIndex
CREATE INDEX "idx_pedido_item_product" ON "public"."pedido_item"("productId" ASC);

-- CreateIndex
CREATE INDEX "idx_pedido_item_ticket_lot" ON "public"."pedido_item"("ticketLotId" ASC);

-- CreateIndex
CREATE INDEX "pedido_item_eventId_idx" ON "public"."pedido_item"("eventId" ASC);

-- CreateIndex
CREATE INDEX "idx_regras_ativo" ON "public"."regras_agentes"("ativo" ASC);

-- CreateIndex
CREATE INDEX "idx_regras_tipo" ON "public"."regras_agentes"("tipo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_regra" ON "public"."regras_agentes"("tipo" ASC, "texto_regra" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "repescagem_atendimento_session_id_key" ON "public"."repescagem_atendimento"("session_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "public"."session"("token" ASC);

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "public"."session"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "public"."user"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_config" ADD CONSTRAINT "agent_config_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_knowledge" ADD CONSTRAINT "ai_knowledge_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_learning_suggestion" ADD CONSTRAINT "ai_learning_suggestion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_prompt" ADD CONSTRAINT "ai_prompt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_prompt" ADD CONSTRAINT "ai_prompt_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_rule" ADD CONSTRAINT "ai_rule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_rule" ADD CONSTRAINT "ai_rule_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "public"."colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_log" ADD CONSTRAINT "audit_log_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "public"."colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."colaborador" ADD CONSTRAINT "colaborador_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customer"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."colaborador" ADD CONSTRAINT "colaborador_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."comprovante_pagamento" ADD CONSTRAINT "comprovante_pagamento_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "public"."lote_ingresso_aluno"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."conversation" ADD CONSTRAINT "conversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversation" ADD CONSTRAINT "conversation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversation_message" ADD CONSTRAINT "conversation_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cortesia" ADD CONSTRAINT "cortesia_eventoid_fkey" FOREIGN KEY ("eventoid") REFERENCES "public"."evento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."customer" ADD CONSTRAINT "customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."historico_pagamento" ADD CONSTRAINT "historico_pagamento_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "public"."lote_ingresso_aluno"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ingresso" ADD CONSTRAINT "ingresso_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ingresso" ADD CONSTRAINT "ingresso_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "public"."evento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ingresso" ADD CONSTRAINT "ingresso_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ingresso" ADD CONSTRAINT "ingresso_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "public"."colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ingresso_aluno" ADD CONSTRAINT "ingresso_aluno_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "public"."lote_ingresso_aluno"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."ingresso_aluno" ADD CONSTRAINT "ingresso_aluno_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "public"."colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inscricao" ADD CONSTRAINT "inscricao_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customer"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inscricao" ADD CONSTRAINT "inscricao_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "public"."evento"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."inscricao" ADD CONSTRAINT "inscricao_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lote_ingresso_aluno" ADD CONSTRAINT "lote_ingresso_aluno_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customer"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."lote_ingresso_aluno" ADD CONSTRAINT "lote_ingresso_aluno_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "public"."evento"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."lote_ingresso_aluno" ADD CONSTRAINT "lote_ingresso_aluno_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "public"."inscricao"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."lote_ingresso_aluno" ADD CONSTRAINT "lote_ingresso_aluno_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "public"."pedido"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pagamento" ADD CONSTRAINT "pagamento_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pagamento" ADD CONSTRAINT "pagamento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "public"."evento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pagamento" ADD CONSTRAINT "pagamento_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "public"."inscricao"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pagamento" ADD CONSTRAINT "pagamento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "public"."pedido"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pagamento" ADD CONSTRAINT "pagamento_replacedPaymentId_fkey" FOREIGN KEY ("replacedPaymentId") REFERENCES "public"."pagamento"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."payment_refund" ADD CONSTRAINT "payment_refund_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "public"."pagamento"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pedido" ADD CONSTRAINT "pedido_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pedido" ADD CONSTRAINT "pedido_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."evento"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pedido" ADD CONSTRAINT "pedido_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pedido_item" ADD CONSTRAINT "pedido_item_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."evento"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."pedido_item" ADD CONSTRAINT "pedido_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."pedido"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."repescagem_log" ADD CONSTRAINT "repescagem_log_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "public"."repescagem_atendimento"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
