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

  const posterStyles = dados.eventoBanner
    ? `.poster-img{width:100%;height:100%;object-fit:cover;display:block}`
    : `.poster-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 60px;background:linear-gradient(135deg,#0f3d24,#1d7a4a 55%,#0f2318)}.poster-fallback span{font-family:'Bebas Neue',sans-serif;font-size:44px;letter-spacing:2px;color:#f0c04a;text-shadow:0 2px 12px rgba(0,0,0,.6)}`;

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
${posterStyles}
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
