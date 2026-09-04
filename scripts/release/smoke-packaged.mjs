import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { variants } from "./variant-config.mjs";

/* global console */

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
const requested = process.argv.includes("--all")
  ? Object.keys(variants).filter((name) => existsSync(join(root, "release", name, version)))
  : [process.argv.find((arg) => variants[arg]) ?? "multiempresa"];
const errors = [];

for (const name of requested) {
  const variant = variants[name];
  const unpacked = join(root, "release", name, version, "win-unpacked");
  const exe = join(unpacked, `${variant.executableName}.exe`);
  if (!existsSync(unpacked)) {
    errors.push(`win-unpacked ausente para ${name}`);
    continue;
  }
  if (!existsSync(exe)) errors.push(`Executavel ausente: ${exe}`);
  if (!existsSync(join(unpacked, "resources", "app.asar"))) errors.push(`app.asar ausente para ${name}`);
  const sqliteNative = findFile(unpacked, "better_sqlite3.node");
  if (!sqliteNative) errors.push(`better_sqlite3.node ausente para ${name}`);
  const size = existsSync(exe) ? statSync(exe).size : 0;
  if (size < 1024 * 1024) errors.push(`Executavel pequeno demais para ${name}`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Smoke packaged passou.");

function findFile(dir, fileName) {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isFile() && entry.name === fileName) return full;
    if (entry.isDirectory()) {
      const found = findFile(full, fileName);
      if (found) return found;
    }
  }
  return null;
}
