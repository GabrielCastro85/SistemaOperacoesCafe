const { app } = require("electron");
const { createHash, randomUUID } = require("node:crypto");
const { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } = require("node:fs");
const { basename, dirname, join, resolve } = require("node:path");
const { XMLParser } = require("fast-xml-parser");

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true, parseTagValue: false, trimValues: true });
const once = process.argv.includes("--once");
const portableDir = process.env.PORTABLE_EXECUTABLE_DIR || dirname(process.execPath);
const configArgument = process.argv.find((value) => value.startsWith("--config="));
const configPath = configArgument ? resolve(configArgument.slice("--config=".length)) : join(portableDir, "coletor-config.json");
const statePath = join(portableDir, "coletor-state.json");
const statusPath = join(portableDir, "coletor-status.json");
const logPath = join(portableDir, "coletor.log");
let running = false;

function log(message, details) {
  const line = `${new Date().toISOString()} ${message}${details ? ` ${JSON.stringify(details)}` : ""}\n`;
  try {
    if (existsSync(logPath) && statSync(logPath).size > 2_000_000) renameSync(logPath, `${logPath}.1`);
    require("node:fs").appendFileSync(logPath, line, "utf8");
  } catch {}
}

function writeStatus(status) {
  writeFileSync(statusPath, JSON.stringify({ updatedAt: new Date().toISOString(), ...status }, null, 2), "utf8");
}

function loadConfig() {
  if (!existsSync(configPath)) throw new Error(`Arquivo de configuracao nao encontrado: ${configPath}`);
  const value = JSON.parse(readFileSync(configPath, "utf8"));
  for (const field of ["serverUrl", "collectorSecret", "sourceCode", "sourceLabel", "xmlRoot"]) {
    if (!String(value[field] || "").trim()) throw new Error(`Configuracao obrigatoria ausente: ${field}`);
  }
  if (!existsSync(value.xmlRoot)) throw new Error(`Pasta da Vulpe nao encontrada: ${value.xmlRoot}`);
  const emitterCnpjs = Array.isArray(value.emitterCnpjs)
    ? value.emitterCnpjs.map(digits).filter((cnpj) => /^\d{14}$/.test(cnpj))
    : [];
  if (emitterCnpjs.length === 0) throw new Error("Configuracao obrigatoria ausente: emitterCnpjs");
  return {
    ...value,
    serverUrl: String(value.serverUrl).replace(/\/$/, ""),
    machineId: String(value.machineId || `graobase-${randomUUID()}`),
    scanIntervalSeconds: Math.max(15, Number(value.scanIntervalSeconds || 60)),
    monthsBack: Math.max(0, Math.min(24, Number(value.monthsBack || 1))),
    emitterCnpjs
  };
}

function loadState() {
  try { return JSON.parse(readFileSync(statePath, "utf8")); }
  catch { return { uploadedHashes: {} }; }
}

function saveState(state) {
  writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
}

function text(value) { return value == null ? "" : String(value).trim(); }
function digits(value) { return text(value).replace(/\D/g, ""); }
function record(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }

function inspectXml(content) {
  const parsed = parser.parse(content);
  const root = Object.keys(parsed).find((key) => key !== "?xml");
  if (root === "nfeProc" || root === "NFe") {
    const process = root === "nfeProc" ? record(parsed.nfeProc) : {};
    const nfe = root === "nfeProc" ? record(process.NFe) : record(parsed.NFe);
    const info = record(nfe.infNFe);
    const protocol = record(record(process.protNFe).infProt);
    const accessKey = digits(text(info["@_Id"])).slice(-44);
    const statusCode = text(protocol.cStat);
    if (!/^\d{44}$/.test(accessKey) || !["100", "150"].includes(statusCode)) return null;
    const emitterCnpj = digits(record(record(info.emit)).CNPJ);
    return { accessKey, emitterCnpj, xmlType: "NFE" };
  }
  let event = {};
  if (root === "retEnvEvento") event = record(record(record(parsed.retEnvEvento).retEvento).infEvento);
  if (root === "procEventoNFe") event = record(record(record(parsed.procEventoNFe).retEvento).infEvento);
  const accessKey = digits(event.chNFe);
  if (text(event.tpEvento) !== "110111" || !["135", "155"].includes(text(event.cStat)) || !text(event.nProt) || !/^\d{44}$/.test(accessKey)) return null;
  return { accessKey, emitterCnpj: accessKey.slice(6, 20), xmlType: "CANCELLATION" };
}

function listCandidates(root) {
  const files = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (/^\d{44}-nfe\.xml$/i.test(entry.name) || (/-eve\.xml$/i.test(entry.name) && !/-ped-eve\.xml$/i.test(entry.name))) files.push(fullPath);
    }
  }
  return files;
}

function oldestAcceptedModification(monthsBack) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthsBack, 1).getTime();
}

async function upload(config, filePath, metadata, content, fileHash) {
  const response = await fetch(`${config.serverUrl}/v1/collector/files`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.collectorSecret}` },
    body: JSON.stringify({
      sourceCode: config.sourceCode,
      sourceLabel: config.sourceLabel,
      machineId: config.machineId,
      originalFileName: basename(filePath),
      fileHash,
      fileSize: Buffer.byteLength(content),
      accessKey: metadata.accessKey,
      xmlType: metadata.xmlType,
      xmlBase64: Buffer.from(content).toString("base64")
    })
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Servidor ${response.status}: ${body.slice(0, 300)}`);
}

async function scan() {
  if (running) return;
  running = true;
  try {
    const config = loadConfig();
    const state = loadState();
    state.uploadedHashes ||= {};
    let inspected = 0;
    let eligible = 0;
    let uploaded = 0;
    let pendingUpload = 0;
    const minimumModifiedAt = oldestAcceptedModification(config.monthsBack);
    const candidates = listCandidates(config.xmlRoot);
    for (const filePath of candidates) {
      inspected += 1;
      const stats = statSync(filePath);
      if (stats.size <= 0 || stats.size > 1_500_000 || stats.mtimeMs < minimumModifiedAt) continue;
      const content = readFileSync(filePath);
      const fileHash = createHash("sha256").update(content).digest("hex");
      if (state.uploadedHashes[fileHash]) continue;
      let metadata;
      try { metadata = inspectXml(content.toString("utf8")); }
      catch { continue; }
      if (!metadata || !config.emitterCnpjs.includes(metadata.emitterCnpj)) continue;
      eligible += 1;
      try {
        await upload(config, filePath, metadata, content, fileHash);
        state.uploadedHashes[fileHash] = { fileName: basename(filePath), uploadedAt: new Date().toISOString(), accessKey: metadata.accessKey };
        saveState(state);
        uploaded += 1;
      } catch (error) {
        pendingUpload += 1;
        log("Falha ao enviar XML", { file: basename(filePath), error: error instanceof Error ? error.message : String(error) });
      }
    }
    writeStatus({ status: pendingUpload ? "PENDING_RETRY" : "OK", inspected, eligible, uploaded, pendingUpload, source: config.sourceLabel, xmlRoot: config.xmlRoot });
    log("Varredura concluida", { inspected, eligible, uploaded, pendingUpload });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeStatus({ status: "ERROR", error: message });
    log("Falha na varredura", { error: message });
  } finally {
    running = false;
  }
}

if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(async () => {
  mkdirSync(portableDir, { recursive: true });
  await scan();
  if (once) return app.quit();
  let interval = 60_000;
  try { interval = loadConfig().scanIntervalSeconds * 1000; } catch {}
  setInterval(() => void scan(), interval);
});

app.on("window-all-closed", (event) => event.preventDefault());
