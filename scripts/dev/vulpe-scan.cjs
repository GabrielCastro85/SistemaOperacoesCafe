const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");
const Database = require("better-sqlite3");
const { XMLParser } = require("fast-xml-parser");

const VULPE_ROOTS = {
  MG: "C:\\Vulpe\\NFe\\VILLA_COFFEE_MG\\EMITIDO",
  ES: "C:\\Vulpe\\NFe\\VILLA_COFFEE\\EMITIDO"
};
const DEFAULT_OPERATIONS_DB = join(
  process.env.APPDATA || "",
  "Sistema de Operacoes de Cafe Multiempresa",
  "database",
  "operations.sqlite"
);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true
});

function argument(name, fallback) {
  const args = process.argv.slice(2);
  const prefix = `--${name}=`;
  const inlineValue = args.find((item) => item.startsWith(prefix));
  if (inlineValue) return inlineValue.slice(prefix.length);
  const position = args.indexOf(`--${name}`);
  return position >= 0 && args[position + 1] && !args[position + 1].startsWith("--")
    ? args[position + 1]
    : fallback;
}

function listAuthorizedXmlFiles(root) {
  const result = [];
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (/^\d{44}-nfe\.xml$/i.test(entry.name)) result.push(fullPath);
    }
  }
  return result;
}

function text(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function parseNfe(filePath) {
  const document = parser.parse(readFileSync(filePath, "utf8"));
  const root = Object.keys(document).find((key) => key !== "?xml");
  const process = root === "nfeProc" ? document.nfeProc : null;
  const nfe = process?.NFe || (root === "NFe" ? document.NFe : null);
  const protocol = process?.protNFe?.infProt || null;
  const info = nfe?.infNFe;
  if (!info) throw new Error("Arquivo sem NF-e reconhecivel.");

  const accessKey = text(info["@_Id"]).replace(/^NFe/i, "");
  if (!/^\d{44}$/.test(accessKey)) throw new Error("Chave de acesso ausente ou invalida.");

  return {
    accessKey,
    number: text(info.ide?.nNF),
    series: text(info.ide?.serie),
    issuedAt: text(info.ide?.dhEmi || info.ide?.dEmi).slice(0, 10),
    issuerCnpj: text(info.emit?.CNPJ || info.emit?.CPF).replace(/\D/g, ""),
    issuer: text(info.emit?.xNome),
    recipientCnpj: text(info.dest?.CNPJ || info.dest?.CPF).replace(/\D/g, ""),
    recipient: text(info.dest?.xNome),
    statusCode: text(protocol?.cStat),
    statusMessage: text(protocol?.xMotivo),
    filePath,
    modifiedAt: statSync(filePath).mtime.toISOString()
  };
}

function loadExistingAccessKeys(databasePath) {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    return new Set(
      database
        .prepare("SELECT access_key FROM fiscal_documents WHERE access_key IS NOT NULL AND access_key <> ''")
        .all()
        .map((row) => String(row.access_key))
    );
  } finally {
    database.close();
  }
}

function main() {
  const source = argument("source", "MG").toUpperCase();
  if (!VULPE_ROOTS[source]) throw new Error(`Origem invalida: ${source}. Use MG ou ES.`);
  const vulpeRoot = argument("vulpe-root", VULPE_ROOTS[source]);
  const databasePath = argument("operations-db", DEFAULT_OPERATIONS_DB);
  const since = argument("since", "");

  if (!existsSync(vulpeRoot)) throw new Error(`Pasta da Vulpe nao encontrada: ${vulpeRoot}`);
  if (!existsSync(databasePath)) throw new Error(`Banco do Operacoes Cafe nao encontrado: ${databasePath}`);

  const existingKeys = loadExistingAccessKeys(databasePath);
  const invalid = [];
  const notes = [];

  for (const filePath of listAuthorizedXmlFiles(vulpeRoot)) {
    try {
      const note = parseNfe(filePath);
      if (since && note.issuedAt < since) continue;
      notes.push({
        ...note,
        authorized: note.statusCode === "100" || note.statusCode === "150",
        alreadyInOperationsCafe: existingKeys.has(note.accessKey)
      });
    } catch (error) {
      invalid.push({ filePath, error: error instanceof Error ? error.message : String(error) });
    }
  }

  notes.sort((left, right) => {
    const dateOrder = right.issuedAt.localeCompare(left.issuedAt);
    return dateOrder || Number(right.number || 0) - Number(left.number || 0);
  });

  const authorized = notes.filter((note) => note.authorized);
  const newNotes = authorized.filter((note) => !note.alreadyInOperationsCafe);
  const statusCodes = notes.reduce((counts, note) => {
    const key = note.statusCode || "SEM_PROTOCOLO";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const result = {
    mode: "READ_ONLY_DEV_SCAN",
    source,
    vulpeRoot,
    databasePath,
    since: since || null,
    summary: {
      xmlFilesRead: notes.length,
      authorized: authorized.length,
      alreadyInOperationsCafe: authorized.length - newNotes.length,
      pendingForReview: newNotes.length,
      invalidFiles: invalid.length,
      statusCodes
    },
    pendingForReview: newNotes,
    invalidFiles: invalid
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
  process.exit(0);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
}
