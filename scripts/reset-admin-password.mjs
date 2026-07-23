/* global console, process */
// Redefine a senha de um usuario local quando a senha atual foi esquecida.
//
// Uso:
//   node scripts/reset-admin-password.mjs
//   node scripts/reset-admin-password.mjs --userData "C:\caminho\para\a\instalacao"
//
// Por padrao, aponta para a instalacao de PRODUCAO
// (%APPDATA%\Sistema de Operacoes de Cafe Multiempresa). Feche o aplicativo
// antes de rodar este script.

import Database from "better-sqlite3";
import { randomBytes, randomUUID, scrypt as nodeScrypt } from "node:crypto";
import { copyFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import readline from "node:readline";

const CREDENTIAL_FORMAT = "scrypt$v1$N=16384,r=8,p=1,keylen=64";
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

function deriveScrypt(password, salt, keyLength) {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await deriveScrypt(password, salt, KEY_LENGTH);
  return `${CREDENTIAL_FORMAT}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const getFlag = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const userData = getFlag("--userData") ?? join(homedir(), "AppData", "Roaming", "Sistema de Operacoes de Cafe Multiempresa");
  return { userData, username: getFlag("--username"), password: getFlag("--password") };
}

let rl = null;

function ask(question) {
  rl ??= readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const { userData, username: usernameFlag, password: passwordFlag } = parseArgs();
  const databasePath = join(userData, "database", "operations.sqlite");
  if (!existsSync(databasePath)) {
    console.error(`Banco nao encontrado em: ${databasePath}`);
    console.error("Use --userData \"<pasta>\" para apontar para a instalacao correta.");
    process.exit(1);
  }

  console.log(`Banco: ${databasePath}`);
  const backupPath = `${databasePath}.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  copyFileSync(databasePath, backupPath);
  console.log(`Backup criado antes de qualquer alteracao: ${backupPath}`);

  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");

  const users = db.prepare("SELECT id, username, display_name AS displayName, status, failed_login_attempts AS failedAttempts FROM app_users ORDER BY username").all();
  if (users.length === 0) {
    console.error("Nenhum usuario encontrado neste banco.");
    db.close();
    process.exit(1);
  }

  console.log("\nUsuarios encontrados:");
  users.forEach((user) => console.log(`  - ${user.username} (${user.displayName}) - status: ${user.status}, tentativas com falha: ${user.failedAttempts}`));

  const defaultUsername = users.some((user) => user.username === "admin") ? "admin" : users[0].username;
  const usernameInput = usernameFlag ?? ((await ask(`\nUsuario para redefinir [${defaultUsername}]: `)).trim() || defaultUsername);
  const user = users.find((item) => item.username.toLowerCase() === usernameInput.toLowerCase());
  if (!user) {
    console.error(`Usuario "${usernameInput}" nao encontrado.`);
    db.close();
    process.exit(1);
  }

  let password = passwordFlag;
  if (!password) {
    console.log("(a senha digitada abaixo fica visivel no terminal)");
    password = await ask("Nova senha: ");
    if (!password) {
      console.error("Senha nao pode ser vazia.");
      db.close();
      process.exit(1);
    }
    const confirmPassword = await ask("Confirme a nova senha: ");
    if (password !== confirmPassword) {
      console.error("As senhas nao coincidem. Nada foi alterado.");
      db.close();
      process.exit(1);
    }
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  const existingCredential = db.prepare("SELECT id FROM user_credentials WHERE user_id = ?").get(user.id);
  const trx = db.transaction(() => {
    if (existingCredential) {
      db.prepare("UPDATE user_credentials SET credential_format = ?, password_hash = ?, password_changed_at = ? WHERE user_id = ?")
        .run(CREDENTIAL_FORMAT, passwordHash, now, user.id);
    } else {
      db.prepare("INSERT INTO user_credentials (id, user_id, credential_format, password_hash, password_changed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), user.id, CREDENTIAL_FORMAT, passwordHash, now, now);
    }
    db.prepare("UPDATE app_users SET status = 'ACTIVE', failed_login_attempts = 0, locked_at = NULL, updated_at = ? WHERE id = ?")
      .run(now, user.id);
  });
  trx();
  db.close();
  rl?.close();

  console.log(`\nSenha do usuario "${user.username}" redefinida e conta desbloqueada.`);
  console.log("Abra o aplicativo e faca login com a nova senha.");
}

void main();
