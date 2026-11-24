import type { BootstrapData, OperationScope, XmlFileInspection, XmlImportFile, XmlImportJob } from "../../../shared/types/domain";
import { formatCurrencyFromCents } from "../../../shared/utils/format";
import { classifyWarehouseXml, parseNfeExtractedPreview, resolveOwnAndCounterparty, type NfeExtractedPreview } from "./xmlPreview";

export function decimalTextBr(value: string | null): string {
  return value ? value.replace(".", ",") : "-";
}

export function xmlQuantityInSacks(
  quantity: string | null | undefined,
  unit: string | null | undefined
): string | null {
  if (!quantity) return null;

  const normalizedUnit = unit?.trim().toUpperCase() ?? "";
  const numericQuantity = Number(quantity.replace(",", "."));

  if (!Number.isFinite(numericQuantity)) return quantity;

  if (["KG", "KGS", "KILO", "KILOS", "QUILO", "QUILOS"].includes(normalizedUnit)) {
    const sacks = numericQuantity / 60;
    return sacks.toFixed(6).replace(/\.?0+$/, "");
  }

  return quantity;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function formatCnpjCompact(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 14) return value || "CNPJ nao informado";
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function xmlQueueSummaryLine(file: XmlFileInspection): string {
  const extracted = file.extractedData as Record<string, unknown> | null;
  const totals = extracted?.totals as Record<string, unknown> | undefined;
  const number = extracted?.number ? `NF ${String(extracted.number)}` : "NF sem numero";
  const date = typeof extracted?.issuedAt === "string" ? extracted.issuedAt.split("-").reverse().join("/") : null;
  const amount = typeof totals?.invoiceAmountCents === "number" ? formatCurrencyFromCents(totals.invoiceAmountCents) : null;
  return [number, date, amount].filter(Boolean).join(" · ");
}

export function xmlPartySummary(file: XmlFileInspection, direction: "INBOUND" | "OUTBOUND"): { title: string; subtitle: string } {
  const extracted = file.extractedData as Record<string, unknown> | null;
  const counterparty = extracted?.[direction === "INBOUND" ? "issuer" : "recipient"] as Record<string, unknown> | undefined;
  const ownParty = extracted?.[direction === "INBOUND" ? "recipient" : "issuer"] as Record<string, unknown> | undefined;
  const name = String(counterparty?.legalName ?? counterparty?.tradeName ?? (direction === "INBOUND" ? "Fornecedor nao identificado" : "Cliente nao identificado"));
  const counterpartyCnpj = formatCnpjCompact(counterparty?.cnpjCpf == null ? null : String(counterparty.cnpjCpf));
  const ownName = String(ownParty?.tradeName ?? ownParty?.legalName ?? "empresa propria");
  const ownCnpj = formatCnpjCompact(ownParty?.cnpjCpf == null ? null : String(ownParty.cnpjCpf));
  return {
    title: name,
    subtitle: `${direction === "INBOUND" ? "Fornecedor" : "Cliente"}: ${counterpartyCnpj} · ${direction === "INBOUND" ? "Recebida por" : "Emitida por"}: ${ownName} (${ownCnpj})`
  };
}

export function inferXmlOperationScope(preview: NfeExtractedPreview | null): OperationScope | null {
  const issuerState = preview?.issuer?.state?.trim().toUpperCase() ?? "";
  const recipientState = preview?.recipient?.state?.trim().toUpperCase() ?? "";
  if (!issuerState || !recipientState) return null;
  return issuerState === recipientState ? "INTERNAL" : "EXTERNAL";
}

export function xmlInspectionIsWarehouse(file: XmlFileInspection): boolean {
  return classifyWarehouseXml(parseNfeExtractedPreview(file.extractedData ?? null)) !== null;
}

export function xmlImportIsVisuallyDeleted(job: XmlImportJob): boolean {
  return job.status === "CANCELLED" || job.status === "REVERTED";
}

export function xmlImportFileIsVisuallyDeleted(file: XmlImportFile): boolean {
  return file.status === "REVERTED";
}

export type DocumentSortKey = "number" | "client";
export type SortDirection = "asc" | "desc";
export type OperationsPageTab = "received" | "issued" | "documents" | "spreadsheets";
export type VulpeDevScanResult = Awaited<ReturnType<Window["operationsCafe"]["scanVulpeDevXml"]>>;
export type VulpeDevStatusResult = Awaited<ReturnType<Window["operationsCafe"]["getVulpeDevStatus"]>>;
export type CollectorMonitorStatus = VulpeDevStatusResult["collectors"][number];

export function formatCollectorActivity(value: string | null): string {
  if (!value) return "Ainda nao registrado";
  const instant = new Date(value);
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - instant.getTime()) / 60_000));
  const relative = elapsedMinutes < 1
    ? "agora"
    : elapsedMinutes < 60
      ? `ha ${elapsedMinutes} min`
      : elapsedMinutes < 1_440
        ? `ha ${Math.floor(elapsedMinutes / 60)} h`
        : `ha ${Math.floor(elapsedMinutes / 1_440)} dia(s)`;
  const exact = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "medium"
  }).format(instant);
  return `${relative} (${exact})`;
}

export function formatCollectorUptime(value: number | null): string {
  if (value === null) return "Ainda nao informado";
  const hours = Math.floor(value / 3_600);
  const minutes = Math.floor((value % 3_600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export function collectorCommandLabel(command: CollectorMonitorStatus["lastCommand"]): string {
  if (command === "SCAN_NOW") return "Buscar notas";
  if (command === "UPDATE_NOW") return "Atualizar coletor";
  if (command === "RESTART") return "Reiniciar coletor";
  if (command === "BACKFILL") return "Enviar notas do periodo";
  return "Nenhum comando enviado";
}

export function collectorCommandStatusLabel(status: CollectorMonitorStatus["lastCommandStatus"]): string {
  if (status === "PENDING") return "aguardando o coletor";
  if (status === "RUNNING") return "em execucao";
  if (status === "COMPLETED") return "concluido";
  if (status === "FAILED") return "falhou";
  return "";
}

export function collectorCompanyLabels(cnpjs: string[]): string {
  const labels = cnpjs.map((cnpj) => {
    if (cnpj === "16594876000224") return "Grao & Grao MG";
    if (cnpj === "16594876000496") return "Grao & Grao SP";
    if (cnpj === "44963370000108") return "Villa SP";
    return cnpj;
  });
  return labels.join(" e ");
}

// Data de hoje no fuso de Brasilia (AAAA-MM-DD).
export function brazilDateValue(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Nao foi possivel determinar a data de Brasilia.");
  }

  return `${year}-${month}-${day}`;
}


// Derivados do XML selecionado na importacao (mesmas regras de antes, agora em funcao pura).
export function buildSelectedXmlView(input: {
  selectedXmlFile: XmlFileInspection | null;
  partnerId: string;
  vulpeScan: unknown;
  xmlPartnerOverrides: Record<string, string>;
  legalEntities: BootstrapData["legalEntities"];
  ownLegalEntity: BootstrapData["legalEntities"][number] | null;
  xmlScopeOverrides: Record<string, OperationScope>;
  scope: OperationScope;
  operationType: "PURCHASE" | "SALE";
  resolveOperationType: (token: string, extractedData: XmlFileInspection["extractedData"]) => "PURCHASE" | "SALE";
}) {
  const selectedXmlFile = input.selectedXmlFile;
  const selectedXmlIsEvent = selectedXmlFile?.xmlType.startsWith("EVENT_") === true;
  const selectedXmlEvent = selectedXmlIsEvent ? selectedXmlFile?.extractedData ?? null : null;
  const selectedXmlPartnerId = selectedXmlFile && input.vulpeScan
    ? input.xmlPartnerOverrides[selectedXmlFile.token] ?? ""
    : input.partnerId;
  const selectedXmlPreview = parseNfeExtractedPreview(selectedXmlFile?.extractedData ?? null);
  const selectedWarehouseMovement = classifyWarehouseXml(selectedXmlPreview);
  const selectedXmlExtractedContract = typeof selectedXmlFile?.extractedData?.contractNumber === "string"
    ? selectedXmlFile.extractedData.contractNumber
    : "";
  const selectedXmlParties = resolveOwnAndCounterparty(selectedXmlPreview, input.legalEntities);
  const selectedXmlItem = selectedXmlPreview?.items[0] ?? null;
  const selectedXmlSacks = xmlQuantityInSacks(selectedXmlItem?.commercialQuantity, selectedXmlItem?.commercialUnit);
  const selectedXmlInferredScope = inferXmlOperationScope(selectedXmlPreview);
  const selectedXmlScope = selectedXmlFile ? selectedXmlInferredScope ?? input.xmlScopeOverrides[selectedXmlFile.token] ?? input.scope : input.scope;
  const selectedXmlOperationType = selectedXmlFile ? input.resolveOperationType(selectedXmlFile.token, selectedXmlFile.extractedData) : input.operationType;
  const selectedXmlOwnMismatch = Boolean(
    selectedXmlParties.ownEntityLabel &&
    input.ownLegalEntity &&
    selectedXmlParties.ownEntityLabel !== (input.ownLegalEntity.legalName || input.ownLegalEntity.tradeName)
  );
  return {
    selectedXmlIsEvent, selectedXmlEvent, selectedXmlPartnerId, selectedXmlPreview, selectedWarehouseMovement,
    selectedXmlExtractedContract, selectedXmlParties, selectedXmlItem, selectedXmlSacks, selectedXmlInferredScope,
    selectedXmlScope, selectedXmlOperationType, selectedXmlOwnMismatch
  };
}
