import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { multiplyDecimalByCents, normalizeDecimalText } from "../../src/shared/utils/decimal.js";
import {
  centralRecord,
  centralRecords,
  commitDomainChanges,
  requirePermission,
  requireWebSession,
  type DomainChange,
  type WebSession
} from "./domainMutations.js";
import { resolveRate } from "./operationalManagement.js";

type Row = Record<string, unknown>;
type ParsedRow = { rowNumber: number; data: Record<string, string> };
type RowStatus = "VALID" | "WARNING" | "ERROR" | "DUPLICATE" | "IMPORTED";
type NormalizedRow = {
  rowNumber: number;
  raw: Record<string, string>;
  data: Record<string, string>;
  status: RowStatus;
  errorCode: string | null;
  errorMessage: string | null;
  warningCodes: string[];
};

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_BODY_BYTES = 21 * 1024 * 1024;
const MAX_ROWS = 1000;

const fileSchema = z.object({
  organizationId: z.string().min(1),
  legalEntityId: z.string().min(1),
  fileName: z.string().trim().min(1).max(240),
  contentBase64: z.string().min(1).max(MAX_BODY_BYTES),
  sheetName: z.string().trim().min(1).max(120).optional(),
  headerRow: z.number().int().min(1).max(100).default(1)
});

const defaultsSchema = z.object({
  responsiblePartnerId: z.string().min(1),
  productId: z.string().min(1),
  operationType: z.enum(["SALE", "PURCHASE"]),
  operationScope: z.enum(["INTERNAL", "EXTERNAL"]),
  defaultDate: z.string().date()
});

const validateSchema = fileSchema.extend({
  mapping: z.record(z.string(), z.string()),
  defaults: defaultsSchema,
  // Como no aplicativo: linhas com aviso so entram quando o usuario pede.
  importWarnings: z.boolean().default(false)
});

const FIELD_ALIASES: Record<string, string[]> = {
  date: ["DATA", "DT", "DATA NF", "EMISSAO", "DATA EMISSAO"],
  issuerName: ["EMPRESA", "EMITENTE", "FORNECEDOR", "VENDEDOR", "RAZAO SOCIAL"],
  sacks: ["SACAS", "QTD SACAS", "QUANTIDADE", "QUANT", "QTD"],
  destinationName: ["DESTINO", "DESTINATARIO", "COMPRADOR", "LOCAL DE DESCARGA"],
  documentNumber: ["NF", "NFE", "NOTA", "NOTA FISCAL", "N NF", "NUMERO NF"],
  series: ["SERIE", "SERIE NF"],
  clientName: ["CLIENTE", "CORRETOR", "RESPONSAVEL"],
  operationScope: ["UF DA VENDA", "INTERNO X EXTERNO", "INTERNO/EXTERNO", "INTERNA/EXTERNA", "TIPO", "OPERACAO", "CLASSIFICACAO"],
  contractNumber: ["CONTRATO", "N DO CONTRATO", "NUMERO DO CONTRATO", "N CONTRATO"],
  commercialUnitPrice: ["VALOR UNITARIO", "PRECO UNITARIO", "VALOR POR SACA", "R$/SACA"],
  totalCommercialAmount: ["VALOR TOTAL", "TOTAL", "VALOR DA NOTA", "TOTAL NOTA"],
  notes: ["OBS", "OBSERVACAO", "OBSERVACOES", "NOTAS"]
};

const text = (value: unknown): string => String(value ?? "");
const active = (row: Row | null | undefined): boolean => Boolean(row) && row!.is_active !== 0 && row!.is_active !== false;
const numeric = (value: unknown): number => {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

class HttpError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) { super(message); }
}

function normalizeHeader(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[º°ª]/g, "")
    .replace(/[^\p{Letter}\p{Number}/ ]/gu, " ").replace(/\s+/g, " ").trim().toUpperCase();
}

function suggestedMapping(headers: string[]): Record<string, string> {
  const normalized = headers.map((header) => [header, normalizeHeader(header)] as const);
  return Object.fromEntries(Object.entries(FIELD_ALIASES).flatMap(([field, aliases]) => {
    const found = normalized.find(([, header]) => aliases.includes(header));
    return found ? [[field, found[0]]] : [];
  }));
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
}

async function loadWorkbook(input: z.infer<typeof fileSchema>): Promise<{ workbook: ExcelJS.Workbook; sizeBytes: number }> {
  if (!input.fileName.toLowerCase().endsWith(".xlsx")) throw new HttpError(400, "FILE_TYPE", "Selecione uma planilha .xlsx.");
  let buffer: Buffer;
  try { buffer = Buffer.from(input.contentBase64, "base64"); } catch { throw new HttpError(400, "FILE_ENCODING", "Arquivo de planilha invalido."); }
  if (!buffer.length) throw new HttpError(400, "EMPTY_FILE", "A planilha esta vazia.");
  if (buffer.length > MAX_FILE_BYTES) throw new HttpError(413, "FILE_TOO_LARGE", "A importacao web aceita planilhas de ate 15 MB.");
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
  catch { throw new HttpError(400, "INVALID_WORKBOOK", "Nao foi possivel ler esta planilha .xlsx."); }
  if (!workbook.worksheets.length) throw new HttpError(400, "EMPTY_WORKBOOK", "A planilha nao possui abas.");
  return { workbook, sizeBytes: buffer.length };
}

function readRows(workbook: ExcelJS.Workbook, requestedSheet: string | undefined, headerRow: number): {
  sheet: ExcelJS.Worksheet; headers: string[]; rows: ParsedRow[];
} {
  const sheet = requestedSheet ? workbook.getWorksheet(requestedSheet) : workbook.worksheets[0];
  if (!sheet) throw new HttpError(404, "SHEET_NOT_FOUND", "Aba da planilha nao encontrada.");
  const values = sheet.getRow(headerRow).values;
  const headers = (Array.isArray(values) ? values : []).slice(1).map((value) => cellText(value as ExcelJS.CellValue));
  if (!headers.some(Boolean)) throw new HttpError(400, "EMPTY_HEADER", "A linha de cabecalho esta vazia.");
  const rows: ParsedRow[] = [];
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const data: Record<string, string> = {};
    headers.forEach((header, index) => { if (header) data[header] = cellText(row.getCell(index + 1).value); });
    const valuesUpper = Object.values(data).map((value) => value.trim().toUpperCase());
    if (valuesUpper.every((value) => !value)) continue;
    if (valuesUpper.some((value) => ["TOTAL", "TOTAL GERAL", "SOMA", "RESUMO"].includes(value))) continue;
    rows.push({ rowNumber, data });
    if (rows.length > MAX_ROWS) throw new HttpError(413, "TOO_MANY_ROWS", `A importacao web aceita ate ${MAX_ROWS} linhas por vez. Divida a planilha em partes.`);
  }
  return { sheet, headers, rows };
}

function normalizeDate(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : null;
}

function normalizeBrazilianDecimal(value: string): string | null {
  const raw = value.replace(/[R$\s]/g, "");
  const decimal = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(?:\.\d+)?$/.test(decimal)) return null;
  try { return normalizeDecimalText(decimal); } catch { return null; }
}

function moneyCents(value: string): number {
  const decimal = normalizeBrazilianDecimal(value) ?? "0";
  return multiplyDecimalByCents(decimal, 100);
}

function normalizedScope(value: string): "INTERNAL" | "EXTERNAL" | null {
  const upper = normalizeHeader(value);
  if (["INTERNO", "INTERNA", "INT", "I", "MESMA UF"].includes(upper)) return "INTERNAL";
  if (["EXTERNO", "EXTERNA", "EXT", "E", "OUTRA UF"].includes(upper)) return "EXTERNAL";
  return null;
}

type PartnerIndex = Map<string, Array<{ id: string; roles: string[] }>>;
const partnerName = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

// Como o aplicativo (handlers.ts, validateSpreadsheetRows): a coluna CLIENTE
// escolhe o cadastro pelo nome exato; se nao houver um unico, a linha falha.
async function partnerIndex(pool: pg.Pool): Promise<PartnerIndex> {
  const [partners, roles] = await Promise.all([centralRecords(pool, "business_partners"), centralRecords(pool, "business_partner_roles")]);
  const rolesByPartner = new Map<string, string[]>();
  for (const role of roles) rolesByPartner.set(text(role.business_partner_id), [...(rolesByPartner.get(text(role.business_partner_id)) ?? []), text(role.role)]);
  const index: PartnerIndex = new Map();
  for (const partner of partners.filter(active)) {
    const key = partnerName(text(partner.display_name));
    index.set(key, [...(index.get(key) ?? []), { id: text(partner.id), roles: rolesByPartner.get(text(partner.id)) ?? [] }]);
  }
  return index;
}

function normalizeRows(rows: ParsedRow[], mapping: Record<string, string>, defaults: z.infer<typeof defaultsSchema>, partners: PartnerIndex): NormalizedRow[] {
  const requiredRole = defaults.operationType === "PURCHASE" ? "SUPPLIER" : "CLIENT";
  return rows.map<NormalizedRow>(({ rowNumber, data: raw }) => {
    const pick = (field: string): string => raw[mapping[field] ?? ""]?.trim() ?? "";
    const warningCodes: string[] = [];
    const customerName = pick("clientName");
    let clientPartnerId = defaults.responsiblePartnerId;
    if (customerName) {
      const candidates = partners.get(partnerName(customerName)) ?? [];
      if (candidates.length !== 1) {
        return { rowNumber, raw, data: {} as Record<string, string>, status: "ERROR", errorCode: "CLIENT_NOT_FOUND", errorMessage: `Cliente "${customerName}" nao identificado de forma unica. Confira o cadastro antes de importar.`, warningCodes };
      }
      if (!candidates[0].roles.includes(requiredRole)) {
        return { rowNumber, raw, data: {} as Record<string, string>, status: "ERROR", errorCode: "PARTNER_ROLE", errorMessage: `"${customerName}" nao tem o papel ${requiredRole === "SUPPLIER" ? "Fornecedor" : "Cliente/corretor"}.`, warningCodes };
      }
      clientPartnerId = candidates[0].id;
    }
    const date = normalizeDate(pick("date") || defaults.defaultDate);
    const sacks = normalizeBrazilianDecimal(pick("sacks"));
    const documentNumber = pick("documentNumber");
    const scope = normalizedScope(pick("operationScope")) ?? defaults.operationScope;
    if (!date || !sacks || numeric(sacks) <= 0 || !documentNumber) {
      return { rowNumber, raw, data: {} as Record<string, string>, status: "ERROR", errorCode: "MISSING_REQUIRED", errorMessage: "Data, sacas e numero da NF sao obrigatorios.", warningCodes };
    }
    if (!pick("clientName")) warningCodes.push("CLIENT_FROM_DEFAULT");
    if (!pick("operationScope")) warningCodes.push("SCOPE_FROM_DEFAULT");
    return {
      rowNumber, raw,
      data: {
        date, sacks, documentNumber, series: pick("series"), contractNumber: pick("contractNumber"),
        clientPartnerId, productId: defaults.productId, operationScope: scope,
        issuerName: pick("issuerName"), destinationName: pick("destinationName"),
        commercialUnitPrice: normalizeBrazilianDecimal(pick("commercialUnitPrice") || "0") ?? "0",
        totalAmountCents: String(moneyCents(pick("totalCommercialAmount") || "0")), notes: pick("notes")
      },
      status: warningCodes.length ? "WARNING" : "VALID", errorCode: null, errorMessage: null, warningCodes
    };
  });
}

async function recordsWhere(pool: pg.Pool, table: string, field: string, values: string[]): Promise<Row[]> {
  if (!values.length) return [];
  const result = await pool.query<{ row_data: Row }>(
    "SELECT row_data FROM central_records WHERE table_name = $1 AND deleted = false AND row_data->>$2 = ANY($3::text[])",
    [table, field, values]
  );
  return result.rows.map((row) => row.row_data);
}

async function validateScope(pool: pg.Pool, input: z.infer<typeof validateSchema>, session: WebSession, reply: FastifyReply): Promise<boolean> {
  if (!(await requirePermission(pool, session, reply, "imports.manage", input.organizationId, input.legalEntityId))) return false;
  const [entity, partner, product, roles] = await Promise.all([
    centralRecord(pool, "legal_entities", input.legalEntityId), centralRecord(pool, "business_partners", input.defaults.responsiblePartnerId),
    centralRecord(pool, "products", input.defaults.productId), recordsWhere(pool, "business_partner_roles", "business_partner_id", [input.defaults.responsiblePartnerId])
  ]);
  if (!entity || !active(entity) || text(entity.organization_id) !== input.organizationId) throw new HttpError(404, "OWN_ENTITY", "Empresa propria nao encontrada.");
  if (!partner || !active(partner) || text(partner.organization_id) !== input.organizationId) throw new HttpError(404, "PARTNER", "Cliente ou fornecedor nao encontrado.");
  const requiredRole = input.defaults.operationType === "PURCHASE" ? "SUPPLIER" : "CLIENT";
  if (!roles.some((role) => text(role.role) === requiredRole)) throw new HttpError(409, "PARTNER_ROLE", requiredRole === "SUPPLIER" ? "Selecione um cadastro com papel Fornecedor." : "Selecione um cadastro com papel Cliente/corretor.");
  if (!product || !active(product) || text(product.organization_id) !== input.organizationId) throw new HttpError(404, "PRODUCT", "Produto nao encontrado.");
  return true;
}

function summary(rows: NormalizedRow[]) {
  const count = (status: RowStatus) => rows.filter((row) => row.status === status).length;
  return { totalRows: rows.length, validRows: count("VALID"), warningRows: count("WARNING"), errorRows: count("ERROR"), duplicateRows: count("DUPLICATE") };
}

async function send(reply: FastifyReply, action: () => Promise<unknown>): Promise<unknown> {
  try { return await action(); }
  catch (error) {
    if (error instanceof HttpError) return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    throw error;
  }
}

export function registerSpreadsheetManagementRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.post("/v1/manage/invoices/spreadsheet/inspect", { bodyLimit: MAX_BODY_BYTES }, async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = fileSchema.parse(request.body);
    return send(reply, async () => {
      if (!(await requirePermission(pool, session, reply, "imports.manage", input.organizationId, input.legalEntityId))) return;
      const { workbook, sizeBytes } = await loadWorkbook(input);
      const selected = readRows(workbook, input.sheetName, input.headerRow);
      return {
        fileName: input.fileName, sizeBytes, selectedSheetName: selected.sheet.name,
        sheets: workbook.worksheets.map((sheet) => ({ name: sheet.name, rowCount: sheet.actualRowCount })),
        headers: selected.headers, rows: selected.rows.slice(0, 10), suggestedMapping: suggestedMapping(selected.headers),
        totalRows: selected.rows.length, limits: { maxFileBytes: MAX_FILE_BYTES, maxRows: MAX_ROWS }
      };
    });
  });

  app.post("/v1/manage/invoices/spreadsheet/validate", { bodyLimit: MAX_BODY_BYTES }, async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = validateSchema.parse(request.body);
    return send(reply, async () => {
      if (!(await validateScope(pool, input, session, reply))) return;
      const { workbook } = await loadWorkbook(input);
      const selected = readRows(workbook, input.sheetName, input.headerRow);
      const rows = normalizeRows(selected.rows, input.mapping, input.defaults, await partnerIndex(pool));
      return { ...summary(rows), rows: rows.slice(0, 200) };
    });
  });

  app.post("/v1/manage/invoices/spreadsheet/import", { bodyLimit: MAX_BODY_BYTES }, async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = validateSchema.parse(request.body);
    return send(reply, async () => {
      if (!(await validateScope(pool, input, session, reply))) return;
      const { workbook } = await loadWorkbook(input);
      const selected = readRows(workbook, input.sheetName, input.headerRow);
      const rows = normalizeRows(selected.rows, input.mapping, input.defaults, await partnerIndex(pool));
      const importable = (row: NormalizedRow): boolean => row.status === "VALID" || (input.importWarnings && row.status === "WARNING");
      if (!rows.some(importable)) throw new HttpError(409, "NO_VALID_ROWS", input.importWarnings ? "Nenhuma linha valida para importar." : "Nenhuma linha sem aviso para importar. Marque a opcao de importar tambem as linhas com aviso.");

      const [documents, rules] = await Promise.all([
        centralRecords(pool, "fiscal_documents"),
        centralRecords(pool, input.defaults.operationType === "SALE" ? "service_rate_rules" : "purchase_rate_rules")
      ]);
      const jobId = randomUUID();
      const now = new Date().toISOString();
      const groups = new Map<string, { documentId: string; first: NormalizedRow }>();
      const changes: DomainChange[] = [];
      let importedRows = 0;

      for (const row of rows) {
        const rowId = randomUUID();
        let documentId: string | null = null;
        let operationId: string | null = null;
        const partnerId = row.data.clientPartnerId || input.defaults.responsiblePartnerId;
        const rate = importable(row)
          ? resolveRate(rules, input.defaults.operationType, input.organizationId, partnerId, input.legalEntityId, null,
            input.defaults.productId, row.data.operationScope as "INTERNAL" | "EXTERNAL", row.data.date, false)
          : null;
        if (rate?.status === "conflict") {
          row.status = "ERROR"; row.errorCode = "RATE_CONFLICT"; row.errorMessage = "Ha conflito entre regras por saca para esta linha.";
        }
        if (importable(row) && rate) {
          const key = `${partnerId}|${row.data.documentNumber}|${row.data.series}`;
          const existingGroup = groups.get(key);
          const duplicate = !existingGroup && documents.some((document) =>
            text(document.organization_id) === input.organizationId && text(document.own_legal_entity_id) === input.legalEntityId
            && text(document.responsible_partner_id) === partnerId
            && text(document.document_number) === row.data.documentNumber && text(document.series) === row.data.series
            && text(document.issue_date) === row.data.date && text(document.status) !== "CANCELED"
          );
          if (duplicate) {
            row.status = "DUPLICATE"; row.errorCode = "DUPLICATE_DOCUMENT"; row.errorMessage = "Nota ja cadastrada para esta empresa e responsavel.";
          } else {
            documentId = existingGroup?.documentId ?? randomUUID();
            if (!existingGroup) {
              groups.set(key, { documentId, first: row });
              changes.push({
                table: "fiscal_documents", key: documentId, operation: "UPSERT", data: {
                  id: documentId, organization_id: input.organizationId, own_legal_entity_id: input.legalEntityId,
                  responsible_partner_id: partnerId, partner_legal_entity_id: null,
                  secondary_responsible_partner_id: null, secondary_operation_type: null, document_type: "MANUAL_INVOICE",
                  access_key: null, document_number: row.data.documentNumber, series: row.data.series || null,
                  issue_date: row.data.date, total_amount_cents: Number(row.data.totalAmountCents || 0),
                  status: row.status === "WARNING" ? "PENDING" : "DRAFT", has_pending_issues: row.status === "WARNING" ? 1 : 0,
                  pending_notes: row.warningCodes.length ? JSON.stringify(row.warningCodes) : null, duplicate_warning: null,
                  notes: row.data.notes || null, confirmed_at: null, canceled_at: null, cancel_reason: null,
                  source: "SPREADSHEET", import_job_id: jobId, import_row_id: rowId, xml_file_path: null, xml_file_hash: null,
                  protocol_number: null, protocol_date: null, authorization_status_code: null, authorization_status_message: null,
                  xml_import_job_id: null, merged_from_source: null, merged_at: null,
                  direction: input.defaults.operationType === "PURCHASE" ? "INBOUND" : "OUTBOUND", fiscal_snapshot_json: null,
                  contract_number: row.data.contractNumber || null, billing_observations: null, freight_dae_reference: null,
                  freight_dae_amount_cents: 0, has_financial_service: 0, created_at: now, updated_at: now
                }
              });
            }
            const itemId = randomUUID();
            operationId = randomUUID();
            const pending = row.status === "WARNING" || rate.status === "missing";
            changes.push({ table: "fiscal_document_items", key: itemId, operation: "UPSERT", data: {
              id: itemId, fiscal_document_id: documentId, product_id: input.defaults.productId,
              description: "Item importado por planilha", quantity_decimal: row.data.sacks, unit: "SACK",
              unit_price_decimal: row.data.commercialUnitPrice || "0", total_amount_cents: Number(row.data.totalAmountCents || 0),
              sacks_quantity_decimal: row.data.sacks, created_at: now, updated_at: now
            } });
            changes.push({ table: "operations", key: operationId, operation: "UPSERT", data: {
              id: operationId, fiscal_document_id: documentId, fiscal_document_item_id: itemId, organization_id: input.organizationId,
              own_legal_entity_id: input.legalEntityId, responsible_partner_id: partnerId,
              product_id: input.defaults.productId, operation_type: input.defaults.operationType,
              operation_scope: row.data.operationScope, operation_date: row.data.date,
              quantity_sacks_decimal: row.data.sacks, gross_quantity_sacks_decimal: row.data.sacks,
              service_rate_rule_id: input.defaults.operationType === "SALE" ? rate.rule?.id ?? null : null,
              purchase_rate_rule_id: input.defaults.operationType === "PURCHASE" ? rate.rule?.id ?? null : null,
              applied_rate_value_cents: rate.rateCents, service_amount_cents: multiplyDecimalByCents(row.data.sacks, rate.rateCents),
              rate_was_manually_overridden: 0, manual_rate_value_cents: null, manual_override_reason: null,
              notes: row.data.notes || null, status: pending ? "PENDING" : "DRAFT", source: "SPREADSHEET",
              import_job_id: jobId, import_row_id: rowId, xml_import_job_id: null, classification_rule_id: null,
              billing_status: "UNBILLED", client_charge_id: null, purchase_settlement_status: "UNSETTLED",
              account_payable_id: null, created_at: now, updated_at: now
            } });
            row.status = "IMPORTED";
            importedRows += 1;
          }
        }
        changes.push({ table: "spreadsheet_import_rows", key: rowId, operation: "UPSERT", data: {
          id: rowId, import_job_id: jobId, sheet_name: selected.sheet.name, source_row_number: row.rowNumber,
          raw_data_json: JSON.stringify(row.raw), normalized_data_json: Object.keys(row.data).length ? JSON.stringify(row.data) : null,
          status: row.status, fiscal_document_id: documentId, operation_id: operationId,
          error_code: row.errorCode, error_message: row.errorMessage, warning_codes_json: JSON.stringify(row.warningCodes),
          created_at: now, updated_at: now
        } });
      }

      const finalSummary = summary(rows);
      const jobStatus = finalSummary.errorRows ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
      changes.unshift({ table: "spreadsheet_import_jobs", key: jobId, operation: "UPSERT", data: {
        id: jobId, organization_id: input.organizationId, own_legal_entity_id: input.legalEntityId, mapping_template_id: null,
        original_file_name: input.fileName, stored_file_path: null, selected_sheet_name: selected.sheet.name,
        import_type: input.mapping.clientName ? "GENERAL_SALES" : "CLIENT_INDIVIDUAL", status: jobStatus,
        total_rows: rows.length, valid_rows: 0, warning_rows: 0, error_rows: finalSummary.errorRows,
        imported_rows: importedRows, duplicate_rows: finalSummary.duplicateRows, created_at: now, started_at: now,
        completed_at: now, cancelled_at: null, created_by_user_id: session.userId,
        settings_json: JSON.stringify({ mapping: input.mapping, defaults: input.defaults, webImport: true })
      } });

      const revision = await commitDomainChanges(pool, session, "WEB_SPREADSHEET_IMPORTED", "spreadsheet_import_job", jobId, changes, {
        organizationId: input.organizationId, legalEntityId: input.legalEntityId, fileName: input.fileName,
        sheetName: selected.sheet.name, totalRows: rows.length, importedRows
      });
      return reply.code(201).send({ id: jobId, revision, status: jobStatus, ...finalSummary, importedRows });
    });
  });
}
