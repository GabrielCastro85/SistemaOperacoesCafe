import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

/* global console */

const source = readFileSync(join(process.cwd(), "electron/main/database/migrations.ts"), "utf8");
const migrations = [...source.matchAll(/name:\s*"(0\d{2}_[^"]+)"/g)].map((match) => match[1]);
const expectedLast = "018_legal_entity_confirmation_defaults";
const errors = [];

if (migrations.at(-1) !== expectedLast) {
  errors.push(`Ultima migration esperada ${expectedLast}, encontrada ${migrations.at(-1) ?? "nenhuma"}.`);
}

const duplicates = migrations.filter((name, index) => migrations.indexOf(name) !== index);
if (duplicates.length > 0) errors.push(`Migrations duplicadas: ${duplicates.join(", ")}.`);

if (migrations.length !== 16) errors.push(`Quantidade esperada de migrations: 16. Encontrada: ${migrations.length}.`);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Migration check passou: ${migrations.length} migrations, ultima ${expectedLast}.`);
