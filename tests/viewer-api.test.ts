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
    business_partners: [
      { id: clientId, organization_id: organizationId, display_name: "Cliente Teste", document_number: "11111111000111", city: "Varginha", state: "MG", is_active: 1 },
      { id: "client2", organization_id: "org2", display_name: "Cliente Org2", is_active: 1 }
    ],
    business_partner_roles: [{ id: "role-client", organization_id: organizationId, business_partner_id: clientId, role: "CLIENT" }],
    partner_legal_entities: [{ id: "partner-entity", organization_id: organizationId, business_partner_id: clientId, legal_name: "Comprador Teste LTDA", trade_name: "Comprador Teste", cnpj: "11111111000111", city: "Varginha", state: "MG", is_active: 1 }],
    products: [{ id: "product", organization_id: organizationId, name: "Cafe Arabica", code: "ARA", category: "COFFEE_ARABICA", default_unit: "SACK", default_sack_weight_kg: 60, is_active: 1 }],
    product_aliases: [{ id: "alias", organization_id: organizationId, product_id: "product", alias: "ARABICA TIPO 6", is_active: 1 }],
    service_rate_rules: [{ id: "service-rate", organization_id: organizationId, own_legal_entity_id: legalEntityId, business_partner_id: clientId, product_id: "product", rate_value_cents: 400, effective_from: "2026-01-01", priority: 10, is_active: 1 }],
    purchase_rate_rules: [{ id: "purchase-rate", organization_id: organizationId, own_legal_entity_id: legalEntityId, business_partner_id: clientId, product_id: "product", rate_value_cents: 700, effective_from: "2026-01-01", priority: 5, is_active: 1 }],
    accounts_payable: [{ id: "payable", organization_id: organizationId, own_legal_entity_id: legalEntityId, supplier_partner_id: clientId, payee_name_snapshot: "Cliente Teste", description: "Acerto de entrada", document_number: "AP-1", due_date: "2000-01-01", final_amount_cents: 100000, paid_amount_cents: 0, open_amount_cents: 100000, status: "OPEN" }],
    transfer_reconciliations: [{ id: "reconciliation", organization_id: organizationId, client_partner_id: clientId, counterparty_role: "CLIENT", source_mode: "INVOICES", reference_date: "2026-09-30", title: "Repasse setembro", status: "DRAFT", total_source_cents: 90000000, total_payments_cents: 50000000, balance_cents: 40000000 }],
    transfer_reconciliation_invoices: [{ id: "reconciliation-invoice", reconciliation_id: "reconciliation", fiscal_document_id: "document" }],
    transfer_reconciliation_payments: [{ id: "reconciliation-payment", reconciliation_id: "reconciliation", amount_cents: 50000000 }],
    deal_confirmations: [{ id: "confirmation", organization_id: organizationId, own_legal_entity_id: legalEntityId, confirmation_number: "VCMG 0200", temporary_reference: "TEMP-200", confirmation_date: "2026-09-20", status: "ISSUED", signature_status: "NOT_SENT", total_quantity_sacks_decimal: "500", total_commercial_amount_cents: 90000000 }],
    deal_confirmation_parties: [
      { id: "party-own", deal_confirmation_id: "confirmation", party_role: "SELLER", own_legal_entity_id: legalEntityId, sort_order: 1, snapshot_json: JSON.stringify({ legalName: "Villa Coffee LTDA" }) },
      { id: "party-buyer", deal_confirmation_id: "confirmation", party_role: "BUYER", business_partner_id: clientId, partner_legal_entity_id: "partner-entity", sort_order: 2, snapshot_json: JSON.stringify({ legalName: "Comprador Teste LTDA" }) }
    ],
    operations: [
      { id: "operation", organization_id: organizationId, own_legal_entity_id: legalEntityId, responsible_partner_id: clientId, fiscal_document_id: "document", operation_date: "2026-09-10", operation_type: "SALE", operation_scope: "INTERNAL", status: "CONFIRMED", billing_status: "UNBILLED", quantity_sacks_decimal: "500", applied_rate_value_cents: 400, service_amount_cents: 150000 },
      { id: "third-operation", organization_id: organizationId, own_legal_entity_id: "third-party", responsible_partner_id: clientId, fiscal_document_id: "third-document", operation_date: "2026-09-11", operation_type: "SALE", operation_scope: "EXTERNAL", status: "CONFIRMED", billing_status: "UNBILLED", quantity_sacks_decimal: "100", applied_rate_value_cents: 800, service_amount_cents: 80000 },
      { id: "operation-org2", organization_id: "org2", own_legal_entity_id: "entity2", responsible_partner_id: "client2", operation_date: "2026-09-12", operation_type: "SALE", operation_scope: "INTERNAL", status: "CONFIRMED", billing_status: "UNBILLED", quantity_sacks_decimal: "50", applied_rate_value_cents: 400, service_amount_cents: 20000 },
      { id: "operation-paid", organization_id: "org2", own_legal_entity_id: "entity2", responsible_partner_id: "client2", operation_date: "2026-09-13", operation_type: "SALE", operation_scope: "INTERNAL", status: "CONFIRMED", billing_status: "BILLED", client_charge_id: "charge-paid", quantity_sacks_decimal: "30", applied_rate_value_cents: 1500, service_amount_cents: 45000 },
      { id: "purchase", organization_id: organizationId, own_legal_entity_id: legalEntityId, responsible_partner_id: clientId, operation_date: "2026-09-14", operation_type: "PURCHASE", operation_scope: "INTERNAL", status: "CONFIRMED", billing_status: "UNBILLED", quantity_sacks_decimal: "900", applied_rate_value_cents: 400, service_amount_cents: 360000 }
    ],
    fiscal_documents: [
      { id: "document", organization_id: organizationId, own_legal_entity_id: legalEntityId, responsible_partner_id: clientId, document_number: "123", series: "1", issue_date: "2026-09-10", total_amount_cents: 90000000, status: "CONFIRMED", direction: "OUTBOUND", source: "XML", has_pending_issues: 0, fiscal_snapshot_json: JSON.stringify({ issuer: { legalName: "Villa Coffee LTDA", cnpjCpf: "44963370000523" }, recipient: { legalName: "Cliente Teste", cnpjCpf: "11111111000111" } }) },
      { id: "third-document", organization_id: organizationId, own_legal_entity_id: "third-party", responsible_partner_id: clientId, document_number: "5201", series: "1", issue_date: "2026-09-11", total_amount_cents: 8000000, status: "CONFIRMED", direction: "OUTBOUND", source: "XML", has_pending_issues: 0, fiscal_snapshot_json: JSON.stringify({ issuer: { legalName: "Emitente Terceiro LTDA", cnpjCpf: "22222222000122" }, recipient: { legalName: "Destino Final LTDA", cnpjCpf: "33333333000133" } }) },
      { id: "pending-document", organization_id: organizationId, own_legal_entity_id: legalEntityId, responsible_partner_id: clientId, document_number: "124", series: "1", issue_date: "2026-09-12", total_amount_cents: 45000000, status: "PENDING", direction: "INBOUND", source: "MANUAL", has_pending_issues: 1, pending_notes: "Conferir fornecedor", fiscal_snapshot_json: JSON.stringify({ issuer: { legalName: "Fornecedor Teste LTDA", cnpjCpf: "44444444000144" }, recipient: { legalName: "Villa Coffee LTDA", cnpjCpf: "44963370000523" } }) }
    ],
    fiscal_document_items: [
      { id: "item", fiscal_document_id: "document", description: "Cafe arabica", quantity_decimal: "500", unit: "SACK", sacks_quantity_decimal: "500", total_amount_cents: 90000000 },
      { id: "third-item", fiscal_document_id: "third-document", description: "Cafe conilon", quantity_decimal: "100", unit: "SACK", sacks_quantity_decimal: "100", total_amount_cents: 8000000 },
      { id: "pending-item", fiscal_document_id: "pending-document", description: "Cafe arabica", quantity_decimal: "250", unit: "SACK", sacks_quantity_decimal: "250", total_amount_cents: 45000000 }
    ],
    warehouse_movements: [
      { id: "warehouse-manual", organization_id: organizationId, own_legal_entity_id: legalEntityId, access_key: "MANUAL:1", item_number: "1", document_number: "AJ-1", issue_date: "2026-09-01", warehouse_name: "SANTA FE", warehouse_cnpj: "04164419000130", product_description: "ARABICA", cfop: "MANUAL", movement_type: "DEPOSIT", movement_kind: "PHYSICAL", quantity_kg_decimal: "60000", source_unit: "SACK", source_quantity_decimal: "1000", status: "ACTIVE", origin: "MANUAL", created_at: "2026-09-01T12:00:00Z" },
      { id: "warehouse-return", organization_id: organizationId, own_legal_entity_id: legalEntityId, access_key: "NFE:2164", item_number: "1", document_number: "2164", series: "1", issue_date: "2026-09-10", warehouse_name: "SANTA FE ARMAZENS GERAIS EIRELI", warehouse_cnpj: "04164419000130", product_description: "CAFE BENEFICIADO CRU EM GRAO ARABICA", cfop: "1906", movement_type: "RETURN", movement_kind: "PHYSICAL", quantity_kg_decimal: "30000", source_unit: "SACK", source_quantity_decimal: "500", referenced_document_number: "1344", status: "ACTIVE", origin: "XML", created_at: "2026-09-10T12:00:00Z" },
      { id: "warehouse-pending", organization_id: organizationId, own_legal_entity_id: legalEntityId, access_key: "NFE:2200", item_number: "1", document_number: "2200", series: "1", issue_date: "2026-09-12", warehouse_name: "SANTA FE ARMAZENS GERAIS EIRELI", warehouse_cnpj: "04164419000130", product_description: "CAFE ARABICA", cfop: "1906", movement_type: "RETURN", movement_kind: "PHYSICAL", quantity_kg_decimal: "6000", source_unit: "SACK", source_quantity_decimal: "100", status: "PENDING_REVIEW", notes: "Referencia da remessa nao identificada", origin: "XML", created_at: "2026-09-12T12:00:00Z" }
    ],
    client_charges: [
      // Permanece ISSUED no servidor, mas ja venceu. O desktop transforma esse
      // estado em OVERDUE durante a leitura e o site deve calcular o mesmo.
      { id: chargeId, organization_id: organizationId, own_legal_entity_id: legalEntityId, client_partner_id: clientId, charge_number: "COB-0099", reference_code: "SET-2026", periodicity: "MONTHLY", period_start: "2026-09-01", period_end: "2026-09-30", issue_date: "2026-09-30", due_date: "2000-01-01", status: "ISSUED", subtotal_services_cents: 200000, additions_cents: 0, deductions_cents: 0, final_amount_cents: 200000, paid_amount_cents: 0, open_amount_cents: 200000, created_at: "2026-09-30T12:00:00Z", updated_at: "2026-09-30T12:00:00Z" },
      { id: "charge-paid", organization_id: "org2", own_legal_entity_id: "entity2", client_partner_id: "client2", periodicity: "MONTHLY", period_start: "2026-09-01", period_end: "2026-09-30", issue_date: "2026-09-30", due_date: "2026-10-05", status: "PAID", subtotal_services_cents: 45000, additions_cents: 0, deductions_cents: 0, final_amount_cents: 45000, paid_amount_cents: 45000, open_amount_cents: 0, created_at: "2026-09-30T12:00:00Z", updated_at: "2026-09-30T12:00:00Z" }
    ],
    client_charge_operations: [{ id: "charge-operation", client_charge_id: chargeId, operation_id: "operation", own_legal_entity_id_snapshot: legalEntityId, own_legal_entity_name_snapshot: "Villa Coffee LTDA", operation_date_snapshot: "2026-09-10", fiscal_document_number_snapshot: "123", issuer_name_snapshot: "Villa Coffee LTDA", destination_name_snapshot: "Cliente Teste", product_name_snapshot: "Cafe", operation_scope_snapshot: "INTERNAL", quantity_sacks_decimal_snapshot: "500", service_rate_cents_snapshot: 400, service_amount_cents_snapshot: 200000, created_at: "2026-09-30T12:00:00Z" }],
    client_charge_adjustments: [], client_payment_allocations: [],
    client_ledger_entries: [
      { id: "ledger-service", organization_id: organizationId, own_legal_entity_id: legalEntityId, client_partner_id: clientId, client_charge_id: chargeId, entry_type: "SERVICE_CHARGE", effect: "INCREASE_RECEIVABLE", amount_cents: 200000, entry_date: "2026-09-30", description: "Cobranca de servico", status: "CONFIRMED", created_at: "2026-09-30T12:00:00Z" },
      { id: "ledger-advance", organization_id: organizationId, own_legal_entity_id: legalEntityId, client_partner_id: clientId, entry_type: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", amount_cents: 50000, entry_date: "2026-09-16", description: "Adiantamento recebido", status: "CONFIRMED", created_at: "2026-09-16T12:00:00Z" },
      { id: "ledger-surcharge", organization_id: organizationId, own_legal_entity_id: legalEntityId, client_partner_id: clientId, entry_type: "SURCHARGE", effect: "INCREASE_RECEIVABLE", amount_cents: 25000, entry_date: "2026-09-17", description: "Acrescimo", status: "CONFIRMED", created_at: "2026-09-17T12:00:00Z" },
      { id: "ledger-payment", organization_id: organizationId, own_legal_entity_id: legalEntityId, client_partner_id: clientId, entry_type: "PAYMENT_RECEIVED", effect: "REDUCE_RECEIVABLE", amount_cents: 30000, entry_date: "2026-09-18", description: "Pagamento recebido", status: "CONFIRMED", created_at: "2026-09-18T12:00:00Z" },
      { id: "ledger-cancelled", organization_id: organizationId, own_legal_entity_id: legalEntityId, client_partner_id: clientId, entry_type: "CREDIT", effect: "REDUCE_RECEIVABLE", amount_cents: 10000, entry_date: "2026-09-19", description: "Credito cancelado", status: "CANCELLED", cancellation_reason: "Teste", created_at: "2026-09-19T12:00:00Z" }
    ],
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
    expect(dashboard.json()).toMatchObject({
      sacks: 500,
      operationCount: 1,
      receivableCents: 450000,
      receivedCents: 45000,
      unbilledCount: 3,
      overdueCharges: [expect.objectContaining({ chargeId, partnerName: "Cliente Teste", openAmountCents: 200000 })]
    });

    const notes = await app.inject({ method: "GET", url: `/v1/viewer/open-notes?${query}`, headers: { authorization: "Bearer test" } });
    expect(notes.statusCode).toBe(200);
    expect(notes.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentNumber: "123", companyTone: "villa", billingStatus: "UNBILLED" }),
      expect.objectContaining({ documentNumber: "5201", companyTone: "other", companyContext: "Operacao terceirizada", issuerName: "Emitente Terceiro LTDA" })
    ]));

    const invoices = await app.inject({ method: "GET", url: `/v1/viewer/invoices?${query}&direction=ALL&status=ACTIVE`, headers: { authorization: "Bearer test" } });
    expect(invoices.statusCode).toBe(200);
    expect(invoices.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ documentNumber: "123", counterpartyName: "Cliente Teste", ownLegalEntityName: "Villa Coffee Minas Gerais", sacks: 500, totalAmountCents: 90000000 }),
      expect.objectContaining({ documentNumber: "124", counterpartyName: "Fornecedor Teste LTDA", direction: "INBOUND", hasPendingIssues: true, sacks: 250 })
    ]));

    const pendingInvoices = await app.inject({ method: "GET", url: `/v1/viewer/invoices?${query}&direction=INBOUND&status=PENDING`, headers: { authorization: "Bearer test" } });
    expect(pendingInvoices.json()).toEqual([expect.objectContaining({ documentNumber: "124", pendingNotes: "Conferir fornecedor" })]);

    const warehouses = await app.inject({ method: "GET", url: `/v1/viewer/warehouses?${query}&status=ALL`, headers: { authorization: "Bearer test" } });
    expect(warehouses.statusCode).toBe(200);
    expect(warehouses.json()).toMatchObject({
      summary: {
        totalKg: 30000,
        totalSacks: 500,
        warehouseCount: 1,
        activeMovementCount: 2,
        pendingReviewCount: 1,
        balances: [expect.objectContaining({ warehouseName: "SANTA FE", warehouseCnpj: "04164419000130", productDescription: "ARABICA", quantityKg: 30000, quantitySacks: 500 })]
      },
      warehouses: [{ cnpj: "04164419000130", name: "SANTA FE" }],
      movements: expect.arrayContaining([
        expect.objectContaining({ id: "warehouse-manual", origin: "MANUAL", movementType: "DEPOSIT" }),
        expect.objectContaining({ id: "warehouse-return", referencedDocumentNumber: "1344", movementType: "RETURN" }),
        expect.objectContaining({ id: "warehouse-pending", status: "PENDING_REVIEW" })
      ])
    });

    const pendingWarehouse = await app.inject({ method: "GET", url: `/v1/viewer/warehouses?${query}&status=PENDING_REVIEW&warehouseCnpj=04164419000130`, headers: { authorization: "Bearer test" } });
    expect(pendingWarehouse.json()).toMatchObject({ movements: [expect.objectContaining({ documentNumber: "2200", notes: "Referencia da remessa nao identificada" })] });

    const scope = `organizationId=${organizationId}&legalEntityId=${legalEntityId}`;
    const partners = await app.inject({ method: "GET", url: `/v1/viewer/partners?${scope}`, headers: { authorization: "Bearer test" } });
    expect(partners.statusCode).toBe(200);
    expect(partners.json()).toEqual([expect.objectContaining({ display_name: "Cliente Teste", roles: [{ role: "CLIENT" }], legal_entities: [expect.objectContaining({ cnpj: "11111111000111" })] })]);

    const products = await app.inject({ method: "GET", url: `/v1/viewer/products?${scope}`, headers: { authorization: "Bearer test" } });
    expect(products.json()).toEqual([expect.objectContaining({ name: "Cafe Arabica", aliases: ["ARABICA TIPO 6"] })]);

    const serviceRates = await app.inject({ method: "GET", url: `/v1/viewer/rate-rules?${scope}&kind=SERVICE`, headers: { authorization: "Bearer test" } });
    expect(serviceRates.json()).toEqual([expect.objectContaining({ id: "service-rate", rate_value_cents: 400, business_partner: { display_name: "Cliente Teste" } })]);

    const purchaseRates = await app.inject({ method: "GET", url: `/v1/viewer/rate-rules?${scope}&kind=PURCHASE`, headers: { authorization: "Bearer test" } });
    expect(purchaseRates.json()).toEqual([expect.objectContaining({ id: "purchase-rate", rate_value_cents: 700 })]);

    const payables = await app.inject({ method: "GET", url: `/v1/viewer/payables?${scope}`, headers: { authorization: "Bearer test" } });
    expect(payables.json()).toEqual([expect.objectContaining({ id: "payable", status: "OVERDUE", supplier: { display_name: "Cliente Teste" } })]);

    const finance = await app.inject({ method: "GET", url: `/v1/viewer/finance?${scope}`, headers: { authorization: "Bearer test" } });
    expect(finance.json()).toMatchObject({ totalReceivableCents: 200000, totalPayableCents: 100000, byEntity: [expect.objectContaining({ name: "Villa Coffee Minas Gerais" })] });

    const reports = await app.inject({ method: "GET", url: `/v1/viewer/reports?${scope}&year=2026`, headers: { authorization: "Bearer test" } });
    expect(reports.json()[8]).toMatchObject({ month: 9, operationCount: 2, sacks: 1400, amountCents: 510000, confirmationCount: 1 });

    const reconciliations = await app.inject({ method: "GET", url: `/v1/viewer/transfer-reconciliations?${scope}`, headers: { authorization: "Bearer test" } });
    expect(reconciliations.json()).toEqual([expect.objectContaining({ id: "reconciliation", clientName: "Cliente Teste", invoiceCount: 1, paymentCount: 1, balanceCents: 40000000 })]);

    const comparison = await app.inject({ method: "GET", url: `/v1/viewer/comparison?${scope}&firstStart=2026-08-01&firstEnd=2026-08-31&secondStart=2026-09-01&secondEnd=2026-09-30`, headers: { authorization: "Bearer test" } });
    expect(comparison.json()).toMatchObject({
      first: { operationCount: 0, sacks: 0, amountCents: 0 },
      second: { operationCount: 1, sacks: 500, amountCents: 150000, clients: [expect.objectContaining({ name: "Cliente Teste" })] }
    });

    const charges = await app.inject({ method: "GET", url: `/v1/viewer/charges?${query}&status=OPEN`, headers: { authorization: "Bearer test" } });
    expect(charges.statusCode).toBe(200);
    expect(charges.json()).toEqual([
      expect.objectContaining({ chargeNumber: "COB-0099", referenceCode: "SET-2026", clientName: "Cliente Teste", status: "OVERDUE", openAmountCents: 200000 })
    ]);

    const ledger = await app.inject({ method: "GET", url: `/v1/viewer/ledger?${query}&clientId=${clientId}`, headers: { authorization: "Bearer test" } });
    expect(ledger.statusCode).toBe(200);
    expect(ledger.json()).toMatchObject({
      client: { id: clientId, displayName: "Cliente Teste" },
      summary: {
        totalServiceCents: 350000,
        liveUnbilledServiceCents: 150000,
        surchargeCents: 25000,
        advanceCents: 50000,
        creditCents: 0,
        paymentCents: 30000,
        balanceCents: 295000
      },
      entries: expect.arrayContaining([
        expect.objectContaining({ id: "ledger-service", description: "Cobranca 2026-09-01 a 2026-09-30" }),
        expect.objectContaining({ id: "ledger-cancelled", status: "CANCELLED", cancellationReason: "Teste" })
      ])
    });

    const confirmations = await app.inject({ method: "GET", url: `/v1/viewer/confirmations?${query}&status=OPEN`, headers: { authorization: "Bearer test" } });
    expect(confirmations.statusCode).toBe(200);
    expect(confirmations.json()).toEqual([
      expect.objectContaining({ confirmationNumber: "VCMG 0200", counterpartyName: "Comprador Teste LTDA", ownLegalEntityName: "Villa Coffee Minas Gerais", totalQuantitySacks: "500" })
    ]);

    const pdf = await app.inject({ method: "GET", url: `/v1/viewer/charges/${chargeId}/pdf`, headers: { authorization: "Bearer test" } });
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
    await app.close();
  });
});
