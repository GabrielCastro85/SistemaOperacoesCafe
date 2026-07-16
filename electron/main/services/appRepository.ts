import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  legalEntityInputSchema,
  locationInputSchema,
  organizationInputSchema,
  saveInstallationProfileSchema,
  updateInstallationProfileSchema
} from "../../../src/shared/schemas/domainSchemas.js";
import type { ActiveContext, AppVariant, BootstrapData, InstallationProfile, LegalEntity, Location, Organization, OrganizationListItem } from "../../../src/shared/types/domain.js";
import { isValidCnpj } from "../../../src/shared/utils/format.js";
import { mapInstallationProfile, mapLegalEntity, mapLocation, mapOrganization } from "../database/mappers.js";

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
