# Coração Gaúcho Admin Backend

Backend em Node.js, TypeScript, Express, Prisma, PostgreSQL e Better Auth para o painel administrativo do Coração Gaúcho.

## Requisitos

- Node.js 20+
- PostgreSQL
- NPM

## Configuração

```bash
cd backend
npm install
cp .env.example .env
```

Edite o `.env` com a `DATABASE_URL`, chaves Better Auth, AbacatePay e Cloudinary.

## Comandos

```bash
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
npm run build
npm run start
```

Se você não usar Docker, suba um PostgreSQL local ou remoto e ajuste `DATABASE_URL` no `.env`.

## Rotas principais

- Auth: `/api/auth/*`
- Admin: `/api/admin/*`
- Webhooks: `/api/webhooks/abacatepay`
- Uploads: `/api/uploads/image`
- Swagger: `/docs`

## Permissões

- `ADMIN`: acesso total
- `STAFF`: eventos, cursos/pedidos/clientes/inscrições, pagamentos, cortesias e relatórios
- `CHECKIN`: scanner QR Code e histórico de validações

O seed cria o usuário inicial usando `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

## Deploy na Vercel

Configure a pasta `backend` como **Root Directory** do projeto na Vercel. A entrada
serverless fica em `api/index.ts`; `src/server.ts` continua sendo usada apenas para
execução local. Cadastre na Vercel as variáveis de `.env.example`, usando URLs e
segredos de produção. Execute as migrações com `npm run prisma:migrate` antes de
publicar uma versão que contenha novas migrações.
