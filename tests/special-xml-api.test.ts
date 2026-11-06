import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type pg from "pg";
import { registerInvoiceManagementRoutes } from "../server/src/invoiceManagement.js";
import { registerOperationalManagementRoutes } from "../server/src/operationalManagement.js";
import { registerSpecialXmlRoutes } from "../server/src/specialXml.js";
import { deterministicUuid } from "../electron/main/services/deterministicId.js";

type Row = Record<string, unknown>;

function accessKey(cnpj: string, number: number): string {
  const base = `3126${11}${cnpj}55001${String(number).padStart(9, "0")}1${String(number).padStart(8, "0")}`.slice(0, 43);
  let weight = 2; let sum = 0;
  for (let index = base.length - 1; index >= 0; index -= 1) { sum += Number(base[index]) * weight; weight = weight === 9 ? 2 : weight + 1; }
  const rest = sum % 11;
  return `${base}${rest < 2 ? 0 : 11 - rest}`;
}

function nfe(key: string, options: { issuer: string; issuerName: string; recipient: string; recipientName: string; cfop: string; unit: string; quantity: string; info?: string; number: number }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${key}" versao="4.00">
      <ide><cUF>31</cUF><natOp>OPERACAO</natOp><mod>55</mod><serie>1</serie><nNF>${options.number}</nNF><dhEmi>2026-11-05T10:00:00-03:00</dhEmi></ide>
      <emit><CNPJ>${options.issuer}</CNPJ><xNome>${options.issuerName}</xNome><enderEmit><UF>MG</UF></enderEmit></emit>
      <dest><CNPJ>${options.recipient}</CNPJ><xNome>${options.recipientName}</xNome><enderDest><UF>MG</UF></enderDest></dest>
      <det nItem="1"><prod><cProd>A</cProd><xProd>CAFE ARABICA</xProd><NCM>09011110</NCM><CFOP>${options.cfop}</CFOP><uCom>${options.unit}</uCom><qCom>${options.quantity}</qCom><vUnCom>10</vUnCom><vProd>6000</vProd><uTrib>${options.unit}</uTrib><qTrib>${options.quantity}</qTrib><vUnTrib>10</vUnTrib></prod></det>
      <total><ICMSTot><vProd>6000</vProd><vNF>6000</vNF></ICMSTot></total>
      ${options.info ? `<infAdic><infCpl>${options.info}</infCpl></infAdic>` : ""}
    </infNFe></NFe><protNFe><infProt><nProt>131260000000001</nProt><dhRecbto>2026-11-05T10:05:00-03:00</dhRecbto><cStat>100</cStat><xMotivo>Autorizado</xMotivo></infProt></protNFe></nfeProc>`;
}

function cancellation(key: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
      <evento versao="1.00"><infEvento Id="ID110111${key}01"><cOrgao>31</cOrgao><chNFe>${key}</chNFe><dhEvento>2026-11-06T09:00:00-03:00</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento>
        <detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>131260000000001</nProt><xJust>Erro na emissao da nota fiscal</xJust></detEvento></infEvento></evento>
      <retEvento versao="1.00"><infEvento><cStat>135</cStat><xMotivo>Evento registrado</xMotivo><chNFe>${key}</chNFe><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><nProt>131260000000099</nProt><dhRegEvento>2026-11-06T09:01:00-03:00</dhRegEvento></infEvento></retEvento>
    </procEventoNFe>`;
}

const OWN = "44963370000523";
const WAREHOUSE = "04164419000130";
const SUPPLIER = "22333444000155";
const BUYER = "33444555000166";

function specialPool() {
  const records = new Map<string, Map<string, Row>>();
  let revision = 10;
  const table = (name: string) => { const current = records.get(name) ?? new Map<string, Row>(); records.set(name, current); return current; };
  table("legal_entities").set("entity", { id: "entity", organization_id: "org", trade_name: "Villa MG", cnpj: OWN, is_active: 1 });
  for (const [id, name, role] of [["client", "IF", "CLIENT"], ["supplier", "Leo ES", "SUPPLIER"], ["broker", "Valani", "CLIENT"]] as const) {
    table("business_partners").set(id, { id, organization_id: "org", display_name: name, is_active: 1, requires_contract: 0 });
    table("business_partner_roles").set(`r-${id}`, { id: `r-${id}`, business_partner_id: id, role });
  }
  table("partner_legal_entities").set("supplier-entity", { id: "supplier-entity", organization_id: "org", business_partner_id: "supplier", legal_name: "LEO ES CAFES", cnpj: SUPPLIER, is_active: 1, is_primary: 1 });
  table("partner_legal_entities").set("buyer-entity", { id: "buyer-entity", organization_id: "org", business_partner_id: null, legal_name: "PRIMAVERA", cnpj: BUYER, is_active: 1 });
  table("partner_legal_entities").set("broker-entity", { id: "broker-entity", organization_id: "org", business_partner_id: "broker", legal_name: "VALANI", cnpj: "55666777000188", is_active: 1, is_primary: 1 });
  table("partner_company_links").set("link", { partner_legal_entity_id: "buyer-entity", business_partner_id: "broker" });
  table("products").set("arabica", { id: "arabica", organization_id: "org", name: "Cafe Arabica", default_sack_weight_kg: 60, is_active: 1 });
  table("purchase_rate_rules").set("p1", { id: "p1", organization_id: "org", business_partner_id: "supplier", operation_scope: "ALL", rate_value_cents: 700, effective_from: "2026-01-01", effective_to: null, priority: 0, is_active: 1 });
  table("service_rate_rules").set("s1", { id: "s1", organization_id: "org", business_partner_id: "broker", operation_scope: "ALL", rate_value_cents: 400, effective_from: "2026-01-01", effective_to: null, priority: 0, is_active: 1 });
  table("service_rate_rules").set("s2", { id: "s2", organization_id: "org", business_partner_id: "client", operation_scope: "ALL", rate_value_cents: 500, effective_from: "2026-01-01", effective_to: null, priority: 0, is_active: 1 });
  const query = async (sql: string, params: unknown[] = []) => {
    if (sql.includes("FROM api_sessions")) return { rows: [{ sessionId: "session", userId: "user", username: "gabriel", displayName: "Gabriel", deviceId: "device" }] };
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
  registerInvoiceManagementRoutes(app, pool);
  registerOperationalManagementRoutes(app, pool);
  registerSpecialXmlRoutes(app, pool);
  const post = (url: string, payload: Record<string, unknown>) => app.inject({ method: "POST", url, headers: { authorization: "Bearer t", "content-type": "application/json" }, payload });
  return { table, post };
}

describe("XMLs especiais pelo site", () => {
  it("aplica o cancelamento da SEFAZ na nota e nos movimentos de armazem e recusa repetir", async () => {
    const state = specialPool();
    const key = accessKey(OWN, 501);
    const imported = await state.post("/v1/manage/invoices/xml/import", {
      organizationId: "org", xml: nfe(key, { issuer: OWN, issuerName: "VILLA", recipient: BUYER, recipientName: "PRIMAVERA", cfop: "5102", unit: "SC", quantity: "10", number: 501 }),
      responsiblePartnerId: "client", operationScope: "INTERNAL", itemProducts: [{ itemNumber: "1", productId: "arabica" }]
    });
    expect(imported.statusCode).toBe(201);
    const inspected = await state.post("/v1/manage/invoices/xml/inspect", { organizationId: "org", xml: cancellation(key) });
    expect(inspected.json()).toMatchObject({ kind: "EVENT", eventType: "CANCELLATION", acceptedCancellation: true, document: { number: "501", status: "CONFIRMED" } });
    const applied = await state.post("/v1/manage/invoices/xml/event", { organizationId: "org", xml: cancellation(key) });
    expect(applied.json()).toMatchObject({ canceledDocument: true });
    const document = state.table("fiscal_documents").get(imported.json().id as string);
    expect(document).toMatchObject({ status: "CANCELED", cancel_reason: "Cancelamento XML protocolo 131260000000099" });
    expect([...state.table("operations").values()].every((row) => row.status === "CANCELED")).toBe(true);
    expect((await state.post("/v1/manage/invoices/xml/event", { organizationId: "org", xml: cancellation(key) })).json().error).toBe("DUPLICATE_EVENT");
  });

  it("guarda o cancelamento recebido antes da nota e cancela a nota quando ela chega", async () => {
    const state = specialPool();
    const key = accessKey(OWN, 502);
    const applied = await state.post("/v1/manage/invoices/xml/event", { organizationId: "org", xml: cancellation(key) });
    expect(applied.json()).toMatchObject({ canceledDocument: false });
    const imported = await state.post("/v1/manage/invoices/xml/import", {
      organizationId: "org", xml: nfe(key, { issuer: OWN, issuerName: "VILLA", recipient: BUYER, recipientName: "PRIMAVERA", cfop: "5102", unit: "SC", quantity: "10", number: 502 }),
      responsiblePartnerId: "client", operationScope: "INTERNAL", itemProducts: [{ itemNumber: "1", productId: "arabica" }]
    });
    const documentId = imported.json().id as string;
    expect(state.table("fiscal_documents").get(documentId)).toMatchObject({ status: "CANCELED" });
    expect([...state.table("fiscal_document_events").values()][0]).toMatchObject({ fiscal_document_id: documentId });
  });

  it("importa remessa e retorno de armazem como movimentos de estoque", async () => {
    const state = specialPool();
    const depositKey = accessKey(OWN, 1344);
    const deposit = nfe(depositKey, { issuer: OWN, issuerName: "VILLA", recipient: WAREHOUSE, recipientName: "SANTA FE ARMAZENS", cfop: "5905", unit: "KG", quantity: "6000", number: 1344 });
    expect((await state.post("/v1/manage/invoices/xml/inspect", { organizationId: "org", xml: deposit })).json()).toMatchObject({
      kind: "WAREHOUSE", movementType: "DEPOSIT", warehouseName: "SANTA FE ARMAZENS", items: [{ quantityKg: "6000", kind: "PHYSICAL" }]
    });
    expect((await state.post("/v1/manage/invoices/xml/warehouse", { organizationId: "org", xml: deposit })).statusCode).toBe(201);
    expect(state.table("warehouse_movements").get(deterministicUuid("warehouseMovement", depositKey, "1"))).toMatchObject({
      movement_type: "DEPOSIT", movement_kind: "PHYSICAL", quantity_kg_decimal: "6000", status: "ACTIVE", origin: "XML", own_legal_entity_id: "entity"
    });
    expect((await state.post("/v1/manage/invoices/xml/warehouse", { organizationId: "org", xml: deposit })).json().error).toBe("DUPLICATE_ACCESS_KEY");

    const returnWithReference = nfe(accessKey(WAREHOUSE, 77), { issuer: WAREHOUSE, issuerName: "SANTA FE ARMAZENS", recipient: OWN, recipientName: "VILLA", cfop: "5907", unit: "SC", quantity: "20", info: "REF. NF-e REMESSA 1.344 (PARTE)", number: 77 });
    const returned = await state.post("/v1/manage/invoices/xml/warehouse", { organizationId: "org", xml: returnWithReference });
    expect(returned.json()).toMatchObject({ movementType: "RETURN", pendingReview: 0 });
    expect(state.table("warehouse_movements").get(deterministicUuid("warehouseMovement", accessKey(WAREHOUSE, 77), "1"))).toMatchObject({ referenced_document_number: "1344", quantity_kg_decimal: "1200" });

    const symbolicWithoutReference = nfe(accessKey(WAREHOUSE, 78), { issuer: WAREHOUSE, issuerName: "SANTA FE ARMAZENS", recipient: OWN, recipientName: "VILLA", cfop: "5907", unit: "SC", quantity: "5", number: 78 });
    expect((await state.post("/v1/manage/invoices/xml/warehouse", { organizationId: "org", xml: symbolicWithoutReference })).json().pendingReview).toBe(1);
  });

  it("importa a nota triangulada com compra do fornecedor e venda ao cliente", async () => {
    const state = specialPool();
    const key = accessKey(SUPPLIER, 900);
    const xml = nfe(key, { issuer: SUPPLIER, issuerName: "LEO ES CAFES", recipient: BUYER, recipientName: "PRIMAVERA", cfop: "6102", unit: "SC", quantity: "100", number: 900 });
    expect((await state.post("/v1/manage/invoices/xml/inspect", { organizationId: "org", xml })).json()).toMatchObject({
      kind: "TRIANGULATED", supplier: { id: "supplier" }, clients: [{ id: "broker", name: "Valani" }]
    });
    const imported = await state.post("/v1/manage/invoices/xml/triangulated", {
      organizationId: "org", xml, ownLegalEntityId: "entity", supplierPartnerId: "supplier", clientPartnerId: "broker",
      operationScope: "EXTERNAL", itemProducts: [{ itemNumber: "1", productId: "arabica" }]
    });
    expect(imported.statusCode).toBe(201);
    expect(imported.json()).toMatchObject({ status: "CONFIRMED", operations: 2 });
    expect(state.table("fiscal_documents").get(imported.json().id as string)).toMatchObject({
      direction: "INBOUND", responsible_partner_id: "supplier", secondary_responsible_partner_id: "broker", secondary_operation_type: "SALE",
      partner_legal_entity_id: "supplier-entity", notes: expect.stringContaining("Nota triangulada")
    });
    const operations = [...state.table("operations").values()];
    expect(operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation_type: "PURCHASE", responsible_partner_id: "supplier", applied_rate_value_cents: 700, service_amount_cents: 70_000 }),
      expect.objectContaining({ operation_type: "SALE", responsible_partner_id: "broker", applied_rate_value_cents: 400, service_amount_cents: 40_000 })
    ]));
    expect((await state.post("/v1/manage/invoices/xml/inspect", { organizationId: "org", xml: nfe(accessKey(OWN, 1), { issuer: OWN, issuerName: "VILLA", recipient: BUYER, recipientName: "X", cfop: "5102", unit: "SC", quantity: "1", number: 1 }) })).json().kind).toBe("INVOICE");
  });
});
