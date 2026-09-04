import { app, BrowserWindow, dialog, ipcMain, net, protocol, session } from "electron";
import log from "electron-log/main.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getBuildVariantConfig } from "../../src/shared/buildVariants.js";
import type { AppDirectories } from "../../src/shared/types/domain.js";
import { initializeDatabase } from "./database/database.js";
import { registerIpcHandlers } from "./ipc/handlers.js";
import { AppRepository } from "./services/appRepository.js";
import { ensureAppDirectories, resolveAppDirectories } from "./services/paths.js";
import { SharedRepository } from "./services/sharedRepository.js";
import { recordSyncResult, setSyncStatusWindow } from "./services/syncStatusService.js";
import { initializeUpdater, startPeriodicUpdateChecks } from "./services/updaterService.js";
import { createMainWindow } from "./windows/createMainWindow.js";
import { createSplashWindow, showSplashError } from "./windows/createSplashWindow.js";

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
const buildVariant = getBuildVariantConfig(resolveRuntimeVariant());

// Precisa ser registrado ANTES de app.whenReady() (exigencia do Electron pra
// protocolos privilegiados). Serve a logo/icone que o cliente enviou pela
// tela de Identidade Visual (ver brandingAssets.ts) pras telas React -- sem
// isso a logo customizada so aparecia nos PDFs (gerados no processo main,
// que le arquivo local direto), nunca na tela, porque o renderer roda
// sandboxed e nao pode abrir um caminho de disco arbitrario como <img src>.
protocol.registerSchemesAsPrivileged([
  { scheme: "branding-asset", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false, bypassCSP: false } }
]);

// Escopo estrito de proposito: so serve exatamente
// <settingsDir>/branding/<organizationId>/<nome-de-arquivo-sem-barra> --
// nunca um caminho arbitrario do disco do cliente, mesmo que o main process
// tenha acesso total ao sistema de arquivos.
function registerBrandingAssetProtocol(directories: AppDirectories): void {
  const brandingRoot = join(directories.settingsDir, "branding");
  protocol.handle("branding-asset", async (request) => {
    try {
      const url = new URL(request.url);
      const organizationId = url.hostname;
      const fileName = decodeURIComponent(url.pathname.replace(/^\//, ""));
      const safeSegment = /^[a-zA-Z0-9._-]+$/;
      if (!safeSegment.test(organizationId) || !safeSegment.test(fileName)) {
        return new Response(null, { status: 400 });
      }
      const resolvedPath = join(brandingRoot, organizationId, fileName);
      if (!resolvedPath.startsWith(join(brandingRoot, organizationId))) {
        return new Response(null, { status: 400 });
      }
      if (!existsSync(resolvedPath)) return new Response(null, { status: 404 });
      return net.fetch(pathToFileURL(resolvedPath).toString());
    } catch (error) {
      log.warn("Falha ao servir branding-asset://", error instanceof Error ? error.message : String(error));
      return new Response(null, { status: 500 });
    }
  });
}

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
  registerBrandingAssetProtocol(directories);
  const db = initializeDatabase(directories);
  const sharedRepository = new SharedRepository(directories);
  const context = { version: app.getVersion(), directories, db, buildVariant, sharedRepository };
  const repository = new AppRepository(db, directories, sharedRepository);
  registerIpcHandlers(ipcMain, context, repository);
  startSharedDataSync(repository);
}

// Sync poll-based (nao realtime) -- roda em segundo plano pra todo PC ir
// enxergando o que os outros lancaram sem precisar de acao manual. 20s e' um
// meio-termo entre "quase imediato" e nao bater na rede toda hora; sem sessao
// Supabase autenticada, syncSharedDataDown() e' um no-op silencioso.
function startSharedDataSync(repository: AppRepository): void {
  const SYNC_INTERVAL_MS = 20_000;
  const run = (): void => {
    repository.syncSharedDataDown()
      .then(async (results) => {
        const withChanges = results.filter((entry) => entry.pulled > 0);
        if (withChanges.length > 0) log.info("Shared data sync pulled changes", { withChanges });
        const connected = await repository.isSharedConnected().catch(() => false);
        recordSyncResult(results, repository.getSharedPushOutboxPendingCount(), connected);
      })
      .catch((error) => log.warn("Shared data sync failed", { error: error instanceof Error ? error.message : String(error) }));
  };
  run();
  setInterval(run, SYNC_INTERVAL_MS);
}

function createWindow(minSplashVisible: Promise<void> = Promise.resolve()): void {
  mainWindow = createMainWindow({
    buildVariant,
    isDevServer,
    onReadyToShow: (window) => {
      void showMainWindowWhenReady(window, minSplashVisible);
    }
  });
  initializeUpdater(mainWindow);
  startPeriodicUpdateChecks();
  setSyncStatusWindow(mainWindow);
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
