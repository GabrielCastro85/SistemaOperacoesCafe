import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type pg from "pg";
import { registerInvoiceManagementRoutes } from "../server/src/invoiceManagement.js";

type Row = Record<string, unknown>;

function invoicePool() {
  const records = new Map<string, Map<string, Row>>();
  const audits: Row[] = [];
  let revision = 50;
  const table = (name: string) => {
    const current = records.get(name) ?? new Map<string, Row>();
    records.set(name, current);
    return current;
  };
  table("legal_entities").set("entity", { id: "entity", organization_id: "org", trade_name: "Villa MG", cnpj: "44963370000523", is_active: 1 });
  table("business_partners").set("client", { id: "client", organization_id: "org", display_name: "IF", is_active: 1, requires_contract: 0 });
  table("business_partners").set("other-client", { id: "other-client", organization_id: "org", display_name: "KATUAI", is_active: 1, requires_contract: 0 });
  table("business_partners").set("supplier", { id: "supplier", organization_id: "org", display_name: "Fornecedor", is_active: 1 });
  table("business_partner_roles").set("r1", { id: "r1", business_partner_id: "client", role: "CLIENT" });
  table("business_partner_roles").set("r2", { id: "r2", business_partner_id: "other-client", role: "CLIENT" });
  table("business_partner_roles").set("r3", { id: "r3", business_partner_id: "supplier", role: "SUPPLIER" });
  table("products").set("arabica", { id: "arabica", organization_id: "org", name: "Cafe Arabica", default_sack_weight_kg: 60, is_active: 1 });
  table("service_rate_rules").set("rule-client", {
    id: "rule-client", organization_id: "org", business_partner_id: "client", own_legal_entity_id: null, counterparty_partner_legal_entity_id: null,
    product_id: null, operation_scope: "ALL", rate_value_cents: 500, financial_rate_value_cents: 800, effective_from: "2026-01-01", effective_to: null, priority: 0, is_active: 1
  });
  table("service_rate_rules").set("rule-other", {
    id: "rule-other", organization_id: "org", business_partner_id: "other-client", own_legal_entity_id: null, counterparty_partner_legal_entity_id: null,
    product_id: null, operation_scope: "ALL", rate_value_cents: 300, effective_from: "2026-01-01", effective_to: null, priority: 0, is_active: 1
  });
  const query = async (sql: string, params: unknown[] = []) => {
    if (sql.includes("FROM api_sessions")) return { rows: [{ sessionId: "session", userId: "user", username: "gabriel", displayName: "Gabriel", deviceId: "device" }] };
    if (sql.includes("UPDATE api_sessions")) return { rows: [] };
    if (sql.includes("SELECT is_central_admin, desktop_profile FROM app_users")) return { rows: [{ is_central_admin: true, desktop_profile: {} }] };
    if (sql.includes("row_data->>$2 = ANY")) {
      const [name, field, values] = params as [string, string, string[]];
      return { rows: [...table(name).values()].filter((row) => values.includes(String(row[field] ?? ""))).map((row_data) => ({ row_data })) };
    }
    if (sql.includes("SELECT row_data FROM central_records")) {
      const current = table(String(params[0]));
      if (params.length > 1) return { rows: current.has(String(params[1])) ? [{ row_data: current.get(String(params[1])) }] : [] };
      return { rows: [...current.values()].map((row_data) => ({ row_data })) };
    }
    if (sql.includes("SELECT revision::text FROM central_sync_state")) return { rows: [{ revision: String(revision) }] };
    if (sql.includes("INSERT INTO central_records")) {
      const [tableName, key, data, , nextRevision, deleted] = params;
      if (deleted) table(String(tableName)).delete(String(key));
      else table(String(tableName)).set(String(key), JSON.parse(String(data)) as Row);
      revision = Number(nextRevision); return { rows: [] };
    }
    if (sql.includes("INSERT INTO central_change_log")) return { rows: [] };
    if (sql.includes("UPDATE central_sync_state")) { revision = Number(params[0]); return { rows: [] }; }
    if (sql.includes("INSERT INTO server_audit_events")) { audits.push({ action: params[3], entityId: params[5] }); return { rows: [] }; }
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    throw new Error(`SQL inesperado: ${sql}`);
  };
  const pool = { query, async connect() { return { query, release() {} }; } } as unknown as pg.Pool;
  const app = Fastify();
  registerInvoiceManagementRoutes(app, pool);
  const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) => app.inject({
    method, url,
    headers: payload ? { authorization: "Bearer test", "content-type": "application/json" } : { authorization: "Bearer test" },
    ...(payload ? { payload: payload as Record<string, unknown> } : {})
  });
  return { records, audits, table, call };
}

const saleInput = {
  organizationId: "org", ownLegalEntityId: "entity", operationType: "SALE", operationScope: "INTERNAL", responsiblePartnerId: "client",
  documentNumber: "9001", series: "1", issueDate: "2026-11-06", totalAmountCents: 1_500_000,
  items: [{ productId: "arabica", quantity: "6000", unit: "KG", totalAmountCents: 1_500_000 }]
};

describe("lancamento e manutencao de notas pelo site", () => {
  it("lanca nota manual calculando sacas e tarifa e confirma na mesma revisao", async () => {
    const state = invoicePool();
    const created = await state.call("POST", "/v1/manage/invoices", { ...saleInput, confirm: true });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ status: "CONFIRMED" });
    const [operation] = [...state.table("operations").values()];
    expect(operation).toMatchObject({ quantity_sacks_decimal: "100", applied_rate_value_cents: 500, service_amount_cents: 50_000, status: "CONFIRMED", source: "MANUAL", billing_status: "UNBILLED" });
    expect([...state.table("fiscal_documents").values()][0]).toMatchObject({ direction: "OUTBOUND", document_type: "MANUAL_INVOICE", has_pending_issues: 0 });
    expect(state.audits.map((row) => row.action)).toEqual(["WEB_INVOICE_CREATED"]);
  });

  it("deixa pendente a nota sem tarifa e recusa confirmar", async () => {
    const state = invoicePool();
    state.table("service_rate_rules").delete("rule-client");
    expect((await state.call("POST", "/v1/manage/invoices", { ...saleInput, confirm: true })).statusCode).toBe(409);
    const draft = await state.call("POST", "/v1/manage/invoices", saleInput);
    expect(draft.json()).toMatchObject({ status: "PENDING", pendingNotes: "Sem tarifa para o item 1" });
    const id = draft.json().id as string;
    expect((await state.call("POST", `/v1/manage/invoices/${id}/confirm`)).statusCode).toBe(409);
  });

  it("recusa responsavel sem o papel correspondente", async () => {
    const state = invoicePool();
    const response = await state.call("POST", "/v1/manage/invoices", { ...saleInput, responsiblePartnerId: "supplier" });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("PARTNER_ROLE");
  });

  it("troca o responsavel recalculando a tarifa e registrando o historico", async () => {
    const state = invoicePool();
    const id = (await state.call("POST", "/v1/manage/invoices", { ...saleInput, confirm: true })).json().id as string;
    const base = { documentNumber: "9001", series: "1", issueDate: "2026-11-06", totalAmountCents: 1_500_000, hasFinancialService: false };
    expect((await state.call("PUT", `/v1/manage/invoices/${id}`, { ...base, responsiblePartnerId: "other-client", issueDate: "2026-11-07" })).statusCode).toBe(409);
    const updated = await state.call("PUT", `/v1/manage/invoices/${id}`, { ...base, responsiblePartnerId: "other-client" });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().reopened).toBe(false);
    const [operation] = [...state.table("operations").values()];
    expect(operation).toMatchObject({ responsible_partner_id: "other-client", applied_rate_value_cents: 300, service_amount_cents: 30_000, status: "CONFIRMED" });
    expect([...state.table("operation_rate_history").values()][0]).toMatchObject({ previous_rate_value_cents: 500, new_rate_value_cents: 300 });
  });

  it("reabre a nota confirmada quando muda a condicao de financeiro", async () => {
    const state = invoicePool();
    const id = (await state.call("POST", "/v1/manage/invoices", { ...saleInput, confirm: true })).json().id as string;
    const updated = await state.call("PUT", `/v1/manage/invoices/${id}`, {
      responsiblePartnerId: "client", documentNumber: "9001", series: "1", issueDate: "2026-11-06", totalAmountCents: 1_500_000, hasFinancialService: true
    });
    expect(updated.json().reopened).toBe(true);
    expect(state.table("fiscal_documents").get(id)).toMatchObject({ status: "DRAFT", has_financial_service: 1, confirmed_at: null });
    expect([...state.table("operations").values()][0]).toMatchObject({ applied_rate_value_cents: 800, status: "DRAFT" });
  });

  it("exige contrato do cliente que o requer antes de confirmar", async () => {
    const state = invoicePool();
    state.table("business_partners").set("client", { ...state.table("business_partners").get("client"), requires_contract: 1 });
    const id = (await state.call("POST", "/v1/manage/invoices", saleInput)).json().id as string;
    const refused = await state.call("POST", `/v1/manage/invoices/${id}/confirm`);
    expect(refused.json().error).toBe("CONTRACT_REQUIRED");
    await state.call("PUT", `/v1/manage/invoices/${id}`, {
      responsiblePartnerId: "client", documentNumber: "9001", series: "1", issueDate: "2026-11-06", totalAmountCents: 1_500_000, hasFinancialService: false, contractNumber: "CT-77"
    });
    expect((await state.call("POST", `/v1/manage/invoices/${id}/confirm`)).statusCode).toBe(200);
  });

  it("nao cancela nota cobrada e cancela as demais com motivo", async () => {
    const state = invoicePool();
    const id = (await state.call("POST", "/v1/manage/invoices", { ...saleInput, confirm: true })).json().id as string;
    const [operation] = [...state.table("operations").values()];
    state.table("operations").set(String(operation.id), { ...operation, billing_status: "BILLED" });
    expect((await state.call("POST", `/v1/manage/invoices/${id}/cancel`, { reason: "Erro de digitacao" })).statusCode).toBe(409);
    state.table("operations").set(String(operation.id), { ...operation, billing_status: "UNBILLED" });
    expect((await state.call("POST", `/v1/manage/invoices/${id}/cancel`, { reason: "Erro de digitacao" })).statusCode).toBe(200);
    expect(state.table("fiscal_documents").get(id)).toMatchObject({ status: "CANCELED", cancel_reason: "Erro de digitacao" });
    expect([...state.table("operations").values()][0].status).toBe("CANCELED");
  });

  it("exclui a nota com seus vinculos e bloqueia confirmacao ativa ou historico de cobranca", async () => {
    const state = invoicePool();
    const id = (await state.call("POST", "/v1/manage/invoices", { ...saleInput, confirm: true })).json().id as string;
    const [operation] = [...state.table("operations").values()];
    await state.call("PUT", `/v1/manage/operations/${String(operation.id)}/rate`, { manualRateValueCents: 450, reason: "Acordo com o cliente" });
    state.table("deal_confirmations").set("deal", { id: "deal", status: "ISSUED" });
    state.table("deal_confirmation_fiscal_documents").set("link", { id: "link", deal_confirmation_id: "deal", fiscal_document_id: id });
    expect((await state.call("DELETE", `/v1/manage/invoices/${id}`)).json().error).toBe("ACTIVE_DEAL");
    state.table("deal_confirmations").set("deal", { id: "deal", status: "CANCELLED" });
    state.table("client_charge_operations").set("old-link", { id: "old-link", operation_id: operation.id, released_at: "2026-11-05" });
    expect((await state.call("DELETE", `/v1/manage/invoices/${id}`)).json().error).toBe("DOCUMENT_REFERENCED");
    state.table("client_charge_operations").delete("old-link");
    const deleted = await state.call("DELETE", `/v1/manage/invoices/${id}`);
    expect(deleted.statusCode).toBe(200);
    for (const name of ["fiscal_documents", "fiscal_document_items", "operations", "operation_rate_history", "deal_confirmation_fiscal_documents"]) {
      expect(state.table(name).size, name).toBe(0);
    }
  });

  it("altera a tarifa manualmente com motivo e recusa operacao cobrada", async () => {
    const state = invoicePool();
    await state.call("POST", "/v1/manage/invoices", { ...saleInput, confirm: true });
    const [operation] = [...state.table("operations").values()];
    const changed = await state.call("PUT", `/v1/manage/operations/${String(operation.id)}/rate`, { manualRateValueCents: 450, reason: "Acordo com o cliente" });
    expect(changed.json()).toMatchObject({ rateCents: 450, amountCents: 45_000 });
    expect(state.table("operations").get(String(operation.id))).toMatchObject({ rate_was_manually_overridden: 1, manual_override_reason: "Acordo com o cliente" });
    state.table("operations").set(String(operation.id), { ...state.table("operations").get(String(operation.id)), billing_status: "BILLED" });
    expect((await state.call("PUT", `/v1/manage/operations/${String(operation.id)}/rate`, { manualRateValueCents: 400, reason: "Outro acordo" })).statusCode).toBe(409);
  });

  it("mostra a nota com acoes permitidas", async () => {
    const state = invoicePool();
    const id = (await state.call("POST", "/v1/manage/invoices", saleInput)).json().id as string;
    const detail = await state.call("GET", `/v1/manage/invoices/${id}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      document: { documentNumber: "9001", responsiblePartnerName: "IF", status: "DRAFT" },
      operations: [{ quantitySacks: "100", rateCents: 500 }],
      permissions: { canEdit: true, canConfirm: true, canCancel: true, canDelete: true }
    });
  });
});
