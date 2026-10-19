/* eslint-disable @typescript-eslint/no-require-imports */
/* global console, process, require */

const nativePath = process.argv[2];
if (!nativePath) throw new Error("Caminho do better_sqlite3.node empacotado nao informado.");

const bindings = require(nativePath);
if (!bindings || typeof bindings.Database !== "function") {
  throw new Error("Modulo SQLite empacotado nao carregou a API esperada.");
}

console.log(`better-sqlite3 empacotado compativel com Electron ABI ${process.versions.modules}.`);
process.exit(0);
