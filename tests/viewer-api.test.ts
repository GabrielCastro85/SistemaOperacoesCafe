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
    // "org2" existe so' pra provar que os cards globais do dashboard (receivableCents/
    // receivedCents, ver viewer.ts) somam TODAS as organizacoes, nao so' a selecionada
    // na consulta -- espelhando getBillingSummary({ includeAllCompanies: true }) do
    // app desktop. Os demais campos do dashboard continuam escopados pela organizationId
    // da query.
    organizations: [
      { id: organizationId, slug: "villa", display_name: "Villa", app_display_name: "Villa Coffee", is_active: 1, primary_color: "#17130f", secondary_color: "#f8f5ed", accent_color: "#1d7a4c" },
      { id: "org2", slug: "grao", display_name: "Grao", app_display_name: "Grao & Grao", is_active: 1, primary_color: "#17130f", secondary_color: "#f8f5ed", accent_color: "#1d7a4c" }
    ],
    legal_entities: [
      { id: legalEntityId, organization_id: organizationId, legal_name: "Villa Coffee LTDA", trade_name: "Villa Coffee Minas Gerais", cnpj: "44963370000523", state_registration: "123", is_active: 1, default_bank_name: "Banco", default_bank_agency: "1", default_bank_account: "2", default_pix_key: "44963370000523" },
      { id: "third-party", organization_id: organizationId, legal_name: "Emitente Terceiro LTDA", trade_name: "Emitente Terceiro", cnpj: "22222222000122", document_prefix: "TERC-XML", is_active: 1 },
      { id: "entity2", organization_id: "org2", legal_name: "Grao & Grao LTDA", trade_name: "Grao & Grao Minas Gerais", cnpj: "16594876000224", is_active: 1 }
    ],
    business_partners: [{ id: clientId, display_name: "Cliente Teste" }, { id: "client2", display_name: "Cliente Org2" }],
    operations: [
      { id: "operation", organization_id: organizationId, own_legal_entity_id: legalEntityId, responsible_partner_id: clientId, fiscal_document_id: "document", operation_date: "2026-09-10", operation_type: "SALE", operation_scope: "INTERNAL", status: "CONFIRMED", billing_status: "UNBILLED", quantity_sacks_decimal: "500", applied_rate_value_cents: 400, service_amount_cents: 150000 },
      { id: "third-operation", organization_id: organizationId, own_legal_entity_id: "third-party", responsible_partner_id: clientId, fiscal_document_id: "third-document", operation_date: "2026-09-11", operation_type: "SALE", operation_scope: "EXTERNAL", status: "CONFIRMED", billing_status: "UNBILLED", quantity_sacks_decimal: "100", applied_rate_value_cents: 800, service_amount_cents: 80000 },
      { id: "operation-org2", organization_id: "org2", own_legal_entity_id: "entity2", responsible_partner_id: "client2", operation_date: "2026-09-12", operation_type: "SALE", operation_scope: "INTERNAL", status: "CONFIRMED", billing_status: "UNBILLED", quantity_sacks_decimal: "50", applied_rate_value_cents: 400, service_amount_cents: 20000 },
      { id: "operation-paid", organization_id: "org2", own_legal_entity_id: "entity2", responsible_partner_id: "client2", operation_date: "2026-09-13", operation_type: "SALE", operation_scope: "INTERNAL", status: "CONFIRMED", billing_status: "BILLED", client_charge_id: "charge-paid", quantity_sacks_decimal: "30", applied_rate_value_cents: 1500, service_amount_cents: 45000 }
    ],
    fiscal_documents: [
      { id: "document", document_number: "123", status: "CONFIRMED", direction: "OUTBOUND", fiscal_snapshot_json: JSON.stringify({ issuer: { legalName: "Villa Coffee LTDA", cnpjCpf: "44963370000523" }, recipient: { legalName: "Cliente Teste", cnpjCpf: "11111111000111" } }) },
      { id: "third-document", document_number: "5201", status: "CONFIRMED", direction: "OUTBOUND", fiscal_snapshot_json: JSON.stringify({ issuer: { legalName: "Emitente Terceiro LTDA", cnpjCpf: "22222222000122" }, recipient: { legalName: "Destino Final LTDA", cnpjCpf: "33333333000133" } }) }
    ],
    client_charges: [
      { id: chargeId, organization_id: organizationId, own_legal_entity_id: legalEntityId, client_partner_id: clientId, periodicity: "MONTHLY", period_start: "2026-09-01", period_end: "2026-09-30", issue_date: "2026-09-30", due_date: "2026-10-05", status: "ISSUED", subtotal_services_cents: 200000, additions_cents: 0, deductions_cents: 0, final_amount_cents: 200000, paid_amount_cents: 0, open_amount_cents: 200000, created_at: "2026-09-30T12:00:00Z", updated_at: "2026-09-30T12:00:00Z" },
      { id: "charge-paid", organization_id: "org2", own_legal_entity_id: "entity2", client_partner_id: "client2", periodicity: "MONTHLY", period_start: "2026-09-01", period_end: "2026-09-30", issue_date: "2026-09-30", due_date: "2026-10-05", status: "PAID", subtotal_services_cents: 45000, additions_cents: 0, deductions_cents: 0, final_amount_cents: 45000, paid_amount_cents: 45000, open_amount_cents: 0, created_at: "2026-09-30T12:00:00Z", updated_at: "2026-09-30T12:00:00Z" }
    ],
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
    // sacks/operationCount seguem escopados pela organizationId+legalEntityId da query
    // (so' a operacao "operation"); receivableCents/receivedCents/unbilledCount somam
    // as duas organizacoes do fixture (villa + org2), replicando o card "Todas as
    // empresas" do app: receivableCents = 200000 (charge aberta) + 150000+80000+20000
    // (3 operacoes UNBILLED em ambas organizacoes); receivedCents = 45000 (unica
    // operacao SALE ligada a uma cobranca PAID no periodo).
    expect(dashboard.json()).toMatchObject({ sacks: 500, receivableCents: 450000, receivedCents: 45000, unbilledCount: 3 });

    const notes = await app.inject({ method: "GET", url: `/v1/viewer/open-notes?${query}`, headers: { authorization: "Bearer test" } });
    expect(notes.statusCode).toBe(200);
    expect(notes.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentNumber: "123", companyTone: "villa", billingStatus: "UNBILLED" }),
      expect.objectContaining({ documentNumber: "5201", companyTone: "other", companyContext: "Operacao terceirizada", issuerName: "Emitente Terceiro LTDA" })
    ]));

    const pdf = await app.inject({ method: "GET", url: `/v1/viewer/charges/${chargeId}/pdf`, headers: { authorization: "Bearer test" } });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
    await app.close();
  });
});
