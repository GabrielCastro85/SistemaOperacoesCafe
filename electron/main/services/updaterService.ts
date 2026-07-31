import { app, BrowserWindow } from "electron";
import log from "electron-log/main.js";
// electron-updater e' CommonJS; seu named export "autoUpdater" nao e'
// estaticamente detectavel pelo interop ESM do Node, entao precisa importar
// o default (senao da SyntaxError em runtime empacotado). "autoUpdater" e'
// tambem um getter que instancia o updater na primeira leitura e ja acessa
// electron.app -- desestruturar no topo do modulo dispara isso assim que o
// arquivo e' importado (quebra em testes fora do Electron real, onde
// electron.app e' um stub). Por isso so' acessa electronUpdater.autoUpdater
// dentro das funcoes, nunca no escopo do modulo.
import electronUpdater from "electron-updater";
import type { UpdateStatus } from "../../../src/shared/types/updater.js";

const UPDATE_STATUS_CHANNEL = "app:updateStatusChanged";
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

let currentStatus: UpdateStatus = { state: "idle" };
let pendingVersion = "";
let mainWindowRef: BrowserWindow | null = null;
let initialized = false;

function setStatus(status: UpdateStatus): void {
  currentStatus = status;
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(UPDATE_STATUS_CHANNEL, status);
  }
}

// Sem canal push dedicado ate' aqui no app -- reaproveita webContents.send direto
// (em vez de expor um EventEmitter customizado) porque o unico consumidor e' a
// tela de configuracoes mostrando progresso de download em tempo real.
export function initializeUpdater(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;
  if (initialized) return;
  initialized = true;

  const { autoUpdater } = electronUpdater;
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => setStatus({ state: "checking" }));
  autoUpdater.on("update-available", (info) => {
    pendingVersion = info.version;
    setStatus({ state: "downloading", version: info.version, percent: 0 });
  });
  autoUpdater.on("update-not-available", () => setStatus({ state: "not-available" }));
  autoUpdater.on("download-progress", (progress) => {
    setStatus({ state: "downloading", version: pendingVersion, percent: Math.round(progress.percent) });
  });
  autoUpdater.on("update-downloaded", (info) => {
    pendingVersion = info.version;
    setStatus({ state: "downloaded", version: info.version });
    log.info("Atualizacao baixada e pronta para instalar", { version: info.version });
  });
  autoUpdater.on("error", (error) => {
    log.warn("Falha no processo de atualizacao automatica", { error: error.message });
    setStatus({ state: "error", message: error.message });
  });
}

export function checkForUpdates(): void {
  if (!app.isPackaged) {
    log.info("Verificacao de atualizacao ignorada: aplicativo rodando em modo de desenvolvimento.");
    return;
  }
  electronUpdater.autoUpdater.checkForUpdates().catch((error) => {
    log.warn("Verificacao de atualizacao falhou", { error: error instanceof Error ? error.message : String(error) });
  });
}

export function startPeriodicUpdateChecks(): void {
  checkForUpdates();
  setInterval(checkForUpdates, CHECK_INTERVAL_MS);
}

export function getUpdateStatus(): UpdateStatus {
  return currentStatus;
}

export function quitAndInstallUpdate(): void {
  if (currentStatus.state !== "downloaded") return;
  electronUpdater.autoUpdater.quitAndInstall();
}
