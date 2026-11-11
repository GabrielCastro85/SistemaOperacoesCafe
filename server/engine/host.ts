import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { initializeDatabase } from "../../electron/main/database/database.js";
import { registerIpcHandlers } from "../../electron/main/ipc/handlers.js";
import { AppRepository } from "../../electron/main/services/appRepository.js";
import { CentralSyncService } from "../../electron/main/services/centralSyncService.js";
import { ensureAppDirectories, resolveAppDirectories } from "../../electron/main/services/paths.js";
import { AuthError, AuthService } from "../../electron/main/services/security.js";
import { IPC_CHANNELS } from "../../src/shared/ipc/channels.js";
import { NeedsUploadError, requestContext, type EngineRequestContext } from "./requestContext.js";

// Motor do app rodando no servidor: o mesmo AppRepository, os mesmos handlers
// de IPC e a mesma sincronizacao central de um PC. O site chama os canais por
// HTTP (server/src/appEngineRoutes.ts) e usa as mesmas telas do app.

type Listener = (event: unknown, payload?: unknown) => unknown;
export interface EngineResult {
  ok: boolean;
  result?: unknown;
  error?: { message: string; code?: string };
  needsUpload?: NeedsUploadError["dialog"];
  downloads: Array<{ name: string; base64: string }>;
  prints: string[];
  clipboardText: string | null;
  clipboardImagePng: string | null;
}

// Canais que nao fazem sentido (ou seriam perigosos) num servidor compartilhado.
const BLOCKED_CHANNELS = new Set<string>([
  IPC_CHANNELS.authBootstrapAdmin,
  IPC_CHANNELS.quitAndInstallUpdate,
  ...Object.entries(IPC_CHANNELS).filter(([name]) => /^(restore|betaReset|createBackup|deleteBackup|executeRestore|prepareRestore)/i.test(name)).map(([, channel]) => channel)
]);

// Valores binarios nao passam por JSON: vao como base64 marcado.
export function encodeForJson(value: unknown): unknown {
  if (value instanceof Uint8Array) return { __engineBytes: Buffer.from(value).toString("base64") };
  if (Array.isArray(value)) return value.map(encodeForJson);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, encodeForJson(item)]));
  }
  return value;
}

// Inverso de encodeForJson para o que o navegador envia (ex.: PDF assinado).
export function decodeFromJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeFromJson);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.__engineBytes === "string" && Object.keys(record).length === 1) return new Uint8Array(Buffer.from(record.__engineBytes, "base64"));
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, decodeFromJson(item)]));
  }
  return value;
}

export function createEngine(options: { dataDir: string; version: string }) {
  const directories = resolveAppDirectories(options.dataDir);
  ensureAppDirectories(directories);
  const uploadsDir = join(options.dataDir, "web-uploads");
  const tempRoot = join(options.dataDir, "web-temp");
  mkdirSync(uploadsDir, { recursive: true });
  mkdirSync(tempRoot, { recursive: true });
  const db = initializeDatabase(directories);
  const context = { version: options.version, directories, db };
  const repository = new AppRepository(db, directories);
  const centralSync = new CentralSyncService(db, options.version);
  // Telas como o Resumo, o Comparativo e o Assistente esperam uma sincronizacao
  // completa com o central antes de responder. Num PC isso e o certo; aqui o
  // motor ja sincroniza sozinho a cada 30 s, e essa espera (10-30 s) rodava
  // dentro da fila unica de chamadas, travando o site de todos. Com uma
  // sincronizacao bem-sucedida ha menos de 2 min, responde na hora com o que ja
  // tem e sincroniza em segundo plano; sem isso (motor recem-iniciado), espera.
  const synchronizeAndWait = centralSync.synchronize.bind(centralSync);
  let backgroundSync: Promise<void> | null = null;
  centralSync.synchronize = async (): Promise<void> => {
    const row = db.prepare("SELECT last_success_at AS at FROM central_sync_state WHERE singleton = 1").get() as { at: string | null } | undefined;
    const fresh = Boolean(row?.at) && Date.now() - Date.parse(String(row?.at)) < 120_000;
    if (!fresh) return synchronizeAndWait();
    backgroundSync ??= synchronizeAndWait().catch(() => undefined).finally(() => { backgroundSync = null; });
  };
  const auth = new AuthService(db);
  const handlers = new Map<string, Listener>();
  registerIpcHandlers({ handle: (channel: string, listener: Listener) => handlers.set(channel, listener) } as never, context, repository, centralSync, { auth });

  // No servidor nao existe "criar o primeiro administrador": quem entra e do
  // servidor central e o login do app provisiona o usuario local.
  handlers.set(IPC_CHANNELS.authNeedsBootstrap, () => false);
  // O servidor nao e um computador para autorizar: cada usuario entra com a propria senha do central.
  handlers.set(IPC_CHANNELS.authCentralConnectionStatus, () => ({ configured: true }));

  // Login e empresa ativa de cada navegador, gravados na pasta de dados (volume
  // da Railway): numa atualizacao do servidor ninguem precisa entrar de novo.
  // As sessoes em si ficam no banco do motor e continuam expirando normalmente.
  const sessionsFile = join(options.dataDir, "web-sessions.json");
  type Scope = { organizationId: string | null; legalEntityId: string | null };
  const saved = ((): { sessions: Record<string, string>; scopes: Record<string, Scope> } => {
    try { return JSON.parse(readFileSync(sessionsFile, "utf8")) as { sessions: Record<string, string>; scopes: Record<string, Scope> }; } catch { return { sessions: {}, scopes: {} }; }
  })();
  const sessions = new Map<string, string | null>(Object.entries(saved.sessions ?? {}));
  // Empresa ativa de cada navegador. O app guarda uma so por computador
  // (installation_profiles); o motor troca antes de cada chamada.
  const activeScopes = new Map<string, Scope>(Object.entries(saved.scopes ?? {}));
  let savedSnapshot = "";
  const persistSessions = (): void => {
    const sessionEntries = [...sessions.entries()].filter((entry): entry is [string, string] => Boolean(entry[1]));
    const snapshot = JSON.stringify({ sessions: Object.fromEntries(sessionEntries), scopes: Object.fromEntries([...activeScopes.entries()].filter(([id]) => sessions.get(id))) });
    if (snapshot === savedSnapshot) return;
    try {
      writeFileSync(`${sessionsFile}.tmp`, snapshot, { encoding: "utf8", mode: 0o600 });
      renameSync(`${sessionsFile}.tmp`, sessionsFile);
      savedSnapshot = snapshot;
    } catch { /* sem disco gravavel: segue so em memoria */ }
  };
  const readScope = () => db.prepare("SELECT id, default_organization_id AS organizationId, default_legal_entity_id AS legalEntityId FROM installation_profiles ORDER BY created_at DESC LIMIT 1").get() as { id: string; organizationId: string | null; legalEntityId: string | null } | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const allowedRoots = [resolve(uploadsDir), resolve(tempRoot), resolve(directories.documentsDir)];

  // Caminhos vindos do navegador so podem apontar para arquivos enviados pelo site ou gerados pelo motor.
  // Registros do app (ex.: a nota inteira ao trocar o responsavel) trazem de volta
  // campos gravados por um PC, como xmlFilePath = "C:\\Users\\...". Esses campos sao
  // so dados guardados: viram null em vez de barrar a acao. Qualquer outro caminho
  // fora das pastas do motor continua bloqueado.
  const isAllowedPath = (value: string): boolean => {
    const looksLikePath = /^([a-zA-Z]:[\\/]|\/)/.test(value) && !/^\/v1\//.test(value);
    return !looksLikePath || allowedRoots.some((root) => resolve(value).startsWith(root + sep));
  };
  const sanitizePaths = (value: unknown, key: string | null = null): unknown => {
    if (typeof value === "string") {
      if (isAllowedPath(value)) return value;
      if (key && /path$/i.test(key)) return null;
      throw new AuthError("Caminho de arquivo nao permitido no site.", "PATH_NOT_ALLOWED");
    }
    if (Array.isArray(value)) return value.map((item) => sanitizePaths(item));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([name, item]) => [name, sanitizePaths(item, name)]));
    }
    return value;
  };

  const run = async (webSessionId: string, channel: string, payload: unknown, uploadIds: string[] | null): Promise<EngineResult> => {
    const handler = handlers.get(channel);
    const context: EngineRequestContext = {
      downloads: [], savedPaths: [], prints: [], clipboardText: null, clipboardImagePng: null,
      uploadedPaths: uploadIds === null ? null : uploadIds.map((id) => uploadPath(id)),
      tempDir: join(tempRoot, randomUUID())
    };
    mkdirSync(context.tempDir, { recursive: true });
    auth.useSession(sessions.get(webSessionId) ?? null);
    const profile = readScope();
    const scope = activeScopes.get(webSessionId);
    if (profile && scope && (scope.organizationId !== profile.organizationId || scope.legalEntityId !== profile.legalEntityId)) {
      db.prepare("UPDATE installation_profiles SET default_organization_id = ?, default_legal_entity_id = ? WHERE id = ?").run(scope.organizationId, scope.legalEntityId, profile.id);
    }
    try {
      if (!handler || BLOCKED_CHANNELS.has(channel)) throw new AuthError("Esta funcao nao esta disponivel no site.", "NOT_AVAILABLE");
      const safePayload = sanitizePaths(payload);
      const result = await requestContext.run(context, () => handler({ sender: null }, decodeFromJson(safePayload)));
      for (const path of context.savedPaths) {
        if (existsSync(path) && !context.downloads.some((item) => item.path === path)) context.downloads.push({ name: basename(path), path });
      }
      return {
        ok: true, result: encodeForJson(result),
        downloads: context.downloads.map((item) => ({ name: item.name, base64: readFileSync(item.path).toString("base64") })),
        prints: context.prints, clipboardText: context.clipboardText,
        clipboardImagePng: context.clipboardImagePng ? context.clipboardImagePng.toString("base64") : null
      };
    } catch (error) {
      if (error instanceof NeedsUploadError) return { ok: false, needsUpload: error.dialog, downloads: [], prints: [], clipboardText: null, clipboardImagePng: null };
      const message = error instanceof Error ? error.message : String(error);
      const code = error instanceof AuthError ? error.code : undefined;
      return { ok: false, error: { message, code }, downloads: [], prints: [], clipboardText: null, clipboardImagePng: null };
    } finally {
      sessions.set(webSessionId, auth.getCurrentSessionId());
      const after = readScope();
      if (after) activeScopes.set(webSessionId, { organizationId: after.organizationId, legalEntityId: after.legalEntityId });
      auth.useSession(null);
      persistSessions();
      rmSync(context.tempDir, { recursive: true, force: true });
    }
  };

  const uploadPath = (id: string): string => {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new AuthError("Arquivo enviado invalido.", "INVALID_UPLOAD");
    const directory = join(uploadsDir, id);
    const name = existsSync(join(directory, "name.txt")) ? readFileSync(join(directory, "name.txt"), "utf8") : "";
    if (!name) throw new AuthError("Arquivo enviado nao encontrado. Envie de novo.", "INVALID_UPLOAD");
    return join(directory, name);
  };

  return {
    directories,
    // Uma chamada por vez: o motor do app foi feito para um usuario por vez.
    invoke(webSessionId: string, channel: string, payload: unknown, uploadIds: string[] | null = null): Promise<EngineResult> {
      const next = queue.then(() => run(webSessionId, channel, payload, uploadIds));
      queue = next.catch(() => undefined);
      return next;
    },
    saveUpload(name: string, content: Buffer): { id: string; path: string; name: string } {
      const id = randomUUID();
      const safe = basename(name.replace(/\\/g, "/")).replace(/[^\p{Letter}\p{Number} ._()-]+/gu, "-").trim() || "arquivo";
      const directory = join(uploadsDir, id);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, safe), content);
      writeFileSync(join(directory, "name.txt"), safe);
      return { id, path: join(directory, safe), name: safe };
    },
    channels(): string[] { return [...handlers.keys()]; },
    sync: centralSync,
    db
  };
}

export type Engine = ReturnType<typeof createEngine>;
