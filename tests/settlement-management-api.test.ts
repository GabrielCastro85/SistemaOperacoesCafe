import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type pg from "pg";
import { registerSettlementManagementRoutes } from "../server/src/settlementManagement.js";

type Row = Record<string, unknown>;
const ORG = "11111111-1111-4111-8111-111111111111";
const ORG2 = "11111111-1111-4111-8111-111111111112";
const OWN = "33333333-3333-4333-8333-333333333331";
const CLIENT = "bbbbbbbb-0000-4000-8000-000000000001";
const CLIENT_GRAO = "bbbbbbbb-0000-4000-8000-000000000003";
const SUPPLIER = "bbbbbbbb-0000-4000-8000-000000000002";
const CATEGORY = "cccccccc-0000-4000-8000-000000000001";

function settlementPool() {
  const records = new Map<string, Map<string, Row>>();
  let revision = 1;
  const table = (name: string) => { const current = records.get(name) ?? new Map<string, Row>(); records.set(name, current); return current; };
  table("organizations").set(ORG, { id: ORG, display_name: "Villa Coffee" });
  table("organizations").set(ORG2, { id: ORG2, display_name: "Grao & Grao" });
  table("legal_entities").set(OWN, { id: OWN, organization_id: ORG, legal_name: "VILLA COFFEE COMERCIO LTDA", trade_name: "Villa Coffee MG", cnpj: "44963370000523" });
  table("business_partners").set(CLIENT, { id: CLIENT, organization_id: ORG, display_name: "Cafe Bom Ltda", document_number: "11.222.333/0001-44", is_active: 1 });
  table("business_partners").set(CLIENT_GRAO, { id: CLIENT_GRAO, organization_id: ORG2, display_name: "CAFE BOM", document_number: null, is_active: 1 });
  table("business_partners").set(SUPPLIER, { id: SUPPLIER, organization_id: ORG, display_name: "Produtor Joao", is_active: 1 });
  [[CLIENT, "CLIENT"], [CLIENT_GRAO, "CLIENT"], [SUPPLIER, "SUPPLIER"]].forEach(([id, role], index) => table("business_partner_roles").set(`r${index}`, { id: `r${index}`, business_partner_id: id, role }));
  table("expense_categories").set(CATEGORY, { id: CATEGORY, organization_id: ORG, name: "Compras de cafe", is_active: 1 });
  table("partner_legal_entities").set("pe1", { id: "pe1", business_partner_id: SUPPLIER, legal_name: "JOAO DA SILVA", cnpj: "123.456.789-00", is_primary: 1, is_active: 1 });
  const doc = (id: string, org: string, number: string, total: number, extra: Row = {}) => table("fiscal_documents").set(id, {
    id, organization_id: org, own_legal_entity_id: OWN, document_number: number, series: "1", issue_date: `2026-10-${number.slice(-2)}`, status: "CONFIRMED",
    total_amount_cents: total, has_pending_issues: 0, fiscal_snapshot_json: JSON.stringify({ issuer: { legalName: "VILLA COFFEE" }, recipient: { legalName: "CAFE BOM LTDA" } }), ...extra
  });
  const op = (id: string, docId: string, org: string, partner: string, type: string, extra: Row = {}) => table("operations").set(id, {
    id, fiscal_document_id: docId, organization_id: org, own_legal_entity_id: OWN, responsible_partner_id: partner, operation_type: type,
    status: "CONFIRMED", operation_date: "2026-10-10", quantity_sacks_decimal: "100", operation_scope: "INTERNAL", applied_rate_value_cents: 200,
    service_amount_cents: 20_000, purchase_settlement_status: "UNSETTLED", account_payable_id: null, created_at: "x", ...extra
  });
  doc("d1", ORG, "1001", 1_000_000); op("o1", "d1", ORG, CLIENT, "SALE");
  doc("d2", ORG2, "2002", 500_000); op("o2", "d2", ORG2, CLIENT_GRAO, "SALE");
  doc("d3", ORG, "3003", 900_000); op("o3", "d3", ORG, SUPPLIER, "PURCHASE");
  doc("d4", ORG, "3004", 300_000); op("o4", "d4", ORG, SUPPLIER, "PURCHASE", { quantity_sacks_decimal: "50", service_amount_cents: 10_000 });
  doc("d5", ORG, "3005", 300_000, { has_pending_issues: 1 }); op("o5", "d5", ORG, SUPPLIER, "PURCHASE");
  const query = async (sql: string, params: unknown[] = []) => {
    if (sql.includes("FROM api_sessions")) return { rows: [{ sessionId: "s", userId: "u", username: "g", displayName: "G", deviceId: "d" }] };
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
  const app = Fastify();
  registerSettlementManagementRoutes(app, pool);
  const call = (method: "GET" | "POST" | "DELETE", url: string, payload?: Record<string, unknown>) => app.inject({
    method, url, headers: payload ? { authorization: "Bearer t", "content-type": "application/json" } : { authorization: "Bearer t" }, ...(payload ? { payload } : {})
  });
  return { table, call };
}

const invoicesUrl = (extra = "") => `/v1/manage/transfer-reconciliations/invoices?organizationId=${ORG}&partnerId=${CLIENT}&role=CLIENT${extra}`;

describe("repasses pelo site", () => {
  it("lista notas das duas empresas pelo mesmo nome e desconta o que ja foi usado", async () => {
    const state = settlementPool();
    const first = (await state.call("GET", invoicesUrl())).json();
    expect(first.map((row: { documentNumber: string }) => row.documentNumber).sort()).toEqual(["1001", "2002"]);
    expect(first.find((row: { documentNumber: string }) => row.documentNumber === "2002")).toMatchObject({ organizationName: "Grao & Grao", availableCents: 500_000 });

    const saved = await state.call("POST", "/v1/manage/transfer-reconciliations", {
      organizationId: ORG, clientPartnerId: CLIENT, referenceDate: "2026-11-06", title: "Repasse outubro", status: "COMPLETED",
      invoices: [{ fiscalDocumentId: "d1", sourceAmountCents: 1_000_000 }],
      payments: [{ beneficiaryName: "Fulano", amountCents: 400_000 }, { beneficiaryName: "Ciclano", amountCents: 200_000, paymentDate: "2026-11-05" }]
    });
    expect(saved.statusCode).toBe(201);
    expect(saved.json()).toMatchObject({ status: "COMPLETED", balanceCents: 400_000 });
    const id = saved.json().id as string;
    // Concluida: usa so o que foi pago (600 mil) da nota.
    expect((await state.call("GET", invoicesUrl())).json().find((row: { documentNumber: string }) => row.documentNumber === "1001")).toMatchObject({ previouslyUsedCents: 600_000, availableCents: 400_000 });
    // Na propria conferencia a nota continua inteira disponivel.
    expect((await state.call("GET", invoicesUrl(`&reconciliationId=${id}`))).json().find((row: { documentNumber: string }) => row.documentNumber === "1001").availableCents).toBe(1_000_000);

    const tooMuch = await state.call("POST", "/v1/manage/transfer-reconciliations", {
      organizationId: ORG, clientPartnerId: CLIENT, referenceDate: "2026-11-06", invoices: [{ fiscalDocumentId: "d1", sourceAmountCents: 500_000 }], payments: []
    });
    expect(tooMuch.statusCode).toBe(409);

    const detail = (await state.call("GET", `/v1/manage/transfer-reconciliations/${id}`)).json();
    expect(detail.invoices[0]).toMatchObject({ documentNumber: "1001", recipientName: "CAFE BOM LTDA", sourceAmountCents: 1_000_000 });
    expect(detail.payments.map((row: { beneficiaryName: string }) => row.beneficiaryName)).toEqual(["Fulano", "Ciclano"]);

    // Editar: mantem a linha da nota, troca pagamentos.
    const invoiceId = detail.invoices[0].id;
    const edited = await state.call("POST", "/v1/manage/transfer-reconciliations", {
      id, organizationId: ORG, clientPartnerId: CLIENT, referenceDate: "2026-11-06", status: "COMPLETED",
      invoices: [{ fiscalDocumentId: "d1", sourceAmountCents: 1_000_000 }, { fiscalDocumentId: "d2", sourceAmountCents: 100_000 }],
      payments: [{ id: detail.payments[0].id, beneficiaryName: "Fulano", amountCents: 1_100_000 }]
    });
    expect(edited.json()).toMatchObject({ balanceCents: 0 });
    expect([...state.table("transfer_reconciliation_invoices").values()].map((row) => row.id)).toContain(invoiceId);
    expect(state.table("transfer_reconciliation_invoices").size).toBe(2);
    expect(state.table("transfer_reconciliation_payments").size).toBe(1);

    const balances = (await state.call("GET", `/v1/manage/transfer-reconciliations/balances?organizationId=${ORG}`)).json();
    expect(balances).toEqual([expect.objectContaining({ clientPartnerId: CLIENT, netBalanceCents: 0, openReconciliations: 0 })]);

    expect((await state.call("POST", `/v1/manage/transfer-reconciliations/${id}/cancel`, {})).json().status).toBe("CANCELLED");
    expect((await state.call("GET", invoicesUrl())).json().find((row: { documentNumber: string }) => row.documentNumber === "1001").availableCents).toBe(1_000_000);
    expect((await state.call("DELETE", `/v1/manage/transfer-reconciliations/${id}`)).json().deleted).toBe(true);
    expect(state.table("transfer_reconciliations").size).toBe(0);
    expect(state.table("transfer_reconciliation_invoices").size).toBe(0);
  });

  it("conferencia com valor manual nao aceita notas e exige papel correto", async () => {
    const state = settlementPool();
    const manual = await state.call("POST", "/v1/manage/transfer-reconciliations", {
      organizationId: ORG, clientPartnerId: CLIENT, referenceDate: "2026-11-06", sourceMode: "MANUAL", manualSourceCents: 50_000,
      payments: [{ beneficiaryName: "X", amountCents: 70_000 }]
    });
    expect(manual.json()).toMatchObject({ status: "DRAFT", balanceCents: -20_000 });
    expect((await state.call("POST", "/v1/manage/transfer-reconciliations", {
      organizationId: ORG, clientPartnerId: SUPPLIER, referenceDate: "2026-11-06", sourceMode: "MANUAL", manualSourceCents: 50_000
    })).statusCode).toBe(409);
  });
});

describe("acertos de entrada pelo site", () => {
  it("gera a conta a pagar das compras, bloqueia repeticao e cancela devolvendo as notas", async () => {
    const state = settlementPool();
    const eligible = (await state.call("GET", `/v1/manage/purchase-settlements/eligible?organizationId=${ORG}&legalEntityId=${OWN}&supplierPartnerId=${SUPPLIER}&periodStart=2026-10-01&periodEnd=2026-10-31`)).json();
    expect(eligible.map((row: { id: string }) => row.id)).toEqual(["o3", "o4"]);
    const options = (await state.call("GET", `/v1/manage/purchase-settlements/options?organizationId=${ORG}`)).json();
    expect(options.suppliers).toEqual([{ id: SUPPLIER, displayName: "Produtor Joao" }]);
    expect(options.categories[0].id).toBe(CATEGORY);

    const created = await state.call("POST", "/v1/manage/purchase-settlements", {
      organizationId: ORG, ownLegalEntityId: OWN, supplierPartnerId: SUPPLIER, operationIds: ["o3", "o4"], categoryId: CATEGORY, dueDate: "2026-11-20", notes: "Outubro"
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    expect(state.table("accounts_payable").get(id)).toMatchObject({ source: "IMPORT", status: "OPEN", final_amount_cents: 30_000, open_amount_cents: 30_000, payee_tax_id_snapshot: "12345678900", supplier_legal_entity_id: "pe1" });
    expect(state.table("operations").get("o3")).toMatchObject({ purchase_settlement_status: "SETTLED", account_payable_id: id });
    expect([...state.table("payable_status_history").values()].map((row) => row.new_status)).toEqual(["DRAFT", "OPEN"]);
    const lines = (await state.call("GET", `/v1/manage/purchase-settlements/${id}/operations`)).json();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ documentNumber: "3003", rateCents: 200, amountCents: 20_000 });

    expect((await state.call("POST", "/v1/manage/purchase-settlements", {
      organizationId: ORG, ownLegalEntityId: OWN, supplierPartnerId: SUPPLIER, operationIds: ["o3"], categoryId: CATEGORY, dueDate: "2026-11-20"
    })).statusCode).toBe(409);
    expect((await state.call("POST", "/v1/manage/purchase-settlements", {
      organizationId: ORG, ownLegalEntityId: OWN, supplierPartnerId: SUPPLIER, operationIds: ["o5"], categoryId: CATEGORY, dueDate: "2026-11-20"
    })).statusCode).toBe(409);

    const cancelled = await state.call("POST", `/v1/manage/purchase-settlements/${id}/cancel`, { reason: "Valor errado" });
    expect(cancelled.json().status).toBe("CANCELLED");
    expect(state.table("operations").get("o4")).toMatchObject({ purchase_settlement_status: "UNSETTLED", account_payable_id: null });
    expect([...state.table("account_payable_operations").values()].every((row) => row.released_at)).toBe(true);
  });
});
