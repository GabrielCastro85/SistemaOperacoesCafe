const LOGIN_IPC_PREFIX = /^Error invoking remote method ['"]auth:login['"]:\s*/i;
const ERROR_PREFIX = /^(?:Error|TypeError):\s*/i;
const CENTRAL_PREFIX = /^Servidor central \(\d{3}\):\s*/i;

export function loginErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");
  const normalized = rawMessage
    .replace(LOGIN_IPC_PREFIX, "")
    .replace(ERROR_PREFIX, "")
    .trim();

  if (/\b401\b|usu[aá]rio ou senha inv[aá]lidos|invalid[_ ]credentials/i.test(normalized)) {
    return "Usuário ou senha incorretos.";
  }
  if (/usu[aá]rio.*bloquead|user[_ ]locked/i.test(normalized)) {
    return "Usuário bloqueado temporariamente. Tente novamente mais tarde.";
  }
  if (/fetch failed|failed to fetch|network|econnrefused|enotfound|etimedout|timeout/i.test(normalized)) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  if (/\b429\b|muitas tentativas|too many requests/i.test(normalized)) {
    return "Muitas tentativas de acesso. Aguarde um pouco e tente novamente.";
  }
  if (/servidor central \(5\d\d\)|application failed to respond|bad gateway|service unavailable/i.test(normalized)) {
    return "O servidor está temporariamente indisponível. Tente novamente em alguns instantes.";
  }
  if (/n[aã]o foi poss[ií]vel carregar os dados do servidor central|falha na sincroniza[cç][aã]o/i.test(normalized)) {
    return "Não foi possível sincronizar os dados. Tente entrar novamente.";
  }

  const readableMessage = normalized
    .replace(CENTRAL_PREFIX, "")
    .split(/\s+Detalhe:\s*/i, 1)[0]
    .trim();
  return readableMessage || "Não foi possível entrar. Tente novamente.";
}
