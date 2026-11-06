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
  table("legal_entities").set("entity", { id: "entity", organization_id: "org", trade_name: "Villa MG" });
  table("business_partners").set("client", { id: "client", organization_id: "org", display_name: "Cliente" });
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
});
