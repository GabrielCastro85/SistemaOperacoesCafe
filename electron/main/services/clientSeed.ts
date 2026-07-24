import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { clientMasterData } from "../../../src/shared/seed/clientMasterData.js";
import type { ClientMasterDataEntry } from "../../../src/shared/seed/clientMasterData.js";

interface DbRecord {
  [key: string]: unknown;
}

const SEED_MARKER_KEY = "client_master_data_seed_v1";

export function seedClientMasterDataIfNeeded(db: Database.Database): number {
  if (!tableExists(db, "app_settings") || !tableExists(db, "business_partners") || !tableExists(db, "partner_legal_entities")) return 0;
  const organization = db.prepare("SELECT id FROM organizations ORDER BY name LIMIT 1").get() as { id: string } | undefined;
  if (!organization) return 0;

  const marker = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(SEED_MARKER_KEY) as { value: string } | undefined;
  if (marker?.value === "done") return 0;

  const now = new Date().toISOString();
  let changed = 0;
  db.transaction(() => {
    for (const entry of clientMasterData) {
      const partnerId = upsertPartner(db, organization.id, entry, now);
      changed += 1;
      for (const role of entry.roles.length > 0 ? entry.roles : ["CLIENT"]) {
        insertRoleIfMissing(db, partnerId, role, now);
      }
      for (const legalEntity of entry.legalEntities) {
        upsertLegalEntity(db, partnerId, legalEntity, now);
      }
      for (const contact of entry.contacts) {
        upsertContact(db, partnerId, contact, now);
      }
    }

    db.prepare(`
      INSERT INTO app_settings (id, key, value, value_type, created_at, updated_at)
      VALUES (?, ?, 'done', 'string', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = 'done', updated_at = excluded.updated_at
    `).run(SEED_MARKER_KEY, SEED_MARKER_KEY, now, now);
  })();

  return changed;
}

function upsertPartner(db: Database.Database, organizationId: string, entry: ClientMasterDataEntry, now: string): string {
  const cnpj = firstCnpj(entry);
  const byCnpj = cnpj
    ? db.prepare("SELECT bp.id FROM partner_legal_entities ple JOIN business_partners bp ON bp.id = ple.business_partner_id WHERE ple.cnpj = ? LIMIT 1").get(cnpj) as { id: string } | undefined
    : undefined;
  const existing = byCnpj ?? db.prepare("SELECT id FROM business_partners WHERE UPPER(TRIM(display_name)) = UPPER(TRIM(?)) LIMIT 1").get(entry.displayName) as { id: string } | undefined;
  if (existing) {
    db.prepare("UPDATE business_partners SET display_name = ?, notes = COALESCE(?, notes), is_active = ?, credit_limit_cents = COALESCE(?, credit_limit_cents), updated_at = ? WHERE id = ?")
      .run(entry.displayName, nullable(entry.notes), entry.isActive ? 1 : 0, entry.creditLimitCents, now, existing.id);
    return existing.id;
  }

  const id = randomUUID();
  db.prepare("INSERT INTO business_partners (id, organization_id, display_name, notes, is_active, credit_limit_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, organizationId, entry.displayName, nullable(entry.notes), entry.isActive ? 1 : 0, entry.creditLimitCents, now, now);
  return id;
}

function upsertLegalEntity(db: Database.Database, partnerId: string, legalEntity: ClientMasterDataEntry["legalEntities"][number], now: string): void {
  const cnpj = normalizeCnpj(legalEntity.cnpj);
  const existing = cnpj
    ? db.prepare("SELECT * FROM partner_legal_entities WHERE cnpj = ? LIMIT 1").get(cnpj) as DbRecord | undefined
    : db.prepare("SELECT * FROM partner_legal_entities WHERE business_partner_id = ? AND UPPER(TRIM(legal_name)) = UPPER(TRIM(?)) LIMIT 1").get(partnerId, legalEntity.legalName) as DbRecord | undefined;

  if (legalEntity.isPrimary) clearPrimaryLegalEntities(db, partnerId, existing?.id as string | undefined);
  const values = legalEntityValues(partnerId, legalEntity, now);
  if (!existing) {
    db.prepare(`INSERT INTO partner_legal_entities (
      id, business_partner_id, legal_name, trade_name, cnpj, state_registration, municipal_registration, email, phone,
      address_line, address_number, address_complement, district, city, state, postal_code, is_primary, is_active, is_draft, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(randomUUID(), ...values, now);
    return;
  }

  db.prepare(`UPDATE partner_legal_entities SET
    business_partner_id = ?, legal_name = ?, trade_name = ?, cnpj = COALESCE(?, cnpj), state_registration = COALESCE(?, state_registration),
    municipal_registration = COALESCE(?, municipal_registration), email = COALESCE(?, email), phone = COALESCE(?, phone),
    address_line = COALESCE(?, address_line), address_number = COALESCE(?, address_number), address_complement = COALESCE(?, address_complement),
    district = COALESCE(?, district), city = COALESCE(?, city), state = COALESCE(?, state), postal_code = COALESCE(?, postal_code),
    is_primary = ?, is_active = ?, is_draft = ?, updated_at = ? WHERE id = ?`)
    .run(...values, existing.id);
}

function upsertContact(db: Database.Database, partnerId: string, contact: ClientMasterDataEntry["contacts"][number], now: string): void {
  if (!tableExists(db, "partner_contacts")) return;
  const existing = db.prepare("SELECT id FROM partner_contacts WHERE business_partner_id = ? AND UPPER(TRIM(name)) = UPPER(TRIM(?)) LIMIT 1").get(partnerId, contact.name) as { id: string } | undefined;
  if (contact.isPrimary) clearPrimaryContacts(db, partnerId, existing?.id);
  const values = [
    partnerId,
    null,
    contact.name,
    nullable(contact.department),
    nullable(contact.email),
    nullable(contact.phone),
    nullable(contact.mobile),
    contact.preferredContactMethod || "PHONE",
    contact.isPrimary ? 1 : 0,
    nullable(contact.notes),
    contact.isActive ? 1 : 0
  ];
  if (!existing) {
    db.prepare("INSERT INTO partner_contacts (id, business_partner_id, partner_legal_entity_id, name, department, email, phone, mobile, preferred_contact_method, is_primary, notes, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), ...values, now, now);
    return;
  }
  db.prepare("UPDATE partner_contacts SET business_partner_id = ?, partner_legal_entity_id = ?, name = ?, department = COALESCE(?, department), email = COALESCE(?, email), phone = COALESCE(?, phone), mobile = COALESCE(?, mobile), preferred_contact_method = ?, is_primary = ?, notes = COALESCE(?, notes), is_active = ?, updated_at = ? WHERE id = ?")
    .run(...values, now, existing.id);
}

function legalEntityValues(partnerId: string, legalEntity: ClientMasterDataEntry["legalEntities"][number], now: string): unknown[] {
  return [
    partnerId,
    legalEntity.legalName,
    legalEntity.tradeName,
    normalizeCnpj(legalEntity.cnpj),
    nullable(legalEntity.stateRegistration),
    nullable(legalEntity.municipalRegistration),
    nullable(legalEntity.email),
    nullable(legalEntity.phone),
    nullable(legalEntity.addressLine),
    nullable(legalEntity.addressNumber),
    nullable(legalEntity.addressComplement),
    nullable(legalEntity.district),
    nullable(legalEntity.city),
    nullable(legalEntity.state),
    nullable(legalEntity.postalCode),
    legalEntity.isPrimary ? 1 : 0,
    legalEntity.isActive ? 1 : 0,
    legalEntity.isDraft ? 1 : 0,
    now
  ];
}

function insertRoleIfMissing(db: Database.Database, partnerId: string, role: string, now: string): void {
  const existing = db.prepare("SELECT id FROM business_partner_roles WHERE business_partner_id = ? AND role = ?").get(partnerId, role);
  if (!existing) db.prepare("INSERT INTO business_partner_roles (id, business_partner_id, role, created_at) VALUES (?, ?, ?, ?)").run(randomUUID(), partnerId, role, now);
}

function clearPrimaryLegalEntities(db: Database.Database, partnerId: string, exceptId?: string): void {
  db.prepare("UPDATE partner_legal_entities SET is_primary = 0 WHERE business_partner_id = ? AND id <> ?").run(partnerId, exceptId ?? "");
}

function clearPrimaryContacts(db: Database.Database, partnerId: string, exceptId?: string): void {
  db.prepare("UPDATE partner_contacts SET is_primary = 0 WHERE business_partner_id = ? AND id <> ?").run(partnerId, exceptId ?? "");
}

function firstCnpj(entry: ClientMasterDataEntry): string | null {
  for (const legalEntity of entry.legalEntities) {
    const cnpj = normalizeCnpj(legalEntity.cnpj);
    if (cnpj) return cnpj;
  }
  return null;
}

function normalizeCnpj(value: string | null): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length > 0 ? digits : null;
}

function nullable(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function tableExists(db: Database.Database, table: string): boolean {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}
