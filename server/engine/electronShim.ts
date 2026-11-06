import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { currentRequest, NeedsUploadError } from "./requestContext.js";

// Substituto do modulo "electron" quando o motor do app roda no servidor.
// Cada recurso do Windows vira algo que o navegador consegue fazer:
// salvar/abrir arquivo -> download, escolher arquivo -> upload, imprimir ->
// pagina para imprimir, copiar -> area de transferencia do navegador.

type DialogOptions = { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }>; properties?: string[] };

function safeName(value: string | undefined, fallback: string): string {
  const name = basename(String(value ?? "").replace(/\\/g, "/")).replace(/[^\p{Letter}\p{Number} ._()-]+/gu, "-").trim();
  return name || fallback;
}

function addDownload(path: string): void {
  if (!existsSync(path) || !statSync(path).isFile()) return;
  const context = currentRequest();
  if (!context.downloads.some((item) => item.path === path)) context.downloads.push({ name: basename(path), path });
}

export const dialog = {
  async showSaveDialog(...args: unknown[]): Promise<{ canceled: boolean; filePath?: string }> {
    const options = (args.find((value) => value && typeof value === "object" && !("webContents" in (value as object))) ?? {}) as DialogOptions;
    const extension = options.filters?.[0]?.extensions?.[0];
    const fallback = `arquivo${extension && extension !== "*" ? `.${extension}` : ""}`;
    const directory = join(currentRequest().tempDir, randomUUID());
    mkdirSync(directory, { recursive: true });
    const filePath = join(directory, safeName(options.defaultPath, fallback));
    currentRequest().savedPaths.push(filePath);
    return { canceled: false, filePath };
  },
  async showOpenDialog(...args: unknown[]): Promise<{ canceled: boolean; filePaths: string[] }> {
    const options = (args.find((value) => value && typeof value === "object" && !("webContents" in (value as object))) ?? {}) as DialogOptions;
    const context = currentRequest();
    if (context.uploadedPaths === null) throw new NeedsUploadError({ title: options.title, filters: options.filters, properties: options.properties });
    const paths = context.uploadedPaths;
    context.uploadedPaths = null;
    return { canceled: paths.length === 0, filePaths: paths };
  },
  async showMessageBox(): Promise<{ response: number }> { return { response: 0 }; },
  showErrorBox(): void { /* sem janela no servidor */ }
};

export const shell = {
  async openPath(path: string): Promise<string> { addDownload(path); return ""; },
  showItemInFolder(path: string): void { addDownload(path); },
  async openExternal(): Promise<void> { /* o navegador abre links sozinho */ }
};

export const nativeImage = {
  createFromDataURL(dataUrl: string) {
    const match = /^data:[^;]+;base64,(.*)$/.exec(dataUrl);
    const bytes = match ? Buffer.from(match[1], "base64") : Buffer.alloc(0);
    return { toPNG: () => bytes, isEmpty: () => bytes.length === 0, getSize: () => ({ width: 0, height: 0 }) };
  },
  createEmpty() { return nativeImage.createFromDataURL(""); }
};

export const clipboard = {
  writeText(value: string): void { currentRequest().clipboardText = value; },
  writeImage(image: { toPNG(): Buffer }): void { currentRequest().clipboardImagePng = image.toPNG(); }
};

// Janela invisivel usada pelo app para imprimir HTML. No site a pagina vai para o navegador imprimir.
export class BrowserWindow {
  private html = "";
  readonly webContents = {
    print: (_options: unknown, callback?: (success: boolean, reason: string) => void) => {
      currentRequest().prints.push(this.html);
      callback?.(true, "");
    },
    send: () => undefined
  };
  constructor(_options?: unknown) {}
  static fromWebContents(): BrowserWindow | null { return null; }
  static getAllWindows(): BrowserWindow[] { return []; }
  async loadURL(url: string): Promise<void> {
    const prefix = "data:text/html;charset=utf-8,";
    this.html = url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : url;
  }
  async capturePage(): Promise<never> { throw new Error("Imagem gerada pelo navegador no site."); }
  isDestroyed(): boolean { return false; }
  destroy(): void { /* nada */ }
  close(): void { /* nada */ }
}

// Credenciais do servidor central guardadas so enquanto o processo vive.
const key = randomBytes(32);
export const safeStorage = {
  isEncryptionAvailable: (): boolean => true,
  encryptString(value: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]);
  },
  decryptString(value: Buffer): string {
    const decipher = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12));
    decipher.setAuthTag(value.subarray(12, 28));
    return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8");
  }
};

export const app = {
  getVersion: (): string => process.env.ENGINE_APP_VERSION ?? "web",
  getPath: (): string => process.env.ENGINE_DATA_DIR ?? "/tmp/operacoes-cafe-engine",
  getAppPath: (): string => process.cwd(),
  isPackaged: false,
  on: () => undefined,
  quit: () => undefined
};

export const ipcMain = { handle: () => undefined };
export const net = { fetch: (...args: Parameters<typeof fetch>) => fetch(...args) };
export const protocol = { handle: () => undefined, registerSchemesAsPrivileged: () => undefined };
export const contextBridge = { exposeInMainWorld: () => undefined };
export const webUtils = { getPathForFile: () => "" };
export default { app, BrowserWindow, clipboard, dialog, shell, nativeImage, safeStorage, ipcMain, net, protocol };
export type IpcMain = { handle(channel: string, listener: (event: unknown, payload?: unknown) => unknown): void };
export type IpcMainInvokeEvent = { sender: unknown };
export type NativeImage = ReturnType<typeof nativeImage.createFromDataURL>;
export type IpcRendererEvent = unknown;
