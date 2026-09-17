import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import Database from "better-sqlite3";

const apiUrl = (process.env.CENTRAL_API_URL ?? "https://mindful-peace-production.up.railway.app").replace(/\/$/, "");
const databasePath = process.env.SQLITE_DATABASE_PATH;
const username = process.env.CENTRAL_USERNAME ?? "Gabriel";
const password = process.env.CENTRAL_PASSWORD;
if (!databasePath || !password) throw new Error("Defina SQLITE_DATABASE_PATH e CENTRAL_PASSWORD.");

const tempPath = join(dirname(databasePath), `central-upload-${Date.now()}.sqlite`);
await mkdir(dirname(tempPath), { recursive: true });
const source = new Database(databasePath, { readonly: true, fileMustExist: true });
await source.backup(tempPath);
source.close();

const snapshotBytes = await readFile(tempPath);
const databaseSha256 = createHash("sha256").update(snapshotBytes).digest("hex");
const db = new Database(tempPath, { readonly: true, fileMustExist: true });

const jsonValue = (value) => {
  if (Buffer.isBuffer(value)) return { $binaryBase64: value.toString("base64") };
  if (typeof value === "bigint") return value.toString();
  return value;
};
const normalizeRow = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, jsonValue(value)]));
const rowKey = (row) => {
  if (typeof row.id === "string" && row.id) return row.id;
  return createHash("sha256").update(JSON.stringify(row)).digest("hex");
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function request(path, init = {}, maxAttempts = 6) {
  const requestInit = { ...init };
  const contentType = new Headers(requestInit.headers).get("content-type");
  if (requestInit.method && requestInit.method !== "GET" && contentType === "application/json" && requestInit.body === undefined) {
    requestInit.body = "{}";
  }
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}${path}`, requestInit);
      const text = await response.text();
      let body = null;
      if (text) {
        try { body = JSON.parse(text); }
        catch { body = { message: text.trim() }; }
      }
      if (response.ok) return body;
      const error = new Error(`${response.status} ${path}: ${JSON.stringify(body)}`);
      if (response.status < 500 || attempt === maxAttempts) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      const status = Number(/^([0-9]{3}) /.exec(error.message)?.[1] ?? 0);
      if ((status > 0 && status < 500) || attempt === maxAttempts) throw error;
    }
    const delay = Math.min(1000 * (2 ** (attempt - 1)), 10000);
    console.warn(`Resposta temporaria do servidor em ${path}. Nova tentativa ${attempt + 1}/${maxAttempts} em ${delay / 1000}s...`);
    await wait(delay);
  }
  throw lastError;
}

try {
  const login = await request("/v1/session/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      device: { installationId: `migration-${randomUUID()}`, displayName: "Migracao inicial", platform: process.platform, appVersion: "1.0.81" }
    })
  });
  const headers = { "content-type": "application/json", authorization: `Bearer ${login.token}` };
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all().map((row) => row.name);
  const tableCounts = Object.fromEntries(tables.map((table) => [table, Number(db.prepare(`SELECT COUNT(*) AS total FROM "${table}"`).get().total)]));
  const installation = db.prepare("SELECT id, installation_name FROM installation_profiles ORDER BY created_at LIMIT 1").get();
  const migration = db.prepare("SELECT migration_name FROM migration_history ORDER BY executed_at DESC LIMIT 1").get();
  const started = await request("/v1/sqlite-imports", {
    method: "POST",
    headers,
    body: JSON.stringify({
      sourceInstallationId: installation?.id ?? `unknown-${databaseSha256.slice(0, 12)}`,
      sourceDatabaseSha256: databaseSha256,
      sourceDatabaseBytes: snapshotBytes.length,
      sourceMigration: migration?.migration_name ?? null,
      tableCounts
    })
  });
  console.log(`Importacao ${started.runId}: ${started.status}`);
  if (started.status === "VERIFIED") process.exitCode = 0;
  else {
    for (const table of tables) {
      const rows = db.prepare(`SELECT * FROM "${table}"`).all().map(normalizeRow);
      for (let index = 0; index < rows.length; index += 100) {
        const batch = rows.slice(index, index + 100).map((data) => ({ key: rowKey(data), data }));
        if (batch.length) await request(`/v1/sqlite-imports/${started.runId}/tables/${table}`, { method: "PUT", headers, body: JSON.stringify({ rows: batch }) });
      }
      console.log(`${table}: ${rows.length}`);
    }
    let verification;
    try {
      verification = await request(`/v1/sqlite-imports/${started.runId}/verify-v3`, { method: "POST", headers });
    } catch (verificationError) {
      const persisted = await request(`/v1/sqlite-imports/${started.runId}`, { headers });
      if (persisted.status !== "VERIFIED") throw verificationError;
      verification = { runId: started.runId, status: persisted.status, recoveredAfterResponseError: true };
    }
    console.log(`Resultado: ${verification.status}`);
    console.log(JSON.stringify(verification, null, 2));
  }
  await request("/v1/session/logout", { method: "POST", headers });
} finally {
  db.close();
  await rm(tempPath, { force: true });
}
