import { BrowserWindow, app } from "electron";
import { existsSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const SPLASH_LOGO_FILE = "460aa52b-8374-44ad-9e66-fe64011192e1.png";

export async function createSplashWindow(): Promise<BrowserWindow> {
  const splash = new BrowserWindow({
    width: 520,
    height: 520,
    minWidth: 420,
    minHeight: 420,
    maxWidth: 720,
    maxHeight: 720,
    frame: false,
    transparent: false,
    resizable: false,
    movable: true,
    center: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: "#050907",
    titleBarStyle: "hidden",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  splash.removeMenu();
  await splash.loadFile(writeSplashHtmlFile());
  if (!splash.isDestroyed()) splash.show();
  return splash;
}

export async function showSplashError(splash: BrowserWindow | null, message: string): Promise<void> {
  if (!splash || splash.isDestroyed()) return;
  await splash.loadFile(writeSplashHtmlFile(message));
  splash.show();
}

function writeSplashHtmlFile(errorMessage?: string): string {
  const htmlPath = join(app.getPath("userData"), "splash.html");
  writeFileSync(htmlPath, buildSplashHtml(errorMessage), "utf8");
  return htmlPath;
}

function buildSplashHtml(errorMessage?: string): string {
  const logoUrl = resolveSplashLogoUrl();
  const safeError = errorMessage ? escapeHtml(errorMessage) : "";
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file: data:; style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --black: #050907;
      --deep: #07150f;
      --green: #0b3a27;
      --gold: #d9b15f;
      --gold-soft: rgba(217, 177, 95, 0.36);
      --cream: #fff6df;
    }

    * { box-sizing: border-box; }

    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: var(--black);
      font-family: Arial, sans-serif;
      user-select: none;
    }

    body {
      display: grid;
      place-items: center;
      opacity: 0;
      animation: bodyIn 280ms ease forwards;
    }

    .splash {
      position: relative;
      display: grid;
      place-items: center;
      width: 100vw;
      height: 100vh;
      background:
        radial-gradient(circle at 50% 42%, rgba(20, 70, 48, 0.62), transparent 38%),
        radial-gradient(circle at 50% 52%, rgba(217, 177, 95, 0.13), transparent 30%),
        linear-gradient(135deg, #030504 0%, var(--deep) 56%, #030504 100%);
    }

    .splash::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(115deg, transparent 28%, rgba(217, 177, 95, 0.12) 48%, transparent 66%),
        radial-gradient(circle at 50% 92%, rgba(217, 177, 95, 0.12), transparent 34%);
      opacity: 0;
      animation: ambientGlow 1500ms ease forwards;
    }

    .logo-wrap {
      position: relative;
      width: min(68vw, 330px);
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      transform: scale(0.88);
      opacity: 0;
      filter: blur(7px);
      animation: logoIn 1250ms cubic-bezier(.2,.8,.2,1) 110ms forwards, logoOut 260ms ease 1650ms forwards;
    }

    .logo-wrap::before {
      content: "";
      position: absolute;
      inset: 5%;
      border-radius: 999px;
      background: radial-gradient(circle, var(--gold-soft), rgba(217, 177, 95, 0.06) 42%, transparent 68%);
      filter: blur(22px);
      opacity: 0;
      animation: glowIn 1500ms ease 420ms forwards;
    }

    .logo-wrap::after {
      content: "";
      position: absolute;
      width: 170%;
      height: 3px;
      transform: translateX(-78%) rotate(-18deg);
      background: linear-gradient(90deg, transparent, rgba(255, 245, 197, 0.18), #ffd875, rgba(255, 245, 197, 0.2), transparent);
      box-shadow: 0 0 22px rgba(255, 216, 117, 0.62);
      opacity: 0;
      animation: lightSweep 760ms ease 820ms forwards;
    }

    img {
      position: relative;
      z-index: 1;
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
    }

    .error {
      position: absolute;
      inset: auto 34px 34px;
      display: ${errorMessage ? "block" : "none"};
      padding: 14px 16px;
      border: 1px solid rgba(217, 177, 95, 0.45);
      border-radius: 12px;
      color: var(--cream);
      background: rgba(5, 9, 7, 0.88);
      font-size: 13px;
      line-height: 1.45;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.36);
    }

    .error strong {
      display: block;
      margin-bottom: 4px;
      color: var(--gold);
      font-size: 14px;
    }

    body.has-error .logo-wrap {
      animation: logoIn 800ms cubic-bezier(.2,.8,.2,1) 90ms forwards;
    }

    @keyframes bodyIn {
      to { opacity: 1; }
    }

    @keyframes ambientGlow {
      0% { opacity: 0; transform: scale(1.02); }
      100% { opacity: 1; transform: scale(1); }
    }

    @keyframes logoIn {
      0% { opacity: 0; transform: scale(0.88); filter: blur(7px); }
      68% { opacity: 1; filter: blur(0); }
      100% { opacity: 1; transform: scale(1); filter: blur(0); }
    }

    @keyframes glowIn {
      0% { opacity: 0; transform: scale(0.82); }
      55% { opacity: 1; }
      100% { opacity: 0.82; transform: scale(1.06); }
    }

    @keyframes lightSweep {
      0% { opacity: 0; transform: translateX(-78%) rotate(-18deg); }
      20% { opacity: 1; }
      100% { opacity: 0; transform: translateX(78%) rotate(-18deg); }
    }

    @keyframes logoOut {
      to { opacity: 0.18; transform: scale(0.98); filter: blur(2px); }
    }

  </style>
</head>
<body class="${errorMessage ? "has-error" : ""}">
  <main class="splash">
    <div class="logo-wrap"><img src="${logoUrl}" alt="" /></div>
    <section class="error"><strong>Falha ao iniciar</strong>${safeError}</section>
  </main>
</body>
</html>`;

  return html;
}

function resolveSplashLogoUrl(): string {
  const candidates = [
    join(process.cwd(), "public", "assets", "splash", SPLASH_LOGO_FILE),
    join(app.getAppPath(), "dist", "assets", "splash", SPLASH_LOGO_FILE),
    join(app.getAppPath(), "public", "assets", "splash", SPLASH_LOGO_FILE),
    join(app.getAppPath(), "build", "icon-sources", "multiempresa-app-icon.png")
  ];
  const found = candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  return pathToFileURL(found).toString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
