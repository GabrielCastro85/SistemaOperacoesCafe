import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type pg from "pg";
import { registerChargeManagementRoutes } from "../server/src/chargeManagement.js";

type Row = Record<string, unknown>;
const ORG = "11111111-1111-4111-8111-111111111111";
const OWN = "33333333-3333-4333-8333-333333333331";
const CLIENT = "bbbbbbbb-0000-4000-8000-000000000002";
const DOC1 = "aaaaaaaa-0000-4000-8000-000000000001";
const DOC2 = "aaaaaaaa-0000-4000-8000-000000000002";
const OP1 = "aaaaaaaa-0000-4000-8000-000000000011";
const OP2 = "aaaaaaaa-0000-4000-8000-000000000012";
const CREDIT = "eeeeeeee-0000-4000-8000-000000000001";
const PRODUCT = "77777777-7777-4777-8777-777777777701";

function chargePool() {
  const records = new Map<string, Map<string, Row>>();
  let revision = 1;
  const actions: string[] = [];
  const table = (name: string) => { const current = records.get(name) ?? new Map<string, Row>(); records.set(name, current); return current; };
  table("organizations").set(ORG, { id: ORG, slug: "villa", display_name: "Villa Coffee", app_display_name: "Villa Coffee", primary_color: "#2f5d3a", secondary_color: "#c8a46a", accent_color: "#8a5a2b", is_active: 1, created_at: "x", updated_at: "x" });
  table("legal_entities").set(OWN, { id: OWN, organization_id: ORG, legal_name: "VILLA COFFEE COMERCIO LTDA", trade_name: "Villa Coffee Minas Gerais", cnpj: "44963370000523", state: "MG", is_active: 1, created_at: "x", updated_at: "x" });
  table("business_partners").set(CLIENT, { id: CLIENT, organization_id: ORG, display_name: "Cliente Teste", requires_contract: 0, is_active: 1, created_at: "x", updated_at: "x" });
  table("products").set(PRODUCT, { id: PRODUCT, organization_id: ORG, name: "Cafe Arabica", is_active: 1 });
  const document = (id: string, number: string, dae = 0) => ({
    id, organization_id: ORG, own_legal_entity_id: OWN, responsible_partner_id: CLIENT, document_number: number, series: "1", issue_date: "2026-11-03",
    status: "CONFIRMED", direction: "OUTBOUND", has_pending_issues: 0, freight_dae_amount_cents: dae, freight_dae_reference: dae ? "123" : null,
    fiscal_snapshot_json: JSON.stringify({ issuer: { legalName: "VILLA COFFEE COMERCIO LTDA", cnpjCpf: "44963370000523" }, recipient: { legalName: "VASSULER CAFES LTDA", cnpjCpf: "11222333000144" } })
  });
  table("fiscal_documents").set(DOC1, document(DOC1, "1201", 2500));
  table("fiscal_documents").set(DOC2, document(DOC2, "1202"));
  const operation = (id: string, documentId: string, sacks: string, amount: number) => ({
    id, fiscal_document_id: documentId, organization_id: ORG, own_legal_entity_id: OWN, responsible_partner_id: CLIENT, product_id: PRODUCT,
    operation_type: "SALE", operation_scope: "INTERNAL", operation_date: "2026-11-03", quantity_sacks_decimal: sacks, status: "CONFIRMED",
    billing_status: "UNBILLED", client_charge_id: null, applied_rate_value_cents: 150, service_amount_cents: amount
  });
  table("operations").set(OP1, operation(OP1, DOC1, "100", 15_000));
  table("operations").set(OP2, operation(OP2, DOC2, "40", 6_000));
  table("client_ledger_entries").set(CREDIT, {
    id: CREDIT, organization_id: ORG, own_legal_entity_id: OWN, client_partner_id: CLIENT, client_charge_id: null, entry_type: "CREDIT",
    effect: "REDUCE_RECEIVABLE", amount_cents: 5_000, entry_date: "2026-10-30", description: "Credito de quebra", status: "CONFIRMED", available_amount_cents: 5_000
  });
  const query = async (sql: string, params: unknown[] = []) => {
    if (sql.includes("FROM api_sessions")) return { rows: [{ sessionId: "s", userId: "dddddddd-0000-4000-8000-000000000001", username: "g", displayName: "G", deviceId: "d" }] };
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
    if (sql.includes("INSERT INTO server_audit_events")) { actions.push(String(params.find((value) => typeof value === "string" && value.startsWith("WEB_")) ?? "")); }
    return { rows: [] };
  };
  const pool = { query, async connect() { return { query, release() {} }; } } as unknown as pg.Pool;
  const app = Fastify();
  registerChargeManagementRoutes(app, pool);
  const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: Record<string, unknown>) => app.inject({
    method, url, headers: payload ? { authorization: "Bearer t", "content-type": "application/json" } : { authorization: "Bearer t" }, ...(payload ? { payload } : {})
  });
  return { table, call, actions };
}

async function draft(state: ReturnType<typeof chargePool>, operationIds = [OP1, OP2]): Promise<string> {
  const created = await state.call("POST", "/v1/manage/client-charges/drafts", {
    organizationId: ORG, legalEntityId: OWN, clientPartnerId: CLIENT, operationIds, periodStart: "2026-11-01", periodEnd: "2026-11-30", dueDate: "2099-12-10"
  });
  expect(created.statusCode).toBe(201);
  return created.json().id as string;
}

describe("cobrancas pelo site", () => {
  it("rascunho reserva as notas, soma DAE, desconto, CT-e e credito e emite como no app", async () => {
    const state = chargePool();
    const id = await draft(state);
    expect(state.table("operations").get(OP1)).toMatchObject({ billing_status: "RESERVED", client_charge_id: id });
    expect(state.table("client_charges").get(id)).toMatchObject({ status: "DRAFT", subtotal_services_cents: 21_000, additions_cents: 2_500, final_amount_cents: 23_500 });

    expect((await state.call("POST", `/v1/manage/client-charges/${id}/adjustments`, { adjustmentType: "DISCOUNT", effect: "REDUCE_RECEIVABLE", description: "Desconto", amountCents: 1_000, reason: "Combinado" })).statusCode).toBe(200);
    const links = [...state.table("client_charge_operations").values()];
    const cte = await state.call("POST", `/v1/manage/client-charges/${id}/cte`, { linkIds: links.map((row) => row.id), unitValueCents: 150 });
    expect(cte.statusCode).toBe(200);
    expect(cte.json().cteAmountCents).toBe(21_000);
    const credit = await state.call("POST", `/v1/manage/client-charges/${id}/credits`, { ledgerEntryId: CREDIT, amountCents: 3_000 });
    expect(credit.json()).toMatchObject({ status: "DRAFT", finalAmountCents: 23_500 - 1_000 + 21_000 - 3_000 });
    expect(state.table("client_ledger_entries").get(CREDIT)).toMatchObject({ available_amount_cents: 2_000 });
    expect((await state.call("POST", `/v1/manage/client-charges/${id}/credits`, { ledgerEntryId: CREDIT, amountCents: 3_000 })).statusCode).toBe(409);

    const detail = (await state.call("GET", `/v1/manage/client-charges/${id}`)).json();
    expect(detail.operations).toHaveLength(2);
    expect(detail.operations[0]).toMatchObject({ destinationNameSnapshot: "VASSULER CAFES LTDA", fiscalDocumentNumberSnapshot: "1201" });
    expect(detail.adjustments.find((row: { cte: unknown }) => row.cte)?.cte).toMatchObject({ sacks: "140", unitValueCents: 150 });
    expect(detail.availableEntries).toEqual([expect.objectContaining({ id: CREDIT, availableAmountCents: 2_000 })]);

    expect((await state.call("POST", `/v1/manage/client-charges/${id}/submit-review`, {})).json().status).toBe("PENDING_REVIEW");
    const issued = await state.call("POST", `/v1/manage/client-charges/${id}/issue`, {});
    expect(issued.json()).toMatchObject({ status: "ISSUED", openAmountCents: 40_500 });
    expect(state.table("operations").get(OP2)).toMatchObject({ billing_status: "BILLED" });
    const service = [...state.table("client_ledger_entries").values()].find((row) => row.entry_type === "SERVICE_CHARGE");
    expect(service).toMatchObject({ amount_cents: 40_500, client_charge_id: id, description: expect.stringContaining("Cobranca") });
    expect(JSON.parse(String(state.table("client_charges").get(id)!.snapshot_json)).operations).toHaveLength(2);
    expect([...state.table("charge_status_history").values()].map((row) => row.next_status)).toEqual(["DRAFT", "PENDING_REVIEW", "ISSUED"]);

    // Depois de emitida: ajuste ainda permitido e a conta-corrente acompanha.
    await state.call("POST", `/v1/manage/client-charges/${id}/adjustments`, { adjustmentType: "SURCHARGE", effect: "INCREASE_RECEIVABLE", description: "Acrescimo", amountCents: 500 });
    expect(service && state.table("client_ledger_entries").get(String(service.id))).toMatchObject({ amount_cents: 41_000 });
    expect((await state.call("POST", `/v1/manage/client-charges/${id}/operations/release`, {})).statusCode).toBe(409);

    const pdf = await state.call("GET", `/v1/manage/client-charges/${id}/pdf`);
    expect(pdf.statusCode).toBe(200);
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe("%PDF");
    const excel = await state.call("GET", `/v1/manage/client-charges/${id}/excel`);
    expect(excel.rawPayload.subarray(0, 2).toString()).toBe("PK");
    const image = (await state.call("GET", `/v1/manage/client-charges/${id}/image`)).json();
    expect(image.svg).toContain("<svg");
    expect(image.width).toBe(1100);
  });

  it("liberar nota tira o DAE e remover ajuste de credito devolve o saldo", async () => {
    const state = chargePool();
    const id = await draft(state);
    await state.call("POST", `/v1/manage/client-charges/${id}/credits`, { ledgerEntryId: CREDIT, amountCents: 4_000 });
    const released = await state.call("POST", `/v1/manage/client-charges/${id}/operations/release`, { operationIds: [OP1] });
    expect(released.json()).toMatchObject({ released: 1, finalAmountCents: 6_000 - 4_000 });
    expect(state.table("operations").get(OP1)).toMatchObject({ billing_status: "UNBILLED", client_charge_id: null });
    expect([...state.table("client_charge_adjustments").values()].some((row) => row.source_fiscal_document_id)).toBe(false);
    const creditAdjustment = [...state.table("client_charge_adjustments").values()].find((row) => row.ledger_entry_id === CREDIT)!;
    expect((await state.call("DELETE", `/v1/manage/client-charges/${id}/adjustments/${String(creditAdjustment.id)}`)).statusCode).toBe(200);
    expect(state.table("client_ledger_entries").get(CREDIT)).toMatchObject({ available_amount_cents: 5_000 });
    expect([...state.table("client_credit_allocations").values()][0]).toMatchObject({ cancelled_at: expect.any(String) });
    expect((await state.call("POST", `/v1/manage/client-charges/${id}/operations`, { operationIds: [OP1] })).json()).toMatchObject({ added: 1, finalAmountCents: 23_500 });
  });

  it("cancela devolvendo notas e creditos, e exclui rascunho sem deixar rastro", async () => {
    const state = chargePool();
    const id = await draft(state, [OP1]);
    await state.call("POST", `/v1/manage/client-charges/${id}/credits`, { ledgerEntryId: CREDIT, amountCents: 2_000 });
    await state.call("POST", `/v1/manage/client-charges/${id}/issue`, {});
    const cancelled = await state.call("POST", `/v1/manage/client-charges/${id}/cancel`, { reason: "Emitida errada" });
    expect(cancelled.json().status).toBe("CANCELLED");
    expect(state.table("operations").get(OP1)).toMatchObject({ billing_status: "UNBILLED", client_charge_id: null });
    expect(state.table("client_ledger_entries").get(CREDIT)).toMatchObject({ available_amount_cents: 5_000 });

    const other = await draft(state, [OP1, OP2]);
    await state.call("POST", `/v1/manage/client-charges/${other}/credits`, { ledgerEntryId: CREDIT, amountCents: 1_000 });
    const removed = await state.call("DELETE", `/v1/manage/client-charges/${other}`);
    expect(removed.json()).toMatchObject({ deleted: true });
    expect(state.table("client_charges").has(other)).toBe(false);
    expect([...state.table("client_charge_operations").values()].some((row) => row.client_charge_id === other)).toBe(false);
    expect([...state.table("client_charge_adjustments").values()].some((row) => row.client_charge_id === other)).toBe(false);
    expect(state.table("operations").get(OP2)).toMatchObject({ billing_status: "UNBILLED" });
    expect(state.table("client_ledger_entries").get(CREDIT)).toMatchObject({ available_amount_cents: 5_000 });
  });

  it("distribui um pagamento entre cobrancas e baixa a sobra depois", async () => {
    const state = chargePool();
    const first = await draft(state, [OP1]);
    const second = await draft(state, [OP2]);
    await state.call("POST", `/v1/manage/client-charges/${first}/issue`, {});
    expect((await state.call("POST", "/v1/manage/client-payments/batch", {
      organizationId: ORG, legalEntityId: OWN, clientPartnerId: CLIENT, paymentDate: "2026-11-06", amountCents: 20_000, paymentMethod: "PIX",
      allocations: [{ chargeId: second, amountCents: 1_000 }]
    })).statusCode).toBe(409);
    await state.call("POST", `/v1/manage/client-charges/${second}/issue`, {});

    const batch = await state.call("POST", "/v1/manage/client-payments/batch", {
      organizationId: ORG, legalEntityId: OWN, clientPartnerId: CLIENT, paymentDate: "2026-11-06", amountCents: 20_000, paymentMethod: "PIX",
      transactionReference: "PIX 123", allocations: [{ chargeId: first, amountCents: 17_500 }, { chargeId: second, amountCents: 2_000 }]
    });
    expect(batch.statusCode).toBe(201);
    expect(batch.json()).toMatchObject({ allocatedAmountCents: 19_500, availableAmountCents: 500 });
    expect(state.table("client_charges").get(first)).toMatchObject({ status: "PAID", open_amount_cents: 0 });
    expect(state.table("client_charges").get(second)).toMatchObject({ status: "PARTIALLY_PAID", open_amount_cents: 4_000 });
    expect([...state.table("client_ledger_entries").values()].filter((row) => row.entry_type === "PAYMENT_RECEIVED")).toHaveLength(2);

    const paymentId = batch.json().id as string;
    expect((await state.call("POST", `/v1/manage/client-payments/${paymentId}/allocate`, { chargeId: second, amountCents: 600 })).statusCode).toBe(409);
    const allocated = await state.call("POST", `/v1/manage/client-payments/${paymentId}/allocate`, { chargeId: second, amountCents: 500 });
    expect(allocated.json()).toMatchObject({ openAmountCents: 3_500, availableAmountCents: 0 });
    const list = (await state.call("GET", `/v1/manage/client-payments?organizationId=${ORG}&legalEntityId=${OWN}&clientPartnerId=${CLIENT}`)).json();
    expect(list[0]).toMatchObject({ amountCents: 20_000, allocatedAmountCents: 20_000, availableAmountCents: 0 });
    expect(list[0].allocations).toHaveLength(3);
    expect((await state.call("DELETE", `/v1/manage/client-charges/${second}`)).statusCode).toBe(409);

    const control = await state.call("POST", "/v1/manage/client-charges/control", { chargeIds: [first, second], filterDescription: "Novembro" });
    expect(control.statusCode).toBe(200);
    expect(control.rawPayload.subarray(0, 2).toString()).toBe("PK");
    const html = await state.call("POST", "/v1/manage/client-charges/control", { chargeIds: [first, second], format: "html" });
    expect(html.body).toContain("Cliente Teste");
  });
});
