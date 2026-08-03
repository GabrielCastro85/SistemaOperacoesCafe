import { ipcMain, net, type IpcMainInvokeEvent } from "electron";

type InvokeListener = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

type ConsultationModeState = {
  active: boolean;
  offline: boolean;
  forced: boolean;
  reason: string | null;
  updatedAt: string;
};

let installed = false;
let forced = false;
let forcedReason: string | null = null;
let updatedAt = new Date().toISOString();

const allowedExact = new Set([
  "consultationmode:getstate",
  "auth:login",
  "auth:logout",
  "auth:session",
  "auth:getsession",
  "auth:currentsession",
  "auth:me",
  "auth:changepassword",
  "auth:bootstrapstatus",
  "auth:bootstrapadmin",
]);

const allowedPrefixes = [
  "sync:",
  "cloudsync:",
  "sharedsync:",
  "sharing:",
  "shared:",
  "supabase:",
  "supabasesync:",
  "updates:",
  "update:",
  "cnpj:",
  "dialog:",
  "window:",
  "diagnostics:",
];

const readVerbs = [
  "list",
  "get",
  "find",
  "search",
  "lookup",
  "preview",
  "summary",
  "stats",
  "totals",
  "history",
  "status",
  "check",
  "diagnose",
  "read",
  "open",
  "select",
  "render",
  "details",
  "detail",
  "exists",
  "ping",
  "count",
  "all",
  "query",
  "current",
  "state",
  "version",
  "ensure",
  "load",
  "download",
  "export",
  "print",
];

const writeVerbs = [
  "create",
  "update",
  "delete",
  "remove",
  "archive",
  "restore",
  "revert",
  "confirm",
  "cancel",
  "issue",
  "emit",
  "save",
  "import",
  "process",
  "register",
  "apply",
  "pay",
  "receive",
  "mark",
  "set",
  "reset",
  "upsert",
  "clear",
  "assign",
  "inactivate",
  "activate",
  "approve",
  "reject",
  "generate",
  "upload",
  "validate",
  "bootstrap",
  "correct",
  "edit",
  "recalculate",
  "migrate",
  "seed",
  "link",
  "unlink",
  "post",
  "commit",
  "void",
  "write",
  "ingest",
  "start",
  "finish",
  "execute",
  "run",
  "copy",
  "move",
  "install",
  "rebuild",
];

function normalize(channel: string) {
  return channel.toLowerCase().replace(/[^a-z0-9:]+/g, ":");
}

function touch() {
  updatedAt = new Date().toISOString();
}

function asMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Erro desconhecido.";
  }
}

function isOffline() {
  try {
    return !net.isOnline();
  } catch {
    return false;
  }
}

function markSyncSuccess() {
  forced = false;
  forcedReason = null;
  touch();
}

function markSyncFailure(reason?: string) {
  forced = true;
  forcedReason = reason ?? "A sincronizacao falhou.";
  touch();
}

function getState(): ConsultationModeState {
  const offline = isOffline();
  const reason = offline
    ? "Sem conexao com a internet. O sistema esta em modo consulta ate a conexao voltar."
    : forced
      ? (forcedReason ?? "A sincronizacao falhou. Sincronize este PC antes de alterar dados.")
      : null;

  return {
    active: offline || forced,
    offline,
    forced,
    reason,
    updatedAt,
  };
}

function hasReadVerb(channel: string) {
  const normalized = normalize(channel);
  const suffix = normalized.split(":").pop() ?? normalized;
  return readVerbs.some((verb) => suffix === verb || suffix.startsWith(verb));
}

function isAllowedInConsultationMode(channel: string) {
  const normalized = normalize(channel);

  if (allowedExact.has(normalized)) return true;
  if (normalized.includes("sync")) return true;
  if (allowedPrefixes.some((prefix) => normalized.startsWith(prefix))) return true;

  return hasReadVerb(channel);
}

function isWriteLike(channel: string) {
  if (isAllowedInConsultationMode(channel)) return false;

  const normalized = normalize(channel);
  return writeVerbs.some(
    (verb) =>
      normalized === verb ||
      normalized.startsWith(`${verb}:`) ||
      normalized.endsWith(`:${verb}`) ||
      normalized.includes(`:${verb}:`) ||
      normalized.includes(`:${verb}`),
  );
}

function isSyncChannel(channel: string) {
  const normalized = normalize(channel);
  return (
    normalized.includes("sync") ||
    normalized.startsWith("sharing:") ||
    normalized.startsWith("shared:") ||
    normalized.startsWith("supabase:")
  );
}

function failureText(text: string) {
  const lower = text.toLowerCase();
  const marker = [
    "sem permissao",
    "permission denied",
    "permission",
    "foreign key",
    "violates",
    "failed",
    "error invoking",
    "error:",
    "erro ao",
    "erro:",
    "rejected",
  ].find((item) => lower.includes(item));

  return marker ? text.slice(0, 500) : null;
}

function resultFailure(result: unknown): string | null {
  if (typeof result === "string") return failureText(result);
  if (!result || typeof result !== "object") return null;

  const data = result as Record<string, unknown>;
  if (data.ok === false || data.success === false) {
    return asMessage(data.error ?? data.message ?? "Falha de sincronizacao.");
  }

  try {
    return failureText(JSON.stringify(data).slice(0, 1200));
  } catch {
    return null;
  }
}

export function installConsultationModeGuard() {
  if (installed) return;

  installed = true;

  const originalHandle = ipcMain.handle.bind(ipcMain);
  const guardedHandle = ((channel: string, listener: InvokeListener) => {
    originalHandle(channel, async (event, ...args) => {
      const state = getState();

      if (state.active && isWriteLike(channel)) {
        throw new Error(
          `Modo consulta ativo. ${
            state.reason ?? "Sincronize este PC antes de lancar ou alterar dados."
          }`,
        );
      }

      try {
        const result = await Promise.resolve(listener(event, ...args));

        if (isSyncChannel(channel)) {
          const failure = resultFailure(result);
          if (failure) markSyncFailure(failure);
          else markSyncSuccess();
        }

        return result;
      } catch (error) {
        if (isSyncChannel(channel)) markSyncFailure(asMessage(error));
        throw error;
      }
    });
  }) as typeof ipcMain.handle;

  (ipcMain as unknown as { handle: typeof ipcMain.handle }).handle = guardedHandle;

  originalHandle("consultationMode:getState", () => getState());
}

installConsultationModeGuard();
