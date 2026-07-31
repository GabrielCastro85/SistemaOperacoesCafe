import type { BrowserWindow } from "electron";
import type { SharedSyncStatus } from "../../../src/shared/types/sync.js";

const SYNC_STATUS_CHANGED_CHANNEL = "app:sharedSyncStatusChanged";

let status: SharedSyncStatus = { pendingCount: 0, lastSyncedAt: null };
let mainWindowRef: BrowserWindow | null = null;

export function setSyncStatusWindow(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;
}

function broadcast(): void {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(SYNC_STATUS_CHANGED_CHANNEL, status);
  }
}

// Chamado depois de QUALQUER syncSharedDataDown (tanto o poll automatico de
// 20s quanto o "Sincronizar agora" manual) -- soma quantas linhas novas
// chegaram desde a ultima vez que o usuario "viu" (acknowledgeSyncUpdates),
// pra alimentar o badge "X atualizacoes pendentes" no rodape do app. Nao
// persiste entre reinicios do app de proposito: e' so' uma notificacao de
// "algo novo chegou", nao um registro de auditoria.
export function recordSyncResult(pulled: Array<{ table: string; pulled: number }>): void {
  const total = pulled.reduce((sum, entry) => sum + entry.pulled, 0);
  status = { pendingCount: status.pendingCount + total, lastSyncedAt: new Date().toISOString() };
  if (total > 0) broadcast();
}

export function acknowledgeSyncUpdates(): void {
  status = { ...status, pendingCount: 0 };
  broadcast();
}

export function getSyncStatus(): SharedSyncStatus {
  return status;
}
