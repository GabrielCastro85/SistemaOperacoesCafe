import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

/* global console */

const root = process.cwd();
const main = read("electron/main/index.ts");
const preload = read("electron/preload/index.cts");
const html = read("index.html");
const security = read("electron/main/services/security.ts");
const checks = [
  ["contextIsolation ativo", main.includes("contextIsolation: true")],
  ["nodeIntegration desativado", main.includes("nodeIntegration: false")],
  ["webSecurity ativo", main.includes("webSecurity: true")],
  ["DevTools bloqueado em pacote", main.includes("OPERACOES_CAFE_ENABLE_DEVTOOLS")],
  ["Novas janelas negadas", main.includes("setWindowOpenHandler") && main.includes('action: "deny"')],
  ["Navegacao restrita", main.includes("will-navigate") && main.includes("event.preventDefault()")],
  ["Permissoes negadas por padrao", main.includes("setPermissionRequestHandler") && main.includes("callback(false)")],
  ["Preload usa contextBridge", preload.includes("contextBridge")],
  ["CSP declarada", html.includes("Content-Security-Policy")],
  ["IPC deny-by-default autenticado", security.includes("?? { mode: \"authenticated\" }")],
  ["Auditoria sanitiza segredo", security.includes("password|senha|hash|salt|token|secret")]
];

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name);
if (failed.length > 0) {
  console.error(`Security check falhou:\n${failed.join("\n")}`);
  process.exit(1);
}

console.log(`Security check passou: ${checks.length} controles verificados.`);

function read(path) {
  return readFileSync(join(root, path), "utf8");
}
