import ExcelJS from "exceljs";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type pg from "pg";
import { registerSpreadsheetManagementRoutes } from "../server/src/spreadsheetManagement.js";

type Row = Record<string, unknown>;

function spreadsheetPool() {
  const records = new Map<string, Map<string, Row>>();
  let revision = 1;
  const table = (name: string) => { const current = records.get(name) ?? new Map<string, Row>(); records.set(name, current); return current; };
  table("legal_entities").set("entity", { id: "entity", organization_id: "org", trade_name: "Villa MG", is_active: 1 });
  for (const [id, name, role] of [["if", "IF", "CLIENT"], ["katuai", "KATUAI", "CLIENT"], ["leo", "Leo ES", "SUPPLIER"]] as const) {
    table("business_partners").set(id, { id, organization_id: "org", display_name: name, is_active: 1 });
    table("business_partner_roles").set(`r-${id}`, { id: `r-${id}`, business_partner_id: id, role });
  }
  table("products").set("arabica", { id: "arabica", organization_id: "org", name: "Cafe Arabica", is_active: 1 });
  table("service_rate_rules").set("s-if", { id: "s-if", organization_id: "org", business_partner_id: "if", operation_scope: "ALL", rate_value_cents: 500, effective_from: "2026-01-01", effective_to: null, priority: 0, is_active: 1 });
  table("service_rate_rules").set("s-katuai", { id: "s-katuai", organization_id: "org", business_partner_id: "katuai", operation_scope: "ALL", rate_value_cents: 300, effective_from: "2026-01-01", effective_to: null, priority: 0, is_active: 1 });
  const query = async (sql: string, params: unknown[] = []) => {
    if (sql.includes("FROM api_sessions")) return { rows: [{ sessionId: "s", userId: "user", username: "g", displayName: "G", deviceId: "d" }] };
    if (sql.includes("UPDATE api_sessions")) return { rows: [] };
    if (sql.includes("FROM app_users")) return { rows: [{ is_central_admin: true, desktop_profile: {} }] };
    if (sql.includes("row_data->>$2 = ANY")) {
      const [name, field, values] = params as [string, string, string[]];
      return { rows: [...table(name).values()].filter((row) => values.includes(String(row[field] ?? ""))).map((row_data) => ({ row_data })) };
    }
    if (sql.includes("SELECT row_data FROM central_records")) {
      const current = table(String(params[0]));
      if (params.length > 1) return { rows: current.has(String(params[1])) ? [{ row_data: current.get(String(params[1])) }] : [] };
      return { rows: [...current.values()].map((row_data) => ({ row_data })) };
    }
    if (sql.includes("SELECT revision::text")) return { rows: [{ revision: String(revision) }] };
    if (sql.includes("INSERT INTO central_records")) {
      const [name, key, data, , next, deleted] = params;
      if (deleted) table(String(name)).delete(String(key)); else table(String(name)).set(String(key), JSON.parse(String(data)) as Row);
      revision = Number(next); return { rows: [] };
    }
    return { rows: [] };
  };
  const pool = { query, async connect() { return { query, release() {} }; } } as unknown as pg.Pool;
  const app = Fastify({ bodyLimit: 30 * 1024 * 1024 });
  registerSpreadsheetManagementRoutes(app, pool);
  const post = (url: string, payload: Record<string, unknown>) => app.inject({ method: "POST", url, headers: { authorization: "Bearer t", "content-type": "application/json" }, payload });
  return { table, post };
}

async function workbookBase64(): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Vendas");
  sheet.addRow(["Data", "NF", "Cliente", "Sacas", "Interno x Externo", "Valor Total"]);
  sheet.addRow(["05/10/2026", "101", "IF", "100", "INTERNO", "150.000,00"]);
  sheet.addRow(["05/10/2026", "101", "IF", "20,5", "INTERNO", "30.000,00"]);
  sheet.addRow(["06/10/2026", "102", "Katuai", "50", "EXTERNO", "75.000,00"]);
  sheet.addRow(["06/10/2026", "103", "CLIENTE QUE NAO EXISTE", "10", "INTERNO", "1,00"]);
  sheet.addRow(["07/10/2026", "", "IF", "10", "INTERNO", "1,00"]);
  sheet.addRow(["07/10/2026", "104", "IF", "30", "", "45.000,00"]);
  sheet.addRow(["TOTAL", "", "", "210,5", "", ""]);
  return Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
}

const base = { organizationId: "org", legalEntityId: "entity", fileName: "vendas-outubro.xlsx" };
const defaults = { responsiblePartnerId: "if", productId: "arabica", operationType: "SALE", operationScope: "INTERNAL", defaultDate: "2026-10-01" };

describe("importacao de notas por planilha pelo site", () => {
  it("le a planilha e sugere as colunas", async () => {
    const state = spreadsheetPool();
    const inspected = await state.post("/v1/manage/invoices/spreadsheet/inspect", { ...base, contentBase64: await workbookBase64() });
    expect(inspected.statusCode).toBe(200);
    expect(inspected.json()).toMatchObject({
      selectedSheetName: "Vendas", totalRows: 6,
      suggestedMapping: { date: "Data", documentNumber: "NF", clientName: "Cliente", sacks: "Sacas", operationScope: "Interno x Externo", totalCommercialAmount: "Valor Total" }
    });
  });

  it("valida cliente por linha, campos obrigatorios e avisos", async () => {
    const state = spreadsheetPool();
    const contentBase64 = await workbookBase64();
    const mapping = (await state.post("/v1/manage/invoices/spreadsheet/inspect", { ...base, contentBase64 })).json().suggestedMapping;
    const validated = (await state.post("/v1/manage/invoices/spreadsheet/validate", { ...base, contentBase64, mapping, defaults })).json();
    expect(validated).toMatchObject({ totalRows: 6, validRows: 3, warningRows: 1, errorRows: 2 });
    expect(validated.rows.find((row: { rowNumber: number }) => row.rowNumber === 5)).toMatchObject({ status: "ERROR", errorCode: "CLIENT_NOT_FOUND" });
    expect(validated.rows.find((row: { rowNumber: number }) => row.rowNumber === 4)).toMatchObject({ status: "VALID", data: { clientPartnerId: "katuai", operationScope: "EXTERNAL" } });
  });

  it("importa agrupando linhas da mesma NF, com tarifa do cliente da linha, e nao duplica", async () => {
    const state = spreadsheetPool();
    const contentBase64 = await workbookBase64();
    const mapping = (await state.post("/v1/manage/invoices/spreadsheet/inspect", { ...base, contentBase64 })).json().suggestedMapping;
    const imported = await state.post("/v1/manage/invoices/spreadsheet/import", { ...base, contentBase64, mapping, defaults });
    expect(imported.statusCode).toBe(201);
    expect(imported.json()).toMatchObject({ importedRows: 3, status: "COMPLETED_WITH_ERRORS" });
    const documents = [...state.table("fiscal_documents").values()];
    expect(documents.map((row) => row.document_number).sort()).toEqual(["101", "102"]);
    expect(documents.find((row) => row.document_number === "102")).toMatchObject({ responsible_partner_id: "katuai", source: "SPREADSHEET" });
    const operations = [...state.table("operations").values()];
    expect(operations.filter((row) => documents.find((document) => document.document_number === "101")?.id === row.fiscal_document_id)).toHaveLength(2);
    expect(operations.find((row) => row.responsible_partner_id === "katuai")).toMatchObject({ applied_rate_value_cents: 300, service_amount_cents: 15_000 });
    expect(operations.find((row) => row.quantity_sacks_decimal === "20.5")).toMatchObject({ service_amount_cents: 10_250 });

    const withWarnings = await state.post("/v1/manage/invoices/spreadsheet/import", { ...base, contentBase64, mapping, defaults, importWarnings: true });
    expect(withWarnings.json()).toMatchObject({ importedRows: 1, duplicateRows: 3 });
    expect([...state.table("fiscal_documents").values()].find((row) => row.document_number === "104")).toMatchObject({ status: "PENDING", has_pending_issues: 1 });
  });
});
