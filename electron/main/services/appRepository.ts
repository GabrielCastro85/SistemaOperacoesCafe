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
  mapServiceRateRule
} from "../database/mappers.js";

type DbRecord = Record<string, unknown>;

export class AppRepository {
  constructor(private readonly db: Database.Database) {}

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
