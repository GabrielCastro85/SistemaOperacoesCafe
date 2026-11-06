import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type pg from "pg";
import { registerCommercialManagementRoutes } from "../server/src/commercialManagement.js";

type Row = Record<string, unknown>;

function managementPool() {
  const records = new Map<string, Map<string, Row>>();
  const changes: Row[] = [];
  const audits: Row[] = [];
  let revision = 10;
  const table = (name: string) => {
    const current = records.get(name) ?? new Map<string, Row>();
    records.set(name, current);
    return current;
  };
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
      revision = Number(nextRevision);
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO central_change_log")) {
      changes.push({ revision: params[0], sequence: params[1], table: params[2], key: params[3], operation: params[4] });
      return { rows: [] };
    }
    if (sql.includes("UPDATE central_sync_state")) { revision = Number(params[0]); return { rows: [] }; }
    if (sql.includes("INSERT INTO server_audit_events")) { audits.push({ action: params[3], entityType: params[4], entityId: params[5] }); return { rows: [] }; }
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    throw new Error(`SQL inesperado: ${sql}`);
  };
  const pool = { query, async connect() { return { query, release() {} }; } } as unknown as pg.Pool;
  return { pool, records, changes, audits, getRevision: () => revision };
}

describe("commercial management API", () => {
  it("grava parceiros, produtos e regras na revisao central auditada", async () => {
    const state = managementPool();
    const app = Fastify();
    registerCommercialManagementRoutes(app, state.pool);
    const headers = { authorization: "Bearer test", "content-type": "application/json" };

    const partner = await app.inject({ method: "POST", url: "/v1/manage/partners", headers, payload: {
      organizationId: "org", legalEntityId: "entity", displayName: "Cliente Web", roles: ["CLIENT"],
      entity: { legalName: "Cliente Web LTDA", tradeName: "Cliente Web", cnpj: "11.111.111/0001-11", city: "Varginha", state: "MG" }
    } });
    expect(partner.statusCode).toBe(201);
    const partnerId = partner.json().id as string;
    expect(state.records.get("business_partners")?.get(partnerId)).toMatchObject({ display_name: "Cliente Web", organization_id: "org" });
    expect([...state.records.get("partner_legal_entities")!.values()][0]).toMatchObject({ cnpj: "11111111000111", business_partner_id: partnerId });

    const product = await app.inject({ method: "POST", url: "/v1/manage/products", headers, payload: {
      organizationId: "org", legalEntityId: "entity", name: "Cafe Especial", category: "COFFEE_ARABICA",
      defaultUnit: "SACK", defaultSackWeightKg: 60, aliases: ["CAFE TIPO 6"]
    } });
    expect(product.statusCode).toBe(201);
    const productId = product.json().id as string;
    expect([...state.records.get("product_aliases")!.values()][0]).toMatchObject({ source_description: "CAFE TIPO 6", product_id: productId });

    const rule = await app.inject({ method: "POST", url: "/v1/manage/rate-rules", headers, payload: {
      organizationId: "org", legalEntityId: "entity", kind: "SERVICE", businessPartnerId: partnerId,
      productId, operationScope: "ALL", rateValueCents: 700, financialRateValueCents: 900,
      effectiveFrom: "2026-11-01", priority: 10
    } });
    expect(rule.statusCode).toBe(201);
    expect(state.records.get("service_rate_rules")?.get(rule.json().id)).toMatchObject({ rate_value_cents: 700, financial_rate_value_cents: 900 });
    expect(state.getRevision()).toBe(13);
    expect(state.audits.map((item) => item.action)).toEqual(["WEB_PARTNER_CREATED", "WEB_PRODUCT_CREATED", "WEB_RATE_RULE_CREATED"]);
    expect(state.changes.length).toBeGreaterThanOrEqual(6);
  });

  it("bloqueia gravacao para usuario sem permissao", async () => {
    const state = managementPool();
    const mutablePool = state.pool as unknown as { query: (sql: string, params?: unknown[]) => Promise<{ rows: Row[] }> };
    const originalQuery = mutablePool.query;
    mutablePool.query = async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT is_central_admin, desktop_profile FROM app_users")) return { rows: [{ is_central_admin: false, desktop_profile: { roleAssignments: [{ roleId: "role-viewer", isActive: true }] } }] } as never;
      return originalQuery(sql, params);
    };
    const app = Fastify(); registerCommercialManagementRoutes(app, state.pool);
    const response = await app.inject({ method: "POST", url: "/v1/manage/products", headers: { authorization: "Bearer test", "content-type": "application/json" }, payload: {
      organizationId: "org", name: "Bloqueado", category: "OTHER", defaultUnit: "UNIT"
    } });
    expect(response.statusCode).toBe(403);
  });
});
