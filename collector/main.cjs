const { app } = require("electron");
const { createHash, randomUUID } = require("node:crypto");
const { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } = require("node:fs");
const { basename, dirname, join, resolve } = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { XMLParser } = require("fast-xml-parser");
const { compareVersions, powershellLiteral, sha256File } = require("./update-utils.cjs");

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true, parseTagValue: false, trimValues: true });
const once = process.argv.includes("--once");
const portableDir = process.env.PORTABLE_EXECUTABLE_DIR || dirname(process.execPath);
const configArgument = process.argv.find((value) => value.startsWith("--config="));
const configPath = configArgument ? resolve(configArgument.slice("--config=".length)) : join(portableDir, "coletor-config.json");
const statePath = join(portableDir, "coletor-state.json");
const statusPath = join(portableDir, "coletor-status.json");
const logPath = join(portableDir, "coletor.log");
let running = false;
let checkingUpdate = false;
let updateApplying = false;
let lastUpdateError = null;
let lastUpdateCheckAt = null;
let pollingCommands = false;
const startedAt = new Date().toISOString();

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

function recentLogs() {
  try {
    if (!existsSync(logPath)) return null;
    return readFileSync(logPath, "utf8").split(/\r?\n/).filter(Boolean).slice(-30).join("\n").slice(-12_000);
  } catch { return null; }
}

function startupConfigured() {
  try {
    const result = spawnSync("schtasks.exe", ["/Query", "/TN", "Coletor GraoBase - Vigilancia"], { windowsHide: true, encoding: "utf8" });
    return result.status === 0;
  } catch { return false; }
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
    updateCheckSeconds: Math.max(300, Number(value.updateCheckSeconds || 3600)),
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

async function sendHeartbeat(config, status) {
  const response = await fetch(`${config.serverUrl}/v1/collector/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.collectorSecret}` },
    body: JSON.stringify({
      sourceCode: config.sourceCode,
      sourceLabel: config.sourceLabel,
      machineId: config.machineId,
      emitterCnpjs: config.emitterCnpjs,
      collectorVersion: app.getVersion(),
      scanIntervalSeconds: config.scanIntervalSeconds,
      ...status,
      startedAt,
      uptimeSeconds: Math.max(0, Math.floor(process.uptime())),
      lastUpdateCheckAt,
      recentLogs: recentLogs(),
      startupConfigured: startupConfigured()
    })
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Servidor ${response.status}: ${body.slice(0, 300)}`);
}

async function reportHeartbeat(config, status) {
  try {
    await sendHeartbeat(config, status);
  } catch (error) {
    log("Falha ao atualizar monitor remoto", { error: error instanceof Error ? error.message : String(error) });
  }
}

async function downloadToFile(url, destination) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`Download da atualizacao falhou (${response.status}).`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

function startDownloadedVersion(executablePath, version) {
  const scriptPath = join(portableDir, "aplicar-atualizacao-coletor.ps1");
  const script = [
    "$ErrorActionPreference = \"SilentlyContinue\"",
    `$oldPid = ${process.pid}`,
    `$newExecutable = ${powershellLiteral(executablePath)}`,
    `$workingDirectory = ${powershellLiteral(portableDir)}`,
    "Wait-Process -Id $oldPid -Timeout 60",
    "if (Get-Process -Id $oldPid -ErrorAction SilentlyContinue) { Stop-Process -Id $oldPid -Force }",
    "Start-Sleep -Seconds 2",
    "Start-Process -FilePath $newExecutable -WorkingDirectory $workingDirectory -WindowStyle Hidden"
  ].join("\r\n");
  writeFileSync(scriptPath, script, "utf8");
  const child = spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", scriptPath], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  updateApplying = true;
  writeStatus({ status: "UPDATING", source: "GraoBase", currentVersion: app.getVersion(), targetVersion: version });
  log("Atualizacao validada; reiniciando o coletor", { currentVersion: app.getVersion(), targetVersion: version });
  setTimeout(() => app.quit(), 1500);
}

async function checkForUpdate(config) {
  if (checkingUpdate || updateApplying) return false;
  checkingUpdate = true;
  lastUpdateCheckAt = new Date().toISOString();
  let temporaryPath = "";
  try {
    const response = await fetch(`${config.serverUrl}/v1/collector/update`, {
      headers: { authorization: `Bearer ${config.collectorSecret}` }
    });
    if (!response.ok) throw new Error(`Servidor ${response.status} ao consultar atualizacao.`);
    const manifest = await response.json();
    lastUpdateError = null;
    if (!manifest?.available || compareVersions(manifest.latestVersion, app.getVersion()) <= 0) return false;
    if (!/^https:\/\//i.test(String(manifest.downloadUrl || "")) || !/^[a-f0-9]{64}$/i.test(String(manifest.sha256 || ""))) {
      throw new Error("Manifesto de atualizacao invalido.");
    }
    const fileName = `ColetorGraoBase-${manifest.latestVersion}-portable.exe`;
    const destination = join(portableDir, fileName);
    temporaryPath = `${destination}.download`;
    rmSync(temporaryPath, { force: true });
    await downloadToFile(manifest.downloadUrl, temporaryPath);
    const actualHash = await sha256File(temporaryPath);
    if (actualHash.toLowerCase() !== String(manifest.sha256).toLowerCase()) {
      throw new Error("A atualizacao baixada nao passou na verificacao de integridade.");
    }
    rmSync(destination, { force: true });
    renameSync(temporaryPath, destination);
    startDownloadedVersion(destination, manifest.latestVersion);
    return true;
  } catch (error) {
    if (temporaryPath) rmSync(temporaryPath, { force: true });
    lastUpdateError = error instanceof Error ? error.message : String(error);
    log("Falha ao atualizar o coletor; a versao atual continuara funcionando", { error: lastUpdateError });
    return false;
  } finally {
    checkingUpdate = false;
  }
}

async function finishRemoteCommand(config, id, status, message) {
  const response = await fetch(`${config.serverUrl}/v1/collector/commands/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.collectorSecret}` },
    body: JSON.stringify({ status, message })
  });
  if (!response.ok) throw new Error(`Servidor ${response.status} ao concluir comando remoto.`);
}

async function pollRemoteCommands(config) {
  if (pollingCommands || updateApplying || running) return;
  pollingCommands = true;
  try {
    const query = new URLSearchParams({ sourceCode: config.sourceCode, machineId: config.machineId });
    const response = await fetch(`${config.serverUrl}/v1/collector/commands?${query}`, {
      headers: { authorization: `Bearer ${config.collectorSecret}` }
    });
    if (!response.ok) throw new Error(`Servidor ${response.status} ao consultar comandos remotos.`);
    const payload = await response.json();
    const command = payload?.command;
    if (!command) return;
    log("Comando remoto recebido", { command: command.command, id: command.id });
    if (command.command === "SCAN_NOW") {
      await scan();
      await finishRemoteCommand(config, command.id, "COMPLETED", "Varredura executada.");
      return;
    }
    if (command.command === "UPDATE_NOW") {
      const updating = await checkForUpdate(config);
      await finishRemoteCommand(config, command.id, "COMPLETED", updating ? "Atualizacao baixada e reinicio iniciado." : "O coletor ja esta atualizado.");
      return;
    }
    if (command.command === "RESTART") {
      await finishRemoteCommand(config, command.id, "COMPLETED", "Reinicio solicitado.");
      log("Reinicio remoto solicitado");
      app.relaunch({ args: [`--config=${configPath}`] });
      setTimeout(() => app.exit(0), 500);
      return;
    }
    await finishRemoteCommand(config, command.id, "FAILED", "Comando desconhecido.");
  } catch (error) {
    log("Falha ao processar comando remoto", { error: error instanceof Error ? error.message : String(error) });
  } finally {
    pollingCommands = false;
  }
}

async function scan() {
  if (running) return;
  running = true;
  let activeConfig = null;
  try {
    const config = loadConfig();
    activeConfig = config;
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
    const currentStatus = { status: pendingUpload ? "PENDING_RETRY" : "OK", inspected, eligible, uploaded, pendingUpload, source: config.sourceLabel, xmlRoot: config.xmlRoot };
    writeStatus(currentStatus);
    await reportHeartbeat(config, {
      status: lastUpdateError ? "ERROR" : currentStatus.status,
      inspected,
      eligible,
      uploaded,
      pendingUpload,
      error: lastUpdateError ? `Falha na atualizacao automatica: ${lastUpdateError}` : pendingUpload ? `${pendingUpload} arquivo(s) aguardando novo envio.` : null
    });
    log("Varredura concluida", { inspected, eligible, uploaded, pendingUpload });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeStatus({ status: "ERROR", error: message });
    if (activeConfig) {
      await reportHeartbeat(activeConfig, {
        status: "ERROR",
        inspected: 0,
        eligible: 0,
        uploaded: 0,
        pendingUpload: 0,
        error: message
      });
    }
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
  let updateInterval = 3_600_000;
  try {
    const config = loadConfig();
    interval = config.scanIntervalSeconds * 1000;
    updateInterval = config.updateCheckSeconds * 1000;
    if (await checkForUpdate(config)) return;
    await pollRemoteCommands(config);
  } catch {}
  setInterval(() => void scan(), interval);
  setInterval(() => {
    try { void pollRemoteCommands(loadConfig()); } catch (error) { log("Falha ao preparar consulta de comandos", { error: error instanceof Error ? error.message : String(error) }); }
  }, 30_000);
  setInterval(() => {
    try { void checkForUpdate(loadConfig()); } catch (error) { log("Falha ao preparar verificacao de atualizacao", { error: error instanceof Error ? error.message : String(error) }); }
  }, updateInterval);
});

app.on("window-all-closed", (event) => event.preventDefault());
