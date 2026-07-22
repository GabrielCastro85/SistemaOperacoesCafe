import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import log from "electron-log/main.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getBuildVariantConfig } from "../../src/shared/buildVariants.js";
import { initializeDatabase } from "./database/database.js";
import { registerIpcHandlers } from "./ipc/handlers.js";
import { AppRepository } from "./services/appRepository.js";
import { ensureAppDirectories, resolveAppDirectories } from "./services/paths.js";

let mainWindow: BrowserWindow | null = null;
const buildVariant = getBuildVariantConfig(resolveRuntimeVariant());

// Ao rodar contra o servidor de dev do Vite, isola completamente os dados numa pasta separada
// da instalacao real, para que testes manuais nunca leiam/escrevam no banco de producao.
const isDevServer = Boolean(process.env.VITE_DEV_SERVER_URL);
const userDataDirectoryName = isDevServer ? `${buildVariant.userDataDirectoryName} (Dev)` : buildVariant.userDataDirectoryName;

app.setName(isDevServer ? `${buildVariant.displayName} (Dev)` : buildVariant.displayName);
app.setAppUserModelId(buildVariant.appId);
app.setPath("userData", join(app.getPath("appData"), userDataDirectoryName));

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    title: isDevServer ? `${buildVariant.displayName} (Dev - banco isolado)` : buildVariant.displayName,
    show: false,
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
  mainWindow.once("ready-to-show", () => {
    mainWindow?.maximize();
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    log.error("Renderer process gone", details);
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    log.info("Renderer console", { level, message, line, sourceId });
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl).catch((error: unknown) => {
      log.error("Failed to load dev server", error);
    });
  } else {
    void mainWindow.loadFile(join(app.getAppPath(), "dist", "index.html")).catch((error: unknown) => {
      log.error("Failed to load renderer file", error);
    });
  }
}

function bootstrap(): void {
  const directories = resolveAppDirectories(app.getPath("userData"));
  ensureAppDirectories(directories);
  log.initialize();
  log.transports.file.resolvePathFn = () => join(directories.logsDir, "main.log");
  log.info("Starting application", { variant: buildVariant.variant, appId: buildVariant.appId, userData: directories.userData });
  const db = initializeDatabase(directories);
  const context = { version: app.getVersion(), directories, db, buildVariant };
  const repository = new AppRepository(db, directories);
  registerIpcHandlers(ipcMain, context, repository);
}

app.whenReady().then(() => {
  try {
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    bootstrap();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    log.error("Fatal error during application startup", error);
    dialog.showErrorBox("Falha ao iniciar", error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

const singleInstance = app.requestSingleInstanceLock({ variant: buildVariant.variant });
if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.maximize();
    mainWindow.focus();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function resolveRuntimeVariant(): string | undefined {
  const envVariant = process.env.OPERACOES_CAFE_VARIANT ?? process.env.VITE_APP_BUILD_VARIANT;
  if (envVariant) return envVariant;
  try {
    const packagePath = join(app.getAppPath(), "package.json");
    if (!existsSync(packagePath)) return undefined;
    const metadata = JSON.parse(readFileSync(packagePath, "utf8")) as { operacoesCafeVariant?: string };
    return metadata.operacoesCafeVariant;
  } catch {
    return undefined;
  }
}
