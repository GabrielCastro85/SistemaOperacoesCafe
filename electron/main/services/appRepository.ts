import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  legalEntityInputSchema,
  locationInputSchema,
  organizationInputSchema,
  businessPartnerInputSchema,
  partnerLegalEntityInputSchema,
  partnerContactInputSchema,
  productInputSchema,
  billingProfileInputSchema,
  serviceRateRuleInputSchema,
  resolveRateInputSchema,
  fiscalDocumentInputSchema,
  fiscalDocumentItemInputSchema,
  operationInputSchema,
  spreadsheetMappingTemplateInputSchema,
  spreadsheetImportJobInputSchema,
  spreadsheetImportRowInputSchema,
  partnerAliasInputSchema,
  xmlImportJobInputSchema,
  xmlImportFileInputSchema,
  xmlImportResolutionSchema,
  productAliasInputSchema,
  operationClassificationRuleInputSchema,
  suggestChargePeriodsInputSchema,
  eligibleOperationsInputSchema,
  clientChargeDraftInputSchema,
  clientChargeAdjustmentInputSchema,
  clientLedgerEntryInputSchema,
  creditAllocationInputSchema,
  clientPaymentInputSchema,
  paymentAllocationInputSchema,
  saveInstallationProfileSchema,
  updateInstallationProfileSchema
} from "../../../src/shared/schemas/domainSchemas.js";
import type {
  ActiveContext,
  AppVariant,
  BootstrapData,
  BusinessPartner,
  BusinessPartnerLegalEntity,
  BusinessPartnerRole,
  ClientBillingProfile,
  InstallationProfile,
  LegalEntity,
  Location,
  PartnerContact,
  Product,
  ResolveRateResult,
  ServiceRateRule,
  FiscalDocument,
  FiscalDocumentDetail,
  FiscalDocumentItem,
  Operation,
  SpreadsheetImportJob,
  SpreadsheetImportRow,
  SpreadsheetMappingTemplate,
  PartnerAlias,
  XmlImportJob,
  XmlImportFile,
  FiscalDocumentEvent,
  ProductAlias,
  OperationClassificationRule,
  FiscalDocumentMergeHistory,
  ClientCharge,
  ClientChargeDetail,
  ClientLedgerEntry,
  ClientPayment,
  BillingSummary,
  Organization,
  OrganizationListItem
} from "../../../src/shared/types/domain.js";
import { isValidCnpj } from "../../../src/shared/utils/format.js";
import {
  mapBusinessPartner,
  mapBusinessPartnerLegalEntity,
  mapClientBillingProfile,
  mapInstallationProfile,
  mapLegalEntity,
  mapLocation,
  mapOrganization,
  mapPartnerContact,
  mapProduct,
  mapServiceRateRule,
  mapFiscalDocument,
  mapFiscalDocumentItem,
  mapOperation,
  mapSpreadsheetMappingTemplate,
  mapSpreadsheetImportJob,
  mapSpreadsheetImportRow,
  mapPartnerAlias,
  mapXmlImportJob,
  mapXmlImportFile,
  mapFiscalDocumentEvent,
  mapProductAlias,
  mapOperationClassificationRule,
  mapFiscalDocumentMergeHistory,
  mapClientCharge,
  mapClientChargeOperation,
  mapClientChargeAdjustment,
  mapClientLedgerEntry,
  mapClientCreditAllocation,
  mapClientPayment,
  mapClientPaymentAllocation,
  mapChargeDocumentVersion
} from "../database/mappers.js";
import { divideDecimalText, multiplyDecimalByCents, normalizeDecimalText } from "../../../src/shared/utils/decimal.js";
import { generateChargeDocuments } from "./chargeDocuments.js";
import type { AppDirectories } from "../../../src/shared/types/domain.js";

type DbRecord = Record<string, unknown>;

export class AppRepository {
  constructor(private readonly db: Database.Database, private readonly directories?: AppDirectories) {}

  getBootstrapData(version: string): BootstrapData {
    return {
      version,
      profile: this.getInstallationProfile(),
      organizations: this.listOrganizations({ status: "active" }),
      legalEntities: this.listLegalEntities({ status: "active" }),
      locations: this.listLocations({ status: "active" })
    };
  }

  listOrganizations(filters: { search?: string; status?: "active" | "inactive" | "all" } = {}): OrganizationListItem[] {
    const rows = this.db
      .prepare(
        `SELECT o.*,
          (SELECT COUNT(*) FROM legal_entities le WHERE le.organization_id = o.id) AS legal_entity_count,
          (SELECT COUNT(*) FROM locations l WHERE l.organization_id = o.id) AS location_count
         FROM organizations o
         ORDER BY o.name`
      )
      .all() as DbRecord[];
    return rows
      .map((row) => ({
        ...mapOrganization(row),
        legalEntityCount: Number(row.legal_entity_count ?? 0),
        locationCount: Number(row.location_count ?? 0)
      }))
      .filter((item) => this.matchesStatus(item.isActive, filters.status))
      .filter((item) => this.matchesSearch([item.name, item.displayName, item.slug], filters.search))
      .filter((item) => this.isOrganizationAllowed(item.id));
  }

  getOrganization(id: string): Organization {
    const row = this.db.prepare("SELECT * FROM organizations WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) {
      throw new Error("Organizacao nao encontrada.");
    }
    const organization = mapOrganization(row);
    if (!this.isOrganizationAllowed(organization.id)) {
      throw new Error("Organizacao nao autorizada para esta instalacao.");
    }
    return organization;
  }

  createOrganization(input: unknown): Organization {
    const profile = this.getInstallationProfile();
    if (profile?.appVariant !== "multiempresa") {
      throw new Error("Esta variante nao permite cadastrar novas organizacoes.");
    }
    const data = organizationInputSchema.parse(input);
    this.assertUniqueSlug(data.slug);
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO organizations (
          id, name, slug, display_name, app_display_name, logo_path, compact_logo_path, icon_path,
          primary_color, secondary_color, accent_color, theme_mode, is_active, created_at, updated_at
        ) VALUES (@id, @name, @slug, @displayName, @appDisplayName, @logoPath, @compactLogoPath, @iconPath,
          @primaryColor, @secondaryColor, @accentColor, @themeMode, @isActive, @createdAt, @updatedAt)`
      )
      .run({ id, ...data, logoPath: data.logoPath ?? null, compactLogoPath: data.compactLogoPath ?? null, iconPath: data.iconPath ?? null, isActive: data.isActive ? 1 : 0, createdAt: now, updatedAt: now });
    return this.getOrganization(id);
  }

  updateOrganization(id: string, input: unknown): Organization {
    this.getOrganization(id);
    const data = organizationInputSchema.parse(input);
    this.assertUniqueSlug(data.slug, id);
    this.db
      .prepare(
        `UPDATE organizations SET
          name = @name, slug = @slug, display_name = @displayName, app_display_name = @appDisplayName,
          logo_path = @logoPath, compact_logo_path = @compactLogoPath, icon_path = @iconPath,
          primary_color = @primaryColor, secondary_color = @secondaryColor, accent_color = @accentColor,
          theme_mode = @themeMode, is_active = @isActive, updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({ id, ...data, logoPath: data.logoPath ?? null, compactLogoPath: data.compactLogoPath ?? null, iconPath: data.iconPath ?? null, isActive: data.isActive ? 1 : 0, updatedAt: new Date().toISOString() });
    return this.getOrganization(id);
  }

  updateOrganizationBranding(id: string, paths: Partial<Pick<Organization, "logoPath" | "compactLogoPath" | "iconPath">>): Organization {
    const organization = this.getOrganization(id);
    this.db
      .prepare(
        `UPDATE organizations SET
          logo_path = @logoPath,
          compact_logo_path = @compactLogoPath,
          icon_path = @iconPath,
          updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({
        id,
        logoPath: paths.logoPath ?? organization.logoPath,
        compactLogoPath: paths.compactLogoPath ?? organization.compactLogoPath,
        iconPath: paths.iconPath ?? organization.iconPath,
        updatedAt: new Date().toISOString()
      });
    return this.getOrganization(id);
  }

  activateOrganization(id: string): Organization {
    this.getOrganization(id);
    this.db.prepare("UPDATE organizations SET is_active = 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getOrganization(id);
  }

  deactivateOrganization(id: string, replacementOrganizationId?: string): Organization {
    const profile = this.getInstallationProfile();
    const organization = this.getOrganization(id);
    const activeAllowed = this.listOrganizations({ status: "active" }).filter((item) => item.id !== id);
    if (activeAllowed.length === 0) {
      throw new Error("Nao e permitido deixar todas as organizacoes autorizadas inativas.");
    }
    if (profile?.defaultOrganizationId === id) {
      if (!replacementOrganizationId) {
        throw new Error("Selecione uma organizacao substituta antes de desativar a organizacao ativa.");
      }
      this.updateInstallationProfile({
        ...profile,
        defaultOrganizationId: replacementOrganizationId,
        defaultLegalEntityId: null,
        confirmVariantChange: false
      });
    }
    this.db.prepare("UPDATE organizations SET is_active = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), organization.id);
    return this.getOrganization(id);
  }

  listLegalEntities(filters: { search?: string; organizationId?: string; state?: string; status?: "active" | "inactive" | "all" } = {}): LegalEntity[] {
    return (this.db.prepare("SELECT * FROM legal_entities ORDER BY trade_name").all() as DbRecord[])
      .map(mapLegalEntity)
      .filter((item) => this.isOrganizationAllowed(item.organizationId))
      .filter((item) => !filters.organizationId || item.organizationId === filters.organizationId)
      .filter((item) => !filters.state || item.state === filters.state)
      .filter((item) => this.matchesStatus(item.isActive, filters.status))
      .filter((item) => this.matchesSearch([item.tradeName, item.legalName, item.cnpj ?? ""], filters.search));
  }

  getLegalEntity(id: string): LegalEntity {
    const row = this.db.prepare("SELECT * FROM legal_entities WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) {
      throw new Error("CNPJ nao encontrado.");
    }
    const entity = mapLegalEntity(row);
    if (!this.isOrganizationAllowed(entity.organizationId)) {
      throw new Error("CNPJ nao autorizado para esta instalacao.");
    }
    return entity;
  }

  createLegalEntity(input: unknown): LegalEntity {
    const data = legalEntityInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    this.assertValidLegalEntity(data);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO legal_entities (
          id, organization_id, legal_name, trade_name, cnpj, state_registration, municipal_registration,
          email, phone, address_line, address_number, address_complement, district, city, state,
          postal_code, document_prefix, is_draft, is_active, created_at, updated_at
        ) VALUES (@id, @organizationId, @legalName, @tradeName, @cnpj, @stateRegistration, @municipalRegistration,
          @email, @phone, @addressLine, @addressNumber, @addressComplement, @district, @city, @state,
          @postalCode, @documentPrefix, @isDraft, @isActive, @createdAt, @updatedAt)`
      )
      .run({ id, ...data, isDraft: data.isDraft ? 1 : 0, isActive: data.isActive ? 1 : 0, createdAt: now, updatedAt: now });
    return this.getLegalEntity(id);
  }

  updateLegalEntity(id: string, input: unknown): LegalEntity {
    this.getLegalEntity(id);
    const data = legalEntityInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    this.assertValidLegalEntity(data, id);
    this.db
      .prepare(
        `UPDATE legal_entities SET
          organization_id = @organizationId, legal_name = @legalName, trade_name = @tradeName, cnpj = @cnpj,
          state_registration = @stateRegistration, municipal_registration = @municipalRegistration, email = @email,
          phone = @phone, address_line = @addressLine, address_number = @addressNumber, address_complement = @addressComplement,
          district = @district, city = @city, state = @state, postal_code = @postalCode, document_prefix = @documentPrefix,
          is_draft = @isDraft, is_active = @isActive, updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({ id, ...data, isDraft: data.isDraft ? 1 : 0, isActive: data.isActive ? 1 : 0, updatedAt: new Date().toISOString() });
    return this.getLegalEntity(id);
  }

  activateLegalEntity(id: string): LegalEntity {
    const entity = this.getLegalEntity(id);
    if (!entity.cnpj || !isValidCnpj(entity.cnpj)) {
      throw new Error("CNPJ valido e obrigatorio para ativar o cadastro.");
    }
    this.db.prepare("UPDATE legal_entities SET is_active = 1, is_draft = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getLegalEntity(id);
  }

  deactivateLegalEntity(id: string, replacementLegalEntityId?: string): LegalEntity {
    const entity = this.getLegalEntity(id);
    const profile = this.getInstallationProfile();
    if (profile?.defaultLegalEntityId === id) {
      if (!replacementLegalEntityId) {
        throw new Error("Selecione outro CNPJ ativo antes de desativar o CNPJ ativo.");
      }
      const replacement = this.getLegalEntity(replacementLegalEntityId);
      if (!replacement.isActive || replacement.organizationId !== entity.organizationId) {
        throw new Error("CNPJ substituto invalido.");
      }
      this.updateInstallationProfile({ ...profile, defaultLegalEntityId: replacementLegalEntityId });
    }
    this.db.prepare("UPDATE legal_entities SET is_active = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getLegalEntity(id);
  }

  listLocations(filters: { search?: string; organizationId?: string; legalEntityId?: string; type?: string; status?: "active" | "inactive" | "all" } = {}): Location[] {
    return (this.db.prepare("SELECT * FROM locations ORDER BY name").all() as DbRecord[])
      .map(mapLocation)
      .filter((item) => this.isOrganizationAllowed(item.organizationId))
      .filter((item) => !filters.organizationId || item.organizationId === filters.organizationId)
      .filter((item) => !filters.legalEntityId || item.legalEntityId === filters.legalEntityId)
      .filter((item) => !filters.type || item.type === filters.type)
      .filter((item) => this.matchesStatus(item.isActive, filters.status))
      .filter((item) => this.matchesSearch([item.name, item.city ?? ""], filters.search));
  }

  getLocation(id: string): Location {
    const row = this.db.prepare("SELECT * FROM locations WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) {
      throw new Error("Local nao encontrado.");
    }
    const location = mapLocation(row);
    if (!this.isOrganizationAllowed(location.organizationId)) {
      throw new Error("Local nao autorizado para esta instalacao.");
    }
    return location;
  }

  createLocation(input: unknown): Location {
    const data = locationInputSchema.parse(input);
    this.assertValidLocation(data);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO locations (
          id, organization_id, legal_entity_id, name, type, description, address_line, address_number,
          address_complement, district, city, state, postal_code, is_active, created_at, updated_at
        ) VALUES (@id, @organizationId, @legalEntityId, @name, @type, @description, @addressLine, @addressNumber,
          @addressComplement, @district, @city, @state, @postalCode, @isActive, @createdAt, @updatedAt)`
      )
      .run({ id, ...data, isActive: data.isActive ? 1 : 0, createdAt: now, updatedAt: now });
    return this.getLocation(id);
  }

  updateLocation(id: string, input: unknown): Location {
    this.getLocation(id);
    const data = locationInputSchema.parse(input);
    this.assertValidLocation(data);
    this.db
      .prepare(
        `UPDATE locations SET
          organization_id = @organizationId, legal_entity_id = @legalEntityId, name = @name, type = @type,
          description = @description, address_line = @addressLine, address_number = @addressNumber,
          address_complement = @addressComplement, district = @district, city = @city, state = @state,
          postal_code = @postalCode, is_active = @isActive, updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({ id, ...data, isActive: data.isActive ? 1 : 0, updatedAt: new Date().toISOString() });
    return this.getLocation(id);
  }

  activateLocation(id: string): Location {
    this.getLocation(id);
    this.db.prepare("UPDATE locations SET is_active = 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getLocation(id);
  }

  deactivateLocation(id: string): Location {
    this.getLocation(id);
    this.db.prepare("UPDATE locations SET is_active = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getLocation(id);
  }

  listBusinessPartners(filters: { search?: string; role?: BusinessPartnerRole; organizationId?: string; status?: "active" | "inactive" | "all" } = {}): BusinessPartner[] {
    return (this.db.prepare("SELECT * FROM business_partners ORDER BY display_name").all() as DbRecord[])
      .map((row) => mapBusinessPartner(row, this.getPartnerRoles(String(row.id))))
      .filter((item) => this.isOrganizationAllowed(item.organizationId))
      .filter((item) => !filters.organizationId || item.organizationId === filters.organizationId)
      .filter((item) => !filters.role || item.roles.includes(filters.role))
      .filter((item) => this.matchesStatus(item.isActive, filters.status))
      .filter((item) => this.matchesSearch([item.displayName], filters.search));
  }

  getBusinessPartner(id: string): BusinessPartner {
    const row = this.db.prepare("SELECT * FROM business_partners WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Parceiro nao encontrado.");
    const partner = mapBusinessPartner(row, this.getPartnerRoles(id));
    if (!this.isOrganizationAllowed(partner.organizationId)) throw new Error("Parceiro nao autorizado para esta instalacao.");
    return partner;
  }

  createBusinessPartner(input: unknown): BusinessPartner {
    const data = businessPartnerInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const id = randomUUID();
    const now = new Date().toISOString();
    const transaction = this.db.transaction(() => {
      this.db.prepare("INSERT INTO business_partners (id, organization_id, display_name, notes, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(id, data.organizationId, data.displayName, data.notes, data.isActive ? 1 : 0, now, now);
      data.roles.forEach((role) => this.addBusinessPartnerRole(id, role, now));
    });
    transaction();
    return this.getBusinessPartner(id);
  }

  updateBusinessPartner(id: string, input: unknown): BusinessPartner {
    this.getBusinessPartner(id);
    const data = businessPartnerInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    if (data.roles.length === 0) throw new Error("Parceiro deve possuir pelo menos um papel.");
    const now = new Date().toISOString();
    const transaction = this.db.transaction(() => {
      this.db.prepare("UPDATE business_partners SET organization_id = ?, display_name = ?, notes = ?, is_active = ?, updated_at = ? WHERE id = ?")
        .run(data.organizationId, data.displayName, data.notes, data.isActive ? 1 : 0, now, id);
      this.db.prepare("DELETE FROM business_partner_roles WHERE business_partner_id = ?").run(id);
      data.roles.forEach((role) => this.addBusinessPartnerRole(id, role, now));
    });
    transaction();
    return this.getBusinessPartner(id);
  }

  addBusinessPartnerRole(id: string, role: BusinessPartnerRole, createdAt = new Date().toISOString()): BusinessPartner {
    if (this.getPartnerRoles(id).includes(role)) throw new Error("Papel ja cadastrado para este parceiro.");
    this.db.prepare("INSERT INTO business_partner_roles (id, business_partner_id, role, created_at) VALUES (?, ?, ?, ?)")
      .run(randomUUID(), id, role, createdAt);
    return this.getBusinessPartner(id);
  }

  removeBusinessPartnerRole(id: string, role: BusinessPartnerRole): BusinessPartner {
    const roles = this.getPartnerRoles(id);
    if (roles.length <= 1 && roles.includes(role)) throw new Error("Parceiro deve possuir pelo menos um papel.");
    this.db.prepare("DELETE FROM business_partner_roles WHERE business_partner_id = ? AND role = ?").run(id, role);
    return this.getBusinessPartner(id);
  }

  activateBusinessPartner(id: string): BusinessPartner {
    this.getBusinessPartner(id);
    this.db.prepare("UPDATE business_partners SET is_active = 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getBusinessPartner(id);
  }

  deactivateBusinessPartner(id: string): BusinessPartner {
    this.getBusinessPartner(id);
    this.db.prepare("UPDATE business_partners SET is_active = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getBusinessPartner(id);
  }

  listPartnerLegalEntities(businessPartnerId: string): BusinessPartnerLegalEntity[] {
    const partner = this.getBusinessPartner(businessPartnerId);
    return (this.db.prepare("SELECT * FROM partner_legal_entities WHERE business_partner_id = ? ORDER BY trade_name").all(partner.id) as DbRecord[]).map(mapBusinessPartnerLegalEntity);
  }

  createPartnerLegalEntity(input: unknown): BusinessPartnerLegalEntity {
    const data = partnerLegalEntityInputSchema.parse(input);
    this.assertPartnerLegalEntity(data);
    const id = randomUUID();
    const now = new Date().toISOString();
    if (data.isPrimary) this.clearPrimaryPartnerLegalEntity(data.businessPartnerId);
    this.db.prepare(`INSERT INTO partner_legal_entities (
      id, business_partner_id, legal_name, trade_name, cnpj, state_registration, municipal_registration, email, phone,
      address_line, address_number, address_complement, district, city, state, postal_code, is_primary, is_active, is_draft, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.businessPartnerId, data.legalName, data.tradeName, data.cnpj, data.stateRegistration, data.municipalRegistration, data.email, data.phone, data.addressLine, data.addressNumber, data.addressComplement, data.district, data.city, data.state, data.postalCode, data.isPrimary ? 1 : 0, data.isActive ? 1 : 0, data.isDraft ? 1 : 0, now, now);
    return this.getPartnerLegalEntity(id);
  }

  updatePartnerLegalEntity(id: string, input: unknown): BusinessPartnerLegalEntity {
    this.getPartnerLegalEntity(id);
    const data = partnerLegalEntityInputSchema.parse(input);
    this.assertPartnerLegalEntity(data, id);
    if (data.isPrimary) this.clearPrimaryPartnerLegalEntity(data.businessPartnerId, id);
    this.db.prepare(`UPDATE partner_legal_entities SET business_partner_id = ?, legal_name = ?, trade_name = ?, cnpj = ?, state_registration = ?, municipal_registration = ?, email = ?, phone = ?, address_line = ?, address_number = ?, address_complement = ?, district = ?, city = ?, state = ?, postal_code = ?, is_primary = ?, is_active = ?, is_draft = ?, updated_at = ? WHERE id = ?`)
      .run(data.businessPartnerId, data.legalName, data.tradeName, data.cnpj, data.stateRegistration, data.municipalRegistration, data.email, data.phone, data.addressLine, data.addressNumber, data.addressComplement, data.district, data.city, data.state, data.postalCode, data.isPrimary ? 1 : 0, data.isActive ? 1 : 0, data.isDraft ? 1 : 0, new Date().toISOString(), id);
    return this.getPartnerLegalEntity(id);
  }

  activatePartnerLegalEntity(id: string): BusinessPartnerLegalEntity { return this.setPartnerLegalEntityActive(id, true); }
  deactivatePartnerLegalEntity(id: string): BusinessPartnerLegalEntity { return this.setPartnerLegalEntityActive(id, false); }

  listPartnerContacts(businessPartnerId: string): PartnerContact[] {
    const partner = this.getBusinessPartner(businessPartnerId);
    return (this.db.prepare("SELECT * FROM partner_contacts WHERE business_partner_id = ? ORDER BY name").all(partner.id) as DbRecord[]).map(mapPartnerContact);
  }

  createPartnerContact(input: unknown): PartnerContact {
    const data = partnerContactInputSchema.parse(input);
    this.assertPartnerContact(data);
    const id = randomUUID();
    const now = new Date().toISOString();
    if (data.isPrimary) this.clearPrimaryContact(data.businessPartnerId);
    this.db.prepare(`INSERT INTO partner_contacts (id, business_partner_id, partner_legal_entity_id, name, department, email, phone, mobile, preferred_contact_method, is_primary, notes, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.businessPartnerId, data.partnerLegalEntityId, data.name, data.department, data.email, data.phone, data.mobile, data.preferredContactMethod, data.isPrimary ? 1 : 0, data.notes, data.isActive ? 1 : 0, now, now);
    return this.getPartnerContact(id);
  }

  updatePartnerContact(id: string, input: unknown): PartnerContact {
    this.getPartnerContact(id);
    const data = partnerContactInputSchema.parse(input);
    this.assertPartnerContact(data);
    if (data.isPrimary) this.clearPrimaryContact(data.businessPartnerId, id);
    this.db.prepare(`UPDATE partner_contacts SET business_partner_id = ?, partner_legal_entity_id = ?, name = ?, department = ?, email = ?, phone = ?, mobile = ?, preferred_contact_method = ?, is_primary = ?, notes = ?, is_active = ?, updated_at = ? WHERE id = ?`)
      .run(data.businessPartnerId, data.partnerLegalEntityId, data.name, data.department, data.email, data.phone, data.mobile, data.preferredContactMethod, data.isPrimary ? 1 : 0, data.notes, data.isActive ? 1 : 0, new Date().toISOString(), id);
    return this.getPartnerContact(id);
  }

  activatePartnerContact(id: string): PartnerContact { return this.setPartnerContactActive(id, true); }
  deactivatePartnerContact(id: string): PartnerContact { return this.setPartnerContactActive(id, false); }

  listProducts(filters: { search?: string; organizationId?: string; category?: string; status?: "active" | "inactive" | "all" } = {}): Product[] {
    return (this.db.prepare("SELECT * FROM products ORDER BY name").all() as DbRecord[]).map(mapProduct)
      .filter((item) => this.isOrganizationAllowed(item.organizationId))
      .filter((item) => !filters.organizationId || item.organizationId === filters.organizationId)
      .filter((item) => !filters.category || item.category === filters.category)
      .filter((item) => this.matchesStatus(item.isActive, filters.status))
      .filter((item) => this.matchesSearch([item.name, item.code ?? ""], filters.search));
  }

  getProduct(id: string): Product {
    const row = this.db.prepare("SELECT * FROM products WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Produto nao encontrado.");
    const product = mapProduct(row);
    if (!this.isOrganizationAllowed(product.organizationId)) throw new Error("Produto nao autorizado.");
    return product;
  }

  createProduct(input: unknown): Product {
    const data = productInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    this.assertUniqueProductCode(data.organizationId, data.code);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO products (id, organization_id, name, code, category, default_unit, default_sack_weight_kg, description, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.organizationId, data.name, data.code, data.category, data.defaultUnit, data.defaultSackWeightKg, data.description, data.isActive ? 1 : 0, now, now);
    return this.getProduct(id);
  }

  updateProduct(id: string, input: unknown): Product {
    this.getProduct(id);
    const data = productInputSchema.parse(input);
    this.assertUniqueProductCode(data.organizationId, data.code, id);
    this.db.prepare("UPDATE products SET organization_id = ?, name = ?, code = ?, category = ?, default_unit = ?, default_sack_weight_kg = ?, description = ?, is_active = ?, updated_at = ? WHERE id = ?")
      .run(data.organizationId, data.name, data.code, data.category, data.defaultUnit, data.defaultSackWeightKg, data.description, data.isActive ? 1 : 0, new Date().toISOString(), id);
    return this.getProduct(id);
  }

  activateProduct(id: string): Product { return this.setProductActive(id, true); }
  deactivateProduct(id: string): Product { return this.setProductActive(id, false); }

  getBillingProfile(businessPartnerId: string): ClientBillingProfile | null {
    const partner = this.getBusinessPartner(businessPartnerId);
    const row = this.db.prepare("SELECT * FROM client_billing_profiles WHERE business_partner_id = ?").get(partner.id) as DbRecord | undefined;
    return row ? mapClientBillingProfile(row) : null;
  }

  upsertBillingProfile(input: unknown): ClientBillingProfile {
    const data = billingProfileInputSchema.parse(input);
    this.assertClientPartner(data.businessPartnerId, data.organizationId);
    if (data.ownLegalEntityId) {
      const own = this.getLegalEntity(data.ownLegalEntityId);
      if (own.organizationId !== data.organizationId) throw new Error("CNPJ proprio pertence a outra organizacao.");
    }
    const existing = this.getBillingProfile(data.businessPartnerId);
    const id = existing?.id ?? randomUUID();
    const now = new Date().toISOString();
    if (existing) {
      this.db.prepare("UPDATE client_billing_profiles SET organization_id = ?, own_legal_entity_id = ?, periodicity = ?, closing_weekday = ?, closing_day_of_month = ?, due_days_after_closing = ?, auto_include_unbilled_operations = ?, notes = ?, is_active = ?, updated_at = ? WHERE id = ?")
        .run(data.organizationId, data.ownLegalEntityId, data.periodicity, data.closingWeekday, data.closingDayOfMonth, data.dueDaysAfterClosing, data.autoIncludeUnbilledOperations ? 1 : 0, data.notes, data.isActive ? 1 : 0, now, id);
    } else {
      this.db.prepare("INSERT INTO client_billing_profiles (id, organization_id, business_partner_id, own_legal_entity_id, periodicity, closing_weekday, closing_day_of_month, due_days_after_closing, auto_include_unbilled_operations, notes, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(id, data.organizationId, data.businessPartnerId, data.ownLegalEntityId, data.periodicity, data.closingWeekday, data.closingDayOfMonth, data.dueDaysAfterClosing, data.autoIncludeUnbilledOperations ? 1 : 0, data.notes, data.isActive ? 1 : 0, now, now);
    }
    const saved = this.getBillingProfile(data.businessPartnerId);
    if (!saved) throw new Error("Falha ao salvar perfil de cobranca.");
    return saved;
  }

  activateBillingProfile(id: string): ClientBillingProfile { return this.setBillingProfileActive(id, true); }
  deactivateBillingProfile(id: string): ClientBillingProfile { return this.setBillingProfileActive(id, false); }

  listServiceRateRules(filters: { businessPartnerId?: string; organizationId?: string; operationScope?: string; productId?: string; ownLegalEntityId?: string; status?: "active" | "inactive" | "all" } = {}): ServiceRateRule[] {
    return (this.db.prepare("SELECT * FROM service_rate_rules ORDER BY effective_from DESC, priority DESC").all() as DbRecord[]).map(mapServiceRateRule)
      .filter((item) => this.isOrganizationAllowed(item.organizationId))
      .filter((item) => !filters.businessPartnerId || item.businessPartnerId === filters.businessPartnerId)
      .filter((item) => !filters.organizationId || item.organizationId === filters.organizationId)
      .filter((item) => !filters.operationScope || item.operationScope === filters.operationScope)
      .filter((item) => !filters.productId || item.productId === filters.productId)
      .filter((item) => !filters.ownLegalEntityId || item.ownLegalEntityId === filters.ownLegalEntityId)
      .filter((item) => this.matchesStatus(item.isActive, filters.status));
  }

  getServiceRateRule(id: string): ServiceRateRule {
    const row = this.db.prepare("SELECT * FROM service_rate_rules WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Regra nao encontrada.");
    const rule = mapServiceRateRule(row);
    if (!this.isOrganizationAllowed(rule.organizationId)) throw new Error("Regra nao autorizada.");
    return rule;
  }

  createServiceRateRule(input: unknown): ServiceRateRule {
    const data = serviceRateRuleInputSchema.parse(input);
    this.assertServiceRateRule(data);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO service_rate_rules (id, organization_id, business_partner_id, own_legal_entity_id, product_id, operation_scope, rate_type, rate_value_cents, effective_from, effective_to, priority, notes, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.organizationId, data.businessPartnerId, data.ownLegalEntityId, data.productId, data.operationScope, data.rateType, data.rateValueCents, data.effectiveFrom, data.effectiveTo, data.priority, data.notes, data.isActive ? 1 : 0, now, now);
    return this.getServiceRateRule(id);
  }

  updateServiceRateRule(id: string, input: unknown): ServiceRateRule {
    this.getServiceRateRule(id);
    const data = serviceRateRuleInputSchema.parse(input);
    this.assertServiceRateRule(data, id);
    this.db.prepare("UPDATE service_rate_rules SET organization_id = ?, business_partner_id = ?, own_legal_entity_id = ?, product_id = ?, operation_scope = ?, rate_type = ?, rate_value_cents = ?, effective_from = ?, effective_to = ?, priority = ?, notes = ?, is_active = ?, updated_at = ? WHERE id = ?")
      .run(data.organizationId, data.businessPartnerId, data.ownLegalEntityId, data.productId, data.operationScope, data.rateType, data.rateValueCents, data.effectiveFrom, data.effectiveTo, data.priority, data.notes, data.isActive ? 1 : 0, new Date().toISOString(), id);
    return this.getServiceRateRule(id);
  }

  activateServiceRateRule(id: string): ServiceRateRule { return this.setServiceRateRuleActive(id, true); }
  deactivateServiceRateRule(id: string): ServiceRateRule { return this.setServiceRateRuleActive(id, false); }

  resolveServiceRateRule(input: unknown): ResolveRateResult {
    const data = resolveRateInputSchema.parse(input);
    this.assertClientPartner(data.businessPartnerId, data.organizationId);
    const candidates = this.listServiceRateRules({ businessPartnerId: data.businessPartnerId, organizationId: data.organizationId, status: "active" })
      .filter((rule) => (rule.operationScope === data.operationScope || rule.operationScope === "ALL") && rule.effectiveFrom <= data.operationDate && (!rule.effectiveTo || rule.effectiveTo >= data.operationDate))
      .filter((rule) => !rule.ownLegalEntityId || rule.ownLegalEntityId === data.ownLegalEntityId)
      .filter((rule) => !rule.productId || rule.productId === data.productId)
      .map((rule) => ({ rule, score: (rule.ownLegalEntityId ? 4 : 0) + (rule.productId ? 2 : 0) + (rule.operationScope === data.operationScope ? 1 : 0) + rule.priority / 1000 }));
    if (candidates.length === 0) return { status: "missing", rule: null, rateValueCents: null, origin: "none", message: "Nenhuma regra aplicavel encontrada." };
    const max = Math.max(...candidates.map((item) => item.score));
    const best = candidates.filter((item) => item.score === max);
    if (best.length > 1) return { status: "conflict", rule: null, rateValueCents: null, origin: "conflict", message: "Mais de uma regra igualmente especifica foi encontrada." };
    const rule = best[0].rule;
    return { status: "found", rule, rateValueCents: rule.rateValueCents, origin: rule.productId || rule.ownLegalEntityId ? "specific" : "general", message: null };
  }

  listFiscalDocuments(filters: { organizationId?: string; search?: string; status?: "DRAFT" | "PENDING" | "CONFIRMED" | "CANCELED" | "all" } = {}): FiscalDocument[] {
    return (this.db.prepare("SELECT * FROM fiscal_documents ORDER BY issue_date DESC, updated_at DESC").all() as DbRecord[])
      .map(mapFiscalDocument)
      .filter((item) => this.isOrganizationAllowed(item.organizationId))
      .filter((item) => !filters.organizationId || item.organizationId === filters.organizationId)
      .filter((item) => !filters.status || filters.status === "all" || item.status === filters.status)
      .filter((item) => this.matchesSearch([item.documentNumber, item.accessKey ?? "", item.pendingNotes ?? ""], filters.search));
  }

  getFiscalDocument(id: string): FiscalDocumentDetail {
    const row = this.db.prepare("SELECT * FROM fiscal_documents WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Nota nao encontrada.");
    const document = mapFiscalDocument(row);
    if (!this.isOrganizationAllowed(document.organizationId)) throw new Error("Nota nao autorizada.");
    const items = (this.db.prepare("SELECT * FROM fiscal_document_items WHERE fiscal_document_id = ? ORDER BY created_at").all(id) as DbRecord[]).map(mapFiscalDocumentItem);
    const operations = (this.db.prepare("SELECT * FROM operations WHERE fiscal_document_id = ? ORDER BY created_at").all(id) as DbRecord[]).map(mapOperation);
    const hasEvents = this.tableExists("fiscal_document_events");
    const events = hasEvents ? (this.db.prepare("SELECT * FROM fiscal_document_events WHERE fiscal_document_id = ? ORDER BY created_at").all(id) as DbRecord[]).map(mapFiscalDocumentEvent) : [];
    const mergeHistory = this.tableExists("fiscal_document_merge_history") ? (this.db.prepare("SELECT * FROM fiscal_document_merge_history WHERE fiscal_document_id = ? ORDER BY created_at").all(id) as DbRecord[]).map(mapFiscalDocumentMergeHistory) : [];
    return { document, items, operations, events, mergeHistory };
  }

  createFiscalDocument(input: unknown): FiscalDocumentDetail {
    const data = fiscalDocumentInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const own = this.getLegalEntity(data.ownLegalEntityId);
    if (own.organizationId !== data.organizationId) throw new Error("CNPJ proprio pertence a outra organizacao.");
    const partner = this.getBusinessPartner(data.responsiblePartnerId);
    if (partner.organizationId !== data.organizationId) throw new Error("Cliente responsavel pertence a outra organizacao.");
    if (data.accessKey) {
      const duplicate = this.db.prepare("SELECT id FROM fiscal_documents WHERE access_key = ?").get(data.accessKey);
      if (duplicate) throw new Error("Chave de acesso ja cadastrada.");
    }
    const duplicateWarning = this.detectPossibleDuplicate(data);
    const id = randomUUID();
    const now = new Date().toISOString();
    const status = data.hasPendingIssues ? "PENDING" : "DRAFT";
    this.db.prepare(`INSERT INTO fiscal_documents (
      id, organization_id, own_legal_entity_id, responsible_partner_id, partner_legal_entity_id, document_type, access_key,
      document_number, series, issue_date, total_amount_cents, status, has_pending_issues, pending_notes, duplicate_warning,
      notes, confirmed_at, canceled_at, cancel_reason, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'MANUAL_INVOICE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`)
      .run(id, data.organizationId, data.ownLegalEntityId, data.responsiblePartnerId, data.partnerLegalEntityId, data.accessKey, data.documentNumber, data.series, data.issueDate, data.totalAmountCents, status, data.hasPendingIssues ? 1 : 0, data.pendingNotes, duplicateWarning, data.notes, now, now);
    return this.getFiscalDocument(id);
  }

  updateFiscalDocument(id: string, input: unknown): FiscalDocumentDetail {
    this.getFiscalDocument(id);
    const data = fiscalDocumentInputSchema.parse(input);
    const duplicateWarning = this.detectPossibleDuplicate(data, id);
    this.db.prepare(`UPDATE fiscal_documents SET own_legal_entity_id = ?, responsible_partner_id = ?, partner_legal_entity_id = ?, access_key = ?, document_number = ?, series = ?, issue_date = ?, total_amount_cents = ?, has_pending_issues = ?, pending_notes = ?, duplicate_warning = ?, notes = ?, updated_at = ? WHERE id = ?`)
      .run(data.ownLegalEntityId, data.responsiblePartnerId, data.partnerLegalEntityId, data.accessKey, data.documentNumber, data.series, data.issueDate, data.totalAmountCents, data.hasPendingIssues ? 1 : 0, data.pendingNotes, duplicateWarning, data.notes, new Date().toISOString(), id);
    return this.getFiscalDocument(id);
  }

  addFiscalDocumentItem(input: unknown): FiscalDocumentItem {
    const data = fiscalDocumentItemInputSchema.parse(input);
    const detail = this.getFiscalDocument(data.fiscalDocumentId);
    if (detail.document.status === "CONFIRMED" || detail.document.status === "CANCELED") throw new Error("Nota confirmada ou cancelada nao pode receber itens.");
    if (data.productId) this.getProduct(data.productId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO fiscal_document_items (id, fiscal_document_id, product_id, description, quantity_decimal, unit, unit_price_decimal, total_amount_cents, sacks_quantity_decimal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.fiscalDocumentId, data.productId, data.description, normalizeDecimalText(data.quantity), data.unit, normalizeDecimalText(data.unitPriceDecimal), data.totalAmountCents, data.sacksQuantity ? normalizeDecimalText(data.sacksQuantity) : null, now, now);
    return this.getFiscalDocument(data.fiscalDocumentId).items.find((item) => item.id === id) as FiscalDocumentItem;
  }

  addOperation(input: unknown): Operation {
    const data = operationInputSchema.parse(input);
    const detail = this.getFiscalDocument(data.fiscalDocumentId);
    if (detail.document.status === "CONFIRMED" || detail.document.status === "CANCELED") throw new Error("Nota confirmada ou cancelada nao pode receber operacoes.");
    const resolved = this.resolveServiceRateRule({
      organizationId: detail.document.organizationId,
      businessPartnerId: data.responsiblePartnerId,
      ownLegalEntityId: data.ownLegalEntityId,
      productId: data.productId,
      operationScope: data.operationScope,
      operationDate: data.operationDate
    });
    if (resolved.status === "conflict") throw new Error("Conflito ao resolver regra por saca.");
    const manual = data.manualRateValueCents !== null;
    if (manual && !data.manualOverrideReason) throw new Error("Informe o motivo para alterar manualmente o valor por saca.");
    const rate = data.manualRateValueCents ?? resolved.rateValueCents ?? 0;
    const amount = multiplyDecimalByCents(data.quantitySacks, rate);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO operations (
      id, fiscal_document_id, fiscal_document_item_id, organization_id, own_legal_entity_id, responsible_partner_id, product_id,
      operation_type, operation_scope, operation_date, quantity_sacks_decimal, service_rate_rule_id, applied_rate_value_cents,
      service_amount_cents, rate_was_manually_overridden, manual_rate_value_cents, manual_override_reason, notes, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.fiscalDocumentId, data.fiscalDocumentItemId, detail.document.organizationId, data.ownLegalEntityId, data.responsiblePartnerId, data.productId, data.operationType, data.operationScope, data.operationDate, normalizeDecimalText(data.quantitySacks), resolved.rule?.id ?? null, rate, amount, manual ? 1 : 0, data.manualRateValueCents, data.manualOverrideReason, data.notes, detail.document.hasPendingIssues || resolved.status === "missing" ? "PENDING" : "DRAFT", now, now);
    return this.getFiscalDocument(data.fiscalDocumentId).operations.find((item) => item.id === id) as Operation;
  }

  updateOperationManualRate(id: string, manualRateValueCents: number, reason: string): Operation {
    const operation = this.getOperation(id);
    if (!reason.trim()) throw new Error("Motivo obrigatorio para alteracao manual.");
    const amount = multiplyDecimalByCents(operation.quantitySacks, manualRateValueCents);
    this.db.prepare("UPDATE operations SET applied_rate_value_cents = ?, service_amount_cents = ?, rate_was_manually_overridden = 1, manual_rate_value_cents = ?, manual_override_reason = ?, updated_at = ? WHERE id = ?")
      .run(manualRateValueCents, amount, manualRateValueCents, reason, new Date().toISOString(), id);
    return this.getOperation(id);
  }

  confirmFiscalDocument(id: string): FiscalDocumentDetail {
    const detail = this.getFiscalDocument(id);
    if (detail.document.hasPendingIssues) throw new Error("Resolva as pendencias antes de confirmar.");
    if (detail.items.length === 0 || detail.operations.length === 0) throw new Error("Nota precisa ter itens e operacoes.");
    const now = new Date().toISOString();
    this.db.prepare("UPDATE fiscal_documents SET status = 'CONFIRMED', confirmed_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
    this.db.prepare("UPDATE operations SET status = 'CONFIRMED', updated_at = ? WHERE fiscal_document_id = ?").run(now, id);
    return this.getFiscalDocument(id);
  }

  cancelFiscalDocument(id: string, reason: string): FiscalDocumentDetail {
    if (!reason.trim()) throw new Error("Motivo de cancelamento obrigatorio.");
    this.getFiscalDocument(id);
    const now = new Date().toISOString();
    this.db.prepare("UPDATE fiscal_documents SET status = 'CANCELED', canceled_at = ?, cancel_reason = ?, updated_at = ? WHERE id = ?").run(now, reason, now, id);
    this.db.prepare("UPDATE operations SET status = 'CANCELED', updated_at = ? WHERE fiscal_document_id = ?").run(now, id);
    return this.getFiscalDocument(id);
  }

  getOperationalIndicators(organizationId: string): { documents: number; pending: number; confirmed: number; operations: number; serviceAmountCents: number } {
    this.assertOrganizationWritable(organizationId);
    const docs = this.listFiscalDocuments({ organizationId });
    const operations = (this.db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(service_amount_cents), 0) AS amount FROM operations WHERE organization_id = ?").get(organizationId) as { total: number; amount: number });
    return {
      documents: docs.length,
      pending: docs.filter((doc) => doc.status === "PENDING" || doc.hasPendingIssues).length,
      confirmed: docs.filter((doc) => doc.status === "CONFIRMED").length,
      operations: Number(operations.total),
      serviceAmountCents: Number(operations.amount)
    };
  }

  listSpreadsheetMappingTemplates(organizationId: string): SpreadsheetMappingTemplate[] {
    this.assertOrganizationWritable(organizationId);
    return (this.db.prepare("SELECT * FROM spreadsheet_mapping_templates WHERE organization_id = ? ORDER BY name").all(organizationId) as DbRecord[]).map(mapSpreadsheetMappingTemplate);
  }

  createSpreadsheetMappingTemplate(input: unknown): SpreadsheetMappingTemplate {
    const data = spreadsheetMappingTemplateInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO spreadsheet_mapping_templates (id, organization_id, name, import_type, sheet_name_pattern, header_row, column_mapping_json, default_commercial_flow, default_operation_scope, default_product_id, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.organizationId, data.name, data.importType, data.sheetNamePattern, data.headerRow, JSON.stringify(data.columnMapping), data.defaultCommercialFlow, data.defaultOperationScope, data.defaultProductId, data.isActive ? 1 : 0, now, now);
    return this.getSpreadsheetMappingTemplate(id);
  }

  updateSpreadsheetMappingTemplate(id: string, input: unknown): SpreadsheetMappingTemplate {
    this.getSpreadsheetMappingTemplate(id);
    const data = spreadsheetMappingTemplateInputSchema.parse(input);
    this.db.prepare(`UPDATE spreadsheet_mapping_templates SET name = ?, import_type = ?, sheet_name_pattern = ?, header_row = ?, column_mapping_json = ?, default_commercial_flow = ?, default_operation_scope = ?, default_product_id = ?, is_active = ?, updated_at = ? WHERE id = ?`)
      .run(data.name, data.importType, data.sheetNamePattern, data.headerRow, JSON.stringify(data.columnMapping), data.defaultCommercialFlow, data.defaultOperationScope, data.defaultProductId, data.isActive ? 1 : 0, new Date().toISOString(), id);
    return this.getSpreadsheetMappingTemplate(id);
  }

  duplicateSpreadsheetMappingTemplate(id: string): SpreadsheetMappingTemplate {
    const template = this.getSpreadsheetMappingTemplate(id);
    return this.createSpreadsheetMappingTemplate({
      organizationId: template.organizationId,
      name: `${template.name} - copia`,
      importType: template.importType,
      sheetNamePattern: template.sheetNamePattern,
      headerRow: template.headerRow,
      columnMapping: JSON.parse(template.columnMappingJson) as Record<string, string>,
      defaultCommercialFlow: template.defaultCommercialFlow,
      defaultOperationScope: template.defaultOperationScope,
      defaultProductId: template.defaultProductId,
      isActive: template.isActive
    });
  }

  activateSpreadsheetMappingTemplate(id: string): SpreadsheetMappingTemplate { return this.setSpreadsheetMappingTemplateActive(id, true); }
  deactivateSpreadsheetMappingTemplate(id: string): SpreadsheetMappingTemplate { return this.setSpreadsheetMappingTemplateActive(id, false); }

  createSpreadsheetImportDraft(input: unknown): SpreadsheetImportJob {
    const data = spreadsheetImportJobInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const own = this.getLegalEntity(data.ownLegalEntityId);
    if (own.organizationId !== data.organizationId) throw new Error("CNPJ proprio pertence a outra organizacao.");
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO spreadsheet_import_jobs (id, organization_id, own_legal_entity_id, mapping_template_id, original_file_name, stored_file_path, selected_sheet_name, import_type, status, created_at, settings_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`)
      .run(id, data.organizationId, data.ownLegalEntityId, data.mappingTemplateId, data.originalFileName, data.storedFilePath, data.selectedSheetName, data.importType, now, JSON.stringify(data.settings));
    return this.getSpreadsheetImportJob(id).job;
  }

  setSpreadsheetImportStoredFilePath(id: string, storedFilePath: string): SpreadsheetImportJob {
    this.getSpreadsheetImportJob(id);
    this.db.prepare("UPDATE spreadsheet_import_jobs SET stored_file_path = ? WHERE id = ?").run(storedFilePath, id);
    return this.getSpreadsheetImportJob(id).job;
  }

  addSpreadsheetImportRow(input: unknown): SpreadsheetImportRow {
    const data = spreadsheetImportRowInputSchema.parse(input);
    const job = this.getSpreadsheetImportJob(data.importJobId).job;
    this.assertOrganizationWritable(job.organizationId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO spreadsheet_import_rows (id, import_job_id, sheet_name, source_row_number, raw_data_json, normalized_data_json, status, error_code, error_message, warning_codes_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.importJobId, data.sheetName, data.sourceRowNumber, JSON.stringify(data.rawData), data.normalizedData ? JSON.stringify(data.normalizedData) : null, data.status, data.errorCode, data.errorMessage, JSON.stringify(data.warningCodes), now, now);
    this.recountImportJob(data.importJobId);
    return this.getSpreadsheetImportJob(data.importJobId).rows.find((row) => row.id === id) as SpreadsheetImportRow;
  }

  getSpreadsheetImportJob(id: string): { job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] } {
    const row = this.db.prepare("SELECT * FROM spreadsheet_import_jobs WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Importacao nao encontrada.");
    const job = mapSpreadsheetImportJob(row);
    if (!this.isOrganizationAllowed(job.organizationId)) throw new Error("Importacao nao autorizada.");
    const rows = (this.db.prepare("SELECT * FROM spreadsheet_import_rows WHERE import_job_id = ? ORDER BY source_row_number").all(id) as DbRecord[]).map(mapSpreadsheetImportRow);
    return { job, rows };
  }

  listSpreadsheetImportJobs(organizationId: string): SpreadsheetImportJob[] {
    this.assertOrganizationWritable(organizationId);
    return (this.db.prepare("SELECT * FROM spreadsheet_import_jobs WHERE organization_id = ? ORDER BY created_at DESC").all(organizationId) as DbRecord[]).map(mapSpreadsheetImportJob);
  }

  executeSpreadsheetImport(id: string, options: { importWarnings?: boolean } = {}): { job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] } {
    const { job, rows } = this.getSpreadsheetImportJob(id);
    const settings = JSON.parse(job.settingsJson) as Record<string, unknown>;
    const ownLegalEntityId = job.ownLegalEntityId;
    const defaultPartnerId = typeof settings.defaultPartnerId === "string" ? settings.defaultPartnerId : null;
    const operationType = settings.operationType === "PURCHASE" ? "PURCHASE" : "SALE";
    const defaultScope = settings.defaultOperationScope === "INTERNAL" ? "INTERNAL" : "EXTERNAL";
    const defaultProductId = typeof settings.defaultProductId === "string" ? settings.defaultProductId : null;
    const now = new Date().toISOString();
    this.db.prepare("UPDATE spreadsheet_import_jobs SET status = 'PROCESSING', started_at = ? WHERE id = ?").run(now, id);
    const documentGroups = new Map<string, string>();
    rows.forEach((row) => {
      if (row.status !== "VALID" && !(options.importWarnings && row.status === "WARNING")) return;
      const normalized = row.normalizedDataJson ? (JSON.parse(row.normalizedDataJson) as Record<string, string>) : {};
      try {
        const partnerId = normalized.clientPartnerId || defaultPartnerId;
        if (!partnerId) throw new Error("Cliente nao informado.");
        const productId = normalized.productId || defaultProductId || null;
        const operationScope = (normalized.operationScope || defaultScope) as "INTERNAL" | "EXTERNAL";
        const groupKey = `${partnerId}|${normalized.accessKey ?? ""}|${normalized.documentNumber}|${normalized.series ?? ""}`;
        const groupedDocumentId = documentGroups.get(groupKey);
        const doc = groupedDocumentId
          ? this.getFiscalDocument(groupedDocumentId)
          : this.createFiscalDocument({
              organizationId: job.organizationId,
              ownLegalEntityId,
              responsiblePartnerId: partnerId,
              partnerLegalEntityId: null,
              accessKey: normalized.accessKey || null,
              documentNumber: normalized.documentNumber,
              series: normalized.series || null,
              issueDate: normalized.date,
              totalAmountCents: Number(normalized.totalAmountCents ?? 0),
              hasPendingIssues: row.status === "WARNING",
              pendingNotes: row.warningCodesJson,
              notes: normalized.notes || null
            });
        if (!groupedDocumentId) {
          documentGroups.set(groupKey, doc.document.id);
          this.db.prepare("UPDATE fiscal_documents SET source = 'SPREADSHEET', import_job_id = ?, import_row_id = ? WHERE id = ?").run(id, row.id, doc.document.id);
        }
        const item = this.addFiscalDocumentItem({
          fiscalDocumentId: doc.document.id,
          productId,
          description: normalized.productName ?? "Item importado",
          quantity: normalized.sacks,
          unit: "SACK",
          unitPriceDecimal: normalized.commercialUnitPrice ?? "0",
          totalAmountCents: Number(normalized.totalAmountCents ?? 0),
          sacksQuantity: normalized.sacks
        });
        const operation = this.addOperation({
          fiscalDocumentId: doc.document.id,
          fiscalDocumentItemId: item.id,
          ownLegalEntityId,
          responsiblePartnerId: partnerId,
          productId,
          operationType,
          operationScope,
          operationDate: normalized.date,
          quantitySacks: normalized.sacks,
          manualRateValueCents: normalized.manualRateValueCents ? Number(normalized.manualRateValueCents) : null,
          manualOverrideReason: normalized.manualRateValueCents ? "Valor informado na planilha" : null,
          notes: normalized.notes ?? null
        });
        this.db.prepare("UPDATE operations SET source = 'SPREADSHEET', import_job_id = ?, import_row_id = ? WHERE id = ?").run(id, row.id, operation.id);
        this.db.prepare("UPDATE spreadsheet_import_rows SET status = 'IMPORTED', fiscal_document_id = ?, operation_id = ?, updated_at = ? WHERE id = ?").run(doc.document.id, operation.id, new Date().toISOString(), row.id);
      } catch (error) {
        this.db.prepare("UPDATE spreadsheet_import_rows SET status = 'ERROR', error_code = 'IMPORT_FAILED', error_message = ?, updated_at = ? WHERE id = ?").run(error instanceof Error ? error.message : "Falha na importacao.", new Date().toISOString(), row.id);
      }
    });
    this.recountImportJob(id);
    const final = this.getSpreadsheetImportJob(id);
    const hasErrors = final.rows.some((row) => row.status === "ERROR");
    this.db.prepare("UPDATE spreadsheet_import_jobs SET status = ?, completed_at = ? WHERE id = ?").run(hasErrors ? "COMPLETED_WITH_ERRORS" : "COMPLETED", new Date().toISOString(), id);
    return this.getSpreadsheetImportJob(id);
  }

  cancelSpreadsheetImportJob(id: string): SpreadsheetImportJob {
    const { job } = this.getSpreadsheetImportJob(id);
    if (job.status !== "DRAFT" && job.status !== "VALIDATED") throw new Error("Somente importacoes nao processadas podem ser canceladas.");
    this.db.prepare("UPDATE spreadsheet_import_jobs SET status = 'CANCELLED', cancelled_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getSpreadsheetImportJob(id).job;
  }

  revertSpreadsheetImportJob(id: string, reason: string): { job: SpreadsheetImportJob; rows: SpreadsheetImportRow[] } {
    if (!reason.trim()) throw new Error("Motivo obrigatorio para reversao.");
    const { job, rows } = this.getSpreadsheetImportJob(id);
    if (job.status === "REVERTED") throw new Error("Importacao ja revertida.");
    rows.filter((row) => row.fiscalDocumentId).forEach((row) => {
      this.cancelFiscalDocument(row.fiscalDocumentId as string, `Reversao da importacao: ${reason}`);
      this.db.prepare("UPDATE spreadsheet_import_rows SET status = 'REVERTED', updated_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
    });
    this.db.prepare("UPDATE spreadsheet_import_jobs SET status = 'REVERTED', completed_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getSpreadsheetImportJob(id);
  }

  listPartnerAliases(organizationId: string): PartnerAlias[] {
    this.assertOrganizationWritable(organizationId);
    return (this.db.prepare("SELECT * FROM partner_aliases WHERE organization_id = ? ORDER BY alias").all(organizationId) as DbRecord[]).map(mapPartnerAlias);
  }

  createPartnerAlias(input: unknown): PartnerAlias {
    const data = partnerAliasInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const normalized = this.normalizeName(data.alias);
    const existing = this.db.prepare("SELECT id FROM partner_aliases WHERE organization_id = ? AND normalized_alias = ? AND is_active = 1").get(data.organizationId, normalized);
    if (existing) throw new Error("Alias ativo ja cadastrado nesta organizacao.");
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO partner_aliases (id, organization_id, business_partner_id, partner_legal_entity_id, alias, normalized_alias, source, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.organizationId, data.businessPartnerId, data.partnerLegalEntityId, data.alias, normalized, data.source, data.isActive ? 1 : 0, now, now);
    return this.listPartnerAliases(data.organizationId).find((alias) => alias.id === id) as PartnerAlias;
  }

  deactivatePartnerAlias(id: string): PartnerAlias {
    const row = this.db.prepare("SELECT * FROM partner_aliases WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Alias nao encontrado.");
    const alias = mapPartnerAlias(row);
    this.assertOrganizationWritable(alias.organizationId);
    this.db.prepare("UPDATE partner_aliases SET is_active = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.listPartnerAliases(alias.organizationId).find((item) => item.id === id) as PartnerAlias;
  }

  resolvePartnerAlias(organizationId: string, value: string): PartnerAlias | null {
    this.assertOrganizationWritable(organizationId);
    const row = this.db.prepare("SELECT * FROM partner_aliases WHERE organization_id = ? AND normalized_alias = ? AND is_active = 1").get(organizationId, this.normalizeName(value)) as DbRecord | undefined;
    return row ? mapPartnerAlias(row) : null;
  }

  createXmlImportDraft(input: unknown): XmlImportJob {
    const data = xmlImportJobInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO xml_import_jobs (id, organization_id, status, source_type, selected_folder, include_subfolders, created_at, settings_json) VALUES (?, ?, 'DRAFT', ?, ?, ?, ?, ?)")
      .run(id, data.organizationId, data.sourceType, data.selectedFolder, data.includeSubfolders ? 1 : 0, now, JSON.stringify(data.settings));
    return this.getXmlImportJob(id).job;
  }

  addXmlImportFile(input: unknown): XmlImportFile {
    const data = xmlImportFileInputSchema.parse(input);
    const { job } = this.getXmlImportJob(data.importJobId);
    let status = data.status;
    let errorCode = data.errorCode;
    let errorMessage = data.errorMessage;
    const sameHash = this.db.prepare("SELECT id FROM xml_import_files WHERE file_hash = ? AND status IN ('IMPORTED','DUPLICATE') LIMIT 1").get(data.fileHash);
    if (sameHash) {
      status = "DUPLICATE";
      errorCode = "DUPLICATE_HASH";
      errorMessage = "Arquivo XML identico ja processado.";
    }
    if (data.accessKey && this.db.prepare("SELECT id FROM fiscal_documents WHERE access_key = ? LIMIT 1").get(data.accessKey)) {
      status = "DUPLICATE";
      errorCode = "DUPLICATE_ACCESS_KEY";
      errorMessage = "Nota com a mesma chave ja cadastrada.";
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO xml_import_files (
      id, import_job_id, original_file_name, file_hash, file_size, xml_type, access_key, status, error_code, error_message,
      warning_codes_json, extracted_data_json, resolution_data_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, job.id, data.originalFileName, data.fileHash, data.fileSize, data.xmlType, data.accessKey, status, errorCode, errorMessage, JSON.stringify(data.warningCodes), data.extractedData ? JSON.stringify(data.extractedData) : null, data.resolutionData ? JSON.stringify(data.resolutionData) : null, now, now);
    this.recountXmlImportJob(job.id);
    return this.getXmlImportJob(job.id).files.find((file) => file.id === id) as XmlImportFile;
  }

  setXmlImportFileStoredPath(id: string, storedFilePath: string): XmlImportFile {
    const file = this.getXmlImportFile(id);
    this.db.prepare("UPDATE xml_import_files SET stored_file_path = ?, updated_at = ? WHERE id = ?").run(storedFilePath, new Date().toISOString(), id);
    return this.getXmlImportJob(file.importJobId).files.find((item) => item.id === id) as XmlImportFile;
  }

  updateXmlImportSettings(id: string, settings: Record<string, unknown>): XmlImportJob {
    this.getXmlImportJob(id);
    this.db.prepare("UPDATE xml_import_jobs SET settings_json = ? WHERE id = ?").run(JSON.stringify(settings), id);
    return this.getXmlImportJob(id).job;
  }

  validateXmlImportJob(id: string): { job: XmlImportJob; files: XmlImportFile[] } {
    this.getXmlImportJob(id);
    this.recountXmlImportJob(id);
    this.db.prepare("UPDATE xml_import_jobs SET status = 'VALIDATED' WHERE id = ?").run(id);
    return this.getXmlImportJob(id);
  }

  updateXmlImportFileResolution(id: string, resolution: unknown): XmlImportFile {
    const file = this.getXmlImportFile(id);
    const data = xmlImportResolutionSchema.parse(resolution);
    this.db.prepare("UPDATE xml_import_files SET resolution_data_json = ?, status = CASE WHEN status = 'ERROR' THEN status ELSE 'WARNING' END, updated_at = ? WHERE id = ?").run(JSON.stringify(data), new Date().toISOString(), id);
    this.recountXmlImportJob(file.importJobId);
    return this.getXmlImportJob(file.importJobId).files.find((item) => item.id === id) as XmlImportFile;
  }

  applyXmlBulkResolution(jobId: string, fileIds: string[], resolution: unknown): { job: XmlImportJob; files: XmlImportFile[] } {
    const data = xmlImportResolutionSchema.parse(resolution);
    this.getXmlImportJob(jobId);
    const update = this.db.prepare("UPDATE xml_import_files SET resolution_data_json = ?, status = CASE WHEN status = 'ERROR' THEN status ELSE 'WARNING' END, updated_at = ? WHERE id = ? AND import_job_id = ?");
    fileIds.forEach((id) => update.run(JSON.stringify(data), new Date().toISOString(), id, jobId));
    this.recountXmlImportJob(jobId);
    return this.getXmlImportJob(jobId);
  }

  executeXmlImportJob(id: string): { job: XmlImportJob; files: XmlImportFile[] } {
    const current = this.getXmlImportJob(id);
    const settings = JSON.parse(current.job.settingsJson) as Record<string, unknown>;
    const now = new Date().toISOString();
    this.db.prepare("UPDATE xml_import_jobs SET status = 'PROCESSING', started_at = ? WHERE id = ?").run(now, id);
    current.files.forEach((file) => {
      if (!["VALID", "WARNING", "PENDING_REVIEW", "DUPLICATE"].includes(file.status)) return;
      const resolution = { ...settings, ...(file.resolutionDataJson ? JSON.parse(file.resolutionDataJson) as Record<string, unknown> : {}) };
      if (resolution.ignore === true) {
        this.db.prepare("UPDATE xml_import_files SET status = 'SKIPPED', updated_at = ? WHERE id = ?").run(new Date().toISOString(), file.id);
        return;
      }
      const trx = this.db.transaction(() => this.processXmlImportFile(current.job, file, resolution));
      try {
        trx();
      } catch (error) {
        this.db.prepare("UPDATE xml_import_files SET status = 'ERROR', error_code = 'IMPORT_FAILED', error_message = ?, updated_at = ? WHERE id = ?").run(error instanceof Error ? error.message : "Falha ao importar XML.", new Date().toISOString(), file.id);
      }
    });
    this.recountXmlImportJob(id);
    const after = this.getXmlImportJob(id);
    const hasErrors = after.files.some((file) => file.status === "ERROR");
    this.db.prepare("UPDATE xml_import_jobs SET status = ?, completed_at = ? WHERE id = ?").run(hasErrors ? "COMPLETED_WITH_ERRORS" : "COMPLETED", new Date().toISOString(), id);
    this.recountXmlImportJob(id);
    return this.getXmlImportJob(id);
  }

  getXmlImportJob(id: string): { job: XmlImportJob; files: XmlImportFile[] } {
    const row = this.db.prepare("SELECT * FROM xml_import_jobs WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Importacao XML nao encontrada.");
    const job = mapXmlImportJob(row);
    if (!this.isOrganizationAllowed(job.organizationId)) throw new Error("Importacao XML nao autorizada.");
    const files = (this.db.prepare("SELECT * FROM xml_import_files WHERE import_job_id = ? ORDER BY created_at").all(id) as DbRecord[]).map(mapXmlImportFile);
    return { job, files };
  }

  listXmlImportJobs(organizationId: string): XmlImportJob[] {
    this.assertOrganizationWritable(organizationId);
    return (this.db.prepare("SELECT * FROM xml_import_jobs WHERE organization_id = ? ORDER BY created_at DESC").all(organizationId) as DbRecord[]).map(mapXmlImportJob);
  }

  getXmlImportJobProgress(id: string): XmlImportJob {
    this.recountXmlImportJob(id);
    return this.getXmlImportJob(id).job;
  }

  cancelXmlImportJob(id: string): XmlImportJob {
    const { job } = this.getXmlImportJob(id);
    if (!["DRAFT", "INSPECTING", "VALIDATED"].includes(job.status)) throw new Error("Somente importacoes XML nao processadas podem ser canceladas.");
    this.db.prepare("UPDATE xml_import_jobs SET status = 'CANCELLED', cancelled_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getXmlImportJob(id).job;
  }

  revertXmlImportJob(id: string, reason: string): { job: XmlImportJob; files: XmlImportFile[] } {
    if (!reason.trim()) throw new Error("Motivo obrigatorio para reversao.");
    const { job, files } = this.getXmlImportJob(id);
    if (job.status === "REVERTED") throw new Error("Importacao XML ja revertida.");
    files.filter((file) => file.fiscalDocumentId).forEach((file) => {
      const doc = this.getFiscalDocument(file.fiscalDocumentId as string).document;
      if (doc.xmlImportJobId === id && doc.mergedFromSource === null) this.cancelFiscalDocument(doc.id, `Reversao da importacao XML: ${reason}`);
      this.db.prepare("UPDATE xml_import_files SET status = 'REVERTED', updated_at = ? WHERE id = ?").run(new Date().toISOString(), file.id);
    });
    this.db.prepare("UPDATE xml_import_jobs SET status = 'REVERTED', reverted_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getXmlImportJob(id);
  }

  listFiscalDocumentEvents(organizationId: string): FiscalDocumentEvent[] {
    this.assertOrganizationWritable(organizationId);
    return (this.db.prepare("SELECT * FROM fiscal_document_events WHERE organization_id = ? ORDER BY created_at DESC").all(organizationId) as DbRecord[]).map(mapFiscalDocumentEvent);
  }

  getFiscalDocumentEvent(id: string): FiscalDocumentEvent {
    const row = this.db.prepare("SELECT * FROM fiscal_document_events WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Evento fiscal nao encontrado.");
    const event = mapFiscalDocumentEvent(row);
    this.assertOrganizationWritable(event.organizationId);
    return event;
  }

  linkPendingFiscalDocumentEvents(accessKey: string): number {
    const doc = this.db.prepare("SELECT * FROM fiscal_documents WHERE access_key = ?").get(accessKey) as DbRecord | undefined;
    if (!doc) return 0;
    const fiscal = mapFiscalDocument(doc);
    const result = this.db.prepare("UPDATE fiscal_document_events SET fiscal_document_id = ? WHERE access_key = ? AND fiscal_document_id IS NULL").run(fiscal.id, accessKey);
    return Number(result.changes);
  }

  listProductAliases(organizationId: string): ProductAlias[] {
    this.assertOrganizationWritable(organizationId);
    return (this.db.prepare("SELECT * FROM product_aliases WHERE organization_id = ? ORDER BY source_description").all(organizationId) as DbRecord[]).map(mapProductAlias);
  }

  createProductAlias(input: unknown): ProductAlias {
    const data = productAliasInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const normalized = this.normalizeName(data.sourceDescription);
    const existing = this.db.prepare(`SELECT id FROM product_aliases WHERE organization_id = ? AND COALESCE(issuer_partner_legal_entity_id, '') = COALESCE(?, '') AND COALESCE(source_product_code, '') = COALESCE(?, '') AND normalized_description = ? AND COALESCE(ncm, '') = COALESCE(?, '') AND is_active = 1`)
      .get(data.organizationId, data.issuerPartnerLegalEntityId, data.sourceProductCode, normalized, data.ncm);
    if (existing) throw new Error("Alias de produto ativo ja cadastrado neste escopo.");
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO product_aliases (id, organization_id, product_id, issuer_partner_legal_entity_id, source_product_code, source_description, normalized_description, ncm, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.organizationId, data.productId, data.issuerPartnerLegalEntityId, data.sourceProductCode, data.sourceDescription, normalized, data.ncm, data.isActive ? 1 : 0, now, now);
    return this.listProductAliases(data.organizationId).find((alias) => alias.id === id) as ProductAlias;
  }

  updateProductAlias(id: string, input: unknown): ProductAlias {
    const current = this.getProductAlias(id);
    const data = productAliasInputSchema.parse(input);
    this.assertOrganizationWritable(current.organizationId);
    this.db.prepare("UPDATE product_aliases SET product_id = ?, issuer_partner_legal_entity_id = ?, source_product_code = ?, source_description = ?, normalized_description = ?, ncm = ?, is_active = ?, updated_at = ? WHERE id = ?")
      .run(data.productId, data.issuerPartnerLegalEntityId, data.sourceProductCode, data.sourceDescription, this.normalizeName(data.sourceDescription), data.ncm, data.isActive ? 1 : 0, new Date().toISOString(), id);
    return this.getProductAlias(id);
  }

  activateProductAlias(id: string): ProductAlias { return this.setProductAliasActive(id, true); }
  deactivateProductAlias(id: string): ProductAlias { return this.setProductAliasActive(id, false); }

  resolveProductAlias(organizationId: string, criteria: { issuerPartnerLegalEntityId?: string | null; sourceProductCode?: string | null; sourceDescription: string; ncm?: string | null }): ProductAlias | null {
    this.assertOrganizationWritable(organizationId);
    const normalized = this.normalizeName(criteria.sourceDescription);
    const row = this.db.prepare(`SELECT * FROM product_aliases WHERE organization_id = ? AND is_active = 1 AND normalized_description = ? AND (source_product_code IS NULL OR source_product_code = ?) AND (ncm IS NULL OR ncm = ?) AND (issuer_partner_legal_entity_id IS NULL OR issuer_partner_legal_entity_id = ?) ORDER BY issuer_partner_legal_entity_id DESC, source_product_code DESC, ncm DESC LIMIT 1`)
      .get(organizationId, normalized, criteria.sourceProductCode ?? null, criteria.ncm ?? null, criteria.issuerPartnerLegalEntityId ?? null) as DbRecord | undefined;
    return row ? mapProductAlias(row) : null;
  }

  listOperationClassificationRules(organizationId: string): OperationClassificationRule[] {
    this.assertOrganizationWritable(organizationId);
    return (this.db.prepare("SELECT * FROM operation_classification_rules WHERE organization_id = ? ORDER BY priority DESC, created_at DESC").all(organizationId) as DbRecord[]).map(mapOperationClassificationRule);
  }

  createOperationClassificationRule(input: unknown): OperationClassificationRule {
    const data = operationClassificationRuleInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO operation_classification_rules (
      id, organization_id, own_legal_entity_id, issuer_partner_legal_entity_id, recipient_partner_legal_entity_id,
      destination_partner_id, product_id, client_partner_id, commercial_flow, operation_scope, priority, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.organizationId, data.ownLegalEntityId, data.issuerPartnerLegalEntityId, data.recipientPartnerLegalEntityId, data.destinationPartnerId, data.productId, data.clientPartnerId, data.commercialFlow, data.operationScope, data.priority, data.isActive ? 1 : 0, now, now);
    return this.listOperationClassificationRules(data.organizationId).find((rule) => rule.id === id) as OperationClassificationRule;
  }

  updateOperationClassificationRule(id: string, input: unknown): OperationClassificationRule {
    const current = this.getOperationClassificationRule(id);
    const data = operationClassificationRuleInputSchema.parse(input);
    this.assertOrganizationWritable(current.organizationId);
    this.db.prepare(`UPDATE operation_classification_rules SET own_legal_entity_id = ?, issuer_partner_legal_entity_id = ?, recipient_partner_legal_entity_id = ?, destination_partner_id = ?, product_id = ?, client_partner_id = ?, commercial_flow = ?, operation_scope = ?, priority = ?, is_active = ?, updated_at = ? WHERE id = ?`)
      .run(data.ownLegalEntityId, data.issuerPartnerLegalEntityId, data.recipientPartnerLegalEntityId, data.destinationPartnerId, data.productId, data.clientPartnerId, data.commercialFlow, data.operationScope, data.priority, data.isActive ? 1 : 0, new Date().toISOString(), id);
    return this.getOperationClassificationRule(id);
  }

  activateOperationClassificationRule(id: string): OperationClassificationRule { return this.setOperationClassificationRuleActive(id, true); }
  deactivateOperationClassificationRule(id: string): OperationClassificationRule { return this.setOperationClassificationRuleActive(id, false); }

  resolveOperationClassificationRule(input: { organizationId: string; ownLegalEntityId?: string | null; issuerPartnerLegalEntityId?: string | null; recipientPartnerLegalEntityId?: string | null; productId?: string | null }): OperationClassificationRule | null {
    this.assertOrganizationWritable(input.organizationId);
    const rows = (this.db.prepare("SELECT * FROM operation_classification_rules WHERE organization_id = ? AND is_active = 1 ORDER BY priority DESC").all(input.organizationId) as DbRecord[]).map(mapOperationClassificationRule);
    return rows.find((rule) =>
      (!rule.ownLegalEntityId || rule.ownLegalEntityId === input.ownLegalEntityId) &&
      (!rule.issuerPartnerLegalEntityId || rule.issuerPartnerLegalEntityId === input.issuerPartnerLegalEntityId) &&
      (!rule.recipientPartnerLegalEntityId || rule.recipientPartnerLegalEntityId === input.recipientPartnerLegalEntityId) &&
      (!rule.productId || rule.productId === input.productId)
    ) ?? null;
  }

  compareXmlWithExisting(fileId: string): Record<string, unknown> {
    const file = this.getXmlImportFile(fileId);
    if (!file.accessKey) return { status: "no-access-key", differences: [] };
    const docRow = this.db.prepare("SELECT * FROM fiscal_documents WHERE access_key = ?").get(file.accessKey) as DbRecord | undefined;
    if (!docRow) return { status: "new", differences: [] };
    const doc = mapFiscalDocument(docRow);
    const extracted = file.extractedDataJson ? JSON.parse(file.extractedDataJson) as Record<string, unknown> : {};
    const differences = [
      ["documentNumber", doc.documentNumber, extracted.number],
      ["series", doc.series, extracted.series],
      ["issueDate", doc.issueDate, extracted.issuedAt],
      ["totalAmountCents", doc.totalAmountCents, (extracted.totals as Record<string, unknown> | undefined)?.invoiceAmountCents]
    ].filter(([, currentValue, xmlValue]) => xmlValue !== undefined && String(currentValue ?? "") !== String(xmlValue ?? ""));
    return { status: differences.length ? "different" : "same", fiscalDocumentId: doc.id, differences };
  }

  mergeXmlIntoExisting(fileId: string, decision: string): FiscalDocumentDetail {
    const file = this.getXmlImportFile(fileId);
    if (!file.accessKey) throw new Error("Arquivo sem chave para mesclagem.");
    const docRow = this.db.prepare("SELECT * FROM fiscal_documents WHERE access_key = ?").get(file.accessKey) as DbRecord | undefined;
    if (!docRow) throw new Error("Nota existente nao encontrada.");
    const doc = mapFiscalDocument(docRow);
    const now = new Date().toISOString();
    const differences = this.compareXmlWithExisting(fileId);
    this.db.prepare("UPDATE fiscal_documents SET xml_file_path = COALESCE(xml_file_path, ?), xml_file_hash = COALESCE(xml_file_hash, ?), xml_import_job_id = COALESCE(xml_import_job_id, ?), merged_from_source = COALESCE(merged_from_source, ?), merged_at = ?, fiscal_snapshot_json = COALESCE(fiscal_snapshot_json, ?), updated_at = ? WHERE id = ?")
      .run(file.storedFilePath, file.fileHash, file.importJobId, doc.source, now, file.extractedDataJson, now, doc.id);
    this.db.prepare("INSERT INTO fiscal_document_merge_history (id, organization_id, fiscal_document_id, xml_import_job_id, previous_source, decision, differences_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), doc.organizationId, doc.id, file.importJobId, doc.source, decision, JSON.stringify(differences), now);
    this.db.prepare("UPDATE xml_import_files SET status = 'IMPORTED', fiscal_document_id = ?, updated_at = ? WHERE id = ?").run(doc.id, now, file.id);
    return this.getFiscalDocument(doc.id);
  }

  getFiscalDocumentMergeHistory(fiscalDocumentId: string): FiscalDocumentMergeHistory[] {
    const detail = this.getFiscalDocument(fiscalDocumentId);
    return detail.mergeHistory ?? [];
  }

  suggestChargePeriods(input: unknown): Array<{ periodicity: string; periodStart: string; periodEnd: string; label: string }> {
    const data = suggestChargePeriodsInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const profile = this.getBillingProfile(data.clientPartnerId);
    const periodicity = data.periodicity ?? profile?.periodicity ?? "MONTHLY";
    const reference = parseLocalDate(data.referenceDate ?? new Date().toISOString().slice(0, 10));
    return [{ periodicity, ...periodFor(reference, periodicity, profile?.closingWeekday ?? 5, profile?.closingDayOfMonth ?? 1) }];
  }

  findEligibleOperations(input: unknown): Operation[] {
    const data = eligibleOperationsInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    return (this.db.prepare(`
      SELECT * FROM operations
      WHERE organization_id = ?
        AND own_legal_entity_id = ?
        AND responsible_partner_id = ?
        AND operation_date BETWEEN ? AND ?
        AND status = 'CONFIRMED'
        AND billing_status = 'UNBILLED'
      ORDER BY operation_date, created_at
    `).all(data.organizationId, data.ownLegalEntityId, data.clientPartnerId, data.periodStart, data.periodEnd) as DbRecord[]).map(mapOperation);
  }

  createClientChargeDraft(input: unknown): ClientChargeDetail {
    const data = clientChargeDraftInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    if (data.periodEnd < data.periodStart) throw new Error("Periodo final deve ser posterior ao inicial.");
    const id = randomUUID();
    const now = new Date().toISOString();
    const trx = this.db.transaction(() => {
      this.db.prepare(`INSERT INTO client_charges (
        id, organization_id, own_legal_entity_id, client_partner_id, billing_profile_id, charge_number, periodicity,
        period_start, period_end, due_date, status, notes, internal_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?)`)
        .run(id, data.organizationId, data.ownLegalEntityId, data.clientPartnerId, data.billingProfileId, data.periodicity, data.periodStart, data.periodEnd, data.dueDate, data.notes, data.internalNotes, now, now);
      this.reserveOperationsForCharge(id, data.operationIds);
      this.recalculateClientCharge(id);
      this.recordChargeStatus(id, null, "DRAFT", "Rascunho criado");
    });
    trx();
    return this.getClientCharge(id);
  }

  reserveOperations(clientChargeId: string, operationIds: string[]): ClientChargeDetail {
    const trx = this.db.transaction(() => {
      this.reserveOperationsForCharge(clientChargeId, operationIds);
      this.recalculateClientCharge(clientChargeId);
    });
    trx();
    return this.getClientCharge(clientChargeId);
  }

  releaseOperations(clientChargeId: string, operationIds?: string[]): ClientChargeDetail {
    const charge = this.getClientCharge(clientChargeId).charge;
    if (!["DRAFT", "PENDING_REVIEW"].includes(charge.status)) throw new Error("Somente rascunhos permitem liberar operacoes.");
    const ids = operationIds?.length ? operationIds : this.getClientCharge(clientChargeId).operations.map((item) => item.operationId);
    const now = new Date().toISOString();
    ids.forEach((operationId) => {
      this.db.prepare("UPDATE client_charge_operations SET released_at = ? WHERE client_charge_id = ? AND operation_id = ? AND released_at IS NULL").run(now, clientChargeId, operationId);
      this.db.prepare("UPDATE operations SET billing_status = 'UNBILLED', client_charge_id = NULL, updated_at = ? WHERE id = ? AND client_charge_id = ?").run(now, operationId, clientChargeId);
    });
    this.recalculateClientCharge(clientChargeId);
    return this.getClientCharge(clientChargeId);
  }

  addChargeAdjustment(input: unknown): ClientChargeDetail {
    const data = clientChargeAdjustmentInputSchema.parse(input);
    const charge = this.getClientCharge(data.clientChargeId).charge;
    if (!["DRAFT", "PENDING_REVIEW"].includes(charge.status)) throw new Error("Ajustes bloqueados apos emissao.");
    if (data.adjustmentType === "MANUAL_ADJUSTMENT" && !data.reason?.trim()) throw new Error("Ajuste manual exige justificativa.");
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO client_charge_adjustments (id, client_charge_id, ledger_entry_id, adjustment_type, effect, description, amount_cents, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.clientChargeId, data.ledgerEntryId, data.adjustmentType, data.effect, data.description, data.amountCents, data.sortOrder, now, now);
    this.recalculateClientCharge(data.clientChargeId);
    return this.getClientCharge(data.clientChargeId);
  }

  removeChargeAdjustment(id: string): ClientChargeDetail {
    const row = this.db.prepare("SELECT client_charge_id AS chargeId FROM client_charge_adjustments WHERE id = ?").get(id) as { chargeId: string } | undefined;
    if (!row) throw new Error("Ajuste nao encontrado.");
    const charge = this.getClientCharge(row.chargeId).charge;
    if (!["DRAFT", "PENDING_REVIEW"].includes(charge.status)) throw new Error("Ajustes bloqueados apos emissao.");
    this.db.prepare("DELETE FROM client_charge_adjustments WHERE id = ?").run(id);
    this.recalculateClientCharge(row.chargeId);
    return this.getClientCharge(row.chargeId);
  }

  createLedgerEntry(input: unknown): ClientLedgerEntry {
    const data = clientLedgerEntryInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO client_ledger_entries (
      id, organization_id, own_legal_entity_id, client_partner_id, client_charge_id, entry_type, effect, amount_cents,
      entry_date, description, reference_number, notes, attachment_path, status, available_amount_cents, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?)`)
      .run(id, data.organizationId, data.ownLegalEntityId, data.clientPartnerId, data.clientChargeId, data.entryType, data.effect, data.amountCents, data.entryDate, data.description, data.referenceNumber, data.notes, data.attachmentPath, data.availableAmountCents, now, now);
    return this.getLedgerEntry(id);
  }

  createAdvance(input: unknown): ClientLedgerEntry {
    const base = clientLedgerEntryInputSchema.parse(input);
    return this.createLedgerEntry({ ...base, entryType: "ADVANCE_RECEIVED", effect: "REDUCE_RECEIVABLE", availableAmountCents: base.amountCents });
  }

  createCredit(input: unknown): ClientLedgerEntry {
    const base = clientLedgerEntryInputSchema.parse(input);
    return this.createLedgerEntry({ ...base, entryType: "CREDIT", effect: "REDUCE_RECEIVABLE", availableAmountCents: base.amountCents });
  }

  getAvailableCredits(organizationId: string, ownLegalEntityId: string, clientPartnerId: string): ClientLedgerEntry[] {
    this.assertOrganizationWritable(organizationId);
    return (this.db.prepare("SELECT * FROM client_ledger_entries WHERE organization_id = ? AND own_legal_entity_id = ? AND client_partner_id = ? AND status = 'CONFIRMED' AND effect = 'REDUCE_RECEIVABLE' AND COALESCE(available_amount_cents, 0) > 0 ORDER BY entry_date").all(organizationId, ownLegalEntityId, clientPartnerId) as DbRecord[]).map(mapClientLedgerEntry);
  }

  applyCredit(input: unknown): ClientChargeDetail {
    const data = creditAllocationInputSchema.parse(input);
    const credit = this.getLedgerEntry(data.ledgerEntryId);
    const charge = this.getClientCharge(data.clientChargeId).charge;
    this.assertSameChargeScope(charge, credit);
    if ((credit.availableAmountCents ?? 0) < data.amountCents) throw new Error("Credito insuficiente.");
    const id = randomUUID();
    const now = new Date().toISOString();
    const trx = this.db.transaction(() => {
      this.db.prepare("INSERT INTO client_credit_allocations (id, ledger_entry_id, client_charge_id, amount_cents, allocated_at) VALUES (?, ?, ?, ?, ?)").run(id, data.ledgerEntryId, data.clientChargeId, data.amountCents, now);
      this.db.prepare("UPDATE client_ledger_entries SET available_amount_cents = available_amount_cents - ?, updated_at = ? WHERE id = ?").run(data.amountCents, now, data.ledgerEntryId);
      this.db.prepare("INSERT INTO client_charge_adjustments (id, client_charge_id, ledger_entry_id, adjustment_type, effect, description, amount_cents, sort_order, created_at, updated_at) VALUES (?, ?, ?, 'CREDIT', 'REDUCE_RECEIVABLE', ?, ?, 100, ?, ?)").run(randomUUID(), data.clientChargeId, data.ledgerEntryId, `Credito utilizado ${credit.description}`, data.amountCents, now, now);
      this.recalculateClientCharge(data.clientChargeId);
    });
    trx();
    return this.getClientCharge(data.clientChargeId);
  }

  submitClientChargeForReview(id: string): ClientChargeDetail {
    const charge = this.getClientCharge(id).charge;
    if (charge.status !== "DRAFT") throw new Error("Somente rascunhos podem ir para conferencia.");
    this.updateChargeStatus(id, "PENDING_REVIEW", "Enviado para conferencia");
    return this.getClientCharge(id);
  }

  async issueClientCharge(id: string): Promise<ClientChargeDetail> {
    const before = this.getClientCharge(id);
    if (!["DRAFT", "PENDING_REVIEW"].includes(before.charge.status)) throw new Error("Cobranca ja emitida ou cancelada.");
    if (before.operations.length === 0) throw new Error("Cobranca sem operacoes.");
    const now = new Date().toISOString();
    const trx = this.db.transaction(() => {
      const number = this.reserveNextChargeNumber(before.charge.organizationId, before.charge.ownLegalEntityId, now.slice(0, 4));
      this.recalculateClientCharge(id);
      const snapshot = JSON.stringify(this.buildChargeSnapshot(id));
      this.db.prepare("UPDATE client_charges SET charge_number = ?, issue_date = ?, status = 'ISSUED', issued_at = ?, snapshot_json = ?, updated_at = ? WHERE id = ?").run(number, now.slice(0, 10), now, snapshot, now, id);
      this.db.prepare("UPDATE operations SET billing_status = 'BILLED', updated_at = ? WHERE client_charge_id = ?").run(now, id);
      this.db.prepare("INSERT INTO client_ledger_entries (id, organization_id, own_legal_entity_id, client_partner_id, client_charge_id, entry_type, effect, amount_cents, entry_date, description, status, available_amount_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'SERVICE_CHARGE', 'INCREASE_RECEIVABLE', ?, ?, ?, 'CONFIRMED', NULL, ?, ?)")
        .run(randomUUID(), before.charge.organizationId, before.charge.ownLegalEntityId, before.charge.clientPartnerId, id, this.getClientCharge(id).charge.finalAmountCents, now.slice(0, 10), `Cobranca ${number}`, now, now);
      this.recordChargeStatus(id, before.charge.status, "ISSUED", "Cobranca emitida");
    });
    trx();
    const generated = await this.regenerateChargeDocuments(id);
    return generated;
  }

  async regenerateChargeDocuments(id: string): Promise<ClientChargeDetail> {
    if (!this.directories) throw new Error("Diretorios locais nao configurados.");
    const detail = this.getClientCharge(id);
    const organization = this.getOrganization(detail.charge.organizationId);
    const ownLegalEntity = this.getLegalEntity(detail.charge.ownLegalEntityId);
    const client = this.getBusinessPartner(detail.charge.clientPartnerId);
    const result = await generateChargeDocuments({ directories: this.directories, organization, ownLegalEntity, client, detail });
    const version = detail.documents.length + 1;
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO charge_document_versions (id, client_charge_id, version, pdf_file_path, pdf_file_hash, excel_file_path, excel_file_hash, image_file_path, image_file_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), id, version, result.pdfFilePath, result.pdfFileHash, result.excelFilePath, result.excelFileHash, result.imageFilePath, result.imageFileHash, now);
    this.db.prepare("UPDATE client_charges SET pdf_file_path = ?, pdf_file_hash = ?, excel_file_path = ?, image_file_path = ?, updated_at = ? WHERE id = ?").run(result.pdfFilePath, result.pdfFileHash, result.excelFilePath, result.imageFilePath, now, id);
    return this.getClientCharge(id);
  }

  createClientPayment(input: unknown): ClientPayment {
    const data = clientPaymentInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO client_payments (id, organization_id, own_legal_entity_id, client_partner_id, payment_date, amount_cents, payment_method, bank_account_description, transaction_reference, notes, attachment_path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?)")
      .run(id, data.organizationId, data.ownLegalEntityId, data.clientPartnerId, data.paymentDate, data.amountCents, data.paymentMethod, data.bankAccountDescription, data.transactionReference, data.notes, data.attachmentPath, now, now);
    return this.getClientPayment(id);
  }

  allocatePayment(input: unknown): ClientChargeDetail {
    const data = paymentAllocationInputSchema.parse(input);
    const payment = this.getClientPayment(data.clientPaymentId);
    const charge = this.getClientCharge(data.clientChargeId).charge;
    this.assertSamePaymentScope(charge, payment);
    const allocated = this.sumPaymentAllocated(payment.id);
    if (payment.amountCents - allocated < data.amountCents) throw new Error("Pagamento sem saldo disponivel.");
    if (charge.openAmountCents < data.amountCents) throw new Error("Valor maior que saldo aberto.");
    const now = new Date().toISOString();
    const trx = this.db.transaction(() => {
      this.db.prepare("INSERT INTO client_payment_allocations (id, client_payment_id, client_charge_id, amount_cents, allocated_at) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), payment.id, charge.id, data.amountCents, now);
      this.db.prepare("INSERT INTO client_ledger_entries (id, organization_id, own_legal_entity_id, client_partner_id, client_charge_id, entry_type, effect, amount_cents, entry_date, description, reference_number, status, available_amount_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'PAYMENT_RECEIVED', 'REDUCE_RECEIVABLE', ?, ?, ?, ?, 'CONFIRMED', NULL, ?, ?)")
        .run(randomUUID(), payment.organizationId, payment.ownLegalEntityId, payment.clientPartnerId, charge.id, data.amountCents, payment.paymentDate, `Pagamento recebido`, payment.transactionReference, now, now);
      this.recalculateClientCharge(charge.id);
    });
    trx();
    return this.getClientCharge(charge.id);
  }

  cancelClientCharge(id: string, reason: string): ClientChargeDetail {
    if (!reason.trim()) throw new Error("Motivo obrigatorio.");
    const detail = this.getClientCharge(id);
    if (detail.charge.status === "PAID" || detail.charge.paidAmountCents > 0) throw new Error("Cobranca com pagamento nao pode ser cancelada diretamente.");
    const now = new Date().toISOString();
    const trx = this.db.transaction(() => {
      this.db.prepare("UPDATE client_charges SET status = 'CANCELLED', cancelled_at = ?, cancellation_reason = ?, updated_at = ? WHERE id = ?").run(now, reason, now, id);
      this.db.prepare("UPDATE operations SET billing_status = 'UNBILLED', client_charge_id = NULL, updated_at = ? WHERE client_charge_id = ?").run(now, id);
      this.db.prepare("UPDATE client_charge_operations SET released_at = ? WHERE client_charge_id = ? AND released_at IS NULL").run(now, id);
      this.db.prepare("UPDATE client_credit_allocations SET cancelled_at = ?, cancellation_reason = ? WHERE client_charge_id = ? AND cancelled_at IS NULL").run(now, reason, id);
      detail.creditAllocations.forEach((allocation) => this.db.prepare("UPDATE client_ledger_entries SET available_amount_cents = available_amount_cents + ?, updated_at = ? WHERE id = ?").run(allocation.amountCents, now, allocation.ledgerEntryId));
      this.recordChargeStatus(id, detail.charge.status, "CANCELLED", reason);
    });
    trx();
    return this.getClientCharge(id);
  }

  listClientCharges(filters: { organizationId?: string; clientPartnerId?: string; status?: string } = {}): ClientCharge[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filters.organizationId) { this.assertOrganizationWritable(filters.organizationId); clauses.push("organization_id = ?"); params.push(filters.organizationId); }
    if (filters.clientPartnerId) { clauses.push("client_partner_id = ?"); params.push(filters.clientPartnerId); }
    if (filters.status && filters.status !== "all") { clauses.push("status = ?"); params.push(filters.status); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return (this.db.prepare(`SELECT * FROM client_charges ${where} ORDER BY created_at DESC`).all(...params) as DbRecord[]).map((row) => this.refreshChargeComputedStatus(mapClientCharge(row)));
  }

  getClientCharge(id: string): ClientChargeDetail {
    const row = this.db.prepare("SELECT * FROM client_charges WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Cobranca nao encontrada.");
    const charge = this.refreshChargeComputedStatus(mapClientCharge(row));
    this.assertOrganizationWritable(charge.organizationId);
    return {
      charge,
      operations: (this.db.prepare("SELECT * FROM client_charge_operations WHERE client_charge_id = ? AND released_at IS NULL ORDER BY operation_date_snapshot").all(id) as DbRecord[]).map(mapClientChargeOperation),
      adjustments: (this.db.prepare("SELECT * FROM client_charge_adjustments WHERE client_charge_id = ? ORDER BY sort_order, created_at").all(id) as DbRecord[]).map(mapClientChargeAdjustment),
      creditAllocations: (this.db.prepare("SELECT * FROM client_credit_allocations WHERE client_charge_id = ? AND cancelled_at IS NULL").all(id) as DbRecord[]).map(mapClientCreditAllocation),
      payments: (this.db.prepare("SELECT * FROM client_payment_allocations WHERE client_charge_id = ? AND cancelled_at IS NULL").all(id) as DbRecord[]).map(mapClientPaymentAllocation),
      documents: (this.db.prepare("SELECT * FROM charge_document_versions WHERE client_charge_id = ? ORDER BY version").all(id) as DbRecord[]).map(mapChargeDocumentVersion)
    };
  }

  listLedgerEntries(filters: { organizationId: string; ownLegalEntityId?: string; clientPartnerId?: string }): ClientLedgerEntry[] {
    this.assertOrganizationWritable(filters.organizationId);
    const clauses = ["organization_id = ?"];
    const params: unknown[] = [filters.organizationId];
    if (filters.ownLegalEntityId) { clauses.push("own_legal_entity_id = ?"); params.push(filters.ownLegalEntityId); }
    if (filters.clientPartnerId) { clauses.push("client_partner_id = ?"); params.push(filters.clientPartnerId); }
    return (this.db.prepare(`SELECT * FROM client_ledger_entries WHERE ${clauses.join(" AND ")} ORDER BY entry_date DESC, created_at DESC`).all(...params) as DbRecord[]).map(mapClientLedgerEntry);
  }

  getBillingSummary(organizationId: string): BillingSummary {
    this.assertOrganizationWritable(organizationId);
    const charges = (this.db.prepare("SELECT * FROM client_charges WHERE organization_id = ? AND status != 'CANCELLED'").all(organizationId) as DbRecord[]).map(mapClientCharge);
    const credits = this.db.prepare("SELECT COALESCE(SUM(available_amount_cents), 0) AS total FROM client_ledger_entries WHERE organization_id = ? AND status = 'CONFIRMED'").get(organizationId) as { total: number };
    const unbilled = (this.db.prepare("SELECT COUNT(*) AS total FROM operations WHERE organization_id = ? AND status = 'CONFIRMED' AND billing_status = 'UNBILLED'").get(organizationId) as { total: number }).total;
    return {
      issuedCents: charges.reduce((sum, item) => sum + item.finalAmountCents, 0),
      receivedCents: charges.reduce((sum, item) => sum + item.paidAmountCents, 0),
      openCents: charges.reduce((sum, item) => sum + item.openAmountCents, 0),
      overdueCents: charges.filter((item) => item.status === "OVERDUE").reduce((sum, item) => sum + item.openAmountCents, 0),
      availableCreditsCents: Number(credits.total),
      unbilledOperations: Number(unbilled),
      unbilledSacks: "0",
      billedSacks: "0"
    };
  }

  getInstallationProfile(): InstallationProfile | null {
    const row = this.db.prepare("SELECT * FROM installation_profiles ORDER BY created_at DESC LIMIT 1").get() as
      | Record<string, unknown>
      | undefined;
    return row ? mapInstallationProfile(row) : null;
  }

  saveInstallationProfile(input: unknown): InstallationProfile {
    const profile = saveInstallationProfileSchema.parse(input);
    this.validateProfileInput(profile);
    const now = new Date().toISOString();
    const existing = this.getInstallationProfile();
    const id = existing?.id ?? randomUUID();
    if (existing) {
      this.db
        .prepare(
          `UPDATE installation_profiles
           SET installation_name = @installationName,
               app_variant = @appVariant,
               default_organization_id = @defaultOrganizationId,
               default_legal_entity_id = @defaultLegalEntityId,
               allow_organization_switch = @allowOrganizationSwitch,
               allow_legal_entity_switch = @allowLegalEntitySwitch,
               completed_setup = @completedSetup,
               updated_at = @updatedAt
           WHERE id = @id`
        )
        .run({
          id,
          installationName: profile.installationName,
          appVariant: profile.appVariant,
          defaultOrganizationId: profile.defaultOrganizationId,
          defaultLegalEntityId: profile.defaultLegalEntityId,
          allowOrganizationSwitch: profile.allowOrganizationSwitch ? 1 : 0,
          allowLegalEntitySwitch: profile.allowLegalEntitySwitch ? 1 : 0,
          completedSetup: profile.completedSetup ? 1 : 0,
          updatedAt: now
        });
    } else {
      this.db
        .prepare(
          `INSERT INTO installation_profiles (
            id, installation_name, app_variant, default_organization_id, default_legal_entity_id,
            allow_organization_switch, allow_legal_entity_switch, completed_setup, created_at, updated_at
          ) VALUES (@id, @installationName, @appVariant, @defaultOrganizationId, @defaultLegalEntityId,
            @allowOrganizationSwitch, @allowLegalEntitySwitch, @completedSetup, @createdAt, @updatedAt)`
        )
        .run({
          id,
          installationName: profile.installationName,
          appVariant: profile.appVariant,
          defaultOrganizationId: profile.defaultOrganizationId,
          defaultLegalEntityId: profile.defaultLegalEntityId,
          allowOrganizationSwitch: profile.allowOrganizationSwitch ? 1 : 0,
          allowLegalEntitySwitch: profile.allowLegalEntitySwitch ? 1 : 0,
          completedSetup: profile.completedSetup ? 1 : 0,
          createdAt: now,
          updatedAt: now
        });
    }
    const saved = this.getInstallationProfile();
    if (!saved) {
      throw new Error("Falha ao salvar o perfil de instalacao.");
    }
    return saved;
  }

  setActiveLegalEntity(legalEntityId: string): InstallationProfile {
    const existing = this.getInstallationProfile();
    if (!existing) {
      throw new Error("Perfil de instalacao nao configurado.");
    }
    return this.saveInstallationProfile({
      ...existing,
      defaultLegalEntityId: legalEntityId
    });
  }

  setActiveOrganization(organizationId: string): InstallationProfile {
    const existing = this.getInstallationProfile();
    if (!existing) {
      throw new Error("Perfil de instalacao nao configurado.");
    }
    if (!existing.allowOrganizationSwitch || existing.appVariant !== "multiempresa") {
      throw new Error("Esta instalacao nao permite trocar organizacao.");
    }
    const organization = this.getOrganization(organizationId);
    if (!organization.isActive) {
      throw new Error("Organizacao inativa nao pode ser selecionada.");
    }
    const firstEntity = this.listLegalEntities({ organizationId, status: "active" })[0];
    return this.updateInstallationProfile({
      ...existing,
      defaultOrganizationId: organizationId,
      defaultLegalEntityId: firstEntity?.id ?? null
    });
  }

  updateInstallationProfile(input: unknown): InstallationProfile {
    const data = updateInstallationProfileSchema.parse(input);
    const existing = this.getInstallationProfile();
    if (existing && existing.appVariant !== data.appVariant && !data.confirmVariantChange) {
      throw new Error("Alteracao de variante exige confirmacao explicita.");
    }
    this.validateProfileInput(data);
    return this.saveInstallationProfile(data);
  }

  getActiveContext(): ActiveContext {
    const profile = this.getInstallationProfile();
    if (!profile?.defaultOrganizationId) {
      return { organizationId: null, legalEntityId: null, appVariant: profile?.appVariant ?? null, branding: null };
    }
    const organization = this.getOrganization(profile.defaultOrganizationId);
    return {
      organizationId: organization.id,
      legalEntityId: profile.defaultLegalEntityId,
      appVariant: profile.appVariant,
      branding: {
        appDisplayName: organization.appDisplayName,
        logoPath: organization.logoPath,
        compactLogoPath: organization.compactLogoPath,
        iconPath: organization.iconPath,
        primaryColor: organization.primaryColor,
        secondaryColor: organization.secondaryColor,
        accentColor: organization.accentColor,
        themeMode: organization.themeMode
      }
    };
  }

  private processXmlImportFile(job: XmlImportJob, file: XmlImportFile, resolution: Record<string, unknown>): void {
    if (!file.extractedDataJson) throw new Error("Arquivo XML sem dados extraidos.");
    const extracted = JSON.parse(file.extractedDataJson) as Record<string, unknown>;
    if (file.xmlType.startsWith("EVENT_")) {
      this.importFiscalEvent(job, file, extracted);
      return;
    }
    if (file.xmlType === "UNKNOWN") throw new Error("XML nao reconhecido como NF-e.");
    if (file.accessKey) {
      const existing = this.db.prepare("SELECT id FROM fiscal_documents WHERE access_key = ?").get(file.accessKey) as { id: string } | undefined;
      if (existing) {
        this.mergeXmlIntoExisting(file.id, "Preencher XML em nota existente sem sobrescrever campos internos.");
        return;
      }
    }
    const own = this.resolveOwnLegalEntityForXml(job.organizationId, extracted, resolution);
    const clientPartnerId = typeof resolution.clientPartnerId === "string" ? resolution.clientPartnerId : null;
    const operationScope = resolution.operationScope === "INTERNAL" || resolution.operationScope === "EXTERNAL" ? resolution.operationScope : null;
    const createOperations = resolution.createOperations !== false;
    const operationType = resolution.operationType === "PURCHASE" || resolution.operationType === "SALE" ? resolution.operationType : own.operationType;
    const pending: string[] = [];
    if (!clientPartnerId) pending.push("Cliente responsavel nao definido.");
    if (!operationScope) pending.push("Classificacao interna/externa nao definida.");
    if (!own.ownLegalEntityId) pending.push("CNPJ proprio nao identificado.");
    const responsiblePartnerId = clientPartnerId ?? this.firstClientPartner(job.organizationId);
    if (!responsiblePartnerId) throw new Error("Nenhum cliente responsavel disponivel para criar a nota.");
    if (!own.ownLegalEntityId) throw new Error("CNPJ proprio nao identificado.");
    const totals = extracted.totals as Record<string, unknown> | undefined;
    const doc = this.createFiscalDocument({
      organizationId: job.organizationId,
      ownLegalEntityId: own.ownLegalEntityId,
      responsiblePartnerId,
      partnerLegalEntityId: null,
      accessKey: file.accessKey,
      documentNumber: String(extracted.number ?? ""),
      series: extracted.series ? String(extracted.series) : null,
      issueDate: String(extracted.issuedAt ?? new Date().toISOString().slice(0, 10)),
      totalAmountCents: Number(totals?.invoiceAmountCents ?? 0),
      hasPendingIssues: pending.length > 0,
      pendingNotes: pending.length ? pending.join(" ") : null,
      notes: String(extracted.nature ?? "")
    });
    const protocol = extracted.protocol as Record<string, unknown> | undefined;
    this.db.prepare(`UPDATE fiscal_documents SET source = 'XML', xml_file_path = ?, xml_file_hash = ?, protocol_number = ?, protocol_date = ?, authorization_status_code = ?, authorization_status_message = ?, xml_import_job_id = ?, direction = ?, fiscal_snapshot_json = ?, updated_at = ? WHERE id = ?`)
      .run(file.storedFilePath, file.fileHash, protocol?.number ?? null, protocol?.receivedAt ?? null, protocol?.statusCode ?? null, protocol?.statusMessage ?? null, job.id, own.direction, file.extractedDataJson, new Date().toISOString(), doc.document.id);
    let createdOperations = 0;
    const items = Array.isArray(extracted.items) ? extracted.items as Array<Record<string, unknown>> : [];
    items.forEach((xmlItem) => {
      const productAlias = this.resolveProductAlias(job.organizationId, {
        sourceProductCode: this.stringOrNull(xmlItem.productCode),
        sourceDescription: String(xmlItem.description ?? ""),
        ncm: this.stringOrNull(xmlItem.ncm)
      });
      const productId = typeof resolution.productId === "string" ? resolution.productId : productAlias?.productId ?? null;
      const product = productId ? this.getProduct(productId) : null;
      const sacks = this.resolveSacksForXmlItem(xmlItem, product, resolution);
      const item = this.addFiscalDocumentItem({
        fiscalDocumentId: doc.document.id,
        productId,
        description: String(xmlItem.description ?? "Item XML"),
        quantity: String(xmlItem.commercialQuantity ?? "0"),
        unit: this.mapXmlUnit(String(xmlItem.commercialUnit ?? "")),
        unitPriceDecimal: String(xmlItem.commercialUnitValue ?? "0"),
        totalAmountCents: Number(xmlItem.totalAmountCents ?? 0),
        sacksQuantity: sacks
      });
      if (createOperations && clientPartnerId && operationScope && productId && sacks) {
        const operation = this.addOperation({
          fiscalDocumentId: doc.document.id,
          fiscalDocumentItemId: item.id,
          ownLegalEntityId: own.ownLegalEntityId as string,
          responsiblePartnerId: clientPartnerId,
          productId,
          operationType,
          operationScope,
          operationDate: doc.document.issueDate,
          quantitySacks: sacks,
          manualRateValueCents: typeof resolution.manualRateValueCents === "number" ? resolution.manualRateValueCents : null,
          manualOverrideReason: typeof resolution.manualOverrideReason === "string" ? resolution.manualOverrideReason : null,
          notes: "Operacao criada a partir de XML"
        });
        this.db.prepare("UPDATE operations SET source = 'XML', xml_import_job_id = ?, classification_rule_id = ? WHERE id = ?").run(job.id, resolution.classificationRuleId ?? null, operation.id);
        createdOperations += 1;
      }
    });
    this.linkPendingFiscalDocumentEvents(file.accessKey ?? "");
    this.db.prepare("UPDATE xml_import_files SET status = 'IMPORTED', fiscal_document_id = ?, updated_at = ? WHERE id = ?").run(doc.document.id, new Date().toISOString(), file.id);
    this.db.prepare("UPDATE xml_import_jobs SET imported_notes = imported_notes + 1, created_operations = created_operations + ? WHERE id = ?").run(createdOperations, job.id);
  }

  private importFiscalEvent(job: XmlImportJob, file: XmlImportFile, extracted: Record<string, unknown>): void {
    if (!file.accessKey) throw new Error("Evento fiscal sem chave de acesso.");
    const eventType = file.xmlType === "EVENT_CANCELLATION" ? "CANCELLATION" : file.xmlType === "EVENT_CORRECTION_LETTER" ? "CORRECTION_LETTER" : "OTHER";
    const document = this.db.prepare("SELECT id FROM fiscal_documents WHERE access_key = ?").get(file.accessKey) as { id: string } | undefined;
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO fiscal_document_events (
      id, organization_id, fiscal_document_id, access_key, event_type, sequence_number, event_date, protocol_number,
      status_code, status_message, correction_text, xml_file_path, file_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, job.organizationId, document?.id ?? null, file.accessKey, eventType, String(extracted.sequenceNumber ?? "1"), extracted.eventDate ?? null, extracted.protocolNumber ?? null, extracted.statusCode ?? null, extracted.statusMessage ?? null, extracted.correctionText ?? null, file.storedFilePath, file.fileHash, now);
    if (eventType === "CANCELLATION" && document?.id) {
      this.cancelFiscalDocument(document.id, `Cancelamento XML protocolo ${String(extracted.protocolNumber ?? "")}`.trim());
    }
    this.db.prepare("UPDATE xml_import_files SET status = 'IMPORTED', fiscal_document_event_id = ?, fiscal_document_id = ?, updated_at = ? WHERE id = ?").run(id, document?.id ?? null, now, file.id);
    this.db.prepare("UPDATE xml_import_jobs SET imported_events = imported_events + 1 WHERE id = ?").run(job.id);
  }

  private resolveOwnLegalEntityForXml(organizationId: string, extracted: Record<string, unknown>, resolution: Record<string, unknown>): { ownLegalEntityId: string | null; direction: "INBOUND" | "OUTBOUND" | "UNKNOWN"; operationType: "PURCHASE" | "SALE" } {
    if (typeof resolution.ownLegalEntityId === "string") return { ownLegalEntityId: resolution.ownLegalEntityId, direction: "UNKNOWN", operationType: "SALE" };
    const issuerDoc = this.onlyDigits(String((extracted.issuer as Record<string, unknown> | undefined)?.cnpjCpf ?? ""));
    const recipientDoc = this.onlyDigits(String((extracted.recipient as Record<string, unknown> | undefined)?.cnpjCpf ?? ""));
    const allEntities = this.listLegalEntities({ status: "all" });
    const issuerOwn = allEntities.find((entity) => entity.organizationId === organizationId && entity.cnpj === issuerDoc);
    const recipientOwn = allEntities.find((entity) => entity.organizationId === organizationId && entity.cnpj === recipientDoc);
    const otherOrg = allEntities.find((entity) => entity.organizationId !== organizationId && (entity.cnpj === issuerDoc || entity.cnpj === recipientDoc));
    if (otherOrg) throw new Error("XML pertence a CNPJ de outra organizacao.");
    if (issuerOwn && !issuerOwn.isActive) throw new Error("CNPJ proprio emitente esta inativo.");
    if (recipientOwn && !recipientOwn.isActive) throw new Error("CNPJ proprio destinatario esta inativo.");
    if (issuerOwn) return { ownLegalEntityId: issuerOwn.id, direction: "OUTBOUND", operationType: "SALE" };
    if (recipientOwn) return { ownLegalEntityId: recipientOwn.id, direction: "INBOUND", operationType: "PURCHASE" };
    return { ownLegalEntityId: null, direction: "UNKNOWN", operationType: "SALE" };
  }

  private resolveSacksForXmlItem(xmlItem: Record<string, unknown>, product: Product | null, resolution: Record<string, unknown>): string | null {
    if (typeof resolution.manualSacks === "string" && resolution.manualSacks) return normalizeDecimalText(resolution.manualSacks);
    const unit = String(xmlItem.commercialUnit ?? "").trim().toUpperCase();
    const quantity = String(xmlItem.commercialQuantity ?? "");
    if (!quantity) return null;
    if (["SC", "SACA", "SACAS", "SAC"].includes(unit)) return normalizeDecimalText(quantity);
    if (unit === "KG" && product?.defaultSackWeightKg) return divideDecimalText(quantity, String(product.defaultSackWeightKg));
    if (unit === "TON" && product?.defaultSackWeightKg) return divideDecimalText(normalizeDecimalText(`${quantity}000`), String(product.defaultSackWeightKg));
    return null;
  }

  private mapXmlUnit(unit: string): "SACK" | "KG" | "TON" | "UNIT" {
    const normalized = unit.trim().toUpperCase();
    if (["SC", "SACA", "SACAS", "SAC"].includes(normalized)) return "SACK";
    if (normalized === "KG") return "KG";
    if (["TON", "T"].includes(normalized)) return "TON";
    return "UNIT";
  }

  private firstClientPartner(organizationId: string): string | null {
    return this.listBusinessPartners({ organizationId, role: "CLIENT", status: "active" })[0]?.id ?? null;
  }

  private getXmlImportFile(id: string): XmlImportFile {
    const row = this.db.prepare("SELECT * FROM xml_import_files WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Arquivo de importacao XML nao encontrado.");
    const file = mapXmlImportFile(row);
    this.getXmlImportJob(file.importJobId);
    return file;
  }

  private getProductAlias(id: string): ProductAlias {
    const row = this.db.prepare("SELECT * FROM product_aliases WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Alias de produto nao encontrado.");
    return mapProductAlias(row);
  }

  private setProductAliasActive(id: string, active: boolean): ProductAlias {
    const alias = this.getProductAlias(id);
    this.assertOrganizationWritable(alias.organizationId);
    this.db.prepare("UPDATE product_aliases SET is_active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, new Date().toISOString(), id);
    return this.getProductAlias(id);
  }

  private getOperationClassificationRule(id: string): OperationClassificationRule {
    const row = this.db.prepare("SELECT * FROM operation_classification_rules WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Regra de classificacao nao encontrada.");
    return mapOperationClassificationRule(row);
  }

  private setOperationClassificationRuleActive(id: string, active: boolean): OperationClassificationRule {
    const rule = this.getOperationClassificationRule(id);
    this.assertOrganizationWritable(rule.organizationId);
    this.db.prepare("UPDATE operation_classification_rules SET is_active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, new Date().toISOString(), id);
    return this.getOperationClassificationRule(id);
  }

  private recountXmlImportJob(id: string): void {
    const rows = (this.db.prepare("SELECT status FROM xml_import_files WHERE import_job_id = ?").all(id) as Array<{ status: string }>).map((row) => row.status);
    const count = (status: string) => rows.filter((row) => row === status).length;
    const importedNotes = (this.db.prepare("SELECT COUNT(*) AS total FROM xml_import_files WHERE import_job_id = ? AND fiscal_document_id IS NOT NULL AND status = 'IMPORTED'").get(id) as { total: number }).total;
    const importedEvents = (this.db.prepare("SELECT COUNT(*) AS total FROM xml_import_files WHERE import_job_id = ? AND fiscal_document_event_id IS NOT NULL AND status = 'IMPORTED'").get(id) as { total: number }).total;
    const createdOperations = (this.db.prepare("SELECT COUNT(*) AS total FROM operations WHERE xml_import_job_id = ?").get(id) as { total: number }).total;
    this.db.prepare("UPDATE xml_import_jobs SET total_files = ?, valid_files = ?, warning_files = ?, duplicate_files = ?, error_files = ?, imported_notes = ?, imported_events = ?, created_operations = ? WHERE id = ?")
      .run(rows.length, count("VALID"), count("WARNING") + count("PENDING_REVIEW"), count("DUPLICATE"), count("ERROR"), importedNotes, importedEvents, createdOperations, id);
  }

  private tableExists(name: string): boolean {
    return Boolean(this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
  }

  private onlyDigits(value: string): string {
    return value.replace(/\D/g, "");
  }

  private stringOrNull(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private reserveOperationsForCharge(clientChargeId: string, operationIds: string[]): void {
    const charge = this.getClientCharge(clientChargeId).charge;
    const now = new Date().toISOString();
    operationIds.forEach((operationId) => {
      const operation = this.getOperation(operationId);
      if (operation.organizationId !== charge.organizationId || operation.ownLegalEntityId !== charge.ownLegalEntityId || operation.responsiblePartnerId !== charge.clientPartnerId) throw new Error("Operacao fora do escopo da cobranca.");
      if (operation.status !== "CONFIRMED") throw new Error("Somente operacoes confirmadas entram em cobranca.");
      if (operation.billingStatus !== "UNBILLED" && operation.clientChargeId !== charge.id) throw new Error("Operacao ja reservada ou cobrada.");
      const doc = this.getFiscalDocument(operation.fiscalDocumentId).document;
      const product = operation.productId ? this.getProduct(operation.productId) : null;
      this.db.prepare(`INSERT INTO client_charge_operations (
        id, client_charge_id, operation_id, operation_date_snapshot, fiscal_document_number_snapshot,
        fiscal_document_series_snapshot, product_name_snapshot, operation_scope_snapshot, quantity_sacks_decimal_snapshot,
        service_rate_cents_snapshot, service_amount_cents_snapshot, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(randomUUID(), charge.id, operation.id, operation.operationDate, doc.documentNumber, doc.series, product?.name ?? null, operation.operationScope, operation.quantitySacks, operation.appliedRateValueCents, operation.serviceAmountCents, now);
      this.db.prepare("UPDATE operations SET billing_status = 'RESERVED', client_charge_id = ?, updated_at = ? WHERE id = ?").run(charge.id, now, operation.id);
    });
  }

  private recalculateClientCharge(id: string): void {
    const operations = (this.db.prepare("SELECT * FROM client_charge_operations WHERE client_charge_id = ? AND released_at IS NULL").all(id) as DbRecord[]).map(mapClientChargeOperation);
    const adjustments = (this.db.prepare("SELECT * FROM client_charge_adjustments WHERE client_charge_id = ?").all(id) as DbRecord[]).map(mapClientChargeAdjustment);
    const payments = (this.db.prepare("SELECT * FROM client_payment_allocations WHERE client_charge_id = ? AND cancelled_at IS NULL").all(id) as DbRecord[]).map(mapClientPaymentAllocation);
    const subtotal = operations.reduce((sum, item) => sum + item.serviceAmountCentsSnapshot, 0);
    const additions = adjustments.filter((item) => item.effect === "INCREASE_RECEIVABLE").reduce((sum, item) => sum + item.amountCents, 0);
    const deductions = adjustments.filter((item) => item.effect === "REDUCE_RECEIVABLE").reduce((sum, item) => sum + item.amountCents, 0);
    const finalAmount = Math.max(0, subtotal + additions - deductions);
    const paid = payments.reduce((sum, item) => sum + item.amountCents, 0);
    const open = Math.max(0, finalAmount - paid);
    const current = mapClientCharge(this.db.prepare("SELECT * FROM client_charges WHERE id = ?").get(id) as DbRecord);
    let status = current.status;
    if (!["DRAFT", "PENDING_REVIEW", "CANCELLED", "REPLACED"].includes(status)) {
      status = open === 0 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "ISSUED";
      if (status === "ISSUED" && current.dueDate && current.dueDate < new Date().toISOString().slice(0, 10)) status = "OVERDUE";
    }
    this.db.prepare("UPDATE client_charges SET subtotal_services_cents = ?, additions_cents = ?, deductions_cents = ?, final_amount_cents = ?, paid_amount_cents = ?, open_amount_cents = ?, status = ?, updated_at = ? WHERE id = ?")
      .run(subtotal, additions, deductions, finalAmount, paid, open, status, new Date().toISOString(), id);
  }

  private reserveNextChargeNumber(organizationId: string, ownLegalEntityId: string, yearText: string): string {
    const year = Number(yearText);
    const now = new Date().toISOString();
    let row = this.db.prepare("SELECT * FROM document_sequences WHERE organization_id = ? AND own_legal_entity_id = ? AND document_type = 'CLIENT_CHARGE' AND year = ? AND is_active = 1").get(organizationId, ownLegalEntityId, year) as DbRecord | undefined;
    if (!row) {
      this.db.prepare("INSERT INTO document_sequences (id, organization_id, own_legal_entity_id, document_type, year, prefix, current_number, padding, is_active, created_at, updated_at) VALUES (?, ?, ?, 'CLIENT_CHARGE', ?, ?, 0, 4, 1, ?, ?)")
        .run(randomUUID(), organizationId, ownLegalEntityId, year, `COB-${year}-`, now, now);
      row = this.db.prepare("SELECT * FROM document_sequences WHERE organization_id = ? AND own_legal_entity_id = ? AND document_type = 'CLIENT_CHARGE' AND year = ? AND is_active = 1").get(organizationId, ownLegalEntityId, year) as DbRecord;
    }
    const next = Number(row.current_number) + 1;
    this.db.prepare("UPDATE document_sequences SET current_number = ?, updated_at = ? WHERE id = ?").run(next, now, row.id);
    return `${String(row.prefix ?? "")}${String(next).padStart(Number(row.padding), "0")}`;
  }

  private buildChargeSnapshot(id: string): Record<string, unknown> {
    const detail = this.getClientCharge(id);
    return {
      charge: detail.charge,
      operations: detail.operations,
      adjustments: detail.adjustments,
      organization: this.getOrganization(detail.charge.organizationId),
      ownLegalEntity: this.getLegalEntity(detail.charge.ownLegalEntityId),
      client: this.getBusinessPartner(detail.charge.clientPartnerId)
    };
  }

  private updateChargeStatus(id: string, nextStatus: ClientCharge["status"], reason: string): void {
    const current = this.getClientCharge(id).charge;
    this.db.prepare("UPDATE client_charges SET status = ?, updated_at = ? WHERE id = ?").run(nextStatus, new Date().toISOString(), id);
    this.recordChargeStatus(id, current.status, nextStatus, reason);
  }

  private recordChargeStatus(id: string, previous: string | null, next: string, reason: string): void {
    this.db.prepare("INSERT INTO charge_status_history (id, client_charge_id, previous_status, next_status, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), id, previous, next, reason, new Date().toISOString());
  }

  private refreshChargeComputedStatus(charge: ClientCharge): ClientCharge {
    if (charge.status === "ISSUED" && charge.openAmountCents > 0 && charge.dueDate && charge.dueDate < new Date().toISOString().slice(0, 10)) {
      this.db.prepare("UPDATE client_charges SET status = 'OVERDUE', updated_at = ? WHERE id = ?").run(new Date().toISOString(), charge.id);
      return { ...charge, status: "OVERDUE" };
    }
    return charge;
  }

  private getLedgerEntry(id: string): ClientLedgerEntry {
    const row = this.db.prepare("SELECT * FROM client_ledger_entries WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Lancamento nao encontrado.");
    return mapClientLedgerEntry(row);
  }

  private getClientPayment(id: string): ClientPayment {
    const row = this.db.prepare("SELECT * FROM client_payments WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Pagamento nao encontrado.");
    return mapClientPayment(row);
  }

  private sumPaymentAllocated(paymentId: string): number {
    const row = this.db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM client_payment_allocations WHERE client_payment_id = ? AND cancelled_at IS NULL").get(paymentId) as { total: number };
    return Number(row.total);
  }

  private assertSameChargeScope(charge: ClientCharge, entry: ClientLedgerEntry): void {
    if (charge.organizationId !== entry.organizationId || charge.ownLegalEntityId !== entry.ownLegalEntityId || charge.clientPartnerId !== entry.clientPartnerId) throw new Error("Lancamento fora do escopo da cobranca.");
  }

  private assertSamePaymentScope(charge: ClientCharge, payment: ClientPayment): void {
    if (charge.organizationId !== payment.organizationId || charge.ownLegalEntityId !== payment.ownLegalEntityId || charge.clientPartnerId !== payment.clientPartnerId) throw new Error("Pagamento fora do escopo da cobranca.");
  }

  private matchesStatus(isActive: boolean, status: "active" | "inactive" | "all" = "all"): boolean {
    return status === "all" || (status === "active" ? isActive : !isActive);
  }

  private matchesSearch(values: string[], search?: string): boolean {
    if (!search?.trim()) {
      return true;
    }
    const needle = search.trim().toLowerCase();
    return values.some((value) => value.toLowerCase().includes(needle));
  }

  private assertUniqueSlug(slug: string, exceptId?: string): void {
    const row = this.db.prepare("SELECT id FROM organizations WHERE slug = ?").get(slug) as { id: string } | undefined;
    if (row && row.id !== exceptId) {
      throw new Error("Slug ja cadastrado.");
    }
  }

  private assertUniqueCnpj(cnpj: string | null, exceptId?: string): void {
    if (!cnpj) {
      return;
    }
    const row = this.db.prepare("SELECT id FROM legal_entities WHERE cnpj = ?").get(cnpj) as { id: string } | undefined;
    if (row && row.id !== exceptId) {
      throw new Error("CNPJ ja cadastrado.");
    }
  }

  private getVariantOrganizationSlug(variant: AppVariant): string | null {
    if (variant === "villa") {
      return "villa-coffee";
    }
    if (variant === "grao") {
      return "grao-e-grao";
    }
    return null;
  }

  private isOrganizationAllowed(organizationId: string): boolean {
    const profile = this.getInstallationProfile();
    if (!profile) {
      return true;
    }
    if (profile.appVariant === "multiempresa") {
      return true;
    }
    const row = this.db.prepare("SELECT slug FROM organizations WHERE id = ?").get(organizationId) as { slug: string } | undefined;
    return row?.slug === this.getVariantOrganizationSlug(profile.appVariant);
  }

  private assertOrganizationWritable(organizationId: string): void {
    const organization = this.getOrganization(organizationId);
    if (!organization.isActive) {
      throw new Error("Organizacao inativa nao pode receber novos cadastros.");
    }
  }

  private assertValidLegalEntity(data: ReturnType<typeof legalEntityInputSchema.parse>, exceptId?: string): void {
    this.assertUniqueCnpj(data.cnpj, exceptId);
    if (!data.isDraft && (!data.cnpj || !isValidCnpj(data.cnpj))) {
      throw new Error("CNPJ invalido.");
    }
  }

  private assertValidLocation(data: ReturnType<typeof locationInputSchema.parse>): void {
    this.assertOrganizationWritable(data.organizationId);
    if (data.legalEntityId) {
      const entity = this.getLegalEntity(data.legalEntityId);
      if (entity.organizationId !== data.organizationId) {
        throw new Error("O CNPJ vinculado deve pertencer a mesma organizacao do local.");
      }
    }
  }

  private getPartnerRoles(businessPartnerId: string): BusinessPartnerRole[] {
    return (this.db.prepare("SELECT role FROM business_partner_roles WHERE business_partner_id = ? ORDER BY role").all(businessPartnerId) as Array<{ role: BusinessPartnerRole }>).map((row) => row.role);
  }

  private getPartnerLegalEntity(id: string): BusinessPartnerLegalEntity {
    const row = this.db.prepare("SELECT * FROM partner_legal_entities WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Estabelecimento do parceiro nao encontrado.");
    const entity = mapBusinessPartnerLegalEntity(row);
    this.getBusinessPartner(entity.businessPartnerId);
    return entity;
  }

  private getPartnerContact(id: string): PartnerContact {
    const row = this.db.prepare("SELECT * FROM partner_contacts WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Contato nao encontrado.");
    const contact = mapPartnerContact(row);
    this.getBusinessPartner(contact.businessPartnerId);
    return contact;
  }

  private assertPartnerLegalEntity(data: ReturnType<typeof partnerLegalEntityInputSchema.parse>, exceptId?: string): void {
    this.getBusinessPartner(data.businessPartnerId);
    if (!data.isDraft && (!data.cnpj || !isValidCnpj(data.cnpj))) throw new Error("CNPJ invalido.");
    if (data.cnpj) {
      const row = this.db
        .prepare(
          `SELECT ple.id, bp.display_name AS partnerName
           FROM partner_legal_entities ple
           JOIN business_partners bp ON bp.id = ple.business_partner_id
           WHERE ple.cnpj = ?`
        )
        .get(data.cnpj) as { id: string; partnerName: string } | undefined;
      if (row && row.id !== exceptId) throw new Error(`CNPJ ja cadastrado no parceiro ${row.partnerName}.`);
    }
  }

  private clearPrimaryPartnerLegalEntity(businessPartnerId: string, exceptId?: string): void {
    this.db.prepare("UPDATE partner_legal_entities SET is_primary = 0 WHERE business_partner_id = ? AND id <> ?").run(businessPartnerId, exceptId ?? "");
  }

  private setPartnerLegalEntityActive(id: string, active: boolean): BusinessPartnerLegalEntity {
    this.getPartnerLegalEntity(id);
    this.db.prepare("UPDATE partner_legal_entities SET is_active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, new Date().toISOString(), id);
    return this.getPartnerLegalEntity(id);
  }

  private assertPartnerContact(data: ReturnType<typeof partnerContactInputSchema.parse>): void {
    const partner = this.getBusinessPartner(data.businessPartnerId);
    if (data.partnerLegalEntityId) {
      const entity = this.getPartnerLegalEntity(data.partnerLegalEntityId);
      if (entity.businessPartnerId !== partner.id) throw new Error("Contato vinculado a estabelecimento de outro parceiro.");
    }
  }

  private clearPrimaryContact(businessPartnerId: string, exceptId?: string): void {
    this.db.prepare("UPDATE partner_contacts SET is_primary = 0 WHERE business_partner_id = ? AND id <> ?").run(businessPartnerId, exceptId ?? "");
  }

  private setPartnerContactActive(id: string, active: boolean): PartnerContact {
    this.getPartnerContact(id);
    this.db.prepare("UPDATE partner_contacts SET is_active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, new Date().toISOString(), id);
    return this.getPartnerContact(id);
  }

  private assertUniqueProductCode(organizationId: string, code: string | null, exceptId?: string): void {
    if (!code) return;
    const row = this.db.prepare("SELECT id FROM products WHERE organization_id = ? AND code = ?").get(organizationId, code) as { id: string } | undefined;
    if (row && row.id !== exceptId) throw new Error("Codigo de produto ja cadastrado nesta organizacao.");
  }

  private setProductActive(id: string, active: boolean): Product {
    this.getProduct(id);
    this.db.prepare("UPDATE products SET is_active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, new Date().toISOString(), id);
    return this.getProduct(id);
  }

  private assertClientPartner(businessPartnerId: string, organizationId: string): BusinessPartner {
    const partner = this.getBusinessPartner(businessPartnerId);
    if (partner.organizationId !== organizationId) throw new Error("Parceiro pertence a outra organizacao.");
    if (!partner.roles.includes("CLIENT")) throw new Error("Somente parceiros com papel Cliente podem usar esta configuracao.");
    return partner;
  }

  private setBillingProfileActive(id: string, active: boolean): ClientBillingProfile {
    const row = this.db.prepare("SELECT business_partner_id AS businessPartnerId FROM client_billing_profiles WHERE id = ?").get(id) as { businessPartnerId: string } | undefined;
    if (!row) throw new Error("Perfil de cobranca nao encontrado.");
    this.db.prepare("UPDATE client_billing_profiles SET is_active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, new Date().toISOString(), id);
    const profile = this.getBillingProfile(row.businessPartnerId);
    if (!profile) throw new Error("Perfil de cobranca nao encontrado.");
    return profile;
  }

  private assertServiceRateRule(data: ReturnType<typeof serviceRateRuleInputSchema.parse>, exceptId?: string): void {
    this.assertClientPartner(data.businessPartnerId, data.organizationId);
    if (data.ownLegalEntityId) {
      const own = this.getLegalEntity(data.ownLegalEntityId);
      if (own.organizationId !== data.organizationId) throw new Error("CNPJ proprio pertence a outra organizacao.");
    }
    if (data.productId) {
      const product = this.getProduct(data.productId);
      if (product.organizationId !== data.organizationId) throw new Error("Produto pertence a outra organizacao.");
    }
    const overlaps = this.listServiceRateRules({ businessPartnerId: data.businessPartnerId, organizationId: data.organizationId, status: "active" }).filter((rule) => {
      if (rule.id === exceptId) return false;
      const sameScope =
        rule.ownLegalEntityId === data.ownLegalEntityId &&
        rule.productId === data.productId &&
        rule.operationScope === data.operationScope &&
        rule.rateType === data.rateType;
      if (!sameScope) return false;
      const aEnd = data.effectiveTo ?? "9999-12-31";
      const bEnd = rule.effectiveTo ?? "9999-12-31";
      return data.effectiveFrom <= bEnd && rule.effectiveFrom <= aEnd;
    });
    if (overlaps.length > 0) throw new Error("Ja existe regra ativa conflitante para o mesmo escopo e vigencia.");
  }

  private setServiceRateRuleActive(id: string, active: boolean): ServiceRateRule {
    this.getServiceRateRule(id);
    this.db.prepare("UPDATE service_rate_rules SET is_active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, new Date().toISOString(), id);
    return this.getServiceRateRule(id);
  }

  private getOperation(id: string): Operation {
    const row = this.db.prepare("SELECT * FROM operations WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Operacao nao encontrada.");
    const operation = mapOperation(row);
    if (!this.isOrganizationAllowed(operation.organizationId)) throw new Error("Operacao nao autorizada.");
    return operation;
  }

  private getSpreadsheetMappingTemplate(id: string): SpreadsheetMappingTemplate {
    const row = this.db.prepare("SELECT * FROM spreadsheet_mapping_templates WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Modelo de mapeamento nao encontrado.");
    const template = mapSpreadsheetMappingTemplate(row);
    if (!this.isOrganizationAllowed(template.organizationId)) throw new Error("Modelo nao autorizado.");
    return template;
  }

  private setSpreadsheetMappingTemplateActive(id: string, active: boolean): SpreadsheetMappingTemplate {
    this.getSpreadsheetMappingTemplate(id);
    this.db.prepare("UPDATE spreadsheet_mapping_templates SET is_active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, new Date().toISOString(), id);
    return this.getSpreadsheetMappingTemplate(id);
  }

  private recountImportJob(id: string): void {
    const rows = (this.db.prepare("SELECT status FROM spreadsheet_import_rows WHERE import_job_id = ?").all(id) as Array<{ status: string }>).map((row) => row.status);
    const count = (status: string): number => rows.filter((rowStatus) => rowStatus === status).length;
    this.db.prepare("UPDATE spreadsheet_import_jobs SET total_rows = ?, valid_rows = ?, warning_rows = ?, error_rows = ?, imported_rows = ?, duplicate_rows = ? WHERE id = ?")
      .run(rows.length, count("VALID"), count("WARNING"), count("ERROR"), count("IMPORTED"), count("DUPLICATE"), id);
  }

  private normalizeName(value: string): string {
    return value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\p{Letter}\p{Number} ]/gu, " ")
      .replace(/\b(LTDA|ME|EPP|SA|S A)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  private detectPossibleDuplicate(data: ReturnType<typeof fiscalDocumentInputSchema.parse>, exceptId?: string): string | null {
    if (data.accessKey) return null;
    const row = this.db
      .prepare(
        `SELECT id FROM fiscal_documents
         WHERE organization_id = ?
           AND responsible_partner_id = ?
           AND document_number = ?
           AND COALESCE(series, '') = COALESCE(?, '')
           AND issue_date = ?
           AND total_amount_cents = ?
           AND id <> ?
         LIMIT 1`
      )
      .get(data.organizationId, data.responsiblePartnerId, data.documentNumber, data.series, data.issueDate, data.totalAmountCents, exceptId ?? "") as
      | { id: string }
      | undefined;
    return row ? "Possivel duplicidade: mesma organizacao, cliente, numero, serie, data e valor total." : null;
  }

  private validateProfileInput(profile: Omit<InstallationProfile, "id" | "createdAt" | "updatedAt">): void {
    if (profile.defaultOrganizationId) {
      const organization = this.getOrganization(profile.defaultOrganizationId);
      if (!organization.isActive) {
        throw new Error("Organizacao padrao precisa estar ativa.");
      }
      if (profile.appVariant !== "multiempresa" && organization.slug !== this.getVariantOrganizationSlug(profile.appVariant)) {
        throw new Error("Organizacao nao autorizada para a variante.");
      }
    }
    if (profile.defaultLegalEntityId) {
      const entity = this.getLegalEntity(profile.defaultLegalEntityId);
      if (!entity.isActive) {
        throw new Error("CNPJ padrao precisa estar ativo.");
      }
      if (profile.defaultOrganizationId && entity.organizationId !== profile.defaultOrganizationId) {
        throw new Error("CNPJ padrao pertence a outra organizacao.");
      }
    }
  }
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function periodFor(reference: Date, periodicity: string, closingWeekday: number, closingDay: number): { periodStart: string; periodEnd: string; label: string } {
  if (periodicity === "WEEKLY") {
    const end = new Date(reference);
    const diff = (end.getDay() - closingWeekday + 7) % 7;
    end.setDate(end.getDate() - diff);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return { periodStart: isoDate(start), periodEnd: isoDate(end), label: `Semana ${isoDate(start)} a ${isoDate(end)}` };
  }
  if (periodicity === "BIWEEKLY") {
    const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() <= 15 ? 1 : 16);
    const end = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() <= 15 ? 15 : new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate());
    return { periodStart: isoDate(start), periodEnd: isoDate(end), label: `Quinzena ${isoDate(start)} a ${isoDate(end)}` };
  }
  if (periodicity === "QUARTERLY") {
    const quarterStartMonth = Math.floor(reference.getMonth() / 3) * 3;
    const start = new Date(reference.getFullYear(), quarterStartMonth, 1);
    const end = new Date(reference.getFullYear(), quarterStartMonth + 3, 0);
    return { periodStart: isoDate(start), periodEnd: isoDate(end), label: `Trimestre ${isoDate(start)} a ${isoDate(end)}` };
  }
  if (periodicity === "CUSTOM") {
    const start = new Date(reference.getFullYear(), reference.getMonth(), Math.min(closingDay, 28));
    return { periodStart: isoDate(start), periodEnd: isoDate(reference), label: `Personalizado ate ${isoDate(reference)}` };
  }
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { periodStart: isoDate(start), periodEnd: isoDate(end), label: `Mes ${isoDate(start)} a ${isoDate(end)}` };
}
