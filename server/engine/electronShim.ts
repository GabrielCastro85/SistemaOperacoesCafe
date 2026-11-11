import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
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
    // "Escolher pasta": o navegador envia os arquivos da pasta; aqui eles sao
    // juntados numa pasta temporaria e o app recebe essa pasta, como no Windows.
    if (options.properties?.includes("openDirectory")) {
      if (!paths.length) return { canceled: true, filePaths: [] };
      // Junto dos arquivos enviados (que ficam guardados), e nao na pasta
      // temporaria da chamada: os passos seguintes da importacao leem daqui.
      const folder = join(dirname(dirname(paths[0])), `pasta-${randomUUID()}`);
      mkdirSync(folder, { recursive: true });
      paths.forEach((path, index) => {
        const target = join(folder, safeName(basename(path), `arquivo-${index}`));
        copyFileSync(path, existsSync(target) ? join(folder, `${index}-${safeName(basename(path), "arquivo")}`) : target);
      });
      return { canceled: false, filePaths: [folder] };
    }
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
    send: () => undefined,
    // A imagem do Comparativo e desenhada num canvas da janela oculta do app.
    // Aqui nao ha janela: devolve o proprio SVG; o navegador converte em PNG
    // ao baixar ou copiar (web/electronRenderer.ts).
    executeJavaScript: async (code: string): Promise<string> => {
      const match = /image\.src\s*=\s*("(?:[^"\\]|\\.)*")/.exec(code);
      if (!match) throw new Error("Recurso de janela indisponivel no site.");
      const source = JSON.parse(match[1]) as string;
      const comma = source.indexOf(",");
      const svg = /;base64,/.test(source.slice(0, comma + 1)) ? Buffer.from(source.slice(comma + 1), "base64").toString("utf8") : decodeURIComponent(source.slice(comma + 1));
      return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
    }
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

// Chave do armazenamento seguro (senhas do central de cada usuario). Fica num
// arquivo na pasta de dados do motor (volume da Railway): sem isso, a cada
// atualizacao do servidor a chave mudava e as senhas guardadas deixavam de abrir.
// ENGINE_STORAGE_KEY (base64, 32 bytes), se definida, tem prioridade.
let cachedKey: Buffer | null = null;
function storageKey(): Buffer {
  if (cachedKey) return cachedKey;
  const fromEnv = Buffer.from(process.env.ENGINE_STORAGE_KEY ?? "", "base64");
  if (fromEnv.length === 32) return (cachedKey = fromEnv);
  const directory = process.env.ENGINE_DATA_DIR;
  if (directory) {
    const file = join(directory, ".storage-key");
    const readKey = (): Buffer | null => {
      if (!existsSync(file)) return null;
      const value = Buffer.from(readFileSync(file, "utf8").trim(), "base64");
      return value.length === 32 ? value : null;
    };
    try {
      const existing = readKey();
      if (existing) return (cachedKey = existing);
      mkdirSync(directory, { recursive: true });
      const created = randomBytes(32);
      writeFileSync(file, created.toString("base64"), { encoding: "utf8", mode: 0o600, flag: "wx" });
      return (cachedKey = created);
    } catch {
      const existing = readKey();
      if (existing) return (cachedKey = existing);
    }
  }
  return (cachedKey = randomBytes(32));
}
export const safeStorage = {
  isEncryptionAvailable: (): boolean => true,
  encryptString(value: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", storageKey(), iv);
    const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]);
  },
  decryptString(value: Buffer): string {
    const decipher = createDecipheriv("aes-256-gcm", storageKey(), value.subarray(0, 12));
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
