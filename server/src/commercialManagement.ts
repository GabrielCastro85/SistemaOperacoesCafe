import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { z } from "zod";
import {
  centralRecord,
  centralRecords,
  commitDomainChanges,
  requirePermission,
  requireWebSession,
  type DomainChange,
  type WebSession
} from "./domainMutations.js";

const roleSchema = z.enum(["CLIENT", "SUPPLIER", "SELLER", "BUYER", "DESTINATION", "CARRIER", "SERVICE_PROVIDER", "OTHER"]);
const scopeSchema = z.object({ organizationId: z.string().min(1), legalEntityId: z.string().min(1).nullable().optional() });
const entitySchema = z.object({
  id: z.string().uuid().optional(),
  legalName: z.string().trim().min(1).max(240), tradeName: z.string().trim().max(240).optional().default(""),
  cnpj: z.string().optional().default(""), stateRegistration: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().email().or(z.literal("")).optional().default(""), phone: z.string().trim().max(40).optional().default(""),
  addressLine: z.string().trim().max(240).optional().default(""), addressNumber: z.string().trim().max(40).optional().default(""),
  addressComplement: z.string().trim().max(120).optional().default(""), district: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().max(120).optional().default(""), state: z.string().trim().max(2).optional().default(""),
  postalCode: z.string().trim().max(20).optional().default("")
});
const partnerSchema = scopeSchema.extend({
  displayName: z.string().trim().min(1).max(240), notes: z.string().trim().max(2000).optional().default(""),
  isActive: z.boolean().default(true), roles: z.array(roleSchema).min(1), entity: entitySchema.optional()
});
const productSchema = scopeSchema.extend({
  name: z.string().trim().min(1).max(200), code: z.string().trim().max(80).optional().default(""),
  category: z.enum(["COFFEE_ARABICA", "COFFEE_CONILON", "COFFEE_OTHER", "OTHER"]),
  defaultUnit: z.enum(["SACK", "KG", "TON", "UNIT"]), defaultSackWeightKg: z.number().positive().nullable().optional(),
  description: z.string().trim().max(2000).optional().default(""), isActive: z.boolean().default(true),
  aliases: z.array(z.string().trim().min(1).max(240)).max(50).optional().default([])
});
const rateRuleSchema = scopeSchema.extend({
  kind: z.enum(["SERVICE", "PURCHASE"]), businessPartnerId: z.string().min(1), productId: z.string().min(1).nullable().optional(),
  operationScope: z.enum(["INTERNAL", "EXTERNAL", "ALL"]).default("ALL"), rateValueCents: z.number().int().min(0),
  financialRateValueCents: z.number().int().min(0).nullable().optional(), effectiveFrom: z.string().date(),
  effectiveTo: z.string().date().nullable().optional(), priority: z.number().int().min(0).max(999).default(0),
  notes: z.string().trim().max(2000).optional().default(""), isActive: z.boolean().default(true)
});

const clean = (value: string): string | null => value.trim() || null;
const digits = (value: string): string => value.replace(/\D/g, "");
const normalized = (value: string): string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim().replace(/\s+/g, " ");

async function authorize(pool: pg.Pool, session: WebSession, reply: FastifyReply, organizationId: string, legalEntityId?: string | null): Promise<boolean> {
  return requirePermission(pool, session, reply, "commercial.manage", organizationId, legalEntityId);
}

async function partnerChanges(pool: pg.Pool, partnerId: string, input: z.infer<typeof partnerSchema>, existing?: Record<string, unknown> | null): Promise<DomainChange[]> {
  const now = new Date().toISOString();
  const changes: DomainChange[] = [{
    table: "business_partners", key: partnerId, operation: "UPSERT", data: {
      ...(existing ?? {}), id: partnerId, organization_id: input.organizationId, display_name: input.displayName,
      notes: clean(input.notes), is_active: input.isActive ? 1 : 0, created_at: existing?.created_at ?? now, updated_at: now
    }
  }];
  const oldRoles = (await centralRecords(pool, "business_partner_roles")).filter((row) => row.business_partner_id === partnerId);
  const wanted = new Set(input.roles);
  for (const row of oldRoles) {
    if (!wanted.has(row.role as z.infer<typeof roleSchema>)) changes.push({ table: "business_partner_roles", key: String(row.id), operation: "DELETE" });
  }
  for (const role of input.roles) {
    const current = oldRoles.find((row) => row.role === role);
    const id = String(current?.id ?? randomUUID());
    changes.push({ table: "business_partner_roles", key: id, operation: "UPSERT", data: { ...(current ?? {}), id, business_partner_id: partnerId, role, created_at: current?.created_at ?? now } });
  }
  if (input.entity) {
    const cnpj = digits(input.entity.cnpj);
    if (cnpj && cnpj.length !== 14) throw Object.assign(new Error("CNPJ deve ter 14 digitos."), { statusCode: 400 });
    const entityId = input.entity.id ?? randomUUID();
    const current = input.entity.id ? await centralRecord(pool, "partner_legal_entities", input.entity.id) : null;
    changes.push({
      table: "partner_legal_entities", key: entityId, operation: "UPSERT", data: {
        ...(current ?? {}), id: entityId, business_partner_id: partnerId, legal_name: input.entity.legalName,
        trade_name: clean(input.entity.tradeName) ?? input.entity.legalName, cnpj: cnpj || null,
        state_registration: clean(input.entity.stateRegistration), email: clean(input.entity.email), phone: clean(input.entity.phone),
        address_line: clean(input.entity.addressLine), address_number: clean(input.entity.addressNumber),
        address_complement: clean(input.entity.addressComplement), district: clean(input.entity.district), city: clean(input.entity.city),
        state: clean(input.entity.state)?.toUpperCase() ?? null, postal_code: clean(input.entity.postalCode),
        is_primary: current?.is_primary ?? 1, is_active: input.isActive ? 1 : 0, is_draft: 0,
        created_at: current?.created_at ?? now, updated_at: now
      }
    });
  }
  return changes;
}

export function registerCommercialManagementRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.post("/v1/manage/partners", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = partnerSchema.parse(request.body);
    if (!(await authorize(pool, session, reply, input.organizationId, input.legalEntityId))) return;
    if (input.entity?.cnpj) {
      const cnpj = digits(input.entity.cnpj);
      const duplicate = (await centralRecords(pool, "partner_legal_entities")).find((row) => digits(String(row.cnpj ?? "")) === cnpj);
      if (duplicate) return reply.code(409).send({ error: "DUPLICATE_CNPJ", message: "Este CNPJ ja esta cadastrado." });
    }
    const id = randomUUID();
    const revision = await commitDomainChanges(pool, session, "WEB_PARTNER_CREATED", "business_partner", id, await partnerChanges(pool, id, input), { organizationId: input.organizationId });
    return reply.code(201).send({ id, revision });
  });

  app.put("/v1/manage/partners/:id", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = partnerSchema.parse(request.body);
    if (!(await authorize(pool, session, reply, input.organizationId, input.legalEntityId))) return;
    const existing = await centralRecord(pool, "business_partners", id);
    if (!existing || existing.organization_id !== input.organizationId) return reply.code(404).send({ error: "NOT_FOUND", message: "Cadastro nao encontrado." });
    if (input.entity?.cnpj) {
      const cnpj = digits(input.entity.cnpj);
      const duplicate = (await centralRecords(pool, "partner_legal_entities")).find((row) => String(row.id) !== input.entity?.id && digits(String(row.cnpj ?? "")) === cnpj);
      if (duplicate) return reply.code(409).send({ error: "DUPLICATE_CNPJ", message: "Este CNPJ pertence a outro cadastro." });
    }
    const revision = await commitDomainChanges(pool, session, "WEB_PARTNER_UPDATED", "business_partner", id, await partnerChanges(pool, id, input, existing), { organizationId: input.organizationId });
    return { id, revision };
  });

  app.post("/v1/manage/products", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = productSchema.parse(request.body);
    if (!(await authorize(pool, session, reply, input.organizationId, input.legalEntityId))) return;
    const id = randomUUID(); const now = new Date().toISOString();
    const changes: DomainChange[] = [{ table: "products", key: id, operation: "UPSERT", data: {
      id, organization_id: input.organizationId, name: input.name, code: clean(input.code), category: input.category,
      default_unit: input.defaultUnit, default_sack_weight_kg: input.defaultSackWeightKg ?? null,
      description: clean(input.description), is_active: input.isActive ? 1 : 0, created_at: now, updated_at: now
    }}];
    input.aliases.forEach((alias) => { const aliasId = randomUUID(); changes.push({ table: "product_aliases", key: aliasId, operation: "UPSERT", data: {
      id: aliasId, organization_id: input.organizationId, product_id: id, issuer_partner_legal_entity_id: null,
      source_product_code: null, source_description: alias, normalized_description: normalized(alias), ncm: null,
      is_active: 1, created_at: now, updated_at: now
    }}); });
    const revision = await commitDomainChanges(pool, session, "WEB_PRODUCT_CREATED", "product", id, changes, { organizationId: input.organizationId });
    return reply.code(201).send({ id, revision });
  });

  app.put("/v1/manage/products/:id", async (request, reply) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const input = productSchema.parse(request.body);
    if (!(await authorize(pool, session, reply, input.organizationId, input.legalEntityId))) return;
    const existing = await centralRecord(pool, "products", id);
    if (!existing || existing.organization_id !== input.organizationId) return reply.code(404).send({ error: "NOT_FOUND", message: "Produto nao encontrado." });
    const now = new Date().toISOString();
    const oldAliases = (await centralRecords(pool, "product_aliases")).filter((row) => row.product_id === id);
    const requestedAliases = new Set(input.aliases.map(normalized));
    const changes: DomainChange[] = [{ table: "products", key: id, operation: "UPSERT", data: {
      ...existing, name: input.name, code: clean(input.code), category: input.category, default_unit: input.defaultUnit,
      default_sack_weight_kg: input.defaultSackWeightKg ?? null, description: clean(input.description),
      is_active: input.isActive ? 1 : 0, updated_at: now
    }}];
    oldAliases.forEach((alias) => { if (!requestedAliases.has(normalized(String(alias.source_description ?? "")))) changes.push({ table: "product_aliases", key: String(alias.id), operation: "DELETE" }); });
    input.aliases.forEach((alias) => {
      const current = oldAliases.find((row) => normalized(String(row.source_description ?? "")) === normalized(alias));
      if (current) return;
      const aliasId = randomUUID(); changes.push({ table: "product_aliases", key: aliasId, operation: "UPSERT", data: {
        id: aliasId, organization_id: input.organizationId, product_id: id, issuer_partner_legal_entity_id: null,
        source_product_code: null, source_description: alias, normalized_description: normalized(alias), ncm: null,
        is_active: 1, created_at: now, updated_at: now
      }});
    });
    const revision = await commitDomainChanges(pool, session, "WEB_PRODUCT_UPDATED", "product", id, changes, { organizationId: input.organizationId });
    return { id, revision };
  });

  const saveRateRule = async (request: FastifyRequest, reply: FastifyReply, id?: string) => {
    const session = await requireWebSession(pool, request, reply); if (!session) return;
    const input = rateRuleSchema.parse(request.body);
    if (!(await authorize(pool, session, reply, input.organizationId, input.legalEntityId))) return;
    const table = input.kind === "SERVICE" ? "service_rate_rules" : "purchase_rate_rules";
    const key = id ?? randomUUID();
    const existing = id ? await centralRecord(pool, table, id) : null;
    if (id && (!existing || existing.organization_id !== input.organizationId)) return reply.code(404).send({ error: "NOT_FOUND", message: "Regra nao encontrada." });
    const now = new Date().toISOString();
    const data: Record<string, unknown> = {
      ...(existing ?? {}), id: key, organization_id: input.organizationId, business_partner_id: input.businessPartnerId,
      own_legal_entity_id: input.legalEntityId ?? null, product_id: input.productId ?? null,
      operation_scope: input.operationScope, rate_type: "PER_SACK", rate_value_cents: input.rateValueCents,
      effective_from: input.effectiveFrom, effective_to: input.effectiveTo ?? null, priority: input.priority,
      notes: clean(input.notes), is_active: input.isActive ? 1 : 0, created_at: existing?.created_at ?? now, updated_at: now
    };
    if (input.kind === "SERVICE") data.financial_rate_value_cents = input.financialRateValueCents ?? null;
    const revision = await commitDomainChanges(pool, session, id ? "WEB_RATE_RULE_UPDATED" : "WEB_RATE_RULE_CREATED", table, key, [{ table, key, operation: "UPSERT", data }], { organizationId: input.organizationId, kind: input.kind });
    return reply.code(id ? 200 : 201).send({ id: key, revision });
  };
  app.post("/v1/manage/rate-rules", async (request, reply) => saveRateRule(request, reply));
  app.put("/v1/manage/rate-rules/:id", async (request, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    return saveRateRule(request, reply, id);
  });
}
