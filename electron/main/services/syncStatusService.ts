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
// 20s quanto o "Sincronizar agora" manual), pra alimentar o badge "X
// atualizacoes pendentes" no rodape do app. Reflete so' o que o ciclo MAIS
// RECENTE trouxe -- nao acumula entre ciclos. Um acumulador somando a cada
// poll de 20s cresce pra sempre sempre que uma mesma linha precisa ser
// reaplicada em mais de um ciclo (ex: cursor preso atras de uma linha com
// erro permanente em outra tabela -- ver comentario em syncTableDown), o que
// fazia o badge crescer indefinidamente mesmo com o app em dia. Sempre
// notifica (inclusive quando zera) pra o badge sumir assim que um ciclo nao
// trouxer nada de novo, sem esperar um "Sincronizar agora" manual.
export function recordSyncResult(pulled: Array<{ table: string; pulled: number }>): void {
  const total = pulled.reduce((sum, entry) => sum + entry.pulled, 0);
  status = { pendingCount: total, lastSyncedAt: new Date().toISOString() };
  broadcast();
}

export function acknowledgeSyncUpdates(): void {
  status = { ...status, pendingCount: 0 };
  broadcast();
}

export function getSyncStatus(): SharedSyncStatus {
  return status;
}
