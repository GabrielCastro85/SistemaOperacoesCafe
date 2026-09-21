import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type pg from "pg";
import { registerViewerRoutes } from "../server/src/viewer.js";

type Row = Record<string, unknown>;

function fakePool(data: Record<string, Row[]>): pg.Pool {
  return {
    async query(sql: string, params: unknown[] = []) {
      if (sql.includes("FROM api_sessions")) return { rows: [{ sessionId: "session", userId: "user", username: "gabriel", displayName: "Gabriel", deviceId: "device" }] };
      if (sql.includes("UPDATE api_sessions")) return { rows: [] };
      if (sql.includes("SELECT desktop_profile FROM app_users")) return { rows: [{ desktop_profile: {} }] };
      if (sql.includes("FROM central_records")) {
        const table = String(params[0]);
        const rows = data[table] ?? [];
        if (params.length > 1) return { rows: rows.filter((row) => row.id === params[1]).map((row) => ({ row_data: row })) };
        return { rows: rows.map((row) => ({ row_data: row })) };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    }
  } as unknown as pg.Pool;
}

const organizationId = "org";
const legalEntityId = "entity";
const clientId = "client";
const chargeId = "charge";

function fixture(): Record<string, Row[]> {
  return {
    organizations: [{ id: organizationId, slug: "villa", display_name: "Villa", app_display_name: "Villa Coffee", is_active: 1, primary_color: "#17130f", secondary_color: "#f8f5ed", accent_color: "#1d7a4c" }],
    legal_entities: [{ id: legalEntityId, organization_id: organizationId, legal_name: "Villa Coffee LTDA", trade_name: "Villa Coffee Minas Gerais", cnpj: "44963370000523", state_registration: "123", is_active: 1, default_bank_name: "Banco", default_bank_agency: "1", default_bank_account: "2", default_pix_key: "44963370000523" }],
    business_partners: [{ id: clientId, display_name: "Cliente Teste" }],
    operations: [{ id: "operation", organization_id: organizationId, own_legal_entity_id: legalEntityId, responsible_partner_id: clientId, fiscal_document_id: "document", operation_date: "2026-09-10", operation_type: "SALE", status: "CONFIRMED", billing_status: "UNBILLED", quantity_sacks_decimal: "500", service_amount_cents: 150000 }],
    fiscal_documents: [{ id: "document", direction: "OUTBOUND", fiscal_snapshot_json: JSON.stringify({ issuer: { legalName: "Villa Coffee LTDA", cnpjCpf: "44963370000523" }, recipient: { legalName: "Cliente Teste", cnpjCpf: "11111111000111" } }) }],
    client_charges: [{ id: chargeId, organization_id: organizationId, own_legal_entity_id: legalEntityId, client_partner_id: clientId, periodicity: "MONTHLY", period_start: "2026-09-01", period_end: "2026-09-30", issue_date: "2026-09-30", due_date: "2026-10-05", status: "ISSUED", subtotal_services_cents: 200000, additions_cents: 0, deductions_cents: 0, final_amount_cents: 200000, paid_amount_cents: 0, open_amount_cents: 200000, created_at: "2026-09-30T12:00:00Z", updated_at: "2026-09-30T12:00:00Z" }],
    client_charge_operations: [{ id: "charge-operation", client_charge_id: chargeId, operation_id: "operation", own_legal_entity_id_snapshot: legalEntityId, own_legal_entity_name_snapshot: "Villa Coffee LTDA", operation_date_snapshot: "2026-09-10", fiscal_document_number_snapshot: "123", issuer_name_snapshot: "Villa Coffee LTDA", destination_name_snapshot: "Cliente Teste", product_name_snapshot: "Cafe", operation_scope_snapshot: "INTERNAL", quantity_sacks_decimal_snapshot: "500", service_rate_cents_snapshot: 400, service_amount_cents_snapshot: 200000, created_at: "2026-09-30T12:00:00Z" }],
    client_charge_adjustments: [], client_payment_allocations: [], client_ledger_entries: [], partner_legal_entities: [],
    client_payments: [{ id: "payment", organization_id: organizationId, own_legal_entity_id: legalEntityId, client_partner_id: clientId, payment_date: "2026-09-15", amount_cents: 50000, status: "CONFIRMED" }]
  };
}

describe("viewer API", () => {
  it("calcula o dashboard no servidor e gera o PDF com o mesmo gerador do desktop", async () => {
    const app = Fastify();
    registerViewerRoutes(app, fakePool(fixture()));
    const query = `organizationId=${organizationId}&legalEntityId=${legalEntityId}&periodStart=2026-09-01&periodEnd=2026-09-30`;
    const dashboard = await app.inject({ method: "GET", url: `/v1/viewer/dashboard?${query}`, headers: { authorization: "Bearer test" } });
    expect(dashboard.statusCode).toBe(200);
    expect(dashboard.json()).toMatchObject({ sacks: 500, receivableCents: 350000, receivedCents: 50000, unbilledCount: 1 });

    const pdf = await app.inject({ method: "GET", url: `/v1/viewer/charges/${chargeId}/pdf`, headers: { authorization: "Bearer test" } });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
    await app.close();
  });
});
