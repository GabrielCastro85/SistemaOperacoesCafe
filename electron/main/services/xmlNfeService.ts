import { XMLParser, XMLValidator } from "fast-xml-parser";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, extname } from "node:path";
import type { XmlFileInspection, XmlType } from "../../../src/shared/types/domain.js";
import { normalizeDecimalText } from "../../../src/shared/utils/decimal.js";

const maxXmlBytes = 10 * 1024 * 1024;
const maxDepth = 80;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ["det", "dup", "vol"].includes(name)
});

export interface ParsedXmlNfe {
  xmlType: XmlType;
  accessKey: string | null;
  extractedData: Record<string, unknown> | null;
  warnings: string[];
}

export function calculateFileHash(filePath: string): string {
  validateXmlPath(filePath);
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function validateXmlPath(filePath: string): void {
  if (!existsSync(filePath)) throw new Error("Arquivo XML nao encontrado.");
  const stats = statSync(filePath);
  if (!stats.isFile()) throw new Error("Caminho selecionado nao e arquivo.");
  if (stats.size === 0) throw new Error("Arquivo XML vazio.");
  if (stats.size > maxXmlBytes) throw new Error("XML maior que 10 MB.");
}

export function inspectXmlFile(filePath: string, token: string): XmlFileInspection {
  try {
    validateXmlPath(filePath);
    const content = readFileSync(filePath, "utf8");
    const hash = createHash("sha256").update(content).digest("hex");
    const parsed = parseXmlContent(content);
    return {
      token,
      originalFileName: basename(filePath),
      fileSize: statSync(filePath).size,
      fileHash: hash,
      xmlType: parsed.xmlType,
      accessKey: parsed.accessKey,
      status: parsed.warnings.length ? "WARNING" : "VALID",
      warnings: parsed.warnings,
      errorCode: null,
      errorMessage: null,
      extractedData: parsed.extractedData
    };
  } catch (error) {
    const size = existsSync(filePath) ? statSync(filePath).size : 0;
    return {
      token,
      originalFileName: basename(filePath),
      fileSize: size,
      fileHash: existsSync(filePath) && size > 0 && size <= maxXmlBytes ? createHash("sha256").update(readFileSync(filePath)).digest("hex") : "0".repeat(64),
      xmlType: "UNKNOWN",
      accessKey: null,
      status: "ERROR",
      warnings: [],
      errorCode: "XML_INVALID",
      errorMessage: error instanceof Error ? error.message : "Falha ao ler XML.",
      extractedData: null
    };
  }
}

export function parseXmlContent(content: string): ParsedXmlNfe {
  validateXmlContent(content);
  const validation = XMLValidator.validate(content, {
    allowBooleanAttributes: false
  });
  if (validation !== true) throw new Error(`XML malformado: ${validation.err.msg}`);
  const parsed = parser.parse(content) as Record<string, unknown>;
  if (objectDepth(parsed) > maxDepth) throw new Error("XML com estrutura profunda demais.");
  const root = firstKey(parsed);
  if (!root) throw new Error("XML sem elemento raiz.");
  if (root === "nfeProc") return parseNfeProc(asRecord(parsed[root]));
  if (root === "NFe") return parseNfe(asRecord(parsed[root]), null);
  if (root === "procEventoNFe") return parseProcEvento(asRecord(parsed[root]));
  if (root === "evento") return parseEvento(asRecord(parsed[root]), null);
  return { xmlType: "UNKNOWN", accessKey: null, extractedData: { root }, warnings: ["XML_NFE_DESCONHECIDO"] };
}

function validateXmlContent(content: string): void {
  if (!content.trim()) throw new Error("Arquivo XML vazio.");
  if (Buffer.byteLength(content, "utf8") > maxXmlBytes) throw new Error("XML maior que 10 MB.");
  if (/<!DOCTYPE/i.test(content)) throw new Error("DTD/DOCTYPE nao permitido.");
  if (/<!ENTITY/i.test(content)) throw new Error("Entidades XML nao permitidas.");
  if (/SYSTEM\s+["']/i.test(content) || /PUBLIC\s+["']/i.test(content)) throw new Error("Entidade externa nao permitida.");
}

function parseNfeProc(data: Record<string, unknown>): ParsedXmlNfe {
  const prot = asRecord(data.protNFe);
  return parseNfe(asRecord(data.NFe), prot);
}

function parseNfe(nfe: Record<string, unknown>, prot: Record<string, unknown> | null): ParsedXmlNfe {
  const inf = asRecord(nfe.infNFe);
  const ide = asRecord(inf.ide);
  const emit = asRecord(inf.emit);
  const dest = asRecord(inf.dest);
  const total = asRecord(asRecord(inf.total).ICMSTot);
  const transp = asRecord(inf.transp);
  const infAdic = asRecord(inf.infAdic);
  const protInf = prot ? asRecord(prot.infProt) : {};
  const idKey = accessKeyFromId(String(inf["@_Id"] ?? ""));
  const protocolKey = digits(String(protInf.chNFe ?? ""));
  const warnings: string[] = [];
  if (idKey && !isValidAccessKey(idKey)) throw new Error("Digito verificador da chave de acesso invalido.");
  if (protocolKey && idKey && protocolKey !== idKey) throw new Error("Chave da NF-e diverge da chave do protocolo.");
  const items = arrayOf(inf.det).map((det) => {
    const prod = asRecord(det.prod);
    return {
      itemNumber: String(det["@_nItem"] ?? ""),
      productCode: text(prod.cProd),
      ean: text(prod.cEAN),
      description: text(prod.xProd),
      ncm: text(prod.NCM),
      cfop: text(prod.CFOP),
      cest: text(prod.CEST),
      commercialUnit: text(prod.uCom),
      commercialQuantity: decimal(prod.qCom),
      commercialUnitValue: decimal(prod.vUnCom),
      totalAmountCents: money(prod.vProd),
      taxableUnit: text(prod.uTrib),
      taxableQuantity: decimal(prod.qTrib),
      taxableUnitValue: decimal(prod.vUnTrib),
      discountCents: money(prod.vDesc),
      freightCents: money(prod.vFrete),
      insuranceCents: money(prod.vSeg),
      otherExpensesCents: money(prod.vOutro),
      additionalInfo: text(asRecord(det.infAdProd))
    };
  });
  if (!idKey) warnings.push("CHAVE_AUSENTE");
  return {
    xmlType: prot ? "NFE_PROC" : "NFE",
    accessKey: idKey,
    warnings,
    extractedData: {
      version: text(inf["@_versao"]),
      accessKey: idKey,
      model: text(ide.mod),
      series: text(ide.serie),
      number: text(ide.nNF),
      nature: text(ide.natOp),
      operationTypeCode: text(ide.tpNF),
      finality: text(ide.finNFe),
      environment: text(ide.tpAmb),
      issuedAt: dateOnly(text(ide.dhEmi) || text(ide.dEmi)),
      exitedAt: dateOnly(text(ide.dhSaiEnt) || text(ide.dSaiEnt)),
      occurrenceCityCode: text(ide.cMunFG),
      emissionType: text(ide.tpEmis),
      issuer: partySnapshot(emit),
      recipient: partySnapshot(dest),
      items,
      totals: {
        productsAmountCents: money(total.vProd),
        invoiceAmountCents: money(total.vNF),
        discountCents: money(total.vDesc),
        freightCents: money(total.vFrete),
        insuranceCents: money(total.vSeg),
        otherExpensesCents: money(total.vOutro),
        taxAmountCents: money(total.vTotTrib)
      },
      transport: transportSnapshot(transp),
      additionalInfo: {
        complementary: text(infAdic.infCpl),
        fiscal: text(infAdic.infAdFisco)
      },
      protocol: {
        number: text(protInf.nProt),
        receivedAt: dateOnly(text(protInf.dhRecbto)),
        statusCode: text(protInf.cStat),
        statusMessage: text(protInf.xMotivo)
      }
    }
  };
}

function parseProcEvento(data: Record<string, unknown>): ParsedXmlNfe {
  return parseEvento(asRecord(data.evento), asRecord(data.retEvento));
}

function parseEvento(evento: Record<string, unknown>, retEvento: Record<string, unknown> | null): ParsedXmlNfe {
  const infEvento = asRecord(evento.infEvento);
  const ret = retEvento ? asRecord(retEvento.infEvento) : {};
  const typeCode = text(infEvento.tpEvento);
  const eventType = typeCode === "110111" ? "EVENT_CANCELLATION" : typeCode === "110110" ? "EVENT_CORRECTION_LETTER" : "EVENT_OTHER";
  const accessKey = digits(text(infEvento.chNFe));
  if (accessKey && !isValidAccessKey(accessKey)) throw new Error("Digito verificador da chave de evento invalido.");
  const detEvento = asRecord(infEvento.detEvento);
  return {
    xmlType: eventType,
    accessKey: accessKey || null,
    warnings: [],
    extractedData: {
      accessKey,
      eventType,
      sequenceNumber: text(infEvento.nSeqEvento) || "1",
      eventDate: dateOnly(text(infEvento.dhEvento)),
      protocolNumber: text(ret.nProt),
      statusCode: text(ret.cStat),
      statusMessage: text(ret.xMotivo),
      correctionText: text(detEvento.xCorrecao) || text(detEvento.xJust),
      rawEventCode: typeCode
    }
  };
}

export function isValidAccessKey(value: string): boolean {
  const key = digits(value);
  if (!/^\d{44}$/.test(key)) return false;
  const body = key.slice(0, 43);
  const expected = Number(key[43]);
  let weight = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  const digit = mod === 0 || mod === 1 ? 0 : 11 - mod;
  return digit === expected;
}

export function accessKeyFromId(value: string): string | null {
  const clean = value.replace(/^NFe/i, "");
  const key = digits(clean);
  return /^\d{44}$/.test(key) ? key : null;
}

function partySnapshot(data: Record<string, unknown>): Record<string, string | null> {
  const address = asRecord(data.enderEmit ?? data.enderDest);
  return {
    legalName: text(data.xNome) || null,
    tradeName: text(data.xFant) || null,
    cnpjCpf: digits(text(data.CNPJ) || text(data.CPF)) || null,
    stateRegistration: text(data.IE) || null,
    street: text(address.xLgr) || null,
    number: text(address.nro) || null,
    complement: text(address.xCpl) || null,
    district: text(address.xBairro) || null,
    city: text(address.xMun) || null,
    cityCode: text(address.cMun) || null,
    state: text(address.UF) || null,
    cep: digits(text(address.CEP)) || null,
    phone: digits(text(address.fone)) || null,
    email: text(data.email) || null
  };
}

function transportSnapshot(data: Record<string, unknown>): Record<string, unknown> {
  const carrier = asRecord(data.transporta);
  const vehicle = asRecord(data.veicTransp);
  const volume = arrayOf(data.vol)[0] ?? {};
  return {
    carrierName: text(carrier.xNome),
    carrierCnpjCpf: digits(text(carrier.CNPJ) || text(carrier.CPF)),
    plate: text(vehicle.placa),
    plateState: text(vehicle.UF),
    volumeQuantity: decimal(volume.qVol),
    species: text(volume.esp),
    brand: text(volume.marca),
    grossWeight: decimal(volume.pesoB),
    netWeight: decimal(volume.pesoL)
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arrayOf(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.map(asRecord);
  return Object.keys(asRecord(value)).length ? [asRecord(value)] : [];
}

function firstKey(value: Record<string, unknown>): string | null {
  return Object.keys(value).find((key) => key !== "?xml") ?? null;
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function decimal(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  return normalizeDecimalText(raw.replace(",", "."));
}

function money(value: unknown): number {
  const dec = decimal(value);
  if (!dec) return 0;
  const [whole, fraction = ""] = dec.split(".");
  return Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2)));
}

function dateOnly(value: string): string | null {
  if (!value) return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function objectDepth(value: unknown, depth = 0): number {
  if (!value || typeof value !== "object") return depth;
  if (depth > maxDepth) return depth;
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.reduce((max, child) => Math.max(max, objectDepth(child, depth + 1)), depth);
}

export function safeXmlTargetName(inspection: XmlFileInspection): string {
  const suffix = inspection.xmlType.startsWith("EVENT_") ? `-${inspection.xmlType.toLowerCase().replace("event_", "event-")}` : "";
  const base = inspection.accessKey ?? inspection.fileHash.slice(0, 16);
  return `${base}${suffix}${extname(inspection.originalFileName).toLowerCase() || ".xml"}`;
}
