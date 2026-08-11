import puppeteer, { type Browser } from "puppeteer-core";

async function resolveLaunchOptions() {
  if (process.env.VERCEL) {
    const chromiumModule = await import("@sparticuz/chromium");
    const chromium = chromiumModule.default ?? chromiumModule;
    return {
      args: chromium.args as string[],
      executablePath: await (chromium.executablePath as () => Promise<string>)(),
      headless: true
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
  if (!browserPromise) {
    browserPromise = resolveLaunchOptions()
      .then((options) => puppeteer.launch(options))
      .catch((error) => {
        // Reset the promise on failure so the next call gets a fresh attempt
        browserPromise = null;
        throw error;
      });
  }
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
    await page.setContent(html, { waitUntil: "networkidle0" as "load" });
    const screenshot = await page.screenshot({ type: "jpeg", quality: 85, fullPage: true });
    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}
