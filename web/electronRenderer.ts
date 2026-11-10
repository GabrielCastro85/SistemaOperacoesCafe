// Substituto do modulo "electron" no navegador. O preload do app
// (electron/preload/index.ts) roda igual: cada ipcRenderer.invoke vira uma
// chamada ao motor do app no servidor (POST /v1/app/rpc). O que o app faria no
// Windows volta como download, impressao, area de transferencia ou pedido de
// arquivo.

const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? "https://mindful-peace-production.up.railway.app").replace(/\/$/, "");
const SESSION_KEY = "operacoes-cafe-app-session";

function sessionId(): string {
  let current = "";
  try { current = localStorage.getItem(SESSION_KEY) ?? ""; } catch { /* navegador sem armazenamento */ }
  if (/^[a-f0-9]{64}$/.test(current)) return current;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  current = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  try { localStorage.setItem(SESSION_KEY, current); } catch { /* sessao so desta aba */ }
  return current;
}

interface EngineResponse {
  ok: boolean;
  result?: unknown;
  error?: { message: string; code?: string };
  needsUpload?: { title?: string; filters?: Array<{ name: string; extensions: string[] }>; properties?: string[] };
  downloads: Array<{ name: string; base64: string }>;
  prints: string[];
  clipboardText: string | null;
  clipboardImagePng: string | null;
}

class EngineError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.__engineBytes === "string" && Object.keys(record).length === 1) return base64ToBytes(record.__engineBytes);
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, decode(item)]));
  }
  return value;
}

function mimeFor(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return ({ pdf: "application/pdf", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", png: "image/png", svg: "image/svg+xml", csv: "text/csv", xml: "application/xml", json: "application/json", zip: "application/zip", html: "text/html" } as Record<string, string>)[extension] ?? "application/octet-stream";
}

// PDF e imagem abrem numa aba (como o app abria no Windows); o resto baixa.
function deliver(download: { name: string; base64: string }): void {
  const blob = new Blob([base64ToBytes(download.base64) as BlobPart], { type: mimeFor(download.name) });
  const url = URL.createObjectURL(blob);
  const viewable = /\.(pdf|png|jpe?g|svg)$/i.test(download.name);
  const opened = viewable ? window.open(url, "_blank", "noopener") : null;
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = download.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

function printHtml(html: string): void {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.appendChild(frame);
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };
  frame.srcdoc = html;
}

async function fileToBase64(file: Blob): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < buffer.length; index += 0x8000) binary += String.fromCharCode(...buffer.subarray(index, index + 0x8000));
  return btoa(binary);
}

async function uploadFile(file: File): Promise<{ id: string; path: string }> {
  const response = await fetch(`${API_URL}/v1/app/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-app-session": sessionId() },
    body: JSON.stringify({ name: file.name, base64: await fileToBase64(file) })
  });
  if (!response.ok) throw new EngineError((await response.json().catch(() => null) as { message?: string } | null)?.message ?? "Falha ao enviar o arquivo.");
  return response.json() as Promise<{ id: string; path: string }>;
}

// Abre o seletor de arquivos do navegador no lugar do dialogo do Windows.
function pickFiles(dialog: NonNullable<EngineResponse["needsUpload"]>): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    const properties = dialog.properties ?? [];
    if (properties.includes("multiSelections")) input.multiple = true;
    if (properties.includes("openDirectory")) input.setAttribute("webkitdirectory", "");
    const extensions = (dialog.filters ?? []).flatMap((filter) => filter.extensions).filter((extension) => extension && extension !== "*");
    if (extensions.length) input.accept = extensions.map((extension) => `.${extension}`).join(",");
    input.style.display = "none";
    let settled = false;
    const finish = (files: File[]) => { if (settled) return; settled = true; input.remove(); resolve(files); };
    input.addEventListener("change", () => finish([...(input.files ?? [])]));
    input.addEventListener("cancel", () => finish([]));
    document.body.appendChild(input);
    input.click();
  });
}

// Arquivos arrastados para a tela: o app pega o caminho do disco; o site envia o arquivo antes da chamada.
const droppedFiles = new Map<string, File>();
async function uploadDroppedReferences(value: unknown): Promise<unknown> {
  if (typeof value === "string" && value.startsWith("web-file:")) {
    const file = droppedFiles.get(value);
    if (!file) throw new EngineError("Arquivo arrastado nao encontrado. Arraste de novo.");
    return (await uploadFile(file)).path;
  }
  if (Array.isArray(value)) return Promise.all(value.map(uploadDroppedReferences));
  if (value && typeof value === "object" && !(value instanceof Uint8Array)) {
    const entries = await Promise.all(Object.entries(value as Record<string, unknown>).map(async ([key, item]) => [key, await uploadDroppedReferences(item)] as const));
    return Object.fromEntries(entries);
  }
  return value;
}

function encodePayload(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    let binary = "";
    for (let index = 0; index < value.length; index += 0x8000) binary += String.fromCharCode(...value.subarray(index, index + 0x8000));
    return { __engineBytes: btoa(binary) };
  }
  if (Array.isArray(value)) return value.map(encodePayload);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, encodePayload(item)]));
  return value;
}

// Consultas (listar, buscar, ver...) podem ser repetidas com seguranca se a conexao cair.
// Mesma regra de isLikelyDataMutation em electron/main/ipc/handlers.ts.
function isReadOnly(channel: string): boolean {
  const action = channel.slice(channel.indexOf(":") + 1);
  return /^(list|get|preview|select|inspect|validate|calculate|find|export|print|open|bytes|reveal|lookup|ask|compare|history|progress|verify|suggest|alerts|indicators|monthlyTotals|summary|vulpeDev)|Summary$/.test(action)
    && !/^(select)/.test(action);
}

const CONNECTION_LOST = "A conexão com o servidor caiu antes da resposta. A operação pode ter sido concluída: atualize a tela e confira antes de repetir.";

async function postRpc(channel: string, body: string): Promise<EngineResponse> {
  const retries = isReadOnly(channel) ? 2 : 0;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(`${API_URL}/v1/app/rpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-session": sessionId() },
        body
      });
      const parsed = await response.json().catch(() => null) as EngineResponse | null;
      if (parsed) return parsed;
      if (attempt >= retries) throw new EngineError(response.status >= 500 ? "O servidor está reiniciando. Aguarde alguns segundos e tente de novo." : `Servidor indisponível (${response.status}).`);
    } catch (error) {
      if (error instanceof EngineError) throw error;
      if (attempt >= retries) throw new EngineError(isReadOnly(channel) ? "Sem conexão com o servidor. Confira a internet e tente de novo." : CONNECTION_LOST);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
}

// Agrupamento: consultas pedidas ao mesmo tempo (ex.: os CNPJs de cada cliente,
// que as telas buscam um por um) vao num pedido so ao servidor. Cada ida e volta
// custa ~0,3 s; 90 consultas separadas viravam quase meio minuto de fila.
const BATCH_LIMIT = 150;
const NOT_BATCHED = /^(export|print|open|bytes|reveal)/;
// Consultas periodicas e leves vao sozinhas, para nao esperar atras de uma consulta pesada do mesmo lote.
const POLLING_CHANNELS = new Set(["app:getDiagnostics", "app:getUpdateStatus", "xmlFiles:vulpeDevStatus"]);
let batchSupported = true;
interface QueuedCall { channel: string; payload: unknown; resolve: (body: EngineResponse) => void; reject: (error: unknown) => void }
let queued: QueuedCall[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function isBatchable(channel: string): boolean {
  const action = channel.slice(channel.indexOf(":") + 1);
  return batchSupported && isReadOnly(channel) && !NOT_BATCHED.test(action) && !POLLING_CHANNELS.has(channel);
}

async function sendBatch(calls: QueuedCall[]): Promise<void> {
  if (calls.length === 1 || !batchSupported) {
    await Promise.all(calls.map((call) => postRpc(call.channel, JSON.stringify({ channel: call.channel, payload: call.payload, uploadIds: null })).then(call.resolve, call.reject)));
    return;
  }
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(`${API_URL}/v1/app/rpc-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-session": sessionId() },
        body: JSON.stringify({ calls: calls.map((call) => ({ channel: call.channel, payload: call.payload })) })
      });
      if (response.status === 404) {
        // Servidor ainda sem a rota de lote: volta a mandar um por um.
        batchSupported = false;
        await sendBatch(calls);
        return;
      }
      const parsed = await response.json().catch(() => null) as { results?: EngineResponse[] } | null;
      if (parsed?.results && parsed.results.length === calls.length) {
        calls.forEach((call, index) => call.resolve(parsed.results![index]));
        return;
      }
      if (attempt >= 2) throw new EngineError(response.status >= 500 ? "O servidor está reiniciando. Aguarde alguns segundos e tente de novo." : `Servidor indisponível (${response.status}).`);
    } catch (error) {
      if (attempt >= 2) {
        const failure = error instanceof EngineError ? error : new EngineError("Sem conexão com o servidor. Confira a internet e tente de novo.");
        calls.forEach((call) => call.reject(failure));
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
}

function flushQueued(): void {
  flushTimer = null;
  const calls = queued;
  queued = [];
  for (let index = 0; index < calls.length; index += BATCH_LIMIT) void sendBatch(calls.slice(index, index + BATCH_LIMIT));
}

function postQueued(channel: string, payload: unknown): Promise<EngineResponse> {
  return new Promise((resolve, reject) => {
    queued.push({ channel, payload, resolve, reject });
    // Espera um instante para juntar as consultas que a tela dispara em sequencia.
    if (!flushTimer) flushTimer = setTimeout(flushQueued, 8);
  });
}

async function invoke(channel: string, payload?: unknown): Promise<unknown> {
  const prepared = encodePayload(await uploadDroppedReferences(payload));
  let uploadIds: string[] | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const body = attempt === 0 && isBatchable(channel)
      ? await postQueued(channel, prepared)
      : await postRpc(channel, JSON.stringify({ channel, payload: prepared, uploadIds }));
    body.downloads?.forEach(deliver);
    body.prints?.forEach(printHtml);
    if (body.clipboardText !== null && body.clipboardText !== undefined) void navigator.clipboard?.writeText(body.clipboardText).catch(() => undefined);
    if (body.clipboardImagePng) {
      const blob = new Blob([base64ToBytes(body.clipboardImagePng) as BlobPart], { type: "image/png" });
      void navigator.clipboard?.write?.([new ClipboardItem({ "image/png": blob })]).catch(() => undefined);
    }
    if (body.needsUpload) {
      const files = await pickFiles(body.needsUpload);
      uploadIds = (await Promise.all(files.map(uploadFile))).map((item) => item.id);
      continue;
    }
    if (!body.ok) throw new EngineError(body.error?.message ?? "Falha no servidor.", body.error?.code);
    return decode(body.result);
  }
  throw new EngineError("Nao foi possivel concluir o envio do arquivo.");
}

export const ipcRenderer = {
  invoke: (channel: string, payload?: unknown) => invoke(channel, payload),
  on: () => ipcRenderer,
  removeListener: () => ipcRenderer,
  send: () => undefined
};

export const contextBridge = {
  exposeInMainWorld(key: string, value: unknown): void { (window as unknown as Record<string, unknown>)[key] = value; }
};

export const webUtils = {
  getPathForFile(file: File): string {
    const token = `web-file:${crypto.randomUUID()}`;
    droppedFiles.set(token, file);
    return token;
  }
};

export type IpcRendererEvent = unknown;
export default { ipcRenderer, contextBridge, webUtils };
