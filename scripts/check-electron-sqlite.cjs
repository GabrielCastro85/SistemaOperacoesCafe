/* eslint-disable @typescript-eslint/no-require-imports */
/* global console, process, require */

const Database = require("better-sqlite3");

const db = new Database(":memory:");
const row = db.prepare("select 1 as ok").get();
db.close();

if (row.ok !== 1) {
  throw new Error("better-sqlite3 nao respondeu corretamente no Electron.");
}

console.log(`better-sqlite3 ok no Electron ABI ${process.versions.modules}.`);
process.exit(0);
