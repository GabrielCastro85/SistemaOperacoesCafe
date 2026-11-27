import type { LegalEntity } from "../../../shared/types/domain";
import { onlyDigits } from "../../../shared/utils/format";

interface NfePartySnapshot {
  legalName: string | null;
  tradeName: string | null;
  cnpjCpf: string | null;
  state: string | null;
}

interface NfeItemPreview {
  description: string | null;
  cfop: string | null;
  commercialQuantity: string | null;
  commercialUnit: string | null;
  commercialUnitValue: string | null;
  totalAmountCents: number | null;
}

export interface NfeExtractedPreview {
  accessKey: string | null;
  model: string | null;
  series: string | null;
  number: string | null;
  nature: string | null;
  issuedAt: string | null;
  issuer: NfePartySnapshot | null;
  recipient: NfePartySnapshot | null;
  transportCarrierName: string | null;
  items: NfeItemPreview[];
  productsAmountCents: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function party(value: unknown): NfePartySnapshot | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    legalName: str(record.legalName),
    tradeName: str(record.tradeName),
    cnpjCpf: str(record.cnpjCpf),
    state: str(record.state)
  };
}

export function parseNfeExtractedPreview(
  data: Record<string, unknown> | null | undefined
): NfeExtractedPreview | null {
  if (!data) return null;

  const totals = asRecord(data.totals);
  const transport = asRecord(data.transport);

  const items = Array.isArray(data.items)
    ? data.items.map((raw): NfeItemPreview => {
        const item = asRecord(raw) ?? {};
        return {
          description: str(item.description),
          cfop: str(item.cfop),
          commercialQuantity: str(item.commercialQuantity),
          commercialUnit: str(item.commercialUnit),
          commercialUnitValue: str(item.commercialUnitValue),
          totalAmountCents: num(item.totalAmountCents)
        };
      })
    : [];

  return {
    accessKey: str(data.accessKey),
    model: str(data.model),
    series: str(data.series),
    number: str(data.number),
    nature: str(data.nature),
    issuedAt: str(data.issuedAt),
    issuer: party(data.issuer),
    recipient: party(data.recipient),
    transportCarrierName: transport ? str(transport.carrierName) : null,
    items,
    productsAmountCents: totals ? num(totals.productsAmountCents) : null
  };
}

export interface WarehouseXmlClassification {
  movementType: "DEPOSIT" | "RETURN";
  movementKind: "PHYSICAL" | "SYMBOLIC";
  cfops: string[];
}

/** Mirrors the backend warehouse-CFOP recognition so the UI can bypass commercial fields safely. */
export function classifyWarehouseXml(preview: NfeExtractedPreview | null): WarehouseXmlClassification | null {
  if (!preview) return null;
  const warehouseCfops: Record<string, Omit<WarehouseXmlClassification, "cfops">> = {
    "5905": { movementType: "DEPOSIT", movementKind: "PHYSICAL" },
    "6905": { movementType: "DEPOSIT", movementKind: "PHYSICAL" },
    "5934": { movementType: "DEPOSIT", movementKind: "SYMBOLIC" },
    "6934": { movementType: "DEPOSIT", movementKind: "SYMBOLIC" },
    "5906": { movementType: "RETURN", movementKind: "PHYSICAL" },
    "6906": { movementType: "RETURN", movementKind: "PHYSICAL" },
    "5907": { movementType: "RETURN", movementKind: "SYMBOLIC" },
    "6907": { movementType: "RETURN", movementKind: "SYMBOLIC" }
  };
  const matches = preview.items.flatMap((item) => {
    const cfop = String(item.cfop ?? "").replace(/\D/g, "");
    const classification = warehouseCfops[cfop];
    return classification ? [{ cfop, ...classification }] : [];
  });
  if (!matches.length) return null;
  const first = matches[0];
  if (matches.some((match) => match.movementType !== first.movementType)) return null;
  return {
    movementType: first.movementType,
    movementKind: first.movementKind,
    cfops: [...new Set(matches.map((match) => match.cfop))]
  };
}

export interface OwnAndCounterparty {
  ownEntityLabel: string | null;
  counterpartyLabel: string | null;
  counterpartyCnpj: string | null;
  issuerLabel: string | null;
  issuerCnpj: string | null;
  recipientLabel: string | null;
  recipientCnpj: string | null;
  originLabel: string;
  isThirdPartyOrigin: boolean;
}

/** Best-effort local preview only — the backend re-resolves the own CNPJ and counterparty independently when the file is actually imported. */
export function resolveOwnAndCounterparty(
  preview: NfeExtractedPreview | null,
  legalEntities: LegalEntity[]
): OwnAndCounterparty {
  if (!preview) {
    return {
      ownEntityLabel: null,
      counterpartyLabel: null,
      counterpartyCnpj: null,
      issuerLabel: null,
      issuerCnpj: null,
      recipientLabel: null,
      recipientCnpj: null,
      originLabel: "Nao identificada",
      isThirdPartyOrigin: false
    };
  }

  const issuerCnpj = preview.issuer?.cnpjCpf
    ? onlyDigits(preview.issuer.cnpjCpf)
    : cnpjFromAccessKey(preview.accessKey);
  const recipientCnpj = preview.recipient?.cnpjCpf
    ? onlyDigits(preview.recipient.cnpjCpf)
    : null;
  const issuerLabel = preview.issuer?.legalName ?? preview.issuer?.tradeName ?? null;
  const recipientLabel = preview.recipient?.legalName ?? preview.recipient?.tradeName ?? null;
  // Exclui "empresas" terceirizadas auto-criadas por importacoes de XML
  // anteriores (ver getOrCreateThirdPartyLegalEntityFromXml no backend) --
  // sem isso, um CNPJ de terceiro ja visto antes era tratado como se fosse
  // uma das empresas proprias, mostrando o aviso errado ("XML de outro CNPJ")
  // em vez do aviso real de nota triangulada/terceirizada.
  const ownLegalEntities = legalEntities.filter((entity) => entity.documentPrefix !== "TERC-XML");
  const ownByIssuer = issuerCnpj
    ? ownLegalEntities.find((entity) => onlyDigits(entity.cnpj) === issuerCnpj)
    : undefined;
  const ownByRecipient = recipientCnpj
    ? ownLegalEntities.find((entity) => onlyDigits(entity.cnpj) === recipientCnpj)
    : undefined;

  if (ownByIssuer) {
    return {
      ownEntityLabel: ownByIssuer.legalName || ownByIssuer.tradeName,
      counterpartyLabel: recipientLabel,
      counterpartyCnpj: recipientCnpj,
      issuerLabel,
      issuerCnpj,
      recipientLabel,
      recipientCnpj,
      originLabel: ownByIssuer.legalName || ownByIssuer.tradeName,
      isThirdPartyOrigin: false
    };
  }

  if (ownByRecipient) {
    return {
      ownEntityLabel: ownByRecipient.legalName || ownByRecipient.tradeName,
      counterpartyLabel: issuerLabel,
      counterpartyCnpj: issuerCnpj,
      issuerLabel,
      issuerCnpj,
      recipientLabel,
      recipientCnpj,
      originLabel: ownByRecipient.legalName || ownByRecipient.tradeName,
      isThirdPartyOrigin: false
    };
  }

  return {
    ownEntityLabel: null,
    counterpartyLabel: recipientLabel,
    counterpartyCnpj: recipientCnpj,
    issuerLabel,
    issuerCnpj,
    recipientLabel,
    recipientCnpj,
    originLabel: issuerLabel ?? "Empresa externa/terceirizada",
    isThirdPartyOrigin: true
  };
}

function cnpjFromAccessKey(accessKey: string | null): string | null {
  const key = accessKey ? onlyDigits(accessKey) : null;
  return key && key.length === 44 ? key.slice(6, 20) : null;
}

// Compra ou venda definida pelo proprio XML: se a empresa propria emitiu a nota, e venda;
// se ela e a destinataria, e compra. Null quando nenhuma empresa propria bate com o XML.
export function inferXmlOperationType(
  preview: NfeExtractedPreview | null,
  legalEntities: LegalEntity[]
): "PURCHASE" | "SALE" | null {
  if (!preview) return null;
  const issuerCnpj = preview.issuer?.cnpjCpf
    ? onlyDigits(preview.issuer.cnpjCpf)
    : cnpjFromAccessKey(preview.accessKey);
  const recipientCnpj = preview.recipient?.cnpjCpf ? onlyDigits(preview.recipient.cnpjCpf) : null;
  const ownLegalEntities = legalEntities.filter((entity) => entity.documentPrefix !== "TERC-XML");
  const isOwn = (cnpj: string | null): boolean => Boolean(cnpj) && ownLegalEntities.some((entity) => onlyDigits(entity.cnpj) === cnpj);
  if (isOwn(issuerCnpj)) return "SALE";
  if (isOwn(recipientCnpj)) return "PURCHASE";
  return null;
}

// Ordem da fila de XMLs (pedido do Gabriel): uma empresa propria de cada vez --
// Villa MG, Villa ES, Villa SP, Grao & Grao MG, Grao & Grao SP -- e dentro de
// cada empresa da nota de menor numero para a maior. A empresa e a emitente
// (notas emitidas) ou a destinataria (notas recebidas). Notas de terceiros vem
// depois das empresas proprias; arquivos com erro ficam no fim.
const XML_QUEUE_STATE_ORDER = ["MG", "ES", "SP"];

function xmlQueueCompanyRank(entity: LegalEntity | undefined): number {
  if (!entity) return 1000;
  const name = `${entity.tradeName} ${entity.legalName}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const brand = name.includes("VILLA") ? 0 : name.includes("GRAO") ? 1 : 2;
  const stateIndex = XML_QUEUE_STATE_ORDER.indexOf((entity.state ?? "").toUpperCase());
  return brand * 10 + (stateIndex === -1 ? XML_QUEUE_STATE_ORDER.length : stateIndex);
}

export function sortXmlQueueByCompanyAndNumber<T extends { status: string; originalFileName: string; extractedData: Record<string, unknown> | null }>(
  files: T[],
  legalEntities: LegalEntity[]
): T[] {
  const ownLegalEntities = legalEntities.filter((entity) => entity.documentPrefix !== "TERC-XML");
  const keyOf = (file: T) => {
    const preview = parseNfeExtractedPreview(file.extractedData);
    const issuerCnpj = preview?.issuer?.cnpjCpf ? onlyDigits(preview.issuer.cnpjCpf) : cnpjFromAccessKey(preview?.accessKey ?? null);
    const recipientCnpj = preview?.recipient?.cnpjCpf ? onlyDigits(preview.recipient.cnpjCpf) : null;
    const own =
      (issuerCnpj ? ownLegalEntities.find((entity) => onlyDigits(entity.cnpj) === issuerCnpj) : undefined)
      ?? (recipientCnpj ? ownLegalEntities.find((entity) => onlyDigits(entity.cnpj) === recipientCnpj) : undefined);
    const number = Number.parseInt(preview?.number ?? "", 10);
    return {
      error: file.status === "ERROR" ? 1 : 0,
      company: xmlQueueCompanyRank(own),
      companyCnpj: own ? "" : issuerCnpj ?? "",
      number: Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER
    };
  };
  return files
    .map((file) => ({ file, key: keyOf(file) }))
    .sort((left, right) =>
      left.key.error - right.key.error
      || left.key.company - right.key.company
      || left.key.companyCnpj.localeCompare(right.key.companyCnpj)
      || left.key.number - right.key.number
      || left.file.originalFileName.localeCompare(right.file.originalFileName))
    .map((item) => item.file);
}
