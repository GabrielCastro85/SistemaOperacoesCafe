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
      preload: join(app.getAppPath(), "dist-electron", "electron", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(join(app.getAppPath(), "dist", "index.html"));
  }
}

function bootstrap(): void {
  const directories = resolveAppDirectories(app.getPath("userData"));
  ensureAppDirectories(directories);
  log.initialize();
  log.transports.file.resolvePathFn = () => join(directories.logsDir, "main.log");
  const db = initializeDatabase(directories);
  const context = { version: app.getVersion(), directories, db };
  const repository = new AppRepository(db);
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
