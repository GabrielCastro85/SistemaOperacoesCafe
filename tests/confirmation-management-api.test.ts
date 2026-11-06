import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type pg from "pg";
import { registerConfirmationManagementRoutes } from "../server/src/confirmationManagement.js";

type Row = Record<string, unknown>;
const ORG = "11111111-1111-4111-8111-111111111111";
const OWN = "33333333-3333-4333-8333-333333333331";
const DOC = "aaaaaaaa-0000-4000-8000-000000000001";
const ITEM = "aaaaaaaa-0000-4000-8000-000000000002";
const OPERATION = "aaaaaaaa-0000-4000-8000-000000000003";
const PRODUCT = "77777777-7777-4777-8777-777777777701";
const BUYER_ENTITY = "bbbbbbbb-0000-4000-8000-000000000001";
const SELLER_PARTNER = "bbbbbbbb-0000-4000-8000-000000000002";

function confirmationPool() {
  const records = new Map<string, Map<string, Row>>();
  let revision = 1;
  const table = (name: string) => { const current = records.get(name) ?? new Map<string, Row>(); records.set(name, current); return current; };
  table("organizations").set(ORG, { id: ORG, slug: "villa", display_name: "Villa Coffee", app_display_name: "Villa Coffee", primary_color: "#2f5d3a", secondary_color: "#c8a46a", accent_color: "#8a5a2b", is_active: 1 });
  table("legal_entities").set(OWN, {
    id: OWN, organization_id: ORG, legal_name: "VILLA COFFEE COMERCIO LTDA", trade_name: "Villa Coffee Minas Gerais", cnpj: "44963370000523", state: "MG", city: "Manhuacu",
    address_line: "Rua A", address_number: "1", district: "Centro", postal_code: "36900000", document_prefix: null, is_active: 1,
    default_bank_name: "Banco do Brasil", default_bank_agency: "2479", default_bank_account: "130009247", default_payment_terms: "A vista", default_delivery_terms: null
  });
  table("products").set(PRODUCT, { id: PRODUCT, organization_id: ORG, name: "Cafe Arabica", default_sack_weight_kg: 60, is_active: 1 });
  table("fiscal_documents").set(DOC, { id: DOC, organization_id: ORG, own_legal_entity_id: OWN, document_number: "1203", series: "1", issue_date: "2026-11-05", status: "CONFIRMED", total_amount_cents: 22_000_000, direction: "OUTBOUND", document_type: "MANUAL_INVOICE", has_pending_issues: 0, created_at: "2026-11-05T10:00:00Z", updated_at: "2026-11-05T10:00:00Z" });
  table("fiscal_document_items").set(ITEM, { id: ITEM, fiscal_document_id: DOC, product_id: PRODUCT, description: "CAFE ARABICA BICA CORRIDA", quantity_decimal: "26400", unit: "KG", unit_price_decimal: "500", total_amount_cents: 22_000_000, sacks_quantity_decimal: "440", created_at: "2026-11-05T10:00:00Z" });
  table("operations").set(OPERATION, { id: OPERATION, fiscal_document_id: DOC, fiscal_document_item_id: ITEM, organization_id: ORG, own_legal_entity_id: OWN, operation_type: "SALE", operation_scope: "INTERNAL", operation_date: "2026-11-05", quantity_sacks_decimal: "440", status: "CONFIRMED", billing_status: "UNBILLED" });
  table("partner_legal_entities").set(BUYER_ENTITY, { id: BUYER_ENTITY, organization_id: ORG, business_partner_id: null, legal_name: "MASSIMO ZANETTI BEVERAGE", cnpj: "11222333000144", state: "SP", is_active: 1 });
  table("business_partners").set(SELLER_PARTNER, { id: SELLER_PARTNER, organization_id: ORG, display_name: "Fazenda Boa Vista", is_active: 1 });
  table("deal_confirmations").set("cccccccc-0000-4000-8000-000000000001", { id: "cccccccc-0000-4000-8000-000000000001", organization_id: ORG, own_legal_entity_id: OWN, confirmation_number: "VCMG 0001", confirmation_date: "2026-03-01", status: "ISSUED" });
  table("deal_confirmations").set("cccccccc-0000-4000-8000-000000000002", { id: "cccccccc-0000-4000-8000-000000000002", organization_id: ORG, own_legal_entity_id: OWN, confirmation_number: "VCMG 0003", confirmation_date: "2026-04-01", status: "ISSUED" });
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
    return { rows: [] };
  };
  const pool = { query, async connect() { return { query, release() {} }; } } as unknown as pg.Pool;
  const app = Fastify();
  registerConfirmationManagementRoutes(app, pool);
  const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: Record<string, unknown>) => app.inject({
    method, url, headers: payload ? { authorization: "Bearer t", "content-type": "application/json" } : { authorization: "Bearer t" }, ...(payload ? { payload } : {})
  });
  return { table, call };
}

async function readyDraft(state: ReturnType<typeof confirmationPool>): Promise<string> {
  const created = await state.call("POST", "/v1/manage/confirmations", { organizationId: ORG, fiscalDocumentIds: [DOC], confirmationDate: "2026-11-06" });
  expect(created.statusCode).toBe(201);
  const id = created.json().id as string;
  expect((await state.call("POST", `/v1/manage/confirmations/${id}/parties`, { partyRole: "BUYER", partnerLegalEntityId: BUYER_ENTITY, sortOrder: 1 })).statusCode).toBe(200);
  expect((await state.call("POST", `/v1/manage/confirmations/${id}/parties`, { partyRole: "SELLER", businessPartnerId: SELLER_PARTNER, sortOrder: 2 })).statusCode).toBe(200);
  return id;
}

describe("confirmacoes pelo site", () => {
  it("cria a partir da nota com itens oficiais, emissora e vinculos", async () => {
    const state = confirmationPool();
    const id = await readyDraft(state);
    const detail = (await state.call("GET", `/v1/manage/confirmations/${id}`)).json();
    expect(detail.confirmation).toMatchObject({ status: "DRAFT", confirmationNumber: null, totalQuantitySacksDecimal: "440", totalCommercialAmountCents: 22_000_000, bankName: "Banco do Brasil", paymentTermsSnapshot: "A vista" });
    expect(detail.items[0]).toMatchObject({ productNameSnapshot: "CAFE ARABICA BICA CORRIDA", quantitySacksDecimal: "440", totalAmountCents: 22_000_000 });
    expect(detail.parties.map((party: { partyRole: string }) => party.partyRole).sort()).toEqual(["BUYER", "ISSUER", "SELLER"]);
    expect(detail.fiscalDocuments).toHaveLength(1);
    expect(detail.operations).toHaveLength(1);
    expect(detail.pendingIssues.map((issue: { code: string }) => issue.code)).toEqual(["DELIVERY_MISSING", "CLAUSES_NOT_REVIEWED"]);
    expect(detail.permissions).toMatchObject({ editable: true, canIssue: true, canDelete: true });
  });

  it("emite com o numero oficial reaproveitando buraco, respeita o piso e gera o PDF", async () => {
    const state = confirmationPool();
    const id = await readyDraft(state);
    const issued = await state.call("POST", `/v1/manage/confirmations/${id}/issue`, {});
    expect(issued.statusCode).toBe(200);
    expect(issued.json()).toMatchObject({ status: "ISSUED", confirmationNumber: "VCMG 0002" });
    expect([...state.table("document_sequences").values()][0]).toMatchObject({ prefix: "VCMG ", current_number: 0, year: 2026 });
    expect((await state.call("POST", `/v1/manage/confirmations/${id}/items`, { sortOrder: 1, productId: null, productNameSnapshot: "X", quantitySacksDecimal: "1", sackWeightKgDecimal: "60", unitPriceDecimal: "1", productDescriptionSnapshot: null, cropSnapshot: null, qualitySnapshot: null, packagingSnapshot: null, originSnapshot: null, destinationSnapshot: null, deliveryStartDate: null, deliveryEndDate: null, deliveryLocationSnapshot: null, notes: null })).statusCode).toBe(409);
    const pdf = await state.call("GET", `/v1/manage/confirmations/${id}/pdf`);
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.rawPayload.subarray(0, 4).toString()).toBe("%PDF");

    const sequence = [...state.table("document_sequences").values()][0];
    state.table("document_sequences").set(String(sequence.id), { ...sequence, current_number: 10 });
    const second = await readyDraft(state);
    expect((await state.call("POST", `/v1/manage/confirmations/${second}/issue`, {})).json().confirmationNumber).toBe("VCMG 0011");
  });

  it("recusa emitir sem comprador e vendedor", async () => {
    const state = confirmationPool();
    const id = (await state.call("POST", "/v1/manage/confirmations", { organizationId: ORG, fiscalDocumentIds: [DOC] })).json().id as string;
    const refused = await state.call("POST", `/v1/manage/confirmations/${id}/issue`, {});
    expect(refused.statusCode).toBe(409);
    expect(refused.json().message).toContain("Vendedor ausente");
  });

  it("substitui a emitida por um novo rascunho e so cancela a original depois de cancelar a substituta", async () => {
    const state = confirmationPool();
    const id = await readyDraft(state);
    await state.call("POST", `/v1/manage/confirmations/${id}/issue`, {});
    const replaced = await state.call("POST", `/v1/manage/confirmations/${id}/replace`, { reason: "Preco renegociado" });
    const newId = replaced.json().newConfirmationId as string;
    expect(state.table("deal_confirmations").get(id)).toMatchObject({ status: "REPLACED", replaced_by_confirmation_id: newId, signature_status: "NOT_APPLICABLE" });
    expect(state.table("deal_confirmations").get(newId)).toMatchObject({ status: "DRAFT", confirmation_number: null });
    expect([...state.table("deal_confirmation_items").values()].filter((row) => row.deal_confirmation_id === newId)).toHaveLength(1);
    expect([...state.table("deal_confirmation_parties").values()].filter((row) => row.deal_confirmation_id === newId).map((row) => row.party_role).sort()).toEqual(["BUYER", "ISSUER", "SELLER"]);
    expect((await state.call("POST", `/v1/manage/confirmations/${id}/cancel`, { reason: "Negocio desfeito" })).statusCode).toBe(409);
    expect((await state.call("POST", `/v1/manage/confirmations/${newId}/cancel`, { reason: "Negocio desfeito" })).statusCode).toBe(200);
    expect((await state.call("POST", `/v1/manage/confirmations/${id}/cancel`, { reason: "Negocio desfeito" })).statusCode).toBe(200);
    expect(state.table("deal_confirmations").get(id)).toMatchObject({ status: "CANCELLED", cancellation_reason: "Negocio desfeito" });
  });

  it("exclui rascunho sem numero com tudo o que pertence a ele", async () => {
    const state = confirmationPool();
    const id = await readyDraft(state);
    expect((await state.call("DELETE", `/v1/manage/confirmations/${id}`)).statusCode).toBe(200);
    expect(state.table("deal_confirmations").has(id)).toBe(false);
    for (const name of ["deal_confirmation_items", "deal_confirmation_parties", "deal_confirmation_fiscal_documents", "deal_confirmation_operations", "deal_confirmation_status_history"]) {
      expect([...state.table(name).values()].some((row) => row.deal_confirmation_id === id), name).toBe(false);
    }
  });

  it("exige 100% nos percentuais de pagamento e agrega o status das assinaturas", async () => {
    const state = confirmationPool();
    const id = await readyDraft(state);
    const term = { sortOrder: 0, description: "Sinal", percentageBasisPoints: 3000, amountCents: null, dueDate: null, daysAfterEvent: null, eventReference: null };
    expect((await state.call("POST", `/v1/manage/confirmations/${id}/payment-terms`, term)).statusCode).toBe(409);
    expect((await state.call("POST", `/v1/manage/confirmations/${id}/payment-terms`, { ...term, percentageBasisPoints: 10000 })).statusCode).toBe(200);
    const signer = { partyRole: "BUYER", name: "Joao", documentNumber: null, positionTitle: null, email: null, phone: null, signatureOrder: 1, signatureStatus: "PENDING", notes: null };
    const added = await state.call("POST", `/v1/manage/confirmations/${id}/signers`, signer);
    await state.call("POST", `/v1/manage/confirmations/${id}/signers`, { ...signer, name: "Maria", signatureOrder: 2 });
    await state.call("PUT", `/v1/manage/confirmations/${id}/signers/${added.json().signerId as string}`, { ...signer, signatureStatus: "SIGNED_EXTERNALLY" });
    expect(state.table("deal_confirmations").get(id)).toMatchObject({ signature_status: "PARTIALLY_SIGNED" });
  });
});
