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
      device: { installationId: `web-${deviceId()}`, displayName: "Consulta Web", platform: navigator.platform, appVersion: "web" }
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

export function queryString(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
  return params.toString();
}
