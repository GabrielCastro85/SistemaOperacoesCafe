import { app, BrowserWindow, dialog, ipcMain, session } from "electron";
import log from "electron-log/main.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getBuildVariantConfig } from "../../src/shared/buildVariants.js";
import { initializeDatabase } from "./database/database.js";
import { registerIpcHandlers } from "./ipc/handlers.js";
import { AppRepository } from "./services/appRepository.js";
import { seedClientMasterDataIfNeeded } from "./services/clientSeed.js";
import { ensureAppDirectories, resolveAppDirectories } from "./services/paths.js";
import { createMainWindow } from "./windows/createMainWindow.js";
import { createSplashWindow, showSplashError } from "./windows/createSplashWindow.js";

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
const buildVariant = getBuildVariantConfig(resolveRuntimeVariant());

// Ao rodar contra o servidor de dev do Vite, isola completamente os dados numa pasta separada
// da instalacao real, para que testes manuais nunca leiam/escrevam no banco de producao.
const isDevServer = Boolean(process.env.VITE_DEV_SERVER_URL);
const userDataDirectoryName = isDevServer ? `${buildVariant.userDataDirectoryName} (Dev)` : buildVariant.userDataDirectoryName;

app.setName(isDevServer ? `${buildVariant.displayName} (Dev)` : buildVariant.displayName);
app.setAppUserModelId(buildVariant.appId);
app.setPath("userData", join(app.getPath("appData"), userDataDirectoryName));

function bootstrap(): void {
  const directories = resolveAppDirectories(app.getPath("userData"));
  ensureAppDirectories(directories);
  log.initialize();
  log.transports.file.resolvePathFn = () => join(directories.logsDir, "main.log");
  log.info("Starting application", { variant: buildVariant.variant, appId: buildVariant.appId, userData: directories.userData });
  const db = initializeDatabase(directories);
  const seededClients = seedClientMasterDataIfNeeded(db);
  if (seededClients > 0) {
    log.info("Client master data seed completed", { partners: seededClients });
  }
  const context = { version: app.getVersion(), directories, db, buildVariant };
  const repository = new AppRepository(db, directories);
  registerIpcHandlers(ipcMain, context, repository);
}

function createWindow(minSplashVisible: Promise<void> = Promise.resolve()): void {
  mainWindow = createMainWindow({
    buildVariant,
    isDevServer,
    onReadyToShow: (window) => {
      void showMainWindowWhenReady(window, minSplashVisible);
    }
  });
}

async function showMainWindowWhenReady(window: BrowserWindow, minSplashVisible: Promise<void>): Promise<void> {
  await minSplashVisible;
  if (!splashWindow?.isDestroyed()) {
    splashWindow?.close();
  }
  splashWindow = null;
  if (window.isDestroyed()) return;
  window.maximize();
  window.show();
  window.focus();
}

app.whenReady().then(async () => {
  try {
    splashWindow = await createSplashWindow();
    const minSplashVisible = delay(1200);
    await delay(80);
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    bootstrap();
    createWindow(minSplashVisible);
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    log.error("Fatal error during application startup", error);
    void showSplashError(splashWindow, error instanceof Error ? error.message : String(error));
    dialog.showErrorBox("Falha ao iniciar", error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

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
