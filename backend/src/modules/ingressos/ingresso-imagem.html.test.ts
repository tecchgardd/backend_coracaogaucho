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
