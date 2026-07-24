import { BrowserWindow, app } from "electron";
import log from "electron-log/main.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BuildVariantConfig } from "../../../src/shared/buildVariants.js";

export interface CreateMainWindowOptions {
  buildVariant: BuildVariantConfig;
  isDevServer: boolean;
  onReadyToShow: (window: BrowserWindow) => void;
}

export function createMainWindow(options: CreateMainWindowOptions): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    title: options.isDevServer ? `${options.buildVariant.displayName} (Dev - banco isolado)` : options.buildVariant.displayName,
    icon: resolveWindowIcon(options.buildVariant),
    show: false,
    backgroundColor: "#050907",
    webPreferences: {
      preload: join(app.getAppPath(), "dist-electron", "electron", "preload", "index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      devTools: !app.isPackaged || process.env.OPERACOES_CAFE_ENABLE_DEVTOOLS === "1"
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://") && !url.startsWith("http://127.0.0.1:")) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    log.error("Renderer failed to load", { errorCode, errorDescription, validatedUrl });
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    log.error("Renderer process gone", details);
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    log.info("Renderer console", { level, message, line, sourceId });
  });

  mainWindow.once("ready-to-show", () => options.onReadyToShow(mainWindow));
  void loadMainRenderer(mainWindow);
  return mainWindow;
}

function resolveWindowIcon(buildVariant: BuildVariantConfig): string | undefined {
  const iconFileName = buildVariant.iconPath.split(/[\\/]/).at(-1);
  const candidates = [
    iconFileName ? join(process.resourcesPath, "icons", iconFileName) : null,
    join(process.cwd(), buildVariant.iconPath),
    join(app.getAppPath(), buildVariant.iconPath)
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => existsSync(candidate));
}

async function loadMainRenderer(mainWindow: BrowserWindow): Promise<void> {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl).catch((error: unknown) => {
      log.error("Failed to load dev server", error);
    });
    return;
  }

  await mainWindow.loadFile(join(app.getAppPath(), "dist", "index.html")).catch((error: unknown) => {
    log.error("Failed to load renderer file", error);
  });
}
