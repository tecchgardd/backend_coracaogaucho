import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Coração Gaúcho Admin API",
      version: "1.0.0"
    },
    servers: [{ url: "/api" }],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "cg-admin.session_token"
        },
        integrationSecret: {
          type: "apiKey",
          in: "header",
          name: "x-integration-secret"
        }
      }
    },
    security: [{ cookieAuth: [] }]
    ,
    paths: {
      "/health": {
        get: { tags: ["Infraestrutura"], security: [], summary: "Verifica a API sem expor credenciais", responses: { "200": { description: "API operacional e indicador booleano da configuracao Stripe" } } }
      },
      "/auth/{path}": {
        post: {
          tags: ["Auth"],
          summary: "Rotas Better Auth",
          parameters: [{ name: "path", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Resposta do Better Auth" } }
        }
      },
      "/public/events": {
        get: { tags: ["Publico"], security: [], summary: "Lista eventos, bailes e cursos publicos", responses: { "200": { description: "Catalogo publico" } } }
      },
      "/public/albums": {
        get: { tags: ["Publico"], security: [], summary: "Lista albuns publicados", responses: { "200": { description: "Lista paginada de albuns" } } }
      },
      "/public/albums/{slug}/photos": {
        get: { tags: ["Publico"], security: [], summary: "Lista fotos paginadas do Cloudinary", parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }, { name: "cursor", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Fotos, thumbnails e nextCursor" } } }
      },
      "/me/profile": {
        get: { tags: ["Cliente"], summary: "Perfil do cliente autenticado", responses: { "200": { description: "Perfil" }, "401": { description: "Nao autenticado" } } },
        patch: { tags: ["Cliente"], summary: "Atualiza o proprio perfil", responses: { "200": { description: "Perfil atualizado" }, "401": { description: "Nao autenticado" } } }
      },
      "/me/checkout/validate": {
        post: { tags: ["Checkout"], summary: "Revalida itens, estoque e valores", responses: { "200": { description: "Carrinho revalidado" }, "401": { description: "Nao autenticado" } } }
      },
      "/me/checkout": {
        post: { tags: ["Checkout"], summary: "Cria pedido e cobranca com valores do servidor", responses: { "201": { description: "Pedido criado" }, "401": { description: "Nao autenticado" } } }
      },
      "/me/orders": {
        get: { tags: ["Cliente"], summary: "Pedidos da sessao atual", responses: { "200": { description: "Historico de pedidos" }, "401": { description: "Nao autenticado" } } }
      },
      "/me/tickets": {
        get: { tags: ["Cliente"], summary: "Ingressos validos da sessao atual", responses: { "200": { description: "Ingressos" }, "401": { description: "Nao autenticado" } } }
      },
      "/me/enrollments": {
        get: { tags: ["Cliente"], summary: "Inscricoes da sessao atual", responses: { "200": { description: "Inscricoes" }, "401": { description: "Nao autenticado" } } }
      },
      "/admin/dashboard": {
        get: {
          tags: ["Dashboard"],
          summary: "Métricas rápidas do admin",
          responses: { "200": { description: "Resumo do painel" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/ingressos": {
        get: {
          tags: ["Ingressos"],
          summary: "Lista ingressos de alunos",
          responses: { "200": { description: "Lista de ingressos" }, "401": { description: "Nao autenticado" } }
        }
      },
      "/admin/ingressos/lotes": {
        get: {
          tags: ["Ingressos"],
          summary: "Lista lotes de ingressos",
          responses: { "200": { description: "Lista de lotes" }, "401": { description: "Nao autenticado" } }
        },
        post: {
          tags: ["Ingressos"],
          summary: "Gera lote de ingressos por CPF",
          responses: { "201": { description: "Lote gerado" }, "401": { description: "Nao autenticado" } }
        }
      },
      "/admin/ingressos/lotes/{id}": {
        get: {
          tags: ["Ingressos"],
          summary: "Busca lote de ingressos",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Lote encontrado" }, "404": { description: "Lote nao encontrado" } }
        },
        patch: {
          tags: ["Ingressos"],
          summary: "Atualiza lote de ingressos",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Lote atualizado" }, "404": { description: "Lote nao encontrado" } }
        }
      },
      "/admin/ingressos/lotes/{id}/pagamento": {
        post: {
          tags: ["Ingressos"],
          summary: "Registra pagamento do lote",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Pagamento registrado" }, "404": { description: "Lote nao encontrado" } }
        }
      },
      "/admin/ingressos/lotes/{id}/comprovante": {
        post: {
          tags: ["Ingressos"],
          summary: "Anexa comprovante de pagamento ao lote",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "201": { description: "Comprovante anexado" }, "404": { description: "Lote nao encontrado" } }
        }
      },
      "/admin/ingressos/{id}": {
        get: {
          tags: ["Ingressos"],
          summary: "Busca ingresso",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Ingresso encontrado" }, "404": { description: "Ingresso nao encontrado" } }
        },
        patch: {
          tags: ["Ingressos"],
          summary: "Atualiza ingresso",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Ingresso atualizado" }, "404": { description: "Ingresso nao encontrado" } }
        }
      },
      "/admin/pessoas/by-cpf/{cpf}": {
        get: {
          tags: ["Pessoas"],
          summary: "Busca pessoa por CPF normalizado",
          parameters: [{ name: "cpf", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Pessoa encontrada" },
            "404": { description: "Pessoa não encontrada pelo CPF informado." }
          }
        }
      },
      "/admin/vendas": {
        get: {
          tags: ["Vendas"],
          summary: "Lista vendas de eventos, bailes e cursos",
          parameters: [
            { name: "search", in: "query", required: false, schema: { type: "string" } },
            { name: "tipo", in: "query", required: false, schema: { type: "string", enum: ["EVENTO", "BAILE", "CURSO"] } },
            { name: "status", in: "query", required: false, schema: { type: "string" } },
            { name: "provider", in: "query", required: false, schema: { type: "string", enum: ["STRIPE", "EXTERNO", "CORTESIA"] } },
            { name: "formaPagamento", in: "query", required: false, schema: { type: "string" } },
            { name: "origem", in: "query", required: false, schema: { type: "string", enum: ["SITE", "WHATSAPP", "PAINEL_ADMIN"] } },
            { name: "eventoId", in: "query", required: false, schema: { type: "integer" } },
            { name: "cursoId", in: "query", required: false, schema: { type: "integer" } },
            { name: "dataInicial", in: "query", required: false, schema: { type: "string", format: "date-time" } },
            { name: "dataFinal", in: "query", required: false, schema: { type: "string", format: "date-time" } }
          ],
          responses: { "200": { description: "Lista de vendas" }, "401": { description: "Não autenticado" } }
        },
        post: {
          tags: ["Vendas"],
          summary: "Cria venda por CPF para evento, baile ou curso",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["cpf", "tipo", "quantidade", "valorUnitario"],
                  properties: {
                    cpf: { type: "string", example: "12072799116" },
                    tipo: { type: "string", enum: ["EVENTO", "BAILE", "CURSO"] },
                    eventoId: { type: "integer" },
                    cursoId: { type: "integer" },
                    inscricaoId: { type: "integer" },
                    quantidade: { type: "integer", example: 1 },
                    valorUnitario: { type: "number", example: 50 },
                    desconto: { type: "number", example: 0 },
                    formaPagamento: { type: "string", enum: ["PIX", "DINHEIRO", "CARTAO", "CORTESIA"] },
                    observacao: { type: "string" }
                  }
                }
              }
            }
          },
          responses: { "201": { description: "Venda criada" }, "404": { description: "Pessoa não encontrada pelo CPF informado." } }
        }
      },
      "/admin/vendas/{id}": {
        get: {
          tags: ["Vendas"],
          summary: "Busca venda",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Venda encontrada" }, "404": { description: "Venda não encontrada" } }
        },
        patch: {
          tags: ["Vendas"],
          summary: "Atualiza venda",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Venda atualizada" }, "404": { description: "Venda não encontrada" } }
        },
        delete: {
          tags: ["Vendas"],
          summary: "Cancela venda sem apagar o histórico financeiro",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Venda removida" }, "404": { description: "Venda não encontrada" } }
        }
      },
      "/admin/pagamentos": {
        get: {
          tags: ["Pagamentos"],
          summary: "Lista pagamentos Stripe, externos e cortesias com a venda relacionada",
          parameters: [
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "provider", in: "query", schema: { type: "string", enum: ["STRIPE", "EXTERNO", "CORTESIA"] } },
            { name: "forma", in: "query", schema: { type: "string" } },
            { name: "eventoId", in: "query", schema: { type: "integer" } },
            { name: "cursoId", in: "query", schema: { type: "integer" } }
          ],
          responses: { "200": { description: "Lista paginada de pagamentos" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/pagamentos/{id}": {
        get: {
          tags: ["Pagamentos"],
          summary: "Detalha pagamento e venda relacionada",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Pagamento encontrado" }, "404": { description: "Pagamento não encontrado" } }
        }
      },
      "/admin/pagamentos/{id}/substituir-por-externo": {
        post: {
          tags: ["Pagamentos"],
          summary: "Cancela ou expira a cobrança Stripe e cria pagamento externo sem apagar o original (somente ADMIN)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["method", "reason"], properties: { method: { type: "string", enum: ["PIX_EXTERNO", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO"] }, amount: { type: "integer", description: "Centavos" }, paidAt: { type: "string", format: "date-time" }, reference: { type: "string" }, observation: { type: "string" }, reason: { type: "string" } } } } } },
          responses: { "201": { description: "Pagamento externo criado e relacionado" }, "403": { description: "Somente ADMIN" }, "409": { description: "Cobrança já paga ou não cancelável" } }
        }
      },
      "/admin/scanner/validar": {
        post: {
          tags: ["Scanner"],
          summary: "Valida ingresso por QR Code",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["codigo"],
                  properties: { codigo: { type: "string", example: "CG250523ABC123" } }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Resultado da validação",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: {
                        type: "string",
                        enum: ["VALIDO", "JA_UTILIZADO", "CANCELADO", "NAO_ENCONTRADO", "EVENTO_EXPIRADO"]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/admin/scanner/digitar-codigo": {
        post: {
          tags: ["Scanner"],
          summary: "Valida ingresso por código digitado",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: { codigo: { type: "string" } } } } }
          },
          responses: { "200": { description: "Resultado da validação" } }
        }
      },
      "/admin/scanner/historico": {
        get: {
          tags: ["Scanner"],
          summary: "Histórico de validações",
          responses: { "200": { description: "Ingressos validados" } }
        }
      },
      "/payments/checkout": {
        post: {
          tags: ["Pagamentos"],
          summary: "Cria uma Stripe Checkout Session com valores recalculados no banco",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", properties: { orderId: { type: "integer" }, eventId: { type: "integer" }, quantity: { type: "integer", minimum: 1, maximum: 10 }, items: { type: "array", items: { type: "object", required: ["eventId", "quantity"], properties: { eventId: { type: "integer" }, quantity: { type: "integer", minimum: 1, maximum: 10 } } } }, origin: { type: "string", enum: ["SITE"], default: "SITE" } } } } }
          },
          responses: { "201": { description: "Checkout criado" }, "401": { description: "Cliente não autenticado" }, "409": { description: "Evento, capacidade ou pedido indisponível" }, "429": { description: "Limite de tentativas excedido" } }
        }
      },
      "/payments/{orderId}/retry": {
        post: { tags: ["Pagamentos"], summary: "Revalida o pedido e cria uma nova tentativa Stripe", parameters: [{ name: "orderId", in: "path", required: true, schema: { type: "integer" } }], responses: { "201": { description: "Nova Checkout Session criada" }, "404": { description: "Pedido inexistente ou de outro cliente" }, "409": { description: "Pedido já pago ou reserva indisponível" } } }
      },
      "/payments/{orderId}/status": {
        get: { tags: ["Pagamentos"], summary: "Consulta somente o status interno do pedido", parameters: [{ name: "orderId", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Status interno" }, "404": { description: "Pedido inexistente ou de outro cliente" } } }
      },
      "/admin/pagamentos/{id}/cancelar": {
        patch: { tags: ["Pagamentos"], summary: "Cancela apenas pagamento ainda não confirmado", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { reason: { type: "string" } } } } } }, responses: { "200": { description: "Pagamento cancelado" }, "409": { description: "Pagamento confirmado deve ser reembolsado" } } }
      },
      "/admin/pagamentos/{id}/reembolsar": {
        post: { tags: ["Pagamentos"], summary: "Solicita reembolso Stripe total ou parcial (somente ADMIN)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["reason"], properties: { amount: { type: "integer", description: "Valor em centavos; omita para reembolso total restante" }, reason: { type: "string" }, stripeReason: { type: "string", enum: ["duplicate", "fraudulent", "requested_by_customer"] } } } } } }, responses: { "201": { description: "Reembolso solicitado" }, "403": { description: "Somente ADMIN" }, "409": { description: "Pagamento não reembolsável" }, "422": { description: "Valor inválido" } } }
      },
      "/integrations/whatsapp/checkout": {
        post: {
          tags: ["Integrações"], security: [{ integrationSecret: [] }], summary: "Cria checkout do WhatsApp/n8n com preço calculado no banco",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["eventId", "quantity", "customer"], properties: { eventId: { type: "integer" }, quantity: { type: "integer", minimum: 1, maximum: 10 }, origin: { type: "string", enum: ["WHATSAPP"] }, customer: { type: "object", required: ["name", "email", "cpf", "phone"], properties: { name: { type: "string" }, email: { type: "string", format: "email" }, cpf: { type: "string", example: "00000000000" }, phone: { type: "string", example: "48999999999" } } } } } } } },
          responses: { "201": { description: "Checkout criado" }, "401": { description: "Segredo ausente ou inválido" }, "409": { description: "Evento ou capacidade indisponível" } }
        }
      },
      "/integrations/payment-status": {
        get: {
          tags: ["Integrações"], security: [{ integrationSecret: [] }], summary: "Consulta o pagamento mais relevante de um customer para um evento (n8n/WhatsApp)",
          parameters: [
            { name: "customerId", in: "query", required: false, schema: { type: "integer" }, description: "Obrigatório se cpf não for informado" },
            { name: "cpf", in: "query", required: false, schema: { type: "string", example: "00000000000" }, description: "Obrigatório se customerId não for informado" },
            { name: "eventId", in: "query", required: true, schema: { type: "integer" } }
          ],
          responses: {
            "200": { description: "Pagamento mais relevante (PAGO > PENDENTE/PROCESSANDO vigente > mais recente), com status da inscrição vinculada" },
            "401": { description: "Segredo ausente ou inválido" },
            "404": { description: "Nenhum pagamento encontrado para o customer+evento" },
            "422": { description: "customerId ou cpf ausente" }
          }
        }
      },
      "/integrations/payments/{paymentId}/tickets-image": {
        get: {
          tags: ["Integrações"],
          security: [{ integrationSecret: [] }],
          summary: "Gera a imagem (JPEG) de cada ingresso vinculado a um pagamento confirmado (n8n/WhatsApp)",
          parameters: [
            { name: "paymentId", in: "path", required: true, schema: { type: "integer" } }
          ],
          responses: {
            "200": { description: "Lista de imagens geradas, uma por ingresso" },
            "401": { description: "Integracao nao autorizada" },
            "404": { description: "Pagamento, venda ou ingressos nao encontrados" }
          }
        }
      },
      "/stripe/webhook": {
        post: { tags: ["Webhooks"], security: [], summary: "Chamado somente pela Stripe; usa corpo bruto e stripe-signature, nunca pelo frontend", parameters: [{ name: "stripe-signature", in: "header", required: true, schema: { type: "string" } }], responses: { "200": { description: "Evento processado, ignorado ou duplicado" }, "400": { description: "Assinatura ausente ou inválida" } } }
      },
      "/admin/agent/config": {
        get: {
          tags: ["Agente IA - Configuração"],
          security: [{ cookieAuth: [] }],
          summary: "Busca a configuração global do Agent IA (cria a linha padrão se ainda não existir)",
          responses: { "200": { description: "Configuração atual" }, "401": { description: "Não autenticado" } }
        },
        patch: {
          tags: ["Agente IA - Configuração"],
          security: [{ cookieAuth: [] }],
          summary: "Atualiza campos da configuração global do Agent IA",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    aiEnabled: { type: "boolean" },
                    firstResponseMode: { type: "string", enum: ["INSTANT", "DELAYED"] },
                    firstResponseDelaySeconds: { type: "integer", minimum: 0 },
                    humanQueueSlaSeconds: { type: "integer", minimum: 1 }
                  }
                }
              }
            }
          },
          responses: { "200": { description: "Configuração atualizada" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/agent/status": {
        patch: {
          tags: ["Agente IA - Configuração"],
          security: [{ cookieAuth: [] }],
          summary: "Liga ou desliga o Agent IA globalmente (somente ADMIN)",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["enabled"], properties: { enabled: { type: "boolean" } } } } }
          },
          responses: { "200": { description: "Configuração atualizada" }, "401": { description: "Não autenticado" }, "403": { description: "Somente ADMIN" } }
        }
      },
      "/admin/agent/channels": {
        get: {
          tags: ["Agente IA - Configuração"],
          security: [{ cookieAuth: [] }],
          summary: "Lista o estado do Agent IA para os 5 canais suportados",
          responses: { "200": { description: "Lista com as 5 configurações de canal" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/agent/channels/{channel}": {
        patch: {
          tags: ["Agente IA - Configuração"],
          security: [{ cookieAuth: [] }],
          summary: "Ativa ou desativa o Agent IA para um canal específico",
          parameters: [{ name: "channel", in: "path", required: true, schema: { type: "string", enum: ["WHATSAPP", "EMAIL", "INSTAGRAM", "FACEBOOK", "WEBSITE"] } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["enabled"], properties: { enabled: { type: "boolean" } } } } }
          },
          responses: { "200": { description: "Configuração de canal atualizada" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/agent/rules": {
        get: {
          tags: ["Agente IA - Regras"],
          security: [{ cookieAuth: [] }],
          summary: "Lista as regras do Agent IA",
          parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["ATIVO", "INATIVO"] } }],
          responses: { "200": { description: "Lista paginada de regras" }, "401": { description: "Não autenticado" } }
        },
        post: {
          tags: ["Agente IA - Regras"],
          security: [{ cookieAuth: [] }],
          summary: "Cria uma nova regra do Agent IA",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "content"],
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string", enum: ["GERAL", "VENDAS", "INSCRICAO", "ATENDIMENTO", "PAGAMENTO"] },
                    content: { type: "string" },
                    priority: { type: "integer" },
                    status: { type: "string", enum: ["ATIVO", "INATIVO"] }
                  }
                }
              }
            }
          },
          responses: { "201": { description: "Regra criada" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/agent/rules/{id}": {
        get: {
          tags: ["Agente IA - Regras"],
          security: [{ cookieAuth: [] }],
          summary: "Busca uma regra do Agent IA por id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Regra encontrada" }, "404": { description: "Regra não encontrada" } }
        },
        patch: {
          tags: ["Agente IA - Regras"],
          security: [{ cookieAuth: [] }],
          summary: "Atualiza campos de uma regra do Agent IA",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Regra atualizada" }, "404": { description: "Regra não encontrada" } }
        },
        delete: {
          tags: ["Agente IA - Regras"],
          security: [{ cookieAuth: [] }],
          summary: "Exclui uma regra do Agent IA (somente ADMIN)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Regra excluída" }, "403": { description: "Somente ADMIN" }, "404": { description: "Regra não encontrada" } }
        }
      },
      "/admin/agent/rules/{id}/status": {
        patch: {
          tags: ["Agente IA - Regras"],
          security: [{ cookieAuth: [] }],
          summary: "Ativa ou desativa uma regra do Agent IA",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ATIVO", "INATIVO"] } } } } }
          },
          responses: { "200": { description: "Status atualizado" }, "404": { description: "Regra não encontrada" } }
        }
      },
      "/admin/agent/prompts": {
        get: {
          tags: ["Agente IA - Prompts"],
          security: [{ cookieAuth: [] }],
          summary: "Lista os prompts do Agent IA",
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["ATIVO", "INATIVO"] } },
            { name: "scope", in: "query", schema: { type: "string", enum: ["GENERAL", "VENDAS", "INSCRICAO"] } }
          ],
          responses: { "200": { description: "Lista paginada de prompts" }, "401": { description: "Não autenticado" } }
        },
        post: {
          tags: ["Agente IA - Prompts"],
          security: [{ cookieAuth: [] }],
          summary: "Cria um novo prompt do Agent IA",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name", "content"],
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    content: { type: "string" },
                    tone: { type: "string" },
                    scope: { type: "string", enum: ["GENERAL", "VENDAS", "INSCRICAO"] },
                    status: { type: "string", enum: ["ATIVO", "INATIVO"] }
                  }
                }
              }
            }
          },
          responses: { "201": { description: "Prompt criado" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/agent/prompts/{id}": {
        get: {
          tags: ["Agente IA - Prompts"],
          security: [{ cookieAuth: [] }],
          summary: "Busca um prompt do Agent IA por id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Prompt encontrado" }, "404": { description: "Prompt não encontrado" } }
        },
        patch: {
          tags: ["Agente IA - Prompts"],
          security: [{ cookieAuth: [] }],
          summary: "Atualiza campos de um prompt (incrementa version automaticamente)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Prompt atualizado" }, "404": { description: "Prompt não encontrado" } }
        },
        delete: {
          tags: ["Agente IA - Prompts"],
          security: [{ cookieAuth: [] }],
          summary: "Exclui um prompt do Agent IA (somente ADMIN)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Prompt excluído" }, "403": { description: "Somente ADMIN" }, "404": { description: "Prompt não encontrado" } }
        }
      },
      "/admin/agent/prompts/{id}/status": {
        patch: {
          tags: ["Agente IA - Prompts"],
          security: [{ cookieAuth: [] }],
          summary: "Ativa ou desativa um prompt do Agent IA",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ATIVO", "INATIVO"] } } } } }
          },
          responses: { "200": { description: "Status atualizado" }, "404": { description: "Prompt não encontrado" } }
        }
      },
      "/admin/agent/knowledge": {
        get: {
          tags: ["Agente IA - Conhecimento"],
          security: [{ cookieAuth: [] }],
          summary: "Lista os itens de conhecimento do Agent IA",
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["ATIVO", "INATIVO"] } },
            { name: "type", in: "query", schema: { type: "string", enum: ["FAQ", "POLICY", "EVENT", "COURSE", "PAYMENT", "TICKET", "OTHER"] } }
          ],
          responses: { "200": { description: "Lista paginada de conhecimento" }, "401": { description: "Não autenticado" } }
        },
        post: {
          tags: ["Agente IA - Conhecimento"],
          security: [{ cookieAuth: [] }],
          summary: "Cria um novo item de conhecimento do Agent IA",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "content", "type"],
                  properties: {
                    title: { type: "string" },
                    content: { type: "string" },
                    type: { type: "string", enum: ["FAQ", "POLICY", "EVENT", "COURSE", "PAYMENT", "TICKET", "OTHER"] },
                    source: { type: "string" },
                    status: { type: "string", enum: ["ATIVO", "INATIVO"] }
                  }
                }
              }
            }
          },
          responses: { "201": { description: "Conhecimento criado" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/agent/knowledge/{id}": {
        get: {
          tags: ["Agente IA - Conhecimento"],
          security: [{ cookieAuth: [] }],
          summary: "Busca um item de conhecimento do Agent IA por id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Conhecimento encontrado" }, "404": { description: "Conhecimento não encontrado" } }
        },
        patch: {
          tags: ["Agente IA - Conhecimento"],
          security: [{ cookieAuth: [] }],
          summary: "Atualiza campos de um item de conhecimento",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Conhecimento atualizado" }, "404": { description: "Conhecimento não encontrado" } }
        },
        delete: {
          tags: ["Agente IA - Conhecimento"],
          security: [{ cookieAuth: [] }],
          summary: "Exclui um item de conhecimento (somente ADMIN)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Conhecimento excluído" }, "403": { description: "Somente ADMIN" }, "404": { description: "Conhecimento não encontrado" } }
        }
      },
      "/admin/agent/knowledge/{id}/status": {
        patch: {
          tags: ["Agente IA - Conhecimento"],
          security: [{ cookieAuth: [] }],
          summary: "Ativa ou desativa um item de conhecimento",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ATIVO", "INATIVO"] } } } } }
          },
          responses: { "200": { description: "Status atualizado" }, "404": { description: "Conhecimento não encontrado" } }
        }
      },
      "/admin/agent/learning": {
        get: {
          tags: ["Agente IA - Aprendizados"],
          security: [{ cookieAuth: [] }],
          summary: "Lista as sugestões de aprendizado do Agent IA",
          parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["PENDENTE", "APROVADO", "REJEITADO"] } }],
          responses: { "200": { description: "Lista paginada de sugestões" }, "401": { description: "Não autenticado" } }
        }
      },
      "/admin/agent/learning/{id}": {
        get: {
          tags: ["Agente IA - Aprendizados"],
          security: [{ cookieAuth: [] }],
          summary: "Busca uma sugestão de aprendizado por id",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Sugestão encontrada" }, "404": { description: "Sugestão não encontrada" } }
        }
      },
      "/admin/agent/learning/{id}/approve": {
        patch: {
          tags: ["Agente IA - Aprendizados"],
          security: [{ cookieAuth: [] }],
          summary: "Aprova uma sugestão de aprendizado (não cria conhecimento/regra automaticamente)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Sugestão aprovada" }, "404": { description: "Sugestão não encontrada" } }
        }
      },
      "/admin/agent/learning/{id}/reject": {
        patch: {
          tags: ["Agente IA - Aprendizados"],
          security: [{ cookieAuth: [] }],
          summary: "Rejeita uma sugestão de aprendizado",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Sugestão rejeitada" }, "404": { description: "Sugestão não encontrada" } }
        }
      },
      "/uploads/image": {
        post: {
          tags: ["Uploads"],
          summary: "Upload de imagem para Cloudinary",
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: { image: { type: "string", format: "binary" } }
                }
              }
            }
      },
      "/public/empresas": { get: { tags: ["Publico"], security: [], summary: "Lista empresas apoiadoras publicadas", responses: { "200": { description: "Empresas ativas ordenadas" } } } },
      "/admin/empresas": {
        get: { tags: ["Empresas"], summary: "Lista empresas", responses: { "200": { description: "Lista paginada" } } },
        post: { tags: ["Empresas"], summary: "Cadastra empresa e envia imagem ao Cloudinary", requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["nome", "imagem"], properties: { nome: { type: "string" }, imagem: { type: "string", format: "binary" }, ativo: { type: "boolean" }, publicado: { type: "boolean" }, ordem: { type: "integer" } } } } } }, responses: { "201": { description: "Empresa criada" } } }
      },
      "/admin/empresas/{id}": {
        get: { tags: ["Empresas"], summary: "Busca empresa", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Empresa" } } },
        patch: { tags: ["Empresas"], summary: "Atualiza empresa e opcionalmente substitui imagem", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { nome: { type: "string" }, imagem: { type: "string", format: "binary" }, ativo: { type: "boolean" }, publicado: { type: "boolean" }, ordem: { type: "integer" } } } } } }, responses: { "200": { description: "Empresa atualizada" } } },
        delete: { tags: ["Empresas"], summary: "Exclui empresa e imagem do Cloudinary", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Empresa excluida" } } }
      },
          responses: { "201": { description: "Imagem enviada" } }
        }
      }
    }
  },
  apis: ["./src/routes/*.ts", "./src/modules/**/*.ts"]
});
