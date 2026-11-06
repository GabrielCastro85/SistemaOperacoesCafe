import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { deterministicUuid } from "../../electron/main/services/deterministicId.js";
import {
  centralRecord,
  centralRecords,
  commitDomainChanges,
  requirePermission,
  requireWebSession,
  type DomainChange
} from "./domainMutations.js";
import { acceptedCancellationFor, isAcceptedCancellation, pendingEventChanges, rowsWhere } from "./fiscalEvents.js";
import { canonicalUnit, readInvoiceXml, resolveRate, sacksForItem } from "./operationalManagement.js";
import { isThirdPartyEntity } from "./thirdPartyEntities.js";

// XMLs que nao viram uma nota comum: eventos fiscais, remessas/retornos de
// armazem e notas trianguladas. Cada regra espelha o aplicativo
// (importFiscalEvent, importWarehouseDocumentIfRecognized e o ramo
// triangulado de processXmlImportFile em appRepository.ts).

type Row = Record<string, unknown>;

const text = (value: unknown): string => String(value ?? "").trim();
const digits = (value: unknown): string => String(value ?? "").replace(/\D/g, "");
const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): Row[] => Array.isArray(value) ? value.map(object) : [];
const numberValue = (value: unknown): number => {
  const parsed = Number(String(value ?? "0").trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const active = (row: Row | null | undefined): boolean => Boolean(row) && row!.is_active !== 0 && row!.is_active !== false;
const compactDecimal = (value: number): string => value.toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
const normalizedUnit = (value: unknown): string => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
const isKg = (value: unknown): boolean => ["KG", "KGS", "KILO", "KILOS", "QUILO", "QUILOS"].includes(normalizedUnit(value));
const isSack = (value: unknown): boolean => ["SC", "SCS", "SAC", "SACA", "SACAS", "SACK", "SACKS"].includes(normalizedUnit(value));
const isTon = (value: unknown): boolean => ["T", "TON", "TONS", "TONELADA", "TONELADAS"].includes(normalizedUnit(value));

class HttpError extends Error {
  constructor(readonly statusCode: number, readonly code: string, message: string) { super(message); }
}

async function send(reply: FastifyReply, action: () => Promise<unknown>): Promise<unknown> {
  try {
    return await action();
  } catch (error) {
    const failure = error as { statusCode?: number; code?: string; message?: string };
    if (error instanceof HttpError || failure.statusCode) {
      return reply.code(failure.statusCode ?? 400).send({ error: failure.code ?? "INVALID_XML", message: failure.message });
    }
    throw error;
  }
}

function parse(xml: string): { parsed: ReturnType<typeof readInvoiceXml>; extracted: Row } {
  const parsed = readInvoiceXml(xml);
  return { parsed, extracted: object(parsed.extractedData) };
}

// --- Eventos -------------------------------------------------------------

const EVENT_TYPES: Record<string, string> = { EVENT_CANCELLATION: "CANCELLATION", EVENT_CORRECTION_LETTER: "CORRECTION_LETTER", EVENT_OTHER: "OTHER" };

async function eventContext(pool: pg.Pool, parsed: ReturnType<typeof readInvoiceXml>, extracted: Row) {
  const accessKey = parsed.accessKey;
  if (!accessKey) throw new HttpError(400, "EVENT_WITHOUT_KEY", "Evento fiscal sem chave de acesso.");
  const eventType = EVENT_TYPES[parsed.xmlType] ?? "OTHER";
  const event: Row = {
    event_type: eventType, sequence_number: text(extracted.sequenceNumber) || "1", event_date: text(extracted.eventDate) || null,
    protocol_number: text(extracted.protocolNumber) || null, status_code: text(extracted.statusCode) || null,
    status_message: text(extracted.statusMessage) || null, correction_text: text(extracted.correctionText) || null
  };
  const [documents, existingEvents, movements] = await Promise.all([
    rowsWhere(pool, "fiscal_documents", "access_key", [accessKey]),
    rowsWhere(pool, "fiscal_document_events", "access_key", [accessKey]),
    rowsWhere(pool, "warehouse_movements", "access_key", [accessKey])
  ]);
  const duplicate = existingEvents.some((row) => text(row.event_type) === eventType && text(row.sequence_number) === text(event.sequence_number)
    && text(row.protocol_number) === text(event.protocol_number));
  return { accessKey, event, document: documents[0] ?? null, movements, duplicate, accepted: isAcceptedCancellation(event) };
}

// --- Armazem -------------------------------------------------------------

const WAREHOUSE_CFOPS: Record<string, { type: "DEPOSIT" | "RETURN"; kind: "PHYSICAL" | "SYMBOLIC" }> = {
  "5905": { type: "DEPOSIT", kind: "PHYSICAL" }, "6905": { type: "DEPOSIT", kind: "PHYSICAL" },
  "5934": { type: "DEPOSIT", kind: "SYMBOLIC" }, "6934": { type: "DEPOSIT", kind: "SYMBOLIC" },
  "5906": { type: "RETURN", kind: "PHYSICAL" }, "6906": { type: "RETURN", kind: "PHYSICAL" },
  "5907": { type: "RETURN", kind: "SYMBOLIC" }, "6907": { type: "RETURN", kind: "SYMBOLIC" }
};

function warehouseFamily(description: string): "ARABICA" | "CONILON" | null {
  const value = description.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (/\bARABICA\b/.test(value)) return "ARABICA";
  if (/\b(?:CONILON|ROBUSTA)\b/.test(value)) return "CONILON";
  return null;
}

function itemKg(item: Row): { kg: number; unit: string; quantity: string } {
  const commercialUnit = text(item.commercialUnit);
  const taxableUnit = text(item.taxableUnit);
  const commercialQuantity = text(item.commercialQuantity) || "0";
  const taxableQuantity = text(item.taxableQuantity) || "0";
  if (isKg(taxableUnit) && numberValue(taxableQuantity) > 0) return { kg: numberValue(taxableQuantity), unit: taxableUnit, quantity: taxableQuantity };
  if (isKg(commercialUnit)) return { kg: numberValue(commercialQuantity), unit: commercialUnit, quantity: commercialQuantity };
  if (isSack(commercialUnit)) return { kg: numberValue(commercialQuantity) * 60, unit: commercialUnit, quantity: commercialQuantity };
  if (isTon(commercialUnit)) return { kg: numberValue(commercialQuantity) * 1000, unit: commercialUnit, quantity: commercialQuantity };
  return { kg: 0, unit: taxableUnit || commercialUnit, quantity: taxableQuantity || commercialQuantity };
}

async function warehousePlan(pool: pg.Pool, accessKey: string, extracted: Row, userId: string | null) {
  const classified = list(extracted.items).flatMap((item) => {
    const cfop = digits(item.cfop);
    return WAREHOUSE_CFOPS[cfop] ? [{ item, cfop, classification: WAREHOUSE_CFOPS[cfop] }] : [];
  });
  if (!classified.length) return null;
  const issuer = object(extracted.issuer);
  const recipient = object(extracted.recipient);
  const issuerCnpj = digits(issuer.cnpjCpf) || accessKey.slice(6, 20);
  const recipientCnpj = digits(recipient.cnpjCpf);
  const ownEntities = (await centralRecords(pool, "legal_entities")).filter((row) => !isThirdPartyEntity(row) && active(row));
  const type = classified[0].classification.type;
  const ownEntity = ownEntities.find((row) => digits(row.cnpj) === (type === "DEPOSIT" ? issuerCnpj : recipientCnpj));
  if (!ownEntity) {
    throw new HttpError(409, "WAREHOUSE_WITHOUT_OWN_ENTITY", type === "DEPOSIT"
      ? "Remessa para armazem sem empresa propria como emitente. Confira o XML."
      : "Retorno de armazem sem empresa propria como destinataria. Confira o XML.");
  }
  if (classified.some(({ classification }) => classification.type !== type)) {
    throw new HttpError(409, "WAREHOUSE_MIXED", "NF-e de armazem contem remessa e retorno no mesmo documento. Revise o XML manualmente.");
  }
  const warehouseParty = type === "DEPOSIT" ? recipient : issuer;
  const warehouseName = text(warehouseParty.legalName) || text(warehouseParty.tradeName) || "Armazem nao identificado";
  const warehouseCnpj = digits(warehouseParty.cnpjCpf) || null;
  // Usa o nome do armazem e do produto ja cadastrados manualmente, para o saldo
  // somar no mesmo armazem/produto.
  const manualReferences = warehouseCnpj
    ? (await rowsWhere(pool, "warehouse_movements", "warehouse_cnpj", [warehouseCnpj]))
      .filter((row) => row.organization_id === ownEntity.organization_id && row.own_legal_entity_id === ownEntity.id
        && text(row.origin) === "MANUAL" && text(row.status) === "ACTIVE")
      .sort((left, right) => text(right.created_at).localeCompare(text(left.created_at)))
    : [];
  const canonicalWarehouseName = text(manualReferences[0]?.warehouse_name) || warehouseName;
  const manualProducts = new Map<string, string>();
  for (const reference of manualReferences) {
    const description = text(reference.product_description);
    const family = warehouseFamily(description);
    manualProducts.set(family ?? `TEXT:${description.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()}`, description);
  }
  const referenceText = [text(object(extracted.additionalInfo).complementary), ...classified.map(({ item }) => text(item.additionalInfo))]
    .filter(Boolean).join(" | ") || null;
  const referencedKeys = (Array.isArray(extracted.referencedAccessKeys) ? extracted.referencedAccessKeys : []).map(String).filter((key) => /^\d{44}$/.test(key));
  const byKey = referencedKeys[0]?.slice(25, 34).replace(/^0+/, "") || null;
  const byText = referenceText?.match(
    /\b(?:REF(?:ERENTE)?\.?\s*)?(?:NF-?E|NF)(?:\s+(?:DE\s+)?(?:REMESSA|ORIGEM))?\s*(?:N[º°.]?\s*)?[:#º°.\-\s]*(\d(?:[\d.]*\d)?)/i
  )?.[1]?.replace(/\D/g, "") || null;
  const referencedDocumentNumber = byKey ?? byText;
  const canceled = Boolean(await acceptedCancellationFor(pool, accessKey));
  const now = new Date().toISOString();
  const movements = classified.map(({ item, cfop, classification }) => {
    const description = text(item.description) || "Cafe";
    const family = warehouseFamily(description);
    const productDescription = family
      ? manualProducts.get(family) ?? description
      : manualProducts.size === 1 ? [...manualProducts.values()][0] : description;
    const quantity = itemKg(item);
    if (!(quantity.kg > 0)) {
      throw new HttpError(409, "WAREHOUSE_UNIT", `Quantidade da nota ${text(extracted.number)} item ${text(item.itemNumber)} nao pode ser convertida para kg.`);
    }
    const needsReference = classification.kind === "SYMBOLIC" && !referencedDocumentNumber;
    const itemNumber = text(item.itemNumber) || "1";
    return {
      id: deterministicUuid("warehouseMovement", accessKey, itemNumber), organization_id: ownEntity.organization_id, own_legal_entity_id: ownEntity.id,
      access_key: accessKey, item_number: itemNumber, document_number: text(extracted.number), series: text(extracted.series) || null,
      issue_date: text(extracted.issuedAt) || now.slice(0, 10), warehouse_name: canonicalWarehouseName, warehouse_cnpj: warehouseCnpj,
      product_description: productDescription, cfop, movement_type: classification.type, movement_kind: classification.kind,
      quantity_kg_decimal: compactDecimal(quantity.kg), source_unit: quantity.unit || "NAO_INFORMADA", source_quantity_decimal: quantity.quantity,
      referenced_document_number: referencedDocumentNumber, reference_text: referenceText,
      status: canceled ? "CANCELED" : needsReference ? "PENDING_REVIEW" : "ACTIVE",
      notes: needsReference ? "Referencia da remessa original nao identificada automaticamente; conferir manualmente." : null,
      origin: "XML", created_by_user_id: userId, created_at: now, updated_at: now
    } satisfies Row;
  });
  return { ownEntity, type, warehouseName: canonicalWarehouseName, warehouseCnpj, referencedDocumentNumber, canceled, movements };
}

// --- Triangulacao --------------------------------------------------------

// Como linkedPartnersByCnpj: dono da empresa e vinculos em partner_company_links.
async function linkedPartnersByCnpj(pool: pg.Pool, cnpj: string): Promise<Array<{ partner: Row; roles: string[]; entity: Row }>> {
  if (cnpj.length !== 14) return [];
  const entity = (await centralRecords(pool, "partner_legal_entities")).find((row) => digits(row.cnpj) === cnpj && active(row));
  if (!entity) return [];
  const links = await rowsWhere(pool, "partner_company_links", "partner_legal_entity_id", [text(entity.id)]);
  const ids = [...new Set([text(entity.business_partner_id), ...links.map((row) => text(row.business_partner_id))].filter(Boolean))];
  const [partners, roles] = await Promise.all([rowsWhere(pool, "business_partners", "id", ids), rowsWhere(pool, "business_partner_roles", "business_partner_id", ids)]);
  return partners.filter(active).map((partner) => ({
    partner, entity, roles: roles.filter((row) => row.business_partner_id === partner.id).map((row) => text(row.role))
  }));
}

async function triangulationContext(pool: pg.Pool, extracted: Row, accessKey: string | null) {
  const issuerCnpj = digits(object(extracted.issuer).cnpjCpf) || (accessKey ? accessKey.slice(6, 20) : "");
  const recipientCnpj = digits(object(extracted.recipient).cnpjCpf);
  const ownCnpjs = new Set((await centralRecords(pool, "legal_entities")).filter((row) => !isThirdPartyEntity(row)).map((row) => digits(row.cnpj)).filter(Boolean));
  if (ownCnpjs.has(issuerCnpj) || ownCnpjs.has(recipientCnpj)) return null;
  const suppliers = (await linkedPartnersByCnpj(pool, issuerCnpj)).filter((item) => item.roles.includes("SUPPLIER"));
  if (suppliers.length !== 1) return null;
  const clients = (await linkedPartnersByCnpj(pool, recipientCnpj)).filter((item) => item.roles.includes("CLIENT") && item.partner.id !== suppliers[0].partner.id);
  return { supplier: suppliers[0], clients, issuerEntity: suppliers[0].entity };
}

async function primaryEntityOf(pool: pg.Pool, partnerId: string): Promise<Row | null> {
  const own = (await rowsWhere(pool, "partner_legal_entities", "business_partner_id", [partnerId])).filter(active);
  const links = await rowsWhere(pool, "partner_company_links", "business_partner_id", [partnerId]);
  const linked = (await rowsWhere(pool, "partner_legal_entities", "id", links.map((row) => text(row.partner_legal_entity_id)))).filter(active);
  return own.find((row) => row.is_primary === 1 || row.is_primary === true) ?? own[0] ?? linked[0] ?? null;
}

const TRIANGULATED_NOTE = "Nota triangulada: gera compra e venda a partir da mesma remessa.";

const xmlSchema = z.object({ organizationId: z.string().min(1), xml: z.string().min(1).max(10 * 1024 * 1024) });
const triangulatedSchema = xmlSchema.extend({
  ownLegalEntityId: z.string().min(1),
  supplierPartnerId: z.string().min(1),
  clientPartnerId: z.string().min(1).nullable().optional(),
  operationScope: z.enum(["INTERNAL", "EXTERNAL"]),
  hasFinancialService: z.boolean().default(false),
  itemProducts: z.array(z.object({ itemNumber: z.string().min(1), productId: z.string().min(1) })).min(1),
  confirmOperations: z.boolean().default(true)
});

export function registerSpecialXmlRoutes(app: FastifyInstance, pool: pg.Pool): void {
  // Diz que tipo de XML e' antes de a tela escolher o fluxo.
  app.post("/v1/manage/invoices/xml/inspect", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = xmlSchema.parse(request.body);
    return send(reply, async () => {
      if (!(await requirePermission(pool, session, reply, "imports.manage", input.organizationId, null))) return;
      const { parsed, extracted } = parse(input.xml);
      if (parsed.xmlType.startsWith("EVENT_")) {
        const context = await eventContext(pool, parsed, extracted);
        const billed = context.document
          ? (await rowsWhere(pool, "operations", "fiscal_document_id", [text(context.document.id)])).some((row) => text(row.billing_status) !== "UNBILLED")
          : false;
        return {
          kind: "EVENT", accessKey: context.accessKey, eventType: context.event.event_type, sequenceNumber: context.event.sequence_number,
          eventDate: context.event.event_date, protocolNumber: context.event.protocol_number, statusCode: context.event.status_code,
          statusMessage: context.event.status_message, correctionText: context.event.correction_text, acceptedCancellation: context.accepted,
          duplicate: context.duplicate, warehouseMovements: context.movements.length, billed,
          document: context.document ? { id: text(context.document.id), number: text(context.document.document_number), status: text(context.document.status) } : null
        };
      }
      if (!["NFE", "NFE_PROC"].includes(parsed.xmlType) || !parsed.accessKey) {
        throw new HttpError(400, "UNSUPPORTED_XML", "Selecione o XML autorizado de uma NF-e ou de um evento fiscal.");
      }
      const plan = await warehousePlan(pool, parsed.accessKey, extracted, session.userId);
      if (plan) {
        const existing = await rowsWhere(pool, "warehouse_movements", "access_key", [parsed.accessKey]);
        return {
          kind: "WAREHOUSE", accessKey: parsed.accessKey, number: text(extracted.number), issueDate: text(extracted.issuedAt),
          ownLegalEntityName: text(plan.ownEntity.trade_name) || text(plan.ownEntity.legal_name), movementType: plan.type,
          warehouseName: plan.warehouseName, warehouseCnpj: plan.warehouseCnpj, referencedDocumentNumber: plan.referencedDocumentNumber,
          canceled: plan.canceled, duplicate: existing.length > 0,
          items: plan.movements.map((row) => ({ itemNumber: row.item_number, description: row.product_description, cfop: row.cfop, kind: row.movement_kind, quantityKg: row.quantity_kg_decimal, status: row.status }))
        };
      }
      const triangulation = await triangulationContext(pool, extracted, parsed.accessKey);
      if (triangulation) {
        return {
          kind: "TRIANGULATED", accessKey: parsed.accessKey, number: text(extracted.number), series: text(extracted.series), issueDate: text(extracted.issuedAt),
          nature: text(extracted.nature), issuer: object(extracted.issuer), recipient: object(extracted.recipient), items: list(extracted.items),
          supplier: { id: text(triangulation.supplier.partner.id), name: text(triangulation.supplier.partner.display_name) },
          clients: triangulation.clients.map((item) => ({ id: text(item.partner.id), name: text(item.partner.display_name) }))
        };
      }
      return { kind: "INVOICE" };
    });
  });

  app.post("/v1/manage/invoices/xml/event", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = xmlSchema.parse(request.body);
    return send(reply, async () => {
      const { parsed, extracted } = parse(input.xml);
      if (!parsed.xmlType.startsWith("EVENT_")) throw new HttpError(400, "NOT_EVENT", "Este XML nao e um evento fiscal.");
      const context = await eventContext(pool, parsed, extracted);
      const ownEntity = context.document ? await centralRecord(pool, "legal_entities", text(context.document.own_legal_entity_id)) : null;
      const legalEntityId = ownEntity && !isThirdPartyEntity(ownEntity) ? text(ownEntity.id) : null;
      if (!(await requirePermission(pool, session, reply, "imports.manage", input.organizationId, legalEntityId))) return;
      if (context.duplicate) throw new HttpError(409, "DUPLICATE_EVENT", "Este evento ja foi registrado.");
      const now = new Date().toISOString();
      const eventId = randomUUID();
      const changes: DomainChange[] = [{
        table: "fiscal_document_events", key: eventId, operation: "UPSERT", data: {
          id: eventId, organization_id: input.organizationId, fiscal_document_id: context.document?.id ?? null, access_key: context.accessKey,
          ...context.event, xml_file_path: null, file_hash: createHash("sha256").update(input.xml).digest("hex"), created_at: now
        }
      }];
      let canceledDocument = false;
      if (context.accepted) {
        const reason = `Cancelamento XML protocolo ${text(context.event.protocol_number)}`;
        // Como o aplicativo: o cancelamento da SEFAZ vale mesmo para nota ja cobrada.
        if (context.document && text(context.document.status) !== "CANCELED") {
          canceledDocument = true;
          changes.push({ table: "fiscal_documents", key: text(context.document.id), operation: "UPSERT", data: { ...context.document, status: "CANCELED", canceled_at: now, cancel_reason: reason, updated_at: now } });
          for (const operation of await rowsWhere(pool, "operations", "fiscal_document_id", [text(context.document.id)])) {
            changes.push({ table: "operations", key: text(operation.id), operation: "UPSERT", data: { ...operation, status: "CANCELED", updated_at: now } });
          }
        }
        for (const movement of context.movements) {
          changes.push({
            table: "warehouse_movements", key: text(movement.id), operation: "UPSERT", data: {
              ...movement, status: "CANCELED", notes: [text(movement.notes), reason].filter(Boolean).join(" "), updated_at: now
            }
          });
        }
      }
      const revision = await commitDomainChanges(pool, session, "WEB_XML_EVENT_IMPORTED", "fiscal_document_event", eventId, changes, {
        organizationId: input.organizationId, accessKey: context.accessKey, eventType: context.event.event_type, canceledDocument,
        canceledMovements: context.accepted ? context.movements.length : 0
      });
      return reply.code(201).send({ id: eventId, revision, canceledDocument, canceledMovements: context.accepted ? context.movements.length : 0 });
    });
  });

  app.post("/v1/manage/invoices/xml/warehouse", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = xmlSchema.parse(request.body);
    return send(reply, async () => {
      const { parsed, extracted } = parse(input.xml);
      if (!["NFE", "NFE_PROC"].includes(parsed.xmlType) || !parsed.accessKey) throw new HttpError(400, "UNSUPPORTED_XML", "Selecione o XML autorizado da NF-e de armazem.");
      const plan = await warehousePlan(pool, parsed.accessKey, extracted, session.userId);
      if (!plan) throw new HttpError(400, "NOT_WAREHOUSE", "Esta NF-e nao tem CFOP de remessa ou retorno de armazem.");
      if (!(await requirePermission(pool, session, reply, "imports.manage", text(plan.ownEntity.organization_id), text(plan.ownEntity.id)))) return;
      if ((await rowsWhere(pool, "warehouse_movements", "access_key", [parsed.accessKey])).length) {
        throw new HttpError(409, "DUPLICATE_ACCESS_KEY", "Esta nota de armazem ja foi importada.");
      }
      const revision = await commitDomainChanges(pool, session, "WEB_XML_WAREHOUSE_IMPORTED", "warehouse_movement", text(plan.movements[0].id),
        plan.movements.map((row) => ({ table: "warehouse_movements", key: text(row.id), operation: "UPSERT" as const, data: row })), {
          organizationId: text(plan.ownEntity.organization_id), legalEntityId: text(plan.ownEntity.id), accessKey: parsed.accessKey, movements: plan.movements.length
        });
      return reply.code(201).send({
        revision, movementType: plan.type, movements: plan.movements.length,
        pendingReview: plan.movements.filter((row) => row.status === "PENDING_REVIEW").length, canceled: plan.canceled
      });
    });
  });

  app.post("/v1/manage/invoices/xml/triangulated", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = triangulatedSchema.parse(request.body);
    return send(reply, async () => {
      const { parsed, extracted } = parse(input.xml);
      if (!["NFE", "NFE_PROC"].includes(parsed.xmlType) || !parsed.accessKey) throw new HttpError(400, "UNSUPPORTED_XML", "O arquivo precisa ser uma NF-e com chave de acesso valida.");
      const ownEntity = await centralRecord(pool, "legal_entities", input.ownLegalEntityId);
      if (!ownEntity || !active(ownEntity) || isThirdPartyEntity(ownEntity) || ownEntity.organization_id !== input.organizationId) {
        throw new HttpError(404, "OWN_ENTITY_NOT_FOUND", "Empresa propria nao encontrada nesta organizacao.");
      }
      if (!(await requirePermission(pool, session, reply, "imports.manage", input.organizationId, input.ownLegalEntityId))) return;
      const context = await triangulationContext(pool, extracted, parsed.accessKey);
      if (!context || text(context.supplier.partner.id) !== input.supplierPartnerId) {
        throw new HttpError(409, "NOT_TRIANGULATED", "O emitente desta nota nao corresponde ao fornecedor informado.");
      }
      if (input.clientPartnerId && !context.clients.some((item) => item.partner.id === input.clientPartnerId)) {
        const roles = (await rowsWhere(pool, "business_partner_roles", "business_partner_id", [input.clientPartnerId])).map((row) => text(row.role));
        if (!roles.includes("CLIENT")) throw new HttpError(409, "PARTNER_ROLE", "O cliente da revenda precisa ter o papel Cliente/corretor.");
      }
      if ((await rowsWhere(pool, "fiscal_documents", "access_key", [parsed.accessKey])).length) {
        throw new HttpError(409, "DUPLICATE_ACCESS_KEY", "Esta NF-e ja esta cadastrada no sistema.");
      }
      const items = list(extracted.items);
      const productByItem = new Map(input.itemProducts.map((row) => [row.itemNumber, row.productId]));
      if (items.some((item) => !productByItem.has(text(item.itemNumber)))) throw new HttpError(400, "PRODUCT_REQUIRED", "Selecione o produto de todos os itens da nota.");
      const products = await rowsWhere(pool, "products", "id", [...new Set(productByItem.values())]);
      const productMap = new Map(products.filter(active).map((row) => [text(row.id), row]));
      if ([...productByItem.values()].some((id) => !productMap.has(id))) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Um dos produtos selecionados nao foi encontrado.");
      const [purchaseRules, serviceRules, supplier, client] = await Promise.all([
        centralRecords(pool, "purchase_rate_rules"), centralRecords(pool, "service_rate_rules"),
        centralRecord(pool, "business_partners", input.supplierPartnerId),
        input.clientPartnerId ? centralRecord(pool, "business_partners", input.clientPartnerId) : Promise.resolve(null)
      ]);
      const clientEntity = input.clientPartnerId ? await primaryEntityOf(pool, input.clientPartnerId) : null;
      const issueDate = text(extracted.issuedAt);
      const documentId = randomUUID();
      const now = new Date().toISOString();
      const pending: string[] = [];
      const changes: DomainChange[] = [];
      const operationRows: Row[] = [];
      const operation = (itemId: string, productId: string, sacks: number, kind: "PURCHASE" | "SALE", partnerId: string, counterpartyId: string | null, notes: string): Row => {
        const resolved = resolveRate(kind === "PURCHASE" ? purchaseRules : serviceRules, kind, input.organizationId, partnerId, input.ownLegalEntityId,
          counterpartyId, productId, input.operationScope, issueDate, kind === "SALE" && input.hasFinancialService);
        if (resolved.status === "missing") pending.push(`Sem tarifa de ${kind === "PURCHASE" ? "compra" : "venda"} para um item`);
        if (resolved.status === "conflict") pending.push(`Tarifas conflitantes de ${kind === "PURCHASE" ? "compra" : "venda"} para um item`);
        const quantity = compactDecimal(sacks);
        return {
          id: randomUUID(), fiscal_document_id: documentId, fiscal_document_item_id: itemId, organization_id: input.organizationId,
          own_legal_entity_id: input.ownLegalEntityId, responsible_partner_id: partnerId, product_id: productId, operation_type: kind,
          operation_scope: input.operationScope, operation_date: issueDate, quantity_sacks_decimal: quantity, gross_quantity_sacks_decimal: quantity,
          service_rate_rule_id: kind === "SALE" ? resolved.rule?.id ?? null : null, purchase_rate_rule_id: kind === "PURCHASE" ? resolved.rule?.id ?? null : null,
          applied_rate_value_cents: resolved.rateCents, service_amount_cents: Math.round(sacks * resolved.rateCents),
          rate_was_manually_overridden: 0, manual_rate_value_cents: null, manual_override_reason: null, notes, status: "DRAFT", source: "XML",
          import_job_id: null, import_row_id: null, xml_import_job_id: null, classification_rule_id: null, billing_status: "UNBILLED", client_charge_id: null,
          purchase_settlement_status: "UNSETTLED", account_payable_id: null, created_at: now, updated_at: now
        };
      };
      for (const item of items) {
        const itemNumber = text(item.itemNumber);
        const productId = productByItem.get(itemNumber)!;
        const product = productMap.get(productId)!;
        const sacks = sacksForItem(item, product);
        if (sacks <= 0) pending.push(`Conferir unidade do item ${itemNumber}`);
        const itemId = randomUUID();
        changes.push({
          table: "fiscal_document_items", key: itemId, operation: "UPSERT", data: {
            id: itemId, fiscal_document_id: documentId, product_id: productId, description: text(item.description) || text(product.name),
            quantity_decimal: compactDecimal(numberValue(item.commercialQuantity)), unit: canonicalUnit(item.commercialUnit),
            unit_price_decimal: compactDecimal(numberValue(item.commercialUnitValue)), total_amount_cents: Math.round(numberValue(item.totalAmountCents)),
            sacks_quantity_decimal: compactDecimal(sacks), created_at: now, updated_at: now
          }
        });
        operationRows.push(operation(itemId, productId, sacks, "PURCHASE", input.supplierPartnerId, text(context.issuerEntity.id), "Operacao criada a partir de XML"));
        if (input.clientPartnerId) {
          operationRows.push(operation(itemId, productId, sacks, "SALE", input.clientPartnerId, clientEntity ? text(clientEntity.id) : null, "Segunda perna (nota triangulada) criada a partir de XML"));
        }
      }
      const contractNumber = text(extracted.contractNumber) || null;
      const requiresContract = [supplier, client].some((partner) => partner && (partner.requires_contract === 1 || partner.requires_contract === true));
      if (requiresContract && !contractNumber) pending.push("Contrato exigido pelo cliente");
      const isPending = pending.length > 0;
      const confirmed = input.confirmOperations && !isPending;
      for (const row of operationRows) row.status = confirmed ? "CONFIRMED" : isPending ? "PENDING" : "DRAFT";
      const protocol = object(extracted.protocol);
      const documentRow: Row = {
        id: documentId, organization_id: input.organizationId, own_legal_entity_id: input.ownLegalEntityId,
        responsible_partner_id: input.supplierPartnerId, partner_legal_entity_id: context.issuerEntity.id,
        secondary_responsible_partner_id: input.clientPartnerId ?? null, secondary_operation_type: input.clientPartnerId ? "SALE" : null,
        document_type: "MANUAL_INVOICE", access_key: parsed.accessKey, document_number: text(extracted.number), series: text(extracted.series) || null,
        issue_date: issueDate, total_amount_cents: Math.round(numberValue(object(extracted.totals).invoiceAmountCents)),
        status: confirmed ? "CONFIRMED" : isPending ? "PENDING" : "DRAFT", has_pending_issues: isPending ? 1 : 0,
        pending_notes: isPending ? [...new Set(pending)].join("; ") : null, duplicate_warning: null,
        notes: [text(extracted.nature), input.clientPartnerId ? TRIANGULATED_NOTE : ""].filter(Boolean).join(" | ") || null,
        confirmed_at: confirmed ? now : null, canceled_at: null, cancel_reason: null, source: "XML", import_job_id: null, import_row_id: null,
        xml_file_path: null, xml_file_hash: createHash("sha256").update(input.xml).digest("hex"), protocol_number: text(protocol.number) || null,
        protocol_date: text(protocol.receivedAt) || null, authorization_status_code: text(protocol.statusCode) || null,
        authorization_status_message: text(protocol.statusMessage) || null, xml_import_job_id: null, merged_from_source: null, merged_at: null,
        direction: "INBOUND", fiscal_snapshot_json: JSON.stringify(extracted), contract_number: contractNumber, billing_observations: null,
        freight_dae_reference: null, freight_dae_amount_cents: 0, has_financial_service: input.clientPartnerId && input.hasFinancialService ? 1 : 0,
        created_at: now, updated_at: now
      };
      const eventChanges = await pendingEventChanges(pool, parsed.accessKey, documentRow, operationRows, now);
      const allChanges: DomainChange[] = [
        { table: "fiscal_documents", key: documentId, operation: "UPSERT", data: documentRow },
        ...changes,
        ...operationRows.map((row) => ({ table: "operations", key: text(row.id), operation: "UPSERT" as const, data: row })),
        ...eventChanges
      ];
      const revision = await commitDomainChanges(pool, session, "WEB_XML_TRIANGULATED_IMPORTED", "fiscal_document", documentId, allChanges, {
        organizationId: input.organizationId, legalEntityId: input.ownLegalEntityId, accessKey: parsed.accessKey, operations: operationRows.length
      });
      return reply.code(201).send({ id: documentId, revision, status: documentRow.status, pendingNotes: documentRow.pending_notes, operations: operationRows.length });
    });
  });
}
