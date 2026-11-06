import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type pg from "pg";
import { registerInvoiceManagementRoutes } from "../server/src/invoiceManagement.js";
import { registerOperationalManagementRoutes } from "../server/src/operationalManagement.js";
import { deterministicUuid } from "../electron/main/services/deterministicId.js";

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
  registerOperationalManagementRoutes(app, pool);
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

  it("guarda o DAE de frete no lancamento e na edicao e descarta a referencia sem valor", async () => {
    const state = invoicePool();
    const id = (await state.call("POST", "/v1/manage/invoices", { ...saleInput, freightDaeAmountCents: 15_000, freightDaeReference: "DAE 123" })).json().id as string;
    expect(state.table("fiscal_documents").get(id)).toMatchObject({ freight_dae_amount_cents: 15_000, freight_dae_reference: "DAE 123" });
    const base = { responsiblePartnerId: "client", documentNumber: "9001", series: "1", issueDate: "2026-11-06", totalAmountCents: 1_500_000, hasFinancialService: false };
    await state.call("PUT", `/v1/manage/invoices/${id}`, { ...base, freightDaeAmountCents: 20_000 });
    expect(state.table("fiscal_documents").get(id)).toMatchObject({ freight_dae_amount_cents: 20_000, freight_dae_reference: "DAE 123" });
    await state.call("PUT", `/v1/manage/invoices/${id}`, { ...base, freightDaeAmountCents: 0, freightDaeReference: "DAE 123" });
    expect(state.table("fiscal_documents").get(id)).toMatchObject({ freight_dae_amount_cents: 0, freight_dae_reference: null });
    expect((await state.call("GET", `/v1/manage/invoices/${id}`)).json().document).toMatchObject({ freightDaeAmountCents: 0, freightDaeReference: null });
  });

  it("abate a devolucao das sacas da venda e desfaz ao excluir", async () => {
    const state = invoicePool();
    const id = (await state.call("POST", "/v1/manage/invoices", { ...saleInput, confirm: true })).json().id as string;
    const added = await state.call("POST", `/v1/manage/invoices/${id}/returns`, { returnDate: "2026-11-07", inputUnit: "KG", inputQuantity: "600", reason: "Cafe fora do padrao" });
    expect(added.statusCode).toBe(201);
    expect(added.json().quantitySacks).toBe("10");
    expect([...state.table("operations").values()][0]).toMatchObject({ quantity_sacks_decimal: "90", gross_quantity_sacks_decimal: "100", service_amount_cents: 45_000 });
    expect((await state.call("POST", `/v1/manage/invoices/${id}/returns`, { returnDate: "2026-11-07", inputUnit: "SACKS", inputQuantity: "91", reason: "Excesso" })).json().error).toBe("RETURN_EXCEEDS");
    const detail = (await state.call("GET", `/v1/manage/invoices/${id}`)).json();
    expect(detail.returns).toEqual([expect.objectContaining({ quantitySacks: "10", reason: "Cafe fora do padrao" })]);
    expect(detail.permissions.canReturn).toBe(true);
    expect((await state.call("DELETE", `/v1/manage/invoice-returns/${added.json().id as string}`)).statusCode).toBe(200);
    expect([...state.table("operations").values()][0]).toMatchObject({ quantity_sacks_decimal: "100", service_amount_cents: 50_000 });
    expect(state.table("fiscal_document_returns").size).toBe(0);
  });

  it("atualiza a cobranca em aberto com a devolucao e bloqueia depois de pagamento", async () => {
    const state = invoicePool();
    const id = (await state.call("POST", "/v1/manage/invoices", { ...saleInput, confirm: true })).json().id as string;
    const [operation] = [...state.table("operations").values()];
    state.table("operations").set(String(operation.id), { ...operation, billing_status: "BILLED", client_charge_id: "charge" });
    state.table("client_charges").set("charge", { id: "charge", status: "ISSUED", due_date: "2099-01-01", subtotal_services_cents: 50_000, final_amount_cents: 51_500, paid_amount_cents: 0, open_amount_cents: 51_500 });
    state.table("client_charge_operations").set("link", { id: "link", client_charge_id: "charge", operation_id: operation.id, quantity_sacks_decimal_snapshot: "100", service_amount_cents_snapshot: 50_000, released_at: null });
    state.table("client_charge_adjustments").set("dae", { id: "dae", client_charge_id: "charge", effect: "INCREASE_RECEIVABLE", amount_cents: 1_500 });
    state.table("client_ledger_entries").set("entry", { id: "entry", client_charge_id: "charge", entry_type: "SERVICE_CHARGE", amount_cents: 51_500 });
    expect((await state.call("POST", `/v1/manage/invoices/${id}/returns`, { returnDate: "2026-11-07", inputUnit: "SACKS", inputQuantity: "10", reason: "Devolucao parcial" })).statusCode).toBe(201);
    expect(state.table("client_charge_operations").get("link")).toMatchObject({ quantity_sacks_decimal_snapshot: "90", service_amount_cents_snapshot: 45_000 });
    expect(state.table("client_charges").get("charge")).toMatchObject({ subtotal_services_cents: 45_000, additions_cents: 1_500, final_amount_cents: 46_500, open_amount_cents: 46_500, status: "ISSUED" });
    expect(state.table("client_ledger_entries").get("entry")).toMatchObject({ amount_cents: 46_500 });
    state.table("client_charges").set("charge", { ...state.table("client_charges").get("charge"), paid_amount_cents: 10_000, status: "PARTIALLY_PAID" });
    expect((await state.call("POST", `/v1/manage/invoices/${id}/returns`, { returnDate: "2026-11-08", inputUnit: "SACKS", inputQuantity: "5", reason: "Outra" })).json().error).toBe("CHARGE_PAID");
  });

  it("lanca nota terceirizada pela emissora cadastrada, com o mesmo id de empresa do aplicativo", async () => {
    const state = invoicePool();
    state.table("legal_entities").set("entity", { ...state.table("legal_entities").get("entity"), city: "Manhuacu", state: "MG", postal_code: "36900000" });
    state.table("partner_legal_entities").set("prime", { id: "prime", organization_id: "org", business_partner_id: null, legal_name: "PRIME COFFEE LTDA", cnpj: "38.136.546/0002-28", state: "MG", is_active: 1 });
    state.table("partner_legal_entities").set("linked", { id: "linked", organization_id: "org", business_partner_id: "client", legal_name: "Empresa do IF", cnpj: "11222333000144", is_active: 1 });
    expect((await state.call("GET", "/v1/manage/third-party-issuers?organizationId=org")).json()).toEqual([expect.objectContaining({ id: "prime", cnpj: "38.136.546/0002-28" })]);
    const { ownLegalEntityId: _own, ...thirdPartyInput } = saleInput;
    void _own;
    const created = await state.call("POST", "/v1/manage/invoices", { ...thirdPartyInput, issuerPartnerLegalEntityId: "prime", partnerLegalEntityId: "linked" });
    expect(created.statusCode).toBe(201);
    const entityId = deterministicUuid("thirdPartyLegalEntity", "38136546000228");
    expect(state.table("legal_entities").get(entityId)).toMatchObject({ document_prefix: "TERC-XML", cnpj: "38136546000228", city: "Manhuacu", is_draft: 1 });
    expect(state.table("fiscal_documents").get(created.json().id as string)).toMatchObject({
      own_legal_entity_id: entityId, partner_legal_entity_id: null, direction: "OUTBOUND", notes: expect.stringContaining("Nota terceirizada")
    });
    expect([...state.table("operations").values()][0]).toMatchObject({ own_legal_entity_id: entityId, applied_rate_value_cents: 500 });
    expect((await state.call("GET", `/v1/manage/invoices/${created.json().id as string}`)).json().document.thirdParty).toBe(true);
    await state.call("POST", "/v1/manage/invoices", { ...thirdPartyInput, documentNumber: "9002", issuerPartnerLegalEntityId: "prime" });
    expect([...state.table("legal_entities").values()].filter((row) => row.document_prefix === "TERC-XML")).toHaveLength(1);
  });

  it("importa XML sem CNPJ proprio como terceirizada e deixa a triangulada para o aplicativo", async () => {
    const state = invoicePool();
    const xml = (issuerCnpj: string) => `<?xml version="1.0" encoding="UTF-8"?>
      <NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe31261138136546000228550010000077771532100313" versao="4.00">
        <ide><cUF>31</cUF><natOp>VENDA</natOp><mod>55</mod><serie>1</serie><nNF>7777</nNF><dhEmi>2026-11-05T10:00:00-03:00</dhEmi></ide>
        <emit><CNPJ>${issuerCnpj}</CNPJ><xNome>PRIME COFFEE LTDA</xNome><enderEmit><xMun>Monte Santo de Minas</xMun><UF>MG</UF><CEP>37968000</CEP></enderEmit></emit>
        <dest><CNPJ>11222333000144</CNPJ><xNome>COMPRADOR FINAL LTDA</xNome><enderDest><UF>SP</UF></enderDest></dest>
        <det nItem="1"><prod><cProd>A</cProd><xProd>CAFE ARABICA</xProd><NCM>09011110</NCM><CFOP>6102</CFOP><uCom>SC</uCom><qCom>50</qCom><vUnCom>1200</vUnCom><vProd>60000</vProd><uTrib>SC</uTrib><qTrib>50</qTrib><vUnTrib>1200</vUnTrib></prod></det>
        <total><ICMSTot><vProd>60000</vProd><vNF>60000</vNF></ICMSTot></total>
      </infNFe></NFe>`;
    const preview = await state.call("POST", "/v1/manage/invoices/xml/preview", { organizationId: "org", xml: xml("38136546000228") });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ thirdParty: true, direction: "OUTBOUND" });
    const imported = await state.call("POST", "/v1/manage/invoices/xml/import", {
      organizationId: "org", xml: xml("38136546000228"), responsiblePartnerId: "client", operationScope: "EXTERNAL", itemProducts: [{ itemNumber: "1", productId: "arabica" }]
    });
    expect(imported.statusCode).toBe(201);
    const document = state.table("fiscal_documents").get(imported.json().id as string);
    expect(document).toMatchObject({ own_legal_entity_id: deterministicUuid("thirdPartyLegalEntity", "38136546000228"), notes: expect.stringContaining("Nota terceirizada") });
    expect(state.table("legal_entities").get(deterministicUuid("thirdPartyLegalEntity", "38136546000228"))).toMatchObject({ city: "Monte Santo de Minas", postal_code: "37968000" });

    state.table("partner_legal_entities").set("supplier-entity", { id: "supplier-entity", organization_id: "org", business_partner_id: "supplier", cnpj: "04164419000130", is_active: 1 });
    const triangulated = await state.call("POST", "/v1/manage/invoices/xml/preview", { organizationId: "org", xml: xml("04164419000130") });
    expect(triangulated.statusCode).toBe(409);
    expect(triangulated.json().error).toBe("TRIANGULATED_XML");
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
