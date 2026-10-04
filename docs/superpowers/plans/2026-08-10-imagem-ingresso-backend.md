# Geração da imagem do ingresso no backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend endpoint that renders the "ingresso" (baile ticket) as a JPEG image directly in this repo, replacing the Gotenberg render that currently happens inside the n8n automation, and fixing the three root-cause bugs found during design (stale ticket-table join, missing banner fallback, one image per payment instead of per ticket).

**Architecture:** New `GET /integrations/payments/:paymentId/tickets-image` endpoint (same `x-integration-secret` auth already used by other n8n-facing endpoints). Given a `paymentId`, it loads the linked `Pedido` with both possible ticket sources (`Ingresso[]` legacy and `LoteIngressoAluno.tickets` `IngressoAluno[]`), resolves the correct list with a small pure function, builds one ticket HTML per resolved ticket with a pure template function, generates a QR code locally, and renders each HTML string to a JPEG buffer using headless Chromium running inside the serverless function itself (`puppeteer-core` + `@sparticuz/chromium` in production, full `puppeteer` locally).

**Tech Stack:** Node 24 / TypeScript / Express / Prisma (existing). New: `puppeteer-core`, `@sparticuz/chromium`, `qrcode` (runtime); `puppeteer` (dev-only, local Chromium for developer machines).

## Global Constraints

- Follow existing module conventions exactly: services return plain data or throw `AppError`, controllers stay thin (`res.json(...)`), routes use `validate({...})` + `asyncHandler(...)` (see `src/modules/ingressos/ingressos.routes.ts` and `src/utils/http.ts`).
- Auth for this endpoint: reuse `integrationSecretIsValid` from `src/modules/pagamentos/pagamentos.controller.ts` — do not duplicate the secret-comparison logic.
- No new test infrastructure: this repo's tests are plain `node:test` files run via `npm test` (`tsx --import ./src/test-env.ts --test src/**/*.test.ts`), testing pure/exported functions directly — no DB mocking framework, no HTTP test client exists today. Keep that pattern; do not introduce supertest or a DB-mocking library.
- All user-controlled strings interpolated into the ticket HTML (customer name, event name/location/city) MUST be HTML-escaped before interpolation.
- Money formatting uses `pt-BR`/`BRL` (`toLocaleString("pt-BR", { style: "currency", currency: "BRL" })`), matching the rest of the codebase's Portuguese-language responses.

---

### Task 1: Add dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `puppeteer-core`, `@sparticuz/chromium`, `qrcode` importable at runtime; `puppeteer`, `@types/qrcode` importable in dev/test.

- [ ] **Step 1: Install runtime dependencies**

Run:
```bash
npm install puppeteer-core @sparticuz/chromium qrcode
```

- [ ] **Step 2: Install dev dependencies**

Run:
```bash
npm install -D puppeteer @types/qrcode
```

- [ ] **Step 3: Verify install**

Run: `npm run typecheck`
Expected: passes (no code uses the new packages yet, so this just confirms `npm install` didn't break anything).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adiciona dependencias para renderizar o ingresso em imagem"
```

---

### Task 2: HTML→JPEG renderer

**Files:**
- Create: `src/lib/html-screenshot.ts`
- Test: `src/lib/html-screenshot.test.ts`

**Interfaces:**
- Produces: `renderHtmlToJpeg(html: string, width: number): Promise<Buffer>` — used by Task 5.

- [ ] **Step 1: Write the failing test**

`src/lib/html-screenshot.test.ts`:
```ts
import assert from "node:assert/strict";
import test from "node:test";

test("renders a JPEG buffer from a simple HTML string", async () => {
  const { renderHtmlToJpeg } = await import("./html-screenshot.js");
  const buffer = await renderHtmlToJpeg(
    "<!DOCTYPE html><html><body style=\"margin:0;width:200px;height:100px;background:#1d7a4a\"></body></html>",
    200
  );
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
  // JPEG files start with the SOI marker 0xFFD8
  assert.equal(buffer[0], 0xff);
  assert.equal(buffer[1], 0xd8);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --import ./src/test-env.ts --test src/lib/html-screenshot.test.ts`
Expected: FAIL — `html-screenshot.js` does not exist yet.

- [ ] **Step 3: Write the implementation**

`src/lib/html-screenshot.ts`:
```ts
import puppeteer, { type Browser } from "puppeteer-core";

async function resolveLaunchOptions() {
  if (process.env.VERCEL) {
    const chromiumModule = await import("@sparticuz/chromium");
    const chromium = chromiumModule.default ?? chromiumModule;
    return {
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true
    };
  }
  // Import por variavel: evita que o rastreador de dependencias da Vercel
  // empacote o puppeteer completo (baixa um Chromium so usado localmente).
  const localPackageName = "puppeteer";
  const localModule = await import(localPackageName);
  const localPuppeteer = localModule.default ?? localModule;
  return {
    executablePath: await localPuppeteer.executablePath(),
    headless: true
  };
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = resolveLaunchOptions().then((options) => puppeteer.launch(options));
  }
  return browserPromise;
}

export async function renderHtmlToJpeg(html: string, width: number): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height: 800 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const screenshot = await page.screenshot({ type: "jpeg", quality: 85, fullPage: true });
    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --import ./src/test-env.ts --test src/lib/html-screenshot.test.ts`
Expected: PASS. (First run may take a few seconds while Chromium launches — this is expected.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/html-screenshot.ts src/lib/html-screenshot.test.ts
git commit -m "feat: renderiza HTML em JPEG via Chromium headless"
```

---

### Task 3: Ticket HTML template (pure, testable)

**Files:**
- Create: `src/modules/ingressos/ingresso-imagem.html.ts`
- Test: `src/modules/ingressos/ingresso-imagem.html.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `buildIngressoHtml(dados: IngressoHtmlDados): string` and `escapeHtml(value: string): string`, used by Task 5. `IngressoHtmlDados` shape:
  ```ts
  interface IngressoHtmlDados {
    eventoNome: string;
    eventoLocal: string;
    eventoCidade: string | null;
    eventoData: Date;
    eventoBanner: string | null;
    customerNome: string;
    customerCpf: string;
    valor: number;
    codigo: string;
    qrDataUrl: string;
  }
  ```

- [ ] **Step 1: Write the failing tests**

`src/modules/ingressos/ingresso-imagem.html.test.ts`:
```ts
import assert from "node:assert/strict";
import test from "node:test";

const dadosBase = {
  eventoNome: "Baile do Ano",
  eventoLocal: "Clube União Rio Bonito",
  eventoCidade: "Braço do Norte/SC",
  eventoData: new Date("2026-05-30T21:00:00-03:00"),
  eventoBanner: null as string | null,
  customerNome: "Gabriel Aluir da Rosa",
  customerCpf: "12345678999",
  valor: 35,
  codigo: "CG-ABCDEF1234",
  qrDataUrl: "data:image/png;base64,AAAA"
};

test("includes ticket code, masked CPF and formatted value", async () => {
  const { buildIngressoHtml } = await import("./ingresso-imagem.html.js");
  const html = buildIngressoHtml(dadosBase);
  assert.match(html, /CG-ABCDEF1234/);
  assert.match(html, /123\.\*\*\*\.789-\*\*/);
  assert.match(html, /R\$\s*35,00/);
  assert.match(html, /data:image\/png;base64,AAAA/);
});

test("falls back to a branded gradient poster when there is no banner", async () => {
  const { buildIngressoHtml } = await import("./ingresso-imagem.html.js");
  const html = buildIngressoHtml({ ...dadosBase, eventoBanner: null });
  assert.doesNotMatch(html, /<img[^>]*class="poster-img"/);
  assert.match(html, /poster-fallback/);
});

test("renders the banner image when present", async () => {
  const { buildIngressoHtml } = await import("./ingresso-imagem.html.js");
  const html = buildIngressoHtml({ ...dadosBase, eventoBanner: "https://res.cloudinary.com/demo/banner.jpg" });
  assert.match(html, /<img class="poster-img" src="https:\/\/res\.cloudinary\.com\/demo\/banner\.jpg"/);
  assert.doesNotMatch(html, /poster-fallback/);
});

test("escapes HTML special characters in customer and event names", async () => {
  const { buildIngressoHtml } = await import("./ingresso-imagem.html.js");
  const html = buildIngressoHtml({ ...dadosBase, customerNome: "<script>alert(1)</script>", eventoNome: "Baile & Cia" });
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Baile &amp; Cia/);
});

test("escapeHtml escapes the five reserved characters", async () => {
  const { escapeHtml } = await import("./ingresso-imagem.html.js");
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --import ./src/test-env.ts --test src/modules/ingressos/ingresso-imagem.html.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Write the implementation**

`src/modules/ingressos/ingresso-imagem.html.ts`:
```ts
export interface IngressoHtmlDados {
  eventoNome: string;
  eventoLocal: string;
  eventoCidade: string | null;
  eventoData: Date;
  eventoBanner: string | null;
  customerNome: string;
  customerCpf: string;
  valor: number;
  codigo: string;
  qrDataUrl: string;
}

const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MESES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (match) => ESCAPE_MAP[match]);
}

function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
}

function formatarHora(data: Date): string {
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mascararCpf(cpf: string): string {
  return cpf.length === 11 ? `${cpf.slice(0, 3)}.***.${cpf.slice(6, 9)}-**` : cpf;
}

export function buildIngressoHtml(dados: IngressoHtmlDados): string {
  const dataSaoPaulo = new Date(dados.eventoData.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const diaSemana = `${DIAS_SEMANA[dataSaoPaulo.getDay()]}.${String(dataSaoPaulo.getDate()).padStart(2, "0")}`;
  const mes = MESES[dataSaoPaulo.getMonth()];
  const nome = escapeHtml(dados.customerNome);
  const eventoNome = escapeHtml(dados.eventoNome);
  const local = escapeHtml(dados.eventoLocal);
  const cidade = dados.eventoCidade ? escapeHtml(dados.eventoCidade) : "";
  const poster = dados.eventoBanner
    ? `<img class="poster-img" src="${escapeHtml(dados.eventoBanner)}" alt="">`
    : `<div class="poster-fallback"><span>${eventoNome}</span></div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Bebas+Neue&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,sans-serif;width:1000px;background:#0d0b12;color:#fff;display:flex}
.tk-main{flex:1;min-width:0}
.poster{position:relative;height:430px;overflow:hidden}
.poster-img{width:100%;height:100%;object-fit:cover;display:block}
.poster-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 60px;background:linear-gradient(135deg,#0f3d24,#1d7a4a 55%,#0f2318)}
.poster-fallback span{font-family:'Bebas Neue',sans-serif;font-size:44px;letter-spacing:2px;color:#f0c04a;text-shadow:0 2px 12px rgba(0,0,0,.6)}
.poster::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(13,11,18,.55) 0%,rgba(13,11,18,0) 26%,rgba(13,11,18,.25) 62%,#0d0b12 100%)}
.pos-tl,.pos-tr{position:absolute;top:24px;z-index:2;font-family:'Bebas Neue',sans-serif;line-height:1.02}
.pos-tl{left:28px;font-size:36px;letter-spacing:1.4px;text-shadow:0 2px 12px rgba(0,0,0,.85)}
.pos-tl small{display:block;font-family:'Inter';font-size:12px;font-weight:700;letter-spacing:2.4px;color:#f0c04a;margin-top:5px}
.pos-tr{right:28px;text-align:right;font-size:25px;letter-spacing:1.2px;color:#f0c04a;text-shadow:0 2px 12px rgba(0,0,0,.85);max-width:330px}
.pos-tr small{display:block;font-family:'Inter';font-size:11px;font-weight:600;letter-spacing:1.5px;color:#fff;opacity:.85;margin-top:4px}
.tk-body{padding:4px 30px 28px}
.cards{display:flex;gap:13px;margin-bottom:15px}
.card{flex:1;background:#16131d;border:1px solid #2b2637;border-radius:11px;padding:13px 15px}
.card b{display:block;font-size:10px;font-weight:700;letter-spacing:1.3px;color:#8b84a0;text-transform:uppercase}
.card span{display:block;font-size:15px;font-weight:700;margin-top:2px;line-height:1.3}
.portador{background:#16131d;border:1px solid #2b2637;border-radius:11px;padding:17px 20px;display:grid;grid-template-columns:1fr 1fr;gap:15px 24px;margin-bottom:15px}
.portador b{display:block;font-size:10px;font-weight:700;letter-spacing:1.3px;color:#8b84a0;text-transform:uppercase}
.portador span{display:block;font-size:16px;font-weight:700;margin-top:3px}
.portador .cod{font-family:ui-monospace,monospace;color:#f0c04a;letter-spacing:1.6px}
.entrada{display:flex;gap:15px;align-items:stretch}
.tk-qr{width:172px;flex:none;background:#fff;border-radius:11px;padding:12px}
.tk-qr img{width:100%;display:block}
.aviso-ent{flex:1;background:linear-gradient(135deg,#c9911f,#f0c04a);border-radius:11px;padding:18px 21px;color:#2a1d02}
.aviso-ent h4{font-family:'Bebas Neue',sans-serif;font-size:23px;letter-spacing:1.6px;margin-bottom:6px}
.aviso-ent p{font-size:12.5px;font-weight:500;line-height:1.65}
.stub{width:88px;flex:none;background:#fff;border-left:2px dashed #b9b6ad;display:flex;align-items:center;justify-content:center}
.stub span{writing-mode:vertical-rl;font-family:ui-monospace,monospace;font-size:19px;font-weight:700;letter-spacing:4px;color:#14261a}
</style>
</head>
<body>
<div class="tk-main">
<div class="poster">
<div class="pos-tl">${diaSemana}<br>${mes}<small>INÍCIO ${formatarHora(dados.eventoData)}</small></div>
<div class="pos-tr">${local}<small>${cidade}</small></div>
${poster}
</div>
<div class="tk-body">
<div class="cards">
<div class="card"><b>Data</b><span>${formatarData(dados.eventoData)}</span></div>
<div class="card"><b>Início</b><span>${formatarHora(dados.eventoData)}</span></div>
<div class="card"><b>Local</b><span>${local || cidade || "—"}</span></div>
</div>
<div class="portador">
<div><b>Portador</b><span>${nome}</span></div>
<div><b>CPF</b><span>${mascararCpf(dados.customerCpf)}</span></div>
<div><b>Valor</b><span>${formatarValor(dados.valor)}</span></div>
<div><b>Código do ingresso</b><span class="cod">${escapeHtml(dados.codigo)}</span></div>
</div>
<div class="entrada">
<div class="tk-qr"><img src="${dados.qrDataUrl}" alt=""></div>
<div class="aviso-ent"><h4>APRESENTE NA ENTRADA</h4>
<p>Este QR Code é único e pessoal. Não compartilhe.<br>Obrigatório documento com foto.</p></div>
</div>
</div>
</div>
<div class="stub"><span>${escapeHtml(dados.codigo)}</span></div>
</body>
</html>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --import ./src/test-env.ts --test src/modules/ingressos/ingresso-imagem.html.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/ingressos/ingresso-imagem.html.ts src/modules/ingressos/ingresso-imagem.html.test.ts
git commit -m "feat: template HTML do ingresso com fallback de banner e escaping"
```

---

### Task 4: Ticket resolver (pure, testable)

**Files:**
- Create: `src/modules/ingressos/ingresso-imagem.service.ts` (resolver part only in this task; orchestrator added in Task 5)
- Test: `src/modules/ingressos/ingresso-imagem.service.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `resolveTickets(pedido: PedidoParaImagem): TicketResolvido[]`, used by Task 5. Types:
  ```ts
  interface TicketResolvido {
    ticketId: number;
    codigo: string;
    qrPayload: string;
    valor: number;
  }
  interface PedidoParaImagem {
    ingressos: { id: number; qrcode: string; preco: number; status: string }[];
    loteIngresso: { tickets: { id: number; codigo: string; qrcode: string; valor: number; status: string }[] } | null;
  }
  ```

- [ ] **Step 1: Write the failing tests**

`src/modules/ingressos/ingresso-imagem.service.test.ts`:
```ts
import assert from "node:assert/strict";
import test from "node:test";

test("uses IngressoAluno tickets when the order has a lote, ignoring cancelled ones", async () => {
  const { resolveTickets } = await import("./ingresso-imagem.service.js");
  const pedido = {
    ingressos: [],
    loteIngresso: {
      tickets: [
        { id: 1, codigo: "CG-AAA", qrcode: "CGQR:CG-AAA", valor: 35, status: "PAGO" },
        { id: 2, codigo: "CG-BBB", qrcode: "CGQR:CG-BBB", valor: 35, status: "CANCELADO" },
        { id: 3, codigo: "CG-CCC", qrcode: "CGQR:CG-CCC", valor: 35, status: "CORTESIA" }
      ]
    }
  };
  const tickets = resolveTickets(pedido);
  assert.deepEqual(tickets, [
    { ticketId: 1, codigo: "CG-AAA", qrPayload: "CGQR:CG-AAA", valor: 35 },
    { ticketId: 3, codigo: "CG-CCC", qrPayload: "CGQR:CG-CCC", valor: 35 }
  ]);
});

test("falls back to legacy Ingresso rows when there is no lote, ignoring cancelled ones", async () => {
  const { resolveTickets } = await import("./ingresso-imagem.service.js");
  const pedido = {
    ingressos: [
      { id: 10, qrcode: "TKT-xxxx", preco: 35, status: "PAGO" },
      { id: 11, qrcode: "TKT-yyyy", preco: 35, status: "CANCELADO" }
    ],
    loteIngresso: null
  };
  const tickets = resolveTickets(pedido);
  assert.deepEqual(tickets, [
    { ticketId: 10, codigo: "ING-000010", qrPayload: "TKT-xxxx", valor: 35 }
  ]);
});

test("returns an empty list when there are no tickets at all", async () => {
  const { resolveTickets } = await import("./ingresso-imagem.service.js");
  assert.deepEqual(resolveTickets({ ingressos: [], loteIngresso: null }), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --import ./src/test-env.ts --test src/modules/ingressos/ingresso-imagem.service.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Write the implementation**

`src/modules/ingressos/ingresso-imagem.service.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --import ./src/test-env.ts --test src/modules/ingressos/ingresso-imagem.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/ingressos/ingresso-imagem.service.ts src/modules/ingressos/ingresso-imagem.service.test.ts
git commit -m "feat: resolve a lista correta de ingressos por pagamento (lote ou legado)"
```

---

### Task 5: Orchestrator — `ingressoImagemService.gerarImagens`

**Files:**
- Modify: `src/modules/ingressos/ingresso-imagem.service.ts` (append to the file created in Task 4)

**Interfaces:**
- Consumes: `renderHtmlToJpeg` (Task 2), `buildIngressoHtml` (Task 3), `resolveTickets` (Task 4), `prisma` (`src/lib/prisma.js`), `AppError` (`src/utils/http.js`), `QRCode` from `qrcode`.
- Produces: `ingressoImagemService.gerarImagens(paymentId: number): Promise<ImagemIngressoResultado[]>`, used by Task 6. Type:
  ```ts
  interface ImagemIngressoResultado {
    ticketId: number;
    codigo: string;
    eventoNome: string;
    telefone: string;
    imageBase64: string;
  }
  ```

This task has no dedicated new automated test: it is a thin orchestration of three already-tested pure/utility pieces (`resolveTickets`, `buildIngressoHtml`, `renderHtmlToJpeg`) plus a Prisma read, and this codebase has no DB-mocking test pattern to hook into (see Global Constraints). It's exercised in Task 9's manual verification.

- [ ] **Step 1: Add imports and the orchestrator to `ingresso-imagem.service.ts`**

Add at the top of `src/modules/ingressos/ingresso-imagem.service.ts` (above the existing `TicketResolvido`/`PedidoParaImagem`/`resolveTickets` code from Task 4):
```ts
import QRCode from "qrcode";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/http.js";
import { renderHtmlToJpeg } from "../../lib/html-screenshot.js";
import { buildIngressoHtml } from "./ingresso-imagem.html.js";
```

Append at the bottom of the same file:
```ts
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
```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS (all existing tests plus the ones from Tasks 2-4).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: passes. (This is where Prisma's generated `pagamento.pedido.ingressos` / `loteIngresso.tickets` field types get checked against `PedidoParaImagem` — fix any structural mismatch here before continuing.)

- [ ] **Step 4: Commit**

```bash
git add src/modules/ingressos/ingresso-imagem.service.ts
git commit -m "feat: orquestra geracao de imagens do ingresso a partir do pagamento"
```

---

### Task 6: Wire up the endpoint (schema, controller, route)

**Files:**
- Modify: `src/modules/ingressos/ingressos.schemas.ts`
- Modify: `src/modules/ingressos/ingressos.controller.ts`
- Modify: `src/modules/pagamentos/pagamentos.routes.ts`

**Interfaces:**
- Consumes: `ingressoImagemService.gerarImagens` (Task 5), `integrationSecretIsValid` (already exists in `src/modules/pagamentos/pagamentos.controller.ts`).
- Produces: `GET /integrations/payments/:paymentId/tickets-image` — `{ success: true, data: ImagemIngressoResultado[] }` on success, `401` (`UNAUTHORIZED_INTEGRATION`) without a valid `x-integration-secret` header, `404` when the payment/order/tickets aren't found.

- [ ] **Step 1: Add the param schema**

In `src/modules/ingressos/ingressos.schemas.ts`, add after the existing imports/exports (near `registrarPagamentoSchema`):
```ts
export const paymentIdParamSchema = z.object({
  paymentId: z.coerce.number().int().positive()
});
```

- [ ] **Step 2: Add the controller handler**

`src/modules/ingressos/ingressos.controller.ts` currently starts with:
```ts
import type { Request, Response } from "express";
import { ingressosService } from "./ingressos.service.js";

export const ingressosController = {
```
Leave those two existing import lines untouched. Add two **new** import lines directly below them (do not re-add `Request`/`Response`/`ingressosService` — they're already imported):
```ts
import { integrationSecretIsValid } from "../pagamentos/pagamentos.controller.js";
import { AppError } from "../../utils/http.js";
import { ingressoImagemService } from "./ingresso-imagem.service.js";
```
Then add a new method inside the `ingressosController` object literal (alongside the existing methods like `listar`, `buscar`, etc. — keep every existing method exactly as-is, just add this one, e.g. right after `anexarComprovante`):
```ts
  async imagemPorPagamento(req: Request, res: Response) {
    if (!integrationSecretIsValid(req.get("x-integration-secret"))) {
      throw new AppError("Integracao nao autorizada", 401, { code: "UNAUTHORIZED_INTEGRATION" });
    }
    const data = await ingressoImagemService.gerarImagens(Number(req.params.paymentId));
    res.json({ success: true, data });
  }
```
Remember the trailing comma after the previous method (`anexarComprovante`) since this is now no longer the last property in the object.

- [ ] **Step 3: Register the route**

In `src/modules/pagamentos/pagamentos.routes.ts`, add the import and route:
```ts
import { ingressosController } from "../ingressos/ingressos.controller.js";
import { paymentIdParamSchema } from "../ingressos/ingressos.schemas.js";
```
Then, in the `integrationsRoutes` block, add:
```ts
integrationsRoutes.get("/payments/:paymentId/tickets-image", validate({ params: paymentIdParamSchema }), asyncHandler(ingressosController.imagemPorPagamento));
```

- [ ] **Step 4: Typecheck and run the full test suite**

Run: `npm run typecheck && npm test`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/ingressos/ingressos.schemas.ts src/modules/ingressos/ingressos.controller.ts src/modules/pagamentos/pagamentos.routes.ts
git commit -m "feat: expoe endpoint de integracao para gerar imagem do ingresso"
```

---

### Task 7: Swagger documentation

**Files:**
- Modify: `src/docs/swagger.ts`

**Interfaces:**
- Consumes: none (documentation only).

- [ ] **Step 1: Add the endpoint entry**

In `src/docs/swagger.ts`, next to the existing `"/integrations/payment-status"` entry (around line 333), add a sibling entry for the new path:
```ts
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
}
```

Match the exact object structure already used by the neighboring `"/integrations/payment-status"` entry in this file (open it first and mirror its nesting).

- [ ] **Step 2: Verify the app still boots and serves docs**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/docs/swagger.ts
git commit -m "docs: documenta endpoint de imagem do ingresso no swagger"
```

---

### Task 8: Vercel function configuration

**Files:**
- Modify: `vercel.json`

**Interfaces:**
- None (deployment configuration only).

- [ ] **Step 1: Find where the local `puppeteer` package cached its downloaded Chromium**

Run (PowerShell or Bash, after Task 1's `npm install` has completed):
```bash
node -e "console.log(require('puppeteer').executablePath())"
```
This prints an absolute path such as `.../node_modules/puppeteer/.local-chromium/win64-XXXX/...` or `.../.cache/puppeteer/chrome/...` depending on the installed `puppeteer` version. Note the folder one level above the browser binary — that's what gets excluded in Step 2 (it's local-dev-only weight; the code only reaches `import("puppeteer")` when `process.env.VERCEL` is unset, per Task 2, so it's safe to exclude from the deployed function).

- [ ] **Step 2: Add a `functions` block with a longer timeout and the Chromium cache excluded**

Update `vercel.json` to (replace `<caminho-encontrado-no-passo-1>` with the actual relative folder found in Step 1, e.g. `node_modules/puppeteer/.local-chromium/**` or `.cache/puppeteer/**`):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run vercel-build",
  "installCommand": "npm ci",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api"
    }
  ],
  "functions": {
    "api/index.ts": {
      "maxDuration": 60,
      "excludeFiles": "<caminho-encontrado-no-passo-1>"
    }
  }
}
```

- [ ] **Step 3: Note the plan limit**

`maxDuration: 60` requires at least a Vercel Pro-tier limit for the Hobby plan's default (Hobby allows up to 60s already as of current Vercel limits, but confirm against the account's actual plan before deploying — if the account is capped lower, this value must be reduced to match, since Vercel rejects deployments with a `maxDuration` above what the plan allows).

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "chore: aumenta timeout da function para renderizacao do ingresso"
```

---

### Task 9: Manual end-to-end verification

**Files:** none (verification only, no committed artifacts).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Find a real `paymentId` to test with**

Run against your local/dev database (adjust connection as needed):
```sql
SELECT id FROM pagamento WHERE status = 'PAGO' ORDER BY id DESC LIMIT 5;
```
Pick one `id` tied to a BAILE event (not a CURSO), ideally one whose `pedido` has a `lote_ingresso_aluno` row (to exercise the lote path) and, separately, one that doesn't (to exercise the legacy path) — repeat Step 3 for both if available.

- [ ] **Step 3: Call the endpoint**

```bash
curl -s -H "x-integration-secret: $N8N_INTEGRATION_SECRET" http://localhost:3333/integrations/payments/<paymentId>/tickets-image | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
for (const ticket of data.data) {
  const base64 = ticket.imageBase64.split(',')[1];
  require('fs').writeFileSync(\`ticket-\${ticket.ticketId}.jpg\`, Buffer.from(base64, 'base64'));
  console.log('wrote', \`ticket-\${ticket.ticketId}.jpg\`, 'for', ticket.codigo);
}
"
```

- [ ] **Step 4: Open the generated `.jpg` files and visually confirm**

Check: poster shows the event banner (or the gradient fallback when the event has none), data/início/local cards are correct, portador/CPF/valor/código are correct, QR code is present and scans to the ticket's `qrPayload`, layout is not cut off or overlapping. Compare against the reference mockup shared earlier in this project.

- [ ] **Step 5: Confirm the auth guard**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3333/integrations/payments/1/tickets-image
```
Expected: `401`.

- [ ] **Step 6: Delete the local `.jpg` files created for verification**

```bash
rm ticket-*.jpg
```

No commit for this task — it's verification only.
