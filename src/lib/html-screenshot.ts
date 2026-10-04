import puppeteer, { type Browser, type LaunchOptions } from "puppeteer-core";

type ResolvedLaunchOptions = Pick<LaunchOptions, "args" | "executablePath" | "headless">;

async function resolveLaunchOptions(): Promise<ResolvedLaunchOptions> {
  if (process.env.VERCEL) {
    const chromiumModule = await import("@sparticuz/chromium");
    const chromium = chromiumModule.default ?? chromiumModule;
    // Desabilita a stack grafica/WebGL: o ticket nao precisa dela e isso evita
    // extrair a lib swiftshader (~3.6MB) em todo cold start.
    chromium.setGraphicsMode = false;
    return {
      args: chromium.args as string[],
      executablePath: await (chromium.executablePath as () => Promise<string>)(),
      // @sparticuz/chromium so empacota o binario "chrome-headless-shell";
      // headless: true nao e suportado por ele, precisa ser "shell".
      headless: "shell"
    };
  }
  // Import por variavel: evita que o rastreador de dependencias da Vercel
  // empacote o puppeteer completo (baixa um Chromium so usado localmente).
  const localPackageName = "puppeteer";
  const localModule = await import(localPackageName);
  const localPuppeteer = localModule.default ?? localModule;
  return {
    executablePath: await (localPuppeteer.executablePath as () => Promise<string>)(),
    headless: true
  };
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const existing = await browserPromise.catch(() => null);
    if (existing?.connected) return existing;
    // Browser cacheado morreu (ex.: container Vercel congelado/reciclado) ou
    // o launch anterior falhou: descarta e forca um novo launch abaixo.
    browserPromise = null;
  }
  browserPromise = resolveLaunchOptions()
    .then((options) => puppeteer.launch(options))
    .catch((error) => {
      // Reset the promise on failure so the next call gets a fresh attempt
      browserPromise = null;
      throw error;
    });
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } finally {
      browserPromise = null;
    }
  }
}

export async function renderHtmlToJpeg(html: string, width: number): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height: 800 });
    // O DOM ja fica pronto assim que setContent resolve o load; se a espera por
    // network idle estourar (fonte do Google Fonts ou banner do Cloudinary lentos/
    // inacessiveis), seguimos com o que carregou em vez de falhar o ticket inteiro.
    await page
      .setContent(html, { waitUntil: "networkidle0" as "load", timeout: 8000 })
      .catch(() => {});
    const screenshot = await page.screenshot({ type: "jpeg", quality: 85, fullPage: true });
    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}
