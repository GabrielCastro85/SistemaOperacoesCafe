const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "")
  ?? "https://mindful-peace-production.up.railway.app";
const TOKEN_KEY = "operacoes-cafe-viewer-token";
const DEVICE_KEY = "operacoes-cafe-viewer-device";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export function hasStoredSession(): boolean {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function deviceId(): string {
  const current = localStorage.getItem(DEVICE_KEY);
  if (current) return current;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, created);
  return created;
}

async function responseError(response: Response): Promise<ApiError> {
  let message = "Falha ao acessar o servidor.";
  try {
    const body = await response.json() as { message?: string };
    if (body.message) message = body.message;
  } catch { /* resposta sem JSON */ }
  return new ApiError(message, response.status);
}

export async function login(username: string, password: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/session/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      device: { installationId: `web-${deviceId()}`, displayName: "Operações Café Web", platform: navigator.platform, appVersion: "web" }
    })
  });
  if (!response.ok) throw await responseError(response);
  const body = await response.json() as { token: string };
  localStorage.setItem(TOKEN_KEY, body.token);
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw await responseError(response);
  }
  return response.json() as Promise<T>;
}

export async function logout(): Promise<void> {
  try { await apiJson("/v1/session/logout", { method: "POST" }); } finally { clearSession(); }
}

export async function downloadChargePdf(chargeId: string, suggestedName: string): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}/v1/viewer/charges/${encodeURIComponent(chargeId)}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) throw await responseError(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadConfirmationPdf(confirmationId: string, suggestedName: string): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}/v1/manage/confirmations/${encodeURIComponent(confirmationId)}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) throw await responseError(response);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function queryString(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
  return params.toString();
}

// Baixa um arquivo gerado pela API (GET ou POST com JSON).
export async function downloadApiFile(path: string, suggestedName: string, body?: unknown): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_URL}${path}`, body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) throw await responseError(response);
  saveBlob(await response.blob(), suggestedName);
}

// Busca HTML pronto para imprimir (ex.: controle de cobrancas).
export async function fetchApiText(path: string, body: unknown): Promise<string> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
  });
  if (!response.ok) throw await responseError(response);
  return response.text();
}

export function saveBlob(blob: Blob, suggestedName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
