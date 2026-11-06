import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const auth = new AuthService(db);
  const handlers = new Map<string, Listener>();
  registerIpcHandlers({ handle: (channel: string, listener: Listener) => handlers.set(channel, listener) } as never, context, repository, centralSync, { auth });

  // No servidor nao existe "criar o primeiro administrador": quem entra e do
  // servidor central e o login do app provisiona o usuario local.
  handlers.set(IPC_CHANNELS.authNeedsBootstrap, () => false);

  const sessions = new Map<string, string | null>();
  // Empresa ativa de cada navegador. O app guarda uma so por computador
  // (installation_profiles); o motor troca antes de cada chamada.
  const activeScopes = new Map<string, { organizationId: string | null; legalEntityId: string | null }>();
  const readScope = () => db.prepare("SELECT id, default_organization_id AS organizationId, default_legal_entity_id AS legalEntityId FROM installation_profiles ORDER BY created_at DESC LIMIT 1").get() as { id: string; organizationId: string | null; legalEntityId: string | null } | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const allowedRoots = [resolve(uploadsDir), resolve(tempRoot), resolve(directories.documentsDir)];

  // Caminhos vindos do navegador so podem apontar para arquivos enviados pelo site ou gerados pelo motor.
  const assertSafePaths = (value: unknown): void => {
    if (typeof value === "string") {
      const looksLikePath = /^([a-zA-Z]:[\\/]|\/)/.test(value) && !/^\/v1\//.test(value);
      if (looksLikePath && !allowedRoots.some((root) => resolve(value).startsWith(root + sep))) {
        throw new AuthError("Caminho de arquivo nao permitido no site.", "PATH_NOT_ALLOWED");
      }
      return;
    }
    if (Array.isArray(value)) value.forEach(assertSafePaths);
    else if (value && typeof value === "object") Object.values(value as Record<string, unknown>).forEach(assertSafePaths);
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
      assertSafePaths(payload);
      const result = await requestContext.run(context, () => handler({ sender: null }, decodeFromJson(payload)));
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
