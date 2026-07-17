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
            { name: "status", in: "query", required: false, schema: { type: "string", enum: ["PENDENTE", "PAGO", "CANCELADO", "CORTESIA"] } }
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
          summary: "Remove venda",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
          responses: { "200": { description: "Venda removida" }, "404": { description: "Venda não encontrada" } }
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
      "/stripe/webhook": {
        post: { tags: ["Webhooks"], security: [], summary: "Chamado somente pela Stripe; usa corpo bruto e stripe-signature, nunca pelo frontend", parameters: [{ name: "stripe-signature", in: "header", required: true, schema: { type: "string" } }], responses: { "200": { description: "Evento processado, ignorado ou duplicado" }, "400": { description: "Assinatura ausente ou inválida" } } }
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
