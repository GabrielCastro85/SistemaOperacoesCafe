import { app, BrowserWindow, ipcMain } from "electron";
import log from "electron-log/main.js";
import { join } from "node:path";
import { initializeDatabase } from "./database/database.js";
import { registerIpcHandlers } from "./ipc/handlers.js";
import { AppRepository } from "./services/appRepository.js";
import { ensureAppDirectories, resolveAppDirectories } from "./services/paths.js";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: "Operacoes Cafe",
    webPreferences: {
      preload: join(app.getAppPath(), "dist-electron", "electron", "preload", "index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
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
  const db = initializeDatabase(directories);
  const context = { version: app.getVersion(), directories, db };
  const repository = new AppRepository(db, directories);
  registerIpcHandlers(ipcMain, context, repository);
}

app.whenReady().then(() => {
  bootstrap();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
