import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type pg from "pg";
import { registerOperationalManagementRoutes } from "../server/src/operationalManagement.js";

type Row = Record<string, unknown>;

function managementPool() {
  const records = new Map<string, Map<string, Row>>();
  const audits: Row[] = [];
  let revision = 20;
  const table = (name: string) => {
    const current = records.get(name) ?? new Map<string, Row>();
    records.set(name, current);
    return current;
  };
  table("legal_entities").set("entity", { id: "entity", organization_id: "org", trade_name: "Villa MG", legal_name: "Villa Coffee Minas Gerais", cnpj: "44963370000523", is_active: 1 });
  table("business_partners").set("client", { id: "client", organization_id: "org", display_name: "Cliente", is_active: 1 });
  const query = async (sql: string, params: unknown[] = []) => {
    if (sql.includes("FROM api_sessions")) return { rows: [{ sessionId: "session", userId: "user", username: "gabriel", displayName: "Gabriel", deviceId: "device" }] };
    if (sql.includes("UPDATE api_sessions")) return { rows: [] };
    if (sql.includes("SELECT is_central_admin, desktop_profile FROM app_users")) return { rows: [{ is_central_admin: true, desktop_profile: {} }] };
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
    if (sql.includes("INSERT INTO server_audit_events")) { audits.push({ action: params[3], entityType: params[4], entityId: params[5] }); return { rows: [] }; }
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    throw new Error(`SQL inesperado: ${sql}`);
  };
  const pool = { query, async connect() { return { query, release() {} }; } } as unknown as pg.Pool;
  return { pool, records, audits, getRevision: () => revision };
}

describe("operational management API", () => {
  it("le e importa XML recebido aplicando a regra de compra", async () => {
    const state = managementPool();
    state.records.set("business_partners", new Map([["supplier", {
      id: "supplier", organization_id: "org", display_name: "Santa Fé Armazéns", is_active: 1
    }]]));
    state.records.set("partner_legal_entities", new Map([["supplier-entity", {
      id: "supplier-entity", organization_id: "org", business_partner_id: "supplier", legal_name: "SANTA FE ARMAZENS GERAIS EIRELI",
      cnpj: "04164419000130", is_active: 1
    }]]));
    state.records.set("products", new Map([["arabica", {
      id: "arabica", organization_id: "org", name: "Café Arábica", default_sack_weight_kg: 60, is_active: 1
    }]]));
    state.records.set("purchase_rate_rules", new Map([["purchase-rule", {
      id: "purchase-rule", organization_id: "org", business_partner_id: "supplier", own_legal_entity_id: "entity",
      counterparty_partner_legal_entity_id: "supplier-entity", product_id: "arabica", operation_scope: "INTERNAL",
      rate_value_cents: 700, effective_from: "2026-01-01", effective_to: null, priority: 10, is_active: 1
    }]]));
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe31261004164419000130550010000021641532100313" versao="4.00">
        <ide><cUF>31</cUF><natOp>VENDA DE CAFE</natOp><mod>55</mod><serie>1</serie><nNF>2164</nNF><dhEmi>2026-11-05T10:00:00-03:00</dhEmi></ide>
        <emit><CNPJ>04164419000130</CNPJ><xNome>SANTA FE ARMAZENS GERAIS EIRELI</xNome><enderEmit><UF>MG</UF></enderEmit></emit>
        <dest><CNPJ>44963370000523</CNPJ><xNome>VILLA COFFEE MINAS GERAIS</xNome><enderDest><UF>MG</UF></enderDest></dest>
        <det nItem="1"><prod><cProd>ARABICA</cProd><xProd>CAFE ARABICA</xProd><NCM>09011110</NCM><CFOP>5102</CFOP><uCom>SC</uCom><qCom>500</qCom><vUnCom>1250</vUnCom><vProd>625000</vProd><uTrib>SC</uTrib><qTrib>500</qTrib><vUnTrib>1250</vUnTrib></prod></det>
        <total><ICMSTot><vProd>625000</vProd><vNF>625000</vNF></ICMSTot></total>
      </infNFe></NFe>`;
    const app = Fastify(); registerOperationalManagementRoutes(app, state.pool);
    const headers = { authorization: "Bearer test", "content-type": "application/json" };
    const preview = await app.inject({ method: "POST", url: "/v1/manage/invoices/xml/preview", headers, payload: { organizationId: "org", xml } });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ number: "2164", direction: "INBOUND", ownLegalEntityId: "entity", counterpartyPartnerLegalEntityId: "supplier-entity" });

    const imported = await app.inject({ method: "POST", url: "/v1/manage/invoices/xml/import", headers, payload: {
      organizationId: "org", xml, responsiblePartnerId: "supplier", operationScope: "INTERNAL", itemProducts: [{ itemNumber: "1", productId: "arabica" }], confirmOperations: true
    } });
    expect(imported.statusCode).toBe(201);
    expect(imported.json()).toMatchObject({ status: "CONFIRMED", pendingNotes: null });
    const document = [...state.records.get("fiscal_documents")!.values()][0];
    expect(document).toMatchObject({ document_number: "2164", direction: "INBOUND", partner_legal_entity_id: "supplier-entity", status: "CONFIRMED" });
    expect([...state.records.get("operations")!.values()][0]).toMatchObject({
      operation_type: "PURCHASE", quantity_sacks_decimal: "500", applied_rate_value_cents: 700,
      service_amount_cents: 350000, purchase_rate_rule_id: "purchase-rule", status: "CONFIRMED"
    });
    expect(state.audits.map((row) => row.action)).toEqual(["WEB_XML_INVOICE_IMPORTED"]);
  });

  it("registra ajuste de armazem usando o saldo central e impede saldo negativo", async () => {
    const state = managementPool();
    state.records.set("warehouse_movements", new Map([["existing", {
      id: "existing", organization_id: "org", own_legal_entity_id: "entity", warehouse_name: "SANTA FE",
      warehouse_cnpj: "04164419000130", product_description: "ARABICA", movement_type: "DEPOSIT",
      quantity_kg_decimal: "6000", status: "ACTIVE", origin: "MANUAL"
    }]]));
    const app = Fastify(); registerOperationalManagementRoutes(app, state.pool);
    const headers = { authorization: "Bearer test", "content-type": "application/json" };
    const created = await app.inject({ method: "POST", url: "/v1/manage/warehouse-adjustments", headers, payload: {
      organizationId: "org", legalEntityId: "entity", warehouseName: "Santa Fé", warehouseCnpj: "04.164.419/0001-30",
      productDescription: "Café Arábica", adjustmentMode: "SET_BALANCE", unit: "SACK", quantity: 120,
      issueDate: "2026-11-05", reason: "Conferência física"
    } });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ previousBalanceKg: 6000, newBalanceKg: 7200 });
    const movement = state.records.get("warehouse_movements")?.get(created.json().id);
    expect(movement).toMatchObject({ warehouse_name: "SANTA FE", warehouse_cnpj: "04164419000130", movement_type: "DEPOSIT", quantity_kg_decimal: "1200", origin: "MANUAL" });

    const rejected = await app.inject({ method: "POST", url: "/v1/manage/warehouse-adjustments", headers, payload: {
      organizationId: "org", legalEntityId: "entity", warehouseName: "SANTA FE", warehouseCnpj: "04164419000130",
      productDescription: "ARABICA", adjustmentMode: "REMOVE", unit: "SACK", quantity: 1000,
      issueDate: "2026-11-05", reason: "Teste de proteção"
    } });
    expect(rejected.statusCode).toBe(409);
  });

  it("cria e cancela lancamento extra preservando auditoria", async () => {
    const state = managementPool();
    const app = Fastify(); registerOperationalManagementRoutes(app, state.pool);
    const headers = { authorization: "Bearer test", "content-type": "application/json" };
    const created = await app.inject({ method: "POST", url: "/v1/manage/ledger-entries", headers, payload: {
      organizationId: "org", legalEntityId: "entity", clientPartnerId: "client", entryType: "ADVANCE_RECEIVED",
      amountCents: 100000, entryDate: "2026-11-05", description: "Adiantamento recebido", applyNow: true
    } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    expect(state.records.get("client_ledger_entries")?.get(id)).toMatchObject({
      effect: "REDUCE_RECEIVABLE", amount_cents: 100000, status: "CONFIRMED", available_amount_cents: 100000
    });

    const cancelled = await app.inject({ method: "POST", url: `/v1/manage/ledger-entries/${id}/cancel`, headers, payload: { reason: "Lançado por engano" } });
    expect(cancelled.statusCode).toBe(200);
    expect(state.records.get("client_ledger_entries")?.get(id)).toMatchObject({ status: "CANCELLED", available_amount_cents: 0, cancellation_reason: "Lançado por engano" });
    expect(state.getRevision()).toBe(22);
    expect(state.audits.map((row) => row.action)).toEqual(["WEB_LEDGER_ENTRY_CREATED", "WEB_LEDGER_ENTRY_CANCELLED"]);
  });

  it("emite cobranca com notas selecionadas e reserva as operacoes atomicamente", async () => {
    const state = managementPool();
    state.records.set("operations", new Map([["operation", {
      id: "operation", organization_id: "org", own_legal_entity_id: "entity", responsible_partner_id: "client",
      fiscal_document_id: "document", product_id: "product", operation_type: "SALE", operation_scope: "INTERNAL",
      operation_date: "2026-11-05", quantity_sacks_decimal: "500", applied_rate_value_cents: 500,
      service_amount_cents: 250000, status: "CONFIRMED", billing_status: "UNBILLED", client_charge_id: null
    }]]));
    state.records.set("fiscal_documents", new Map([["document", {
      id: "document", status: "CONFIRMED", has_pending_issues: 0, issue_date: "2026-11-05", document_number: "2001", series: "1",
      fiscal_snapshot_json: JSON.stringify({ issuer: { legalName: "Villa MG" }, recipient: { legalName: "Cliente Teste" } }),
      freight_dae_amount_cents: 12000, freight_dae_reference: "DAE-1"
    }]]));
    state.records.set("products", new Map([["product", { id: "product", name: "Café Arábica" }]]));
    const app = Fastify(); registerOperationalManagementRoutes(app, state.pool);
    const headers = { authorization: "Bearer test", "content-type": "application/json" };
    const response = await app.inject({ method: "POST", url: "/v1/manage/client-charges/issue", headers, payload: {
      organizationId: "org", legalEntityId: "entity", clientPartnerId: "client", operationIds: ["operation"],
      periodStart: "2026-11-01", periodEnd: "2026-11-06", dueDate: "2026-11-15"
    } });
    expect(response.statusCode).toBe(201);
    const chargeId = response.json().id as string;
    expect(response.json().finalAmountCents).toBe(262000);
    expect(state.records.get("client_charges")?.get(chargeId)).toMatchObject({
      status: "ISSUED", subtotal_services_cents: 250000, additions_cents: 12000, open_amount_cents: 262000
    });
    expect(state.records.get("operations")?.get("operation")).toMatchObject({ billing_status: "BILLED", client_charge_id: chargeId });
    expect([...state.records.get("client_charge_operations")!.values()][0]).toMatchObject({
      client_charge_id: chargeId, fiscal_document_number_snapshot: "2001", service_amount_cents_snapshot: 250000
    });
    expect(state.audits.map((row) => row.action)).toEqual(["WEB_CLIENT_CHARGE_ISSUED"]);
  });

  it("registra e estorna pagamento atualizando o saldo da cobranca", async () => {
    const state = managementPool();
    state.records.set("client_charges", new Map([["charge", {
      id: "charge", organization_id: "org", own_legal_entity_id: "entity", client_partner_id: "client",
      status: "ISSUED", final_amount_cents: 250000, paid_amount_cents: 0, open_amount_cents: 250000,
      due_date: "2099-11-10", updated_at: "2026-11-01T12:00:00.000Z"
    }]]));
    const app = Fastify(); registerOperationalManagementRoutes(app, state.pool);
    const headers = { authorization: "Bearer test", "content-type": "application/json" };
    const created = await app.inject({ method: "POST", url: "/v1/manage/client-payments", headers, payload: {
      chargeId: "charge", paymentDate: "2026-11-06", amountCents: 100000, paymentMethod: "PIX",
      transactionReference: "PIX-123", notes: "Primeira parcela"
    } });
    expect(created.statusCode).toBe(201);
    const paymentId = created.json().id as string;
    expect(state.records.get("client_charges")?.get("charge")).toMatchObject({
      status: "PARTIALLY_PAID", paid_amount_cents: 100000, open_amount_cents: 150000
    });
    expect(state.records.get("client_payments")?.get(paymentId)).toMatchObject({ status: "CONFIRMED", amount_cents: 100000 });
    expect([...state.records.get("client_ledger_entries")!.values()][0]).toMatchObject({ entry_type: "PAYMENT_RECEIVED", effect: "REDUCE_RECEIVABLE" });

    const cancelled = await app.inject({ method: "POST", url: `/v1/manage/client-payments/${paymentId}/cancel`, headers, payload: { reason: "Pagamento lançado no cliente errado" } });
    expect(cancelled.statusCode).toBe(200);
    expect(state.records.get("client_payments")?.get(paymentId)).toMatchObject({ status: "CANCELLED", cancellation_reason: "Pagamento lançado no cliente errado" });
    expect(state.records.get("client_charges")?.get("charge")).toMatchObject({ status: "ISSUED", paid_amount_cents: 0, open_amount_cents: 250000 });
    expect([...state.records.get("client_ledger_entries")!.values()].some((row) => row.entry_type === "REVERSAL")).toBe(true);
    expect(state.audits.map((row) => row.action)).toEqual(["WEB_CLIENT_PAYMENT_CREATED", "WEB_CLIENT_PAYMENT_CANCELLED"]);
  });
});
