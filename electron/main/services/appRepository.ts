import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
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
  partnerRateSummaryInputSchema,
  clientChargeDraftInputSchema,
  clientChargeAdjustmentInputSchema,
  clientLedgerEntryInputSchema,
  creditAllocationInputSchema,
  clientPaymentInputSchema,
  paymentAllocationInputSchema,
  expenseCategoryInputSchema,
  costCenterInputSchema,
  financialAccountInputSchema,
  accountPayableInputSchema,
  accountPayableAllocationInputSchema,
  payableRecurringTemplateInputSchema,
  payableInstallmentGroupInputSchema,
  payablePaymentInputSchema,
  payablePaymentAllocationInputSchema,
  addPayableAttachmentInputSchema,
  addPayablePaymentAttachmentInputSchema,
  financialReportInputSchema,
  financialReportFiltersSchema,
  confirmationReportInputSchema,
  dealClauseTemplateInputSchema,
  dealConfirmationClauseInputSchema,
  dealConfirmationDraftInputSchema,
  dealConfirmationItemInputSchema,
  dealConfirmationListFiltersSchema,
  dealConfirmationPartyInputSchema,
  dealConfirmationSignerInputSchema,
  dealConfirmationSourceInputSchema,
  dealConfirmationTemplateInputSchema,
  dealConfirmationUpdateSchema,
  dealPaymentTermInputSchema,
  dealSignatureStatusSchema,
  signedDealDocumentInputSchema,
  saveInstallationProfileSchema,
  updateInstallationProfileSchema
} from "../../../src/shared/schemas/domainSchemas.js";
import type {
  ActiveContext,
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
  FiscalDocumentStatus,
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
  DashboardAlerts,
  PartnerRateSummaryRow,
  ExpenseCategory,
  CostCenter,
  FinancialAccount,
  AccountPayable,
  AccountPayableDetail,
  PayableRecurringTemplate,
  PayableInstallmentGroup,
  PayablePayment,
  PayableDocumentAttachment,
  FinancialReportGeneration,
  FinancialReportPreview,
  FinancialReportFilters,
  FinancialSummary,
  ConfirmationReportGeneration,
  ConfirmationReportFilters,
  DealClauseTemplate,
  DealConfirmation,
  DealConfirmationClause,
  DealConfirmationDetail,
  DealConfirmationDocumentVersion,
  DealConfirmationItem,
  DealConfirmationParty,
  DealConfirmationSigner,
  DealConfirmationStatus,
  DealConfirmationSummary,
  DealConfirmationTemplate,
  DealPaymentTerm,
  DealPartyRole,
  DealPartySnapshot,
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
  mapChargeDocumentVersion,
  mapExpenseCategory,
  mapCostCenter,
  mapFinancialAccount,
  mapAccountPayable,
  mapAccountPayableAllocation,
  mapPayableRecurringTemplate,
  mapPayableInstallmentGroup,
  mapPayablePayment,
  mapPayablePaymentAllocation,
  mapPayableStatusHistory,
  mapPayableDocumentAttachment,
  mapFinancialReportGeneration,
  mapDealClauseTemplate,
  mapDealConfirmation,
  mapDealConfirmationClause,
  mapDealConfirmationDocumentVersion,
  mapDealConfirmationItem,
  mapDealConfirmationParty,
  mapDealConfirmationSigner,
  mapDealConfirmationStatusHistory,
  mapDealConfirmationTemplate,
  mapDealPaymentTerm
} from "../database/mappers.js";
import { decimalTextToScaled, divideDecimalText, multiplyDecimalByCents, multiplyDecimalText, normalizeDecimalText, sumDecimalTexts } from "../../../src/shared/utils/decimal.js";
import { generateChargeDocuments } from "./chargeDocuments.js";
import { generateFinancialReportFile, storePayableAttachment } from "./financialFiles.js";
import { generateDealConfirmationPdf, generateDealConfirmationReportFile, storeSignedDealConfirmationPdf } from "./dealConfirmationFiles.js";
import type { AppDirectories } from "../../../src/shared/types/domain.js";

type DbRecord = Record<string, unknown>;
type DealItemInput = ReturnType<typeof dealConfirmationItemInputSchema.parse> & { totalAmountCents?: number | null };

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
    const data = organizationInputSchema.parse(input);
    this.assertUniqueSlug(data.slug);
    const now = new Date().toISOString();
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO organizations (
          id, name, slug, display_name, app_display_name, description, logo_path, compact_logo_path, icon_path,
          primary_color, secondary_color, accent_color, theme_mode, is_active, created_at, updated_at
        ) VALUES (@id, @name, @slug, @displayName, @appDisplayName, @description, @logoPath, @compactLogoPath, @iconPath,
          @primaryColor, @secondaryColor, @accentColor, @themeMode, @isActive, @createdAt, @updatedAt)`
      )
      .run({ id, ...data, description: data.description ?? null, logoPath: data.logoPath ?? null, compactLogoPath: data.compactLogoPath ?? null, iconPath: data.iconPath ?? null, isActive: data.isActive ? 1 : 0, createdAt: now, updatedAt: now });
    return this.getOrganization(id);
  }

  updateOrganization(id: string, input: unknown): Organization {
    this.getOrganization(id);
    const data = organizationInputSchema.parse(input);
    this.assertUniqueSlug(data.slug, id);
    this.db
      .prepare(
        `UPDATE organizations SET
          name = @name, slug = @slug, display_name = @displayName, app_display_name = @appDisplayName, description = @description,
          logo_path = @logoPath, compact_logo_path = @compactLogoPath, icon_path = @iconPath,
          primary_color = @primaryColor, secondary_color = @secondaryColor, accent_color = @accentColor,
          theme_mode = @themeMode, is_active = @isActive, updated_at = @updatedAt
         WHERE id = @id`
      )
      .run({ id, ...data, description: data.description ?? null, logoPath: data.logoPath ?? null, compactLogoPath: data.compactLogoPath ?? null, iconPath: data.iconPath ?? null, isActive: data.isActive ? 1 : 0, updatedAt: new Date().toISOString() });
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
          postal_code, document_prefix, default_bank_name, default_bank_code, default_bank_agency,
          default_bank_account, default_pix_key, is_draft, is_active, created_at, updated_at
        ) VALUES (@id, @organizationId, @legalName, @tradeName, @cnpj, @stateRegistration, @municipalRegistration,
          @email, @phone, @addressLine, @addressNumber, @addressComplement, @district, @city, @state,
          @postalCode, @documentPrefix, @defaultBankName, @defaultBankCode, @defaultBankAgency,
          @defaultBankAccount, @defaultPixKey, @isDraft, @isActive, @createdAt, @updatedAt)`
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
          default_bank_name = @defaultBankName, default_bank_code = @defaultBankCode, default_bank_agency = @defaultBankAgency,
          default_bank_account = @defaultBankAccount, default_pix_key = @defaultPixKey,
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
      this.db.prepare("INSERT INTO business_partners (id, organization_id, display_name, notes, is_active, credit_limit_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(id, data.organizationId, data.displayName, data.notes, data.isActive ? 1 : 0, data.creditLimitCents ?? null, now, now);
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
      this.db.prepare("UPDATE business_partners SET organization_id = ?, display_name = ?, notes = ?, is_active = ?, credit_limit_cents = ?, updated_at = ? WHERE id = ?")
        .run(data.organizationId, data.displayName, data.notes, data.isActive ? 1 : 0, data.creditLimitCents ?? null, now, id);
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

  deleteBusinessPartner(id: string): void {
    this.getBusinessPartner(id);
    const transaction = this.db.transaction(() => {
      const partnerLegalEntitySubquery = "SELECT id FROM partner_legal_entities WHERE business_partner_id = ?";
      const fiscalDocumentSubquery = `SELECT id FROM fiscal_documents WHERE responsible_partner_id = ? OR partner_legal_entity_id IN (${partnerLegalEntitySubquery})`;
      const operationSubquery = `SELECT id FROM operations WHERE responsible_partner_id = ? OR fiscal_document_id IN (${fiscalDocumentSubquery})`;
      const clientChargeSubquery = "SELECT id FROM client_charges WHERE client_partner_id = ?";
      const clientLedgerSubquery = `SELECT id FROM client_ledger_entries WHERE client_partner_id = ? OR client_charge_id IN (${clientChargeSubquery})`;
      const clientPaymentSubquery = "SELECT id FROM client_payments WHERE client_partner_id = ?";
      const accountPayableSubquery = `SELECT id FROM accounts_payable WHERE supplier_partner_id = ? OR supplier_legal_entity_id IN (${partnerLegalEntitySubquery})`;

      this.db.prepare(`DELETE FROM spreadsheet_import_rows WHERE operation_id IN (${operationSubquery}) OR fiscal_document_id IN (${fiscalDocumentSubquery})`)
        .run(id, id, id, id, id);
      this.db.prepare(`DELETE FROM xml_import_files WHERE fiscal_document_id IN (${fiscalDocumentSubquery}) OR fiscal_document_event_id IN (SELECT id FROM fiscal_document_events WHERE fiscal_document_id IN (${fiscalDocumentSubquery}))`).run(id, id, id, id);
      this.db.prepare(`DELETE FROM deal_confirmation_operations WHERE operation_id IN (${operationSubquery})`).run(id, id, id);
      this.db.prepare(`DELETE FROM deal_confirmation_fiscal_documents WHERE fiscal_document_id IN (${fiscalDocumentSubquery})`).run(id, id);
      this.db.prepare(`DELETE FROM client_charge_operations WHERE operation_id IN (${operationSubquery}) OR client_charge_id IN (${clientChargeSubquery})`).run(id, id, id, id);

      this.db.prepare(`DELETE FROM client_credit_allocations WHERE ledger_entry_id IN (${clientLedgerSubquery}) OR client_charge_id IN (${clientChargeSubquery})`).run(id, id, id);
      this.db.prepare(`DELETE FROM client_payment_allocations WHERE client_payment_id IN (${clientPaymentSubquery}) OR client_charge_id IN (${clientChargeSubquery})`).run(id, id);
      this.db.prepare(`DELETE FROM client_charge_adjustments WHERE client_charge_id IN (${clientChargeSubquery}) OR ledger_entry_id IN (${clientLedgerSubquery})`).run(id, id, id);
      this.db.prepare(`DELETE FROM charge_document_versions WHERE client_charge_id IN (${clientChargeSubquery})`).run(id);
      this.db.prepare(`DELETE FROM charge_status_history WHERE client_charge_id IN (${clientChargeSubquery})`).run(id);
      this.db.prepare(`UPDATE operations SET client_charge_id = NULL, billing_status = 'UNBILLED' WHERE client_charge_id IN (${clientChargeSubquery})`).run(id);
      this.db.prepare(`DELETE FROM client_ledger_entries WHERE id IN (${clientLedgerSubquery})`).run(id, id);
      this.db.prepare(`DELETE FROM client_payments WHERE id IN (${clientPaymentSubquery})`).run(id);
      this.db.prepare(`DELETE FROM client_charges WHERE id IN (${clientChargeSubquery})`).run(id);

      this.db.prepare(`DELETE FROM payable_payment_allocations WHERE account_payable_id IN (${accountPayableSubquery})`).run(id, id);
      this.db.prepare(`DELETE FROM account_payable_allocations WHERE account_payable_id IN (${accountPayableSubquery})`).run(id, id);
      this.db.prepare(`DELETE FROM payable_status_history WHERE account_payable_id IN (${accountPayableSubquery})`).run(id, id);
      this.db.prepare(`DELETE FROM payable_document_attachments WHERE account_payable_id IN (${accountPayableSubquery})`).run(id, id);
      this.db.prepare(`DELETE FROM accounts_payable WHERE id IN (${accountPayableSubquery})`).run(id, id);
      this.db.prepare(`DELETE FROM payable_recurring_templates WHERE supplier_partner_id = ? OR supplier_legal_entity_id IN (${partnerLegalEntitySubquery})`).run(id, id);
      this.db.prepare("DELETE FROM payable_installment_groups WHERE supplier_partner_id = ?").run(id);

      this.db.prepare(`DELETE FROM fiscal_document_merge_history WHERE fiscal_document_id IN (${fiscalDocumentSubquery})`).run(id, id);
      this.db.prepare(`DELETE FROM fiscal_document_events WHERE fiscal_document_id IN (${fiscalDocumentSubquery})`).run(id, id);
      this.db.prepare(`DELETE FROM operations WHERE id IN (${operationSubquery})`).run(id, id, id);
      this.db.prepare(`DELETE FROM fiscal_document_items WHERE fiscal_document_id IN (${fiscalDocumentSubquery})`).run(id, id);
      this.db.prepare(`DELETE FROM fiscal_documents WHERE id IN (${fiscalDocumentSubquery})`).run(id, id);

      this.db.prepare(`DELETE FROM product_aliases WHERE issuer_partner_legal_entity_id IN (${partnerLegalEntitySubquery})`).run(id);
      this.db.prepare(`DELETE FROM operation_classification_rules WHERE client_partner_id = ? OR destination_partner_id = ? OR issuer_partner_legal_entity_id IN (${partnerLegalEntitySubquery}) OR recipient_partner_legal_entity_id IN (${partnerLegalEntitySubquery})`).run(id, id, id, id);
      this.db.prepare(`DELETE FROM deal_confirmation_parties WHERE business_partner_id = ? OR partner_legal_entity_id IN (${partnerLegalEntitySubquery})`).run(id, id);
      this.db.prepare("DELETE FROM service_rate_rules WHERE business_partner_id = ?").run(id);
      this.db.prepare("DELETE FROM client_billing_profiles WHERE business_partner_id = ?").run(id);
      this.db.prepare(`DELETE FROM partner_aliases WHERE business_partner_id = ? OR partner_legal_entity_id IN (${partnerLegalEntitySubquery})`).run(id, id);
      this.db.prepare("DELETE FROM partner_contacts WHERE business_partner_id = ?").run(id);
      this.db.prepare("DELETE FROM partner_legal_entities WHERE business_partner_id = ?").run(id);
      this.db.prepare("DELETE FROM business_partner_roles WHERE business_partner_id = ?").run(id);
      this.db.prepare("DELETE FROM business_partners WHERE id = ?").run(id);
    });
    transaction();
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

  deleteServiceRateRule(id: string): void {
    this.getServiceRateRule(id);
    const transaction = this.db.transaction(() => {
      this.db.prepare("UPDATE operations SET service_rate_rule_id = NULL WHERE service_rate_rule_id = ?").run(id);
      this.db.prepare("DELETE FROM service_rate_rules WHERE id = ?").run(id);
    });
    transaction();
  }

  resolveServiceRateRule(input: unknown): ResolveRateResult {
    const data = resolveRateInputSchema.parse(input);
    this.assertClientPartner(data.businessPartnerId, data.organizationId);
    const activeRules = this.listServiceRateRules({ businessPartnerId: data.businessPartnerId, organizationId: data.organizationId, status: "active" })
      .filter((rule) => rule.effectiveFrom <= data.operationDate && (!rule.effectiveTo || rule.effectiveTo >= data.operationDate))
      .filter((rule) => !rule.ownLegalEntityId || rule.ownLegalEntityId === data.ownLegalEntityId)
      .filter((rule) => !rule.productId || rule.productId === data.productId);
    const candidates = activeRules
      .filter((rule) => rule.operationScope === data.operationScope || rule.operationScope === "ALL")
      .map((rule) => ({ rule, score: (rule.ownLegalEntityId ? 4 : 0) + (rule.productId ? 2 : 0) + (rule.operationScope === data.operationScope ? 1 : 0) + rule.priority / 1000 }));
    if (candidates.length === 0) {
      const fallback = activeRules
        .filter((rule) => rule.operationScope !== "ALL")
        .map((rule) => ({ rule, score: (rule.ownLegalEntityId ? 4 : 0) + (rule.productId ? 2 : 0) + rule.priority / 1000 }));
      if (fallback.length === 1) {
        const rule = fallback[0].rule;
        return { status: "found", rule, rateValueCents: rule.rateValueCents, origin: "single-scope-fallback", message: "Regra unica do cliente aplicada apesar da UF da venda diferente." };
      }
      return { status: "missing", rule: null, rateValueCents: null, origin: "none", message: "Nenhuma regra aplicavel encontrada." };
    }
    const max = Math.max(...candidates.map((item) => item.score));
    const best = candidates.filter((item) => item.score === max);
    if (best.length > 1) return { status: "conflict", rule: null, rateValueCents: null, origin: "conflict", message: "Mais de uma regra igualmente especifica foi encontrada." };
    const rule = best[0].rule;
    return { status: "found", rule, rateValueCents: rule.rateValueCents, origin: rule.productId || rule.ownLegalEntityId ? "specific" : "general", message: null };
  }

  private resolveServiceRateRuleForUnbilledBackfill(input: unknown): ResolveRateResult {
    const data = resolveRateInputSchema.parse(input);
    this.assertClientPartner(data.businessPartnerId, data.organizationId);
    const activeRules = this.listServiceRateRules({ businessPartnerId: data.businessPartnerId, organizationId: data.organizationId, status: "active" })
      .filter((rule) => !rule.effectiveTo || rule.effectiveTo >= data.operationDate)
      .filter((rule) => !rule.ownLegalEntityId || rule.ownLegalEntityId === data.ownLegalEntityId)
      .filter((rule) => !rule.productId || rule.productId === data.productId);
    const scoreRule = (rule: ServiceRateRule): number => (rule.ownLegalEntityId ? 4 : 0) + (rule.productId ? 2 : 0) + (rule.operationScope === data.operationScope ? 1 : 0) + rule.priority / 1000;
    let candidates = activeRules
      .filter((rule) => rule.operationScope === data.operationScope || rule.operationScope === "ALL")
      .map((rule) => ({ rule, score: scoreRule(rule) }));
    if (candidates.length === 0) {
      candidates = activeRules
        .filter((rule) => rule.operationScope !== "ALL")
        .map((rule) => ({ rule, score: (rule.ownLegalEntityId ? 4 : 0) + (rule.productId ? 2 : 0) + rule.priority / 1000 }));
    }
    if (candidates.length === 0) return { status: "missing", rule: null, rateValueCents: null, origin: "none", message: "Nenhuma regra aplicavel encontrada." };
    const max = Math.max(...candidates.map((item) => item.score));
    const best = candidates
      .filter((item) => item.score === max)
      .sort((a, b) => a.rule.effectiveFrom.localeCompare(b.rule.effectiveFrom));
    const sameEffectiveBest = best.filter((item) => item.rule.effectiveFrom === best[0].rule.effectiveFrom);
    if (sameEffectiveBest.length > 1) return { status: "conflict", rule: null, rateValueCents: null, origin: "conflict", message: "Mais de uma regra igualmente especifica foi encontrada." };
    const rule = best[0].rule;
    return { status: "found", rule, rateValueCents: rule.rateValueCents, origin: "backfill", message: "Regra ativa aplicada a operacao em aberto anterior a vigencia." };
  }

  listFiscalDocuments(filters: { organizationId?: string; ownLegalEntityId?: string; search?: string; status?: "DRAFT" | "PENDING" | "CONFIRMED" | "CANCELED" | "all" } = {}): FiscalDocument[] {
    return (this.db.prepare("SELECT * FROM fiscal_documents ORDER BY issue_date DESC, updated_at DESC").all() as DbRecord[])
      .map(mapFiscalDocument)
      .filter((item) => this.isOrganizationAllowed(item.organizationId))
      .filter((item) => !filters.organizationId || item.organizationId === filters.organizationId)
      .filter((item) => !filters.ownLegalEntityId || item.ownLegalEntityId === filters.ownLegalEntityId)
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
    this.assertClientPartner(data.responsiblePartnerId, data.organizationId);
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
    this.assertClientPartner(data.responsiblePartnerId, data.organizationId);
    const duplicateWarning = this.detectPossibleDuplicate(data, id);
    this.db.prepare(`UPDATE fiscal_documents SET own_legal_entity_id = ?, responsible_partner_id = ?, partner_legal_entity_id = ?, access_key = ?, document_number = ?, series = ?, issue_date = ?, total_amount_cents = ?, has_pending_issues = ?, pending_notes = ?, duplicate_warning = ?, notes = ?, updated_at = ? WHERE id = ?`)
      .run(data.ownLegalEntityId, data.responsiblePartnerId, data.partnerLegalEntityId, data.accessKey, data.documentNumber, data.series, data.issueDate, data.totalAmountCents, data.hasPendingIssues ? 1 : 0, data.pendingNotes, duplicateWarning, data.notes, new Date().toISOString(), id);
    return this.getFiscalDocument(id);
  }

  deleteFiscalDocument(id: string): void {
    const detail = this.getFiscalDocument(id);
    const linkedCharge = detail.operations.find((operation) => operation.clientChargeId || operation.billingStatus !== "UNBILLED");
    if (linkedCharge) throw new Error("Nota ja vinculada a cobranca. Cancele/libere a cobranca antes de excluir.");
    const linkedDeal = this.tableExists("deal_confirmation_fiscal_documents")
      ? this.db.prepare("SELECT 1 FROM deal_confirmation_fiscal_documents WHERE fiscal_document_id = ? LIMIT 1").get(id)
      : null;
    const linkedDealOperation = this.tableExists("deal_confirmation_operations")
      ? this.db.prepare("SELECT 1 FROM deal_confirmation_operations WHERE operation_id IN (SELECT id FROM operations WHERE fiscal_document_id = ?) LIMIT 1").get(id)
      : null;
    if (linkedDeal || linkedDealOperation) throw new Error("Nota ja vinculada a confirmacao de negocio. Remova o vinculo antes de excluir.");
    const xmlImportJobIds = this.tableExists("xml_import_files")
      ? (this.db.prepare("SELECT DISTINCT import_job_id FROM xml_import_files WHERE fiscal_document_id = ?").all(id) as Array<{ import_job_id: string }>).map((row) => row.import_job_id)
      : [];
    const trx = this.db.transaction(() => {
      if (this.tableExists("spreadsheet_import_rows")) this.db.prepare("UPDATE spreadsheet_import_rows SET fiscal_document_id = NULL, operation_id = NULL WHERE fiscal_document_id = ? OR operation_id IN (SELECT id FROM operations WHERE fiscal_document_id = ?)").run(id, id);
      if (this.tableExists("xml_import_files")) this.db.prepare("UPDATE xml_import_files SET fiscal_document_id = NULL, status = 'REVERTED', updated_at = ? WHERE fiscal_document_id = ?").run(new Date().toISOString(), id);
      if (this.tableExists("fiscal_document_merge_history")) this.db.prepare("DELETE FROM fiscal_document_merge_history WHERE fiscal_document_id = ?").run(id);
      if (this.tableExists("fiscal_document_events")) this.db.prepare("DELETE FROM fiscal_document_events WHERE fiscal_document_id = ?").run(id);
      this.db.prepare("DELETE FROM operations WHERE fiscal_document_id = ?").run(id);
      this.db.prepare("DELETE FROM fiscal_document_items WHERE fiscal_document_id = ?").run(id);
      this.db.prepare("DELETE FROM fiscal_documents WHERE id = ?").run(id);
      xmlImportJobIds.forEach((jobId) => {
        this.recountXmlImportJob(jobId);
        this.reconcileXmlImportJobStatus(jobId);
      });
    });
    trx();
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

  listOperations(filters: { organizationId?: string; ownLegalEntityId?: string; responsiblePartnerId?: string; periodStart?: string; periodEnd?: string; status?: FiscalDocumentStatus | "all"; billingStatus?: Operation["billingStatus"] | "all" } = {}): Operation[] {
    return (this.db.prepare("SELECT * FROM operations ORDER BY operation_date DESC, created_at DESC").all() as DbRecord[])
      .map(mapOperation)
      .filter((item) => this.isOrganizationAllowed(item.organizationId))
      .filter((item) => !filters.organizationId || item.organizationId === filters.organizationId)
      .filter((item) => !filters.ownLegalEntityId || item.ownLegalEntityId === filters.ownLegalEntityId)
      .filter((item) => !filters.responsiblePartnerId || item.responsiblePartnerId === filters.responsiblePartnerId)
      .filter((item) => !filters.periodStart || item.operationDate >= filters.periodStart)
      .filter((item) => !filters.periodEnd || item.operationDate <= filters.periodEnd)
      .filter((item) => !filters.status || filters.status === "all" || item.status === filters.status)
      .filter((item) => !filters.billingStatus || filters.billingStatus === "all" || item.billingStatus === filters.billingStatus);
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

  getOperationalIndicators(input: string | { organizationId: string; ownLegalEntityId?: string | null }): { documents: number; pending: number; confirmed: number; operations: number; serviceAmountCents: number } {
    const organizationId = typeof input === "string" ? input : input.organizationId;
    const ownLegalEntityId = typeof input === "string" ? undefined : input.ownLegalEntityId ?? undefined;
    this.assertOrganizationWritable(organizationId);
    this.refreshOperationServiceRates({ organizationId, ownLegalEntityId });
    const docs = this.listFiscalDocuments({ organizationId, ownLegalEntityId });
    const operations = this.listOperations({ organizationId, ownLegalEntityId });
    return {
      documents: docs.length,
      pending: docs.filter((doc) => doc.status === "PENDING" || doc.hasPendingIssues).length,
      confirmed: docs.filter((doc) => doc.status === "CONFIRMED").length,
      operations: operations.length,
      serviceAmountCents: operations.reduce((sum, operation) => sum + operation.serviceAmountCents, 0)
    };
  }

  getMonthlyOperationTotals(organizationId: string, year: number, ownLegalEntityId?: string | null): Array<{ month: number; sacksDecimal: string; amountCents: number; operationCount: number }> {
    this.assertOrganizationWritable(organizationId);
    this.refreshOperationServiceRates({ organizationId, ownLegalEntityId: ownLegalEntityId ?? undefined, periodStart: `${year}-01-01`, periodEnd: `${year}-12-31` });
    const rows = this.listOperations({ organizationId, ownLegalEntityId: ownLegalEntityId ?? undefined, status: "CONFIRMED", periodStart: `${year}-01-01`, periodEnd: `${year}-12-31` })
      .map((operation) => ({ operationDate: operation.operationDate, sacks: operation.quantitySacks, amountCents: operation.serviceAmountCents }));
    const byMonth = new Map<number, { sacks: string[]; amountCents: number; count: number }>();
    for (const row of rows) {
      const month = Number(row.operationDate.slice(5, 7));
      const bucket = byMonth.get(month) ?? { sacks: [], amountCents: 0, count: 0 };
      bucket.sacks.push(row.sacks);
      bucket.amountCents += row.amountCents;
      bucket.count += 1;
      byMonth.set(month, bucket);
    }
    return Array.from({ length: 12 }, (_unused, index) => {
      const month = index + 1;
      const bucket = byMonth.get(month);
      return {
        month,
        sacksDecimal: bucket?.sacks.length ? sumDecimalTexts(bucket.sacks) : "0",
        amountCents: bucket?.amountCents ?? 0,
        operationCount: bucket?.count ?? 0
      };
    });
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
          notes: normalized.notes || null
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
    this.recountXmlImportJob(id);
    this.reconcileXmlImportJobStatus(id);
    const row = this.db.prepare("SELECT * FROM xml_import_jobs WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Importacao XML nao encontrada.");
    const job = mapXmlImportJob(row);
    if (!this.isOrganizationAllowed(job.organizationId)) throw new Error("Importacao XML nao autorizada.");
    const files = (this.db.prepare("SELECT * FROM xml_import_files WHERE import_job_id = ? ORDER BY created_at").all(id) as DbRecord[]).map(mapXmlImportFile);
    return { job, files };
  }

  listXmlImportJobs(organizationId: string): XmlImportJob[] {
    this.assertOrganizationWritable(organizationId);
    const ids = (this.db.prepare("SELECT id FROM xml_import_jobs WHERE organization_id = ?").all(organizationId) as Array<{ id: string }>).map((row) => row.id);
    ids.forEach((id) => {
      this.recountXmlImportJob(id);
      this.reconcileXmlImportJobStatus(id);
    });
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
    this.refreshOperationServiceRates({
      organizationId: data.organizationId,
      ownLegalEntityId: data.ownLegalEntityId,
      responsiblePartnerId: data.clientPartnerId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd
    });
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

  getPartnerRateSummary(input: unknown): PartnerRateSummaryRow[] {
    const data = partnerRateSummaryInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    this.refreshOperationServiceRates({
      organizationId: data.organizationId,
      ownLegalEntityId: data.ownLegalEntityId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd
    });
    const billingStatusClause = data.includeAlreadyBilled ? "" : "AND billing_status = 'UNBILLED'";
    const rows = this.db.prepare(`
      SELECT responsible_partner_id AS partnerId, operation_scope AS scope, quantity_sacks_decimal AS sacks, service_amount_cents AS amountCents
      FROM operations
      WHERE organization_id = ?
        AND own_legal_entity_id = ?
        AND operation_date BETWEEN ? AND ?
        AND status = 'CONFIRMED'
        ${billingStatusClause}
    `).all(data.organizationId, data.ownLegalEntityId, data.periodStart, data.periodEnd) as Array<{ partnerId: string; scope: "INTERNAL" | "EXTERNAL"; sacks: string; amountCents: number }>;

    const byPartner = new Map<string, { internalSacks: string[]; externalSacks: string[]; internalAmountCents: number; externalAmountCents: number; operationCount: number }>();
    for (const row of rows) {
      const bucket = byPartner.get(row.partnerId) ?? { internalSacks: [], externalSacks: [], internalAmountCents: 0, externalAmountCents: 0, operationCount: 0 };
      if (row.scope === "INTERNAL") {
        bucket.internalSacks.push(row.sacks);
        bucket.internalAmountCents += row.amountCents;
      } else {
        bucket.externalSacks.push(row.sacks);
        bucket.externalAmountCents += row.amountCents;
      }
      bucket.operationCount += 1;
      byPartner.set(row.partnerId, bucket);
    }

    const clients = this.listBusinessPartners({ role: "CLIENT", status: "active" });
    return clients
      .map((partner): PartnerRateSummaryRow => {
        const bucket = byPartner.get(partner.id);
        return {
          partnerId: partner.id,
          partnerDisplayName: partner.displayName,
          internalSacks: bucket?.internalSacks.length ? sumDecimalTexts(bucket.internalSacks) : "0",
          externalSacks: bucket?.externalSacks.length ? sumDecimalTexts(bucket.externalSacks) : "0",
          internalAmountCents: bucket?.internalAmountCents ?? 0,
          externalAmountCents: bucket?.externalAmountCents ?? 0,
          totalAmountCents: (bucket?.internalAmountCents ?? 0) + (bucket?.externalAmountCents ?? 0),
          operationCount: bucket?.operationCount ?? 0
        };
      })
      .sort((a, b) => b.totalAmountCents - a.totalAmountCents);
  }

  private refreshOperationServiceRates(filters: { organizationId: string; ownLegalEntityId?: string; responsiblePartnerId?: string; periodStart?: string; periodEnd?: string }): void {
    const operations = this.listOperations({
      organizationId: filters.organizationId,
      ownLegalEntityId: filters.ownLegalEntityId,
      responsiblePartnerId: filters.responsiblePartnerId,
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
      status: "all",
      billingStatus: "UNBILLED"
    }).filter((operation) => !operation.rateWasManuallyOverridden && operation.status !== "CANCELED");
    const now = new Date().toISOString();
    for (const operation of operations) {
      const resolved = this.resolveServiceRateRule({
        organizationId: operation.organizationId,
        businessPartnerId: operation.responsiblePartnerId,
        ownLegalEntityId: operation.ownLegalEntityId,
        productId: operation.productId,
        operationScope: operation.operationScope,
        operationDate: operation.operationDate
      });
      const backfilled = resolved.status === "missing" && operation.appliedRateValueCents === 0 && operation.serviceAmountCents === 0
        ? this.resolveServiceRateRuleForUnbilledBackfill({
          organizationId: operation.organizationId,
          businessPartnerId: operation.responsiblePartnerId,
          ownLegalEntityId: operation.ownLegalEntityId,
          productId: operation.productId,
          operationScope: operation.operationScope,
          operationDate: operation.operationDate
        })
        : resolved;
      if (backfilled.status !== "found" || backfilled.rateValueCents === null) continue;
      const resolvedRule = backfilled.rule;
      const serviceAmountCents = multiplyDecimalByCents(operation.quantitySacks, backfilled.rateValueCents);
      if (operation.serviceRateRuleId === resolvedRule?.id && operation.appliedRateValueCents === backfilled.rateValueCents && operation.serviceAmountCents === serviceAmountCents) continue;
      this.db.prepare("UPDATE operations SET service_rate_rule_id = ?, applied_rate_value_cents = ?, service_amount_cents = ?, updated_at = ? WHERE id = ?")
        .run(resolvedRule?.id ?? null, backfilled.rateValueCents, serviceAmountCents, now, operation.id);
    }
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
    if (!["DRAFT", "PENDING_REVIEW", "ISSUED", "OVERDUE"].includes(charge.status)) throw new Error("Ajustes bloqueados para cobranca paga, parcial, cancelada ou substituida.");
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
    if (!["DRAFT", "PENDING_REVIEW", "ISSUED", "OVERDUE"].includes(charge.status)) throw new Error("Ajustes bloqueados para cobranca paga, parcial, cancelada ou substituida.");
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
    const clientLegalEntity = this.listPartnerLegalEntities(client.id).find((entity) => entity.isPrimary && entity.isActive) ?? this.listPartnerLegalEntities(client.id).find((entity) => entity.isActive) ?? null;
    const result = await generateChargeDocuments({ directories: this.directories, organization, ownLegalEntity, client, clientLegalEntity, detail });
    const version = detail.documents.length + 1;
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO charge_document_versions (id, client_charge_id, version, pdf_file_path, pdf_file_hash, excel_file_path, excel_file_hash, image_file_path, image_file_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), id, version, result.pdfFilePath, result.pdfFileHash, result.excelFilePath, result.excelFileHash, result.imageFilePath, result.imageFileHash, now);
    this.db.prepare("UPDATE client_charges SET pdf_file_path = ?, pdf_file_hash = ?, excel_file_path = ?, image_file_path = ?, updated_at = ? WHERE id = ?").run(result.pdfFilePath, result.pdfFileHash, result.excelFilePath, result.imageFilePath, now, id);
    return this.getClientCharge(id);
  }

  getChargeDocumentPath(chargeId: string, kind: "pdf" | "excel" | "image"): string {
    const charge = this.getClientCharge(chargeId).charge;
    const path = kind === "pdf" ? charge.pdfFilePath : kind === "excel" ? charge.excelFilePath : charge.imageFilePath;
    if (!path) throw new Error("Documento ainda nao foi gerado para esta cobranca.");
    return path;
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

  getBillingSummary(input: string | { organizationId: string; ownLegalEntityId?: string | null }): BillingSummary {
    const organizationId = typeof input === "string" ? input : input.organizationId;
    const ownLegalEntityId = typeof input === "string" ? undefined : input.ownLegalEntityId ?? undefined;
    this.assertOrganizationWritable(organizationId);
    this.refreshOperationServiceRates({ organizationId, ownLegalEntityId });
    const charges = (this.db.prepare(`SELECT * FROM client_charges WHERE organization_id = ? ${ownLegalEntityId ? "AND own_legal_entity_id = ?" : ""} AND status != 'CANCELLED'`).all(...(ownLegalEntityId ? [organizationId, ownLegalEntityId] : [organizationId])) as DbRecord[]).map(mapClientCharge);
    const credits = this.db.prepare(`SELECT COALESCE(SUM(available_amount_cents), 0) AS total FROM client_ledger_entries WHERE organization_id = ? ${ownLegalEntityId ? "AND own_legal_entity_id = ?" : ""} AND status = 'CONFIRMED'`).get(...(ownLegalEntityId ? [organizationId, ownLegalEntityId] : [organizationId])) as { total: number };
    const unbilledRows = this.listOperations({ organizationId, ownLegalEntityId, status: "CONFIRMED", billingStatus: "UNBILLED" });
    const unbilledServiceCents = unbilledRows.reduce((sum, item) => sum + item.serviceAmountCents, 0);
    return {
      issuedCents: charges.reduce((sum, item) => sum + item.finalAmountCents, 0),
      receivedCents: charges.reduce((sum, item) => sum + item.paidAmountCents, 0),
      openCents: charges.reduce((sum, item) => sum + item.openAmountCents, 0) + unbilledServiceCents,
      overdueCents: charges.filter((item) => item.status === "OVERDUE").reduce((sum, item) => sum + item.openAmountCents, 0),
      availableCreditsCents: Number(credits.total),
      unbilledOperations: unbilledRows.length,
      unbilledSacks: unbilledRows.length ? sumDecimalTexts(unbilledRows.map((item) => item.quantitySacks)) : "0",
      billedSacks: "0"
    };
  }

  private static readonly WAITING_SIGNATURE_ALERT_DAYS = 7;
  private static readonly CREDIT_LIMIT_ALERT_PERCENT = 90;

  getDashboardAlerts(organizationId: string, ownLegalEntityId?: string | null): DashboardAlerts {
    this.assertOrganizationWritable(organizationId);
    const today = new Date().toISOString().slice(0, 10);
    const partners = this.listBusinessPartners({ role: "CLIENT", status: "active" });
    const partnerName = (id: string): string => partners.find((item) => item.id === id)?.displayName ?? id;

    const overdueCharges = this.listClientCharges({ organizationId })
      .filter((charge) => !ownLegalEntityId || charge.ownLegalEntityId === ownLegalEntityId)
      .filter((charge) => charge.status === "OVERDUE")
      .map((charge) => ({
        chargeId: charge.id,
        chargeNumber: charge.chargeNumber,
        partnerId: charge.clientPartnerId,
        partnerName: partnerName(charge.clientPartnerId),
        dueDate: charge.dueDate ?? "",
        daysOverdue: charge.dueDate ? daysBetweenDates(charge.dueDate, today) : 0,
        openAmountCents: charge.openAmountCents
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const waitingSignatureConfirmations = this.listDealConfirmations({ organizationId, ownLegalEntityId: ownLegalEntityId ?? undefined, signatureStatus: "WAITING_SIGNATURE" })
      .map((confirmation) => {
        const sentAt = confirmation.sentForSignatureAt ?? confirmation.issuedAt ?? confirmation.createdAt;
        return { confirmation, daysWaiting: daysBetweenDates(sentAt, today) };
      })
      .filter((item) => item.daysWaiting >= AppRepository.WAITING_SIGNATURE_ALERT_DAYS)
      .map((item) => {
        const buyerParty = this.db.prepare("SELECT * FROM deal_confirmation_parties WHERE deal_confirmation_id = ? AND party_role = 'BUYER' LIMIT 1").get(item.confirmation.id) as DbRecord | undefined;
        let buyerName = item.confirmation.temporaryReference;
        if (buyerParty) {
          try { buyerName = (JSON.parse(String(buyerParty.snapshot_json)) as { name?: string }).name || buyerName; } catch { /* keep fallback */ }
        }
        return {
          confirmationId: item.confirmation.id,
          confirmationNumber: item.confirmation.confirmationNumber ?? item.confirmation.temporaryReference,
          buyerName,
          daysWaiting: item.daysWaiting
        };
      })
      .sort((a, b) => b.daysWaiting - a.daysWaiting);

    const partnersNearCreditLimit = partners
      .filter((partner) => (partner.creditLimitCents ?? 0) > 0)
      .map((partner) => {
        const outstanding = this.db.prepare(`
          SELECT COALESCE(SUM(open_amount_cents), 0) AS total
          FROM client_charges
          WHERE organization_id = ?
            AND client_partner_id = ?
            ${ownLegalEntityId ? "AND own_legal_entity_id = ?" : ""}
            AND status NOT IN ('CANCELLED', 'REPLACED')
        `).get(...(ownLegalEntityId ? [organizationId, partner.id, ownLegalEntityId] : [organizationId, partner.id])) as { total: number };
        const creditLimitCents = partner.creditLimitCents ?? 0;
        const outstandingCents = Number(outstanding.total);
        return {
          partnerId: partner.id,
          partnerName: partner.displayName,
          creditLimitCents,
          outstandingCents,
          percentUsed: creditLimitCents ? Math.round((outstandingCents / creditLimitCents) * 100) : 0
        };
      })
      .filter((item) => item.percentUsed >= AppRepository.CREDIT_LIMIT_ALERT_PERCENT)
      .sort((a, b) => b.percentUsed - a.percentUsed);

    return { overdueCharges, waitingSignatureConfirmations, partnersNearCreditLimit };
  }

  getInstallationProfile(): InstallationProfile | null {
    const row = this.db.prepare("SELECT * FROM installation_profiles ORDER BY created_at DESC LIMIT 1").get() as
      | Record<string, unknown>
      | undefined;
    return row ? mapInstallationProfile(row) : null;
  }

  saveInstallationProfile(input: unknown): InstallationProfile {
    const parsedProfile = saveInstallationProfileSchema.parse(input);
    const profile = {
      ...parsedProfile,
      appVariant: "multiempresa" as const,
      allowOrganizationSwitch: true,
      allowLegalEntitySwitch: true
    };
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
    if (!own.ownLegalEntityId) throw new Error(own.errorMessage ?? "CNPJ proprio nao identificado.");
    const explicitClientPartnerId = typeof resolution.clientPartnerId === "string" ? resolution.clientPartnerId : null;
    const autoMatchedPartnerId = explicitClientPartnerId ? null : this.resolveCounterpartyPartnerForXml(job.organizationId, extracted, own.ownLegalEntityId, own.direction);
    const responsiblePartnerId = explicitClientPartnerId ?? autoMatchedPartnerId;
    if (!responsiblePartnerId) {
      this.db.prepare("UPDATE xml_import_files SET status = 'PENDING_REVIEW', error_code = NULL, error_message = ?, updated_at = ? WHERE id = ?")
        .run("Cliente responsavel nao identificado automaticamente pelo CNPJ/nome do contraparte. Associe manualmente e reprocesse.", new Date().toISOString(), file.id);
      return;
    }
    const operationScope = resolution.operationScope === "INTERNAL" || resolution.operationScope === "EXTERNAL" ? resolution.operationScope : null;
    const createOperations = resolution.createOperations !== false;
    const operationType = resolution.operationType === "PURCHASE" || resolution.operationType === "SALE" ? resolution.operationType : own.operationType;
    const pending: string[] = [];
    if (!operationScope) pending.push("UF da venda nao definida.");
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
      if (createOperations && operationScope && productId && sacks) {
        const operation = this.addOperation({
          fiscalDocumentId: doc.document.id,
          fiscalDocumentItemId: item.id,
          ownLegalEntityId: own.ownLegalEntityId as string,
          responsiblePartnerId,
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
    // Nota sem pendencias e com pelo menos uma operacao ja entra confirmada, pronta para cobranca,
    // sem exigir um segundo clique manual em "Confirmar" na tela de Notas fiscais.
    if (!pending.length && createdOperations > 0) {
      this.confirmFiscalDocument(doc.document.id);
    }
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

  private resolveOwnLegalEntityForXml(
    organizationId: string,
    extracted: Record<string, unknown>,
    resolution: Record<string, unknown>
  ): { ownLegalEntityId: string | null; direction: "INBOUND" | "OUTBOUND" | "UNKNOWN"; operationType: "PURCHASE" | "SALE"; errorMessage?: string } {
    const issuer = extracted.issuer as Record<string, unknown> | undefined;
    const recipient = extracted.recipient as Record<string, unknown> | undefined;
    const issuerDoc = this.onlyDigits(String(issuer?.cnpjCpf ?? ""));
    const recipientDoc = this.onlyDigits(String(recipient?.cnpjCpf ?? ""));
    const allEntities = this.listLegalEntities({ status: "all" });
    if (typeof resolution.ownLegalEntityId === "string") {
      const selectedOwn = allEntities.find((entity) => entity.id === resolution.ownLegalEntityId);
      if (!selectedOwn || selectedOwn.organizationId !== organizationId) throw new Error("CNPJ proprio selecionado nao pertence a organizacao atual.");
      if (!selectedOwn.isActive) throw new Error("CNPJ proprio selecionado esta inativo.");
      if (selectedOwn.cnpj && selectedOwn.cnpj !== issuerDoc && selectedOwn.cnpj !== recipientDoc) {
        throw new Error("XML nao pertence ao CNPJ proprio selecionado. Troque a empresa ativa antes de importar ou selecione o CNPJ correto.");
      }
      if (selectedOwn.cnpj && selectedOwn.cnpj === issuerDoc) return { ownLegalEntityId: selectedOwn.id, direction: "OUTBOUND", operationType: "SALE" };
      if (selectedOwn.cnpj && selectedOwn.cnpj === recipientDoc) return { ownLegalEntityId: selectedOwn.id, direction: "INBOUND", operationType: "PURCHASE" };
      return { ownLegalEntityId: selectedOwn.id, direction: "UNKNOWN", operationType: "SALE" };
    }
    const issuerOwn = allEntities.find((entity) => entity.organizationId === organizationId && entity.cnpj === issuerDoc);
    const recipientOwn = allEntities.find((entity) => entity.organizationId === organizationId && entity.cnpj === recipientDoc);
    const otherOrg = allEntities.find((entity) => entity.organizationId !== organizationId && (entity.cnpj === issuerDoc || entity.cnpj === recipientDoc));
    if (otherOrg) throw new Error("XML pertence a CNPJ de outra organizacao.");
    if (issuerOwn && !issuerOwn.isActive) throw new Error("CNPJ proprio emitente esta inativo.");
    if (recipientOwn && !recipientOwn.isActive) throw new Error("CNPJ proprio destinatario esta inativo.");
    if (issuerOwn) return { ownLegalEntityId: issuerOwn.id, direction: "OUTBOUND", operationType: "SALE" };
    if (recipientOwn) return { ownLegalEntityId: recipientOwn.id, direction: "INBOUND", operationType: "PURCHASE" };

    const organizationEntities = allEntities.filter((entity) => entity.organizationId === organizationId);
    const issuerByIdentity = this.resolveOwnLegalEntityByXmlParty(organizationEntities, issuer);
    const recipientByIdentity = this.resolveOwnLegalEntityByXmlParty(organizationEntities, recipient);
    if (issuerByIdentity && !issuerByIdentity.isActive) throw new Error("CNPJ proprio emitente esta inativo.");
    if (recipientByIdentity && !recipientByIdentity.isActive) throw new Error("CNPJ proprio destinatario esta inativo.");
    if (issuerByIdentity) return { ownLegalEntityId: issuerByIdentity.id, direction: "OUTBOUND", operationType: "SALE" };
    if (recipientByIdentity) return { ownLegalEntityId: recipientByIdentity.id, direction: "INBOUND", operationType: "PURCHASE" };

    const issuerLabel = [issuerDoc || "sem CNPJ", this.stringOrNull(issuer?.state) ?? null, this.stringOrNull(issuer?.legalName) ?? null].filter(Boolean).join(" - ");
    const recipientLabel = [recipientDoc || "sem CNPJ", this.stringOrNull(recipient?.state) ?? null, this.stringOrNull(recipient?.legalName) ?? null].filter(Boolean).join(" - ");
    return {
      ownLegalEntityId: null,
      direction: "UNKNOWN",
      operationType: "SALE",
      errorMessage: `CNPJ proprio nao identificado. Cadastre o CNPJ proprio da empresa ou selecione a empresa/CNPJ correto. Emitente: ${issuerLabel || "-"}; Destinatario: ${recipientLabel || "-"}.`
    };
  }

  private resolveOwnLegalEntityByXmlParty(entities: LegalEntity[], party: Record<string, unknown> | undefined): LegalEntity | null {
    const state = this.stringOrNull(party?.state)?.toUpperCase() ?? null;
    if (!state) return null;
    const stateAliases: Record<string, string[]> = {
      MG: ["MG", "MINAS GERAIS", "MONTE SANTO DE MINAS"],
      ES: ["ES", "ESPIRITO SANTO"],
      SP: ["SP", "SAO PAULO"]
    };
    const aliases = stateAliases[state] ?? [state];
    const matches = entities.filter((entity) => {
      if (entity.state?.toUpperCase() === state) return true;
      const haystack = this.normalizeName(`${entity.legalName} ${entity.tradeName} ${entity.city} ${entity.state}`);
      return aliases.some((alias) => haystack.includes(this.normalizeName(alias)));
    });
    return matches.find((entity) => entity.isActive) ?? matches[0] ?? null;
  }

  private resolveCounterpartyPartnerForXml(organizationId: string, extracted: Record<string, unknown>, ownLegalEntityId: string, direction: "INBOUND" | "OUTBOUND" | "UNKNOWN"): string | null {
    const ownEntity = this.listLegalEntities({ organizationId, status: "all" }).find((entity) => entity.id === ownLegalEntityId);
    const ownCnpj = ownEntity?.cnpj ?? null;
    const issuer = extracted.issuer as Record<string, unknown> | undefined;
    const recipient = extracted.recipient as Record<string, unknown> | undefined;
    const issuerDoc = this.onlyDigits(String(issuer?.cnpjCpf ?? ""));
    const recipientDoc = this.onlyDigits(String(recipient?.cnpjCpf ?? ""));
    const counterpartyIsRecipient = direction === "OUTBOUND" || (direction === "UNKNOWN" && ownCnpj !== null && issuerDoc === ownCnpj);
    const counterpartyDoc = counterpartyIsRecipient ? recipientDoc : issuerDoc;
    const counterpartyParty = counterpartyIsRecipient ? recipient : issuer;
    const counterpartyTradeName = this.stringOrNull(counterpartyParty?.tradeName);
    const counterpartyLegalName = this.stringOrNull(counterpartyParty?.legalName);

    if (counterpartyDoc && counterpartyDoc.length === 14) {
      const row = this.db.prepare(`
        SELECT ple.business_partner_id AS id
        FROM partner_legal_entities ple
        JOIN business_partners bp ON bp.id = ple.business_partner_id
        WHERE ple.cnpj = ? AND bp.organization_id = ? AND ple.is_active = 1 AND bp.is_active = 1
      `).get(counterpartyDoc, organizationId) as { id: string } | undefined;
      if (row) return row.id;
    }
    if (counterpartyTradeName) {
      const aliasMatch = this.resolvePartnerAlias(organizationId, counterpartyTradeName);
      if (aliasMatch) return aliasMatch.businessPartnerId;
    }
    if (counterpartyLegalName) {
      const aliasMatch = this.resolvePartnerAlias(organizationId, counterpartyLegalName);
      if (aliasMatch) return aliasMatch.businessPartnerId;
    }
    return null;
  }

  private resolveSacksForXmlItem(xmlItem: Record<string, unknown>, product: Product | null, resolution: Record<string, unknown>): string | null {
    if (typeof resolution.manualSacks === "string" && resolution.manualSacks) return normalizeDecimalText(resolution.manualSacks);
    const unit = String(xmlItem.commercialUnit ?? "").trim().toUpperCase();
    const description = String(xmlItem.description ?? "").trim().toUpperCase();
    const quantity = String(xmlItem.commercialQuantity ?? "");
    if (!quantity) return null;
    const sackWeightKg = product?.defaultSackWeightKg ? String(product.defaultSackWeightKg) : "60";
    if (isXmlSackUnit(unit)) return normalizeDecimalText(quantity);
    if (isXmlKgUnit(unit)) return divideDecimalText(quantity, sackWeightKg);
    if (isXmlTonUnit(unit)) return divideDecimalText(multiplyDecimalText(quantity, "1000"), sackWeightKg);
    if (isXmlBigBagUnit(unit) || description.includes("BIG BAG") || description.includes("BIGBAG")) {
      const bigBagWeightKg = typeof resolution.bigBagWeightKg === "string" && resolution.bigBagWeightKg ? resolution.bigBagWeightKg : "1000";
      return divideDecimalText(multiplyDecimalText(quantity, bigBagWeightKg), sackWeightKg);
    }
    return null;
  }

  private mapXmlUnit(unit: string): "SACK" | "KG" | "TON" | "UNIT" {
    const normalized = unit.trim().toUpperCase();
    if (isXmlSackUnit(normalized)) return "SACK";
    if (isXmlKgUnit(normalized)) return "KG";
    if (isXmlTonUnit(normalized)) return "TON";
    return "UNIT";
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

  private reconcileXmlImportJobStatus(id: string): void {
    const rows = (this.db.prepare("SELECT status FROM xml_import_files WHERE import_job_id = ?").all(id) as Array<{ status: string }>).map((row) => row.status);
    if (rows.length > 0 && rows.every((status) => status === "REVERTED")) {
      this.db.prepare("UPDATE xml_import_jobs SET status = 'REVERTED', reverted_at = COALESCE(reverted_at, ?) WHERE id = ?").run(new Date().toISOString(), id);
    }
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
    this.db.prepare("UPDATE client_ledger_entries SET amount_cents = ?, updated_at = ? WHERE client_charge_id = ? AND entry_type = 'SERVICE_CHARGE'")
      .run(finalAmount, new Date().toISOString(), id);
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

  listExpenseCategories(organizationId: string): ExpenseCategory[] {
    this.ensureDefaultExpenseCategories(organizationId);
    return (this.db.prepare("SELECT * FROM expense_categories WHERE organization_id = ? ORDER BY is_active DESC, name").all(organizationId) as DbRecord[]).map(mapExpenseCategory);
  }

  createExpenseCategory(input: unknown): ExpenseCategory {
    const data = expenseCategoryInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    if (data.parentCategoryId) this.assertExpenseCategoryScope(data.parentCategoryId, data.organizationId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO expense_categories (id, organization_id, parent_category_id, name, code, expense_nature, description, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.organizationId, data.parentCategoryId, data.name, data.code, data.expenseNature, data.description, data.isActive ? 1 : 0, now, now);
    return this.getExpenseCategory(id);
  }

  updateExpenseCategory(id: string, input: unknown): ExpenseCategory {
    const current = this.getExpenseCategory(id);
    const data = expenseCategoryInputSchema.parse(input);
    if (current.organizationId !== data.organizationId) throw new Error("Categoria fora da organizacao.");
    if (data.parentCategoryId) {
      if (data.parentCategoryId === id) throw new Error("Categoria pai invalida.");
      this.assertExpenseCategoryScope(data.parentCategoryId, data.organizationId);
      this.assertNoExpenseCategoryCycle(id, data.parentCategoryId);
    }
    this.db.prepare("UPDATE expense_categories SET parent_category_id = ?, name = ?, code = ?, expense_nature = ?, description = ?, is_active = ?, updated_at = ? WHERE id = ?")
      .run(data.parentCategoryId, data.name, data.code, data.expenseNature, data.description, data.isActive ? 1 : 0, new Date().toISOString(), id);
    return this.getExpenseCategory(id);
  }

  activateExpenseCategory(id: string): ExpenseCategory {
    this.db.prepare("UPDATE expense_categories SET is_active = 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getExpenseCategory(id);
  }

  deactivateExpenseCategory(id: string): ExpenseCategory {
    this.db.prepare("UPDATE expense_categories SET is_active = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getExpenseCategory(id);
  }

  getExpenseCategory(id: string): ExpenseCategory {
    const row = this.db.prepare("SELECT * FROM expense_categories WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Categoria nao encontrada.");
    return mapExpenseCategory(row);
  }

  listCostCenters(filters: { organizationId: string; ownLegalEntityId?: string; status?: "active" | "inactive" | "all" }): CostCenter[] {
    const where = ["organization_id = ?"];
    const params: unknown[] = [filters.organizationId];
    if (filters.ownLegalEntityId) {
      where.push("(own_legal_entity_id = ? OR own_legal_entity_id IS NULL)");
      params.push(filters.ownLegalEntityId);
    }
    return (this.db.prepare(`SELECT * FROM cost_centers WHERE ${where.join(" AND ")} ORDER BY is_active DESC, name`).all(...params) as DbRecord[])
      .map(mapCostCenter)
      .filter((item) => this.matchesStatus(item.isActive, filters.status ?? "all"));
  }

  createCostCenter(input: unknown): CostCenter {
    const data = costCenterInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    if (data.ownLegalEntityId) this.assertLegalEntityScope(data.ownLegalEntityId, data.organizationId);
    if (data.locationId) this.assertLocationScope(data.locationId, data.organizationId, data.ownLegalEntityId);
    if (data.parentCostCenterId) this.assertCostCenterScope(data.parentCostCenterId, data.organizationId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO cost_centers (id, organization_id, own_legal_entity_id, location_id, parent_cost_center_id, name, code, description, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.organizationId, data.ownLegalEntityId, data.locationId, data.parentCostCenterId, data.name, data.code, data.description, data.isActive ? 1 : 0, now, now);
    return this.getCostCenter(id);
  }

  updateCostCenter(id: string, input: unknown): CostCenter {
    const current = this.getCostCenter(id);
    const data = costCenterInputSchema.parse(input);
    if (current.organizationId !== data.organizationId) throw new Error("Centro de custo fora da organizacao.");
    if (data.ownLegalEntityId) this.assertLegalEntityScope(data.ownLegalEntityId, data.organizationId);
    if (data.locationId) this.assertLocationScope(data.locationId, data.organizationId, data.ownLegalEntityId);
    if (data.parentCostCenterId) {
      if (data.parentCostCenterId === id) throw new Error("Centro pai invalido.");
      this.assertCostCenterScope(data.parentCostCenterId, data.organizationId);
      this.assertNoCostCenterCycle(id, data.parentCostCenterId);
    }
    this.db.prepare("UPDATE cost_centers SET own_legal_entity_id = ?, location_id = ?, parent_cost_center_id = ?, name = ?, code = ?, description = ?, is_active = ?, updated_at = ? WHERE id = ?")
      .run(data.ownLegalEntityId, data.locationId, data.parentCostCenterId, data.name, data.code, data.description, data.isActive ? 1 : 0, new Date().toISOString(), id);
    return this.getCostCenter(id);
  }

  activateCostCenter(id: string): CostCenter {
    this.db.prepare("UPDATE cost_centers SET is_active = 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getCostCenter(id);
  }

  deactivateCostCenter(id: string): CostCenter {
    this.db.prepare("UPDATE cost_centers SET is_active = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getCostCenter(id);
  }

  getCostCenter(id: string): CostCenter {
    const row = this.db.prepare("SELECT * FROM cost_centers WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Centro de custo nao encontrado.");
    return mapCostCenter(row);
  }

  listFinancialAccounts(filters: { organizationId: string; ownLegalEntityId?: string; status?: "active" | "inactive" | "all" }): FinancialAccount[] {
    const where = ["organization_id = ?"];
    const params: unknown[] = [filters.organizationId];
    if (filters.ownLegalEntityId) {
      where.push("own_legal_entity_id = ?");
      params.push(filters.ownLegalEntityId);
    }
    return (this.db.prepare(`SELECT * FROM financial_accounts WHERE ${where.join(" AND ")} ORDER BY is_active DESC, name`).all(...params) as DbRecord[])
      .map(mapFinancialAccount)
      .filter((item) => this.matchesStatus(item.isActive, filters.status ?? "all"));
  }

  createFinancialAccount(input: unknown): FinancialAccount {
    const data = financialAccountInputSchema.parse(input);
    this.assertLegalEntityScope(data.ownLegalEntityId, data.organizationId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO financial_accounts (id, organization_id, own_legal_entity_id, name, account_type, bank_name, branch, account_identifier_masked, pix_key_description, notes, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.organizationId, data.ownLegalEntityId, data.name, data.accountType, data.bankName, data.branch, data.accountIdentifierMasked, data.pixKeyDescription, data.notes, data.isActive ? 1 : 0, now, now);
    return this.getFinancialAccount(id);
  }

  updateFinancialAccount(id: string, input: unknown): FinancialAccount {
    const current = this.getFinancialAccount(id);
    const data = financialAccountInputSchema.parse(input);
    if (current.organizationId !== data.organizationId || current.ownLegalEntityId !== data.ownLegalEntityId) throw new Error("Conta financeira fora do escopo.");
    this.db.prepare("UPDATE financial_accounts SET name = ?, account_type = ?, bank_name = ?, branch = ?, account_identifier_masked = ?, pix_key_description = ?, notes = ?, is_active = ?, updated_at = ? WHERE id = ?")
      .run(data.name, data.accountType, data.bankName, data.branch, data.accountIdentifierMasked, data.pixKeyDescription, data.notes, data.isActive ? 1 : 0, new Date().toISOString(), id);
    return this.getFinancialAccount(id);
  }

  activateFinancialAccount(id: string): FinancialAccount {
    this.db.prepare("UPDATE financial_accounts SET is_active = 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getFinancialAccount(id);
  }

  deactivateFinancialAccount(id: string): FinancialAccount {
    this.db.prepare("UPDATE financial_accounts SET is_active = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getFinancialAccount(id);
  }

  getFinancialAccount(id: string): FinancialAccount {
    const row = this.db.prepare("SELECT * FROM financial_accounts WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Conta financeira nao encontrada.");
    return mapFinancialAccount(row);
  }

  listAccountsPayable(filters: { organizationId: string; ownLegalEntityId?: string; status?: string; supplierPartnerId?: string }): AccountPayable[] {
    const where = ["organization_id = ?"];
    const params: unknown[] = [filters.organizationId];
    if (filters.ownLegalEntityId) {
      where.push("own_legal_entity_id = ?");
      params.push(filters.ownLegalEntityId);
    }
    if (filters.status) {
      where.push("status = ?");
      params.push(filters.status);
    }
    if (filters.supplierPartnerId) {
      where.push("supplier_partner_id = ?");
      params.push(filters.supplierPartnerId);
    }
    return (this.db.prepare(`SELECT * FROM accounts_payable WHERE ${where.join(" AND ")} ORDER BY due_date, created_at DESC`).all(...params) as DbRecord[]).map((row) => this.refreshPayableComputedStatus(mapAccountPayable(row)));
  }

  getAccountPayable(id: string): AccountPayableDetail {
    const payable = this.getPayable(id);
    return {
      payable,
      allocations: (this.db.prepare("SELECT * FROM account_payable_allocations WHERE account_payable_id = ? ORDER BY created_at").all(id) as DbRecord[]).map(mapAccountPayableAllocation),
      payments: (this.db.prepare("SELECT * FROM payable_payment_allocations WHERE account_payable_id = ? AND cancelled_at IS NULL ORDER BY allocated_at").all(id) as DbRecord[]).map(mapPayablePaymentAllocation),
      attachments: (this.db.prepare("SELECT * FROM payable_document_attachments WHERE account_payable_id = ? AND removed_at IS NULL ORDER BY created_at").all(id) as DbRecord[]).map(mapPayableDocumentAttachment),
      history: (this.db.prepare("SELECT * FROM payable_status_history WHERE account_payable_id = ? ORDER BY changed_at").all(id) as DbRecord[]).map(mapPayableStatusHistory)
    };
  }

  createAccountPayableDraft(input: unknown): AccountPayableDetail {
    const data = accountPayableInputSchema.parse(input);
    this.assertPayableInputScope(data);
    const totals = this.calculatePayableAmounts(data.originalAmountCents, data.discountCents, data.interestCents, data.penaltyCents, data.otherAdditionsCents);
    const id = randomUUID();
    const now = new Date().toISOString();
    const status = data.amountStatus === "PENDING" ? "DRAFT" : "DRAFT";
    this.db.prepare(`INSERT INTO accounts_payable (
      id, organization_id, own_legal_entity_id, supplier_partner_id, supplier_legal_entity_id, payee_name_snapshot, payee_tax_id_snapshot,
      category_id, default_cost_center_id, default_location_id, source, description, document_type, document_number,
      competence_date, issue_date, due_date, original_amount_cents, discount_cents, interest_cents, penalty_cents, other_additions_cents,
      final_amount_cents, paid_amount_cents, open_amount_cents, amount_status, status, notes, internal_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.organizationId, data.ownLegalEntityId, data.supplierPartnerId, data.supplierLegalEntityId, data.payeeNameSnapshot, this.cleanOptionalTaxId(data.payeeTaxIdSnapshot), data.categoryId, data.defaultCostCenterId, data.defaultLocationId, data.source, data.description, data.documentType, data.documentNumber, data.competenceDate, data.issueDate, data.dueDate, data.originalAmountCents, data.discountCents, data.interestCents, data.penaltyCents, data.otherAdditionsCents, totals.finalAmountCents, totals.openAmountCents, data.amountStatus, status, data.notes, data.internalNotes, now, now);
    this.recordPayableStatus(id, null, status, "Rascunho criado");
    return this.getAccountPayable(id);
  }

  updateAccountPayable(id: string, input: unknown): AccountPayableDetail {
    const current = this.getPayable(id);
    if (["PAID", "CANCELLED"].includes(current.status)) throw new Error("Conta paga ou cancelada nao pode ser editada silenciosamente.");
    const data = accountPayableInputSchema.parse(input);
    this.assertPayableInputScope(data);
    if (current.organizationId !== data.organizationId || current.ownLegalEntityId !== data.ownLegalEntityId) throw new Error("Conta fora do escopo.");
    const totals = this.calculatePayableAmounts(data.originalAmountCents, data.discountCents, data.interestCents, data.penaltyCents, data.otherAdditionsCents, current.paidAmountCents);
    this.db.prepare(`UPDATE accounts_payable SET supplier_partner_id = ?, supplier_legal_entity_id = ?, payee_name_snapshot = ?, payee_tax_id_snapshot = ?,
      category_id = ?, default_cost_center_id = ?, default_location_id = ?, source = ?, description = ?, document_type = ?, document_number = ?,
      competence_date = ?, issue_date = ?, due_date = ?, original_amount_cents = ?, discount_cents = ?, interest_cents = ?, penalty_cents = ?,
      other_additions_cents = ?, final_amount_cents = ?, open_amount_cents = ?, amount_status = ?, notes = ?, internal_notes = ?, updated_at = ? WHERE id = ?`)
      .run(data.supplierPartnerId, data.supplierLegalEntityId, data.payeeNameSnapshot, this.cleanOptionalTaxId(data.payeeTaxIdSnapshot), data.categoryId, data.defaultCostCenterId, data.defaultLocationId, data.source, data.description, data.documentType, data.documentNumber, data.competenceDate, data.issueDate, data.dueDate, data.originalAmountCents, data.discountCents, data.interestCents, data.penaltyCents, data.otherAdditionsCents, totals.finalAmountCents, totals.openAmountCents, data.amountStatus, data.notes, data.internalNotes, new Date().toISOString(), id);
    this.refreshPayableStatus(id);
    return this.getAccountPayable(id);
  }

  confirmAccountPayable(id: string): AccountPayableDetail {
    const run = this.db.transaction(() => {
      const payable = this.getPayable(id);
      if (payable.amountStatus !== "CONFIRMED" || payable.finalAmountCents === null) throw new Error("Informe valor confirmado antes de abrir a conta.");
      const next = payable.openAmountCents === 0 ? "PAID" : "OPEN";
      this.db.prepare("UPDATE accounts_payable SET status = ?, confirmed_at = COALESCE(confirmed_at, ?), updated_at = ? WHERE id = ?").run(next, new Date().toISOString(), new Date().toISOString(), id);
      this.recordPayableStatus(id, payable.status, next, "Conta confirmada");
      this.validatePayableAllocations(id);
    });
    run();
    return this.getAccountPayable(id);
  }

  duplicateAccountPayable(id: string): AccountPayableDetail {
    const original = this.getPayable(id);
    return this.createAccountPayableDraft({
      organizationId: original.organizationId,
      ownLegalEntityId: original.ownLegalEntityId,
      supplierPartnerId: original.supplierPartnerId,
      supplierLegalEntityId: original.supplierLegalEntityId,
      payeeNameSnapshot: original.payeeNameSnapshot,
      payeeTaxIdSnapshot: original.payeeTaxIdSnapshot,
      categoryId: original.categoryId,
      defaultCostCenterId: original.defaultCostCenterId,
      defaultLocationId: original.defaultLocationId,
      source: "MANUAL",
      description: `${original.description} (copia)`,
      documentType: original.documentType,
      documentNumber: null,
      competenceDate: original.competenceDate,
      issueDate: original.issueDate,
      dueDate: original.dueDate,
      originalAmountCents: original.originalAmountCents,
      discountCents: original.discountCents,
      interestCents: original.interestCents,
      penaltyCents: original.penaltyCents,
      otherAdditionsCents: original.otherAdditionsCents,
      amountStatus: original.amountStatus,
      notes: original.notes,
      internalNotes: original.internalNotes
    });
  }

  findPossiblePayableDuplicates(input: unknown): AccountPayable[] {
    const data = accountPayableInputSchema.parse(input);
    const totals = this.calculatePayableAmounts(data.originalAmountCents, data.discountCents, data.interestCents, data.penaltyCents, data.otherAdditionsCents);
    const params: unknown[] = [data.organizationId, data.ownLegalEntityId, data.competenceDate, data.dueDate, data.documentNumber ?? "", data.supplierPartnerId ?? "", totals.finalAmountCents ?? data.originalAmountCents ?? -1];
    return (this.db.prepare(`SELECT * FROM accounts_payable WHERE organization_id = ? AND own_legal_entity_id = ? AND status != 'CANCELLED'
      AND (competence_date = ? OR due_date = ? OR COALESCE(document_number, '') = ? OR COALESCE(supplier_partner_id, '') = ? OR COALESCE(final_amount_cents, original_amount_cents, -1) = ?)
      ORDER BY created_at DESC LIMIT 20`).all(...params) as DbRecord[]).map(mapAccountPayable);
  }

  addPayableAllocation(input: unknown): AccountPayableDetail {
    const data = accountPayableAllocationInputSchema.parse(input);
    const payable = this.getPayable(data.accountPayableId);
    if (payable.status === "PAID") throw new Error("Rateio de conta paga exige ajuste reforcado.");
    if (data.costCenterId) this.assertCostCenterScope(data.costCenterId, payable.organizationId);
    if (data.locationId) this.assertLocationScope(data.locationId, payable.organizationId, payable.ownLegalEntityId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO account_payable_allocations (id, account_payable_id, cost_center_id, location_id, allocation_amount_cents, allocation_basis_points, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, payable.id, data.costCenterId, data.locationId, data.allocationAmountCents, data.allocationBasisPoints, data.description, now, now);
    this.validatePayableAllocations(payable.id);
    return this.getAccountPayable(payable.id);
  }

  removePayableAllocation(id: string): AccountPayableDetail {
    const row = this.db.prepare("SELECT * FROM account_payable_allocations WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Rateio nao encontrado.");
    const payableId = String(row.account_payable_id);
    this.db.prepare("DELETE FROM account_payable_allocations WHERE id = ?").run(id);
    this.validatePayableAllocations(payableId);
    return this.getAccountPayable(payableId);
  }

  contestAccountPayable(id: string, reason: string): AccountPayableDetail {
    const payable = this.getPayable(id);
    if (payable.status === "PAID" || payable.status === "CANCELLED") throw new Error("Conta paga ou cancelada nao pode ser contestada.");
    const now = new Date().toISOString();
    this.db.prepare("UPDATE accounts_payable SET status = 'CONTESTED', contested_at = ?, contest_reason = ?, updated_at = ? WHERE id = ?").run(now, reason, now, id);
    this.recordPayableStatus(id, payable.status, "CONTESTED", reason);
    return this.getAccountPayable(id);
  }

  cancelAccountPayable(id: string, reason: string): AccountPayableDetail {
    const run = this.db.transaction(() => {
      const payable = this.getPayable(id);
      if (payable.paidAmountCents > 0) throw new Error("Cancele ou estorne pagamentos antes de cancelar esta conta.");
      const now = new Date().toISOString();
      this.db.prepare("UPDATE accounts_payable SET status = 'CANCELLED', cancelled_at = ?, cancellation_reason = ?, updated_at = ? WHERE id = ?").run(now, reason, now, id);
      this.recordPayableStatus(id, payable.status, "CANCELLED", reason);
    });
    run();
    return this.getAccountPayable(id);
  }

  listPayableRecurringTemplates(organizationId: string): PayableRecurringTemplate[] {
    return (this.db.prepare("SELECT * FROM payable_recurring_templates WHERE organization_id = ? ORDER BY is_active DESC, description").all(organizationId) as DbRecord[]).map(mapPayableRecurringTemplate);
  }

  createPayableRecurringTemplate(input: unknown): PayableRecurringTemplate {
    const data = payableRecurringTemplateInputSchema.parse(input);
    this.assertRecurringInputScope(data);
    if (data.amountMode === "FIXED" && data.fixedAmountCents === null) throw new Error("Recorrencia fixa exige valor.");
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO payable_recurring_templates (
      id, organization_id, own_legal_entity_id, supplier_partner_id, supplier_legal_entity_id, payee_name_snapshot, category_id,
      default_cost_center_id, default_location_id, description, amount_mode, fixed_amount_cents, estimated_amount_cents, frequency, due_day,
      generation_lead_days, start_date, end_date, auto_generate_on_open, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.organizationId, data.ownLegalEntityId, data.supplierPartnerId, data.supplierLegalEntityId, data.payeeNameSnapshot, data.categoryId, data.defaultCostCenterId, data.defaultLocationId, data.description, data.amountMode, data.fixedAmountCents, data.estimatedAmountCents, data.frequency, data.dueDay, data.generationLeadDays, data.startDate, data.endDate, data.autoGenerateOnOpen ? 1 : 0, data.isActive ? 1 : 0, now, now);
    return this.getPayableRecurringTemplate(id);
  }

  getPayableRecurringTemplate(id: string): PayableRecurringTemplate {
    const row = this.db.prepare("SELECT * FROM payable_recurring_templates WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Recorrencia nao encontrada.");
    return mapPayableRecurringTemplate(row);
  }

  previewPayableRecurringGeneration(templateId: string, monthsAhead = 3): Array<{ competenceDate: string; dueDate: string; amountCents: number | null; amountStatus: string }> {
    const template = this.getPayableRecurringTemplate(templateId);
    return this.buildRecurringOccurrences(template, monthsAhead);
  }

  generatePayableRecurringPeriod(templateId: string, monthsAhead = 3): AccountPayable[] {
    const run = this.db.transaction(() => {
      const template = this.getPayableRecurringTemplate(templateId);
      const created: AccountPayable[] = [];
      this.buildRecurringOccurrences(template, monthsAhead).forEach((occurrence) => {
        const existing = this.db.prepare("SELECT id FROM accounts_payable WHERE recurring_template_id = ? AND competence_date = ? AND status != 'CANCELLED'").get(template.id, occurrence.competenceDate);
        if (existing) return;
        const detail = this.createAccountPayableDraft({
          organizationId: template.organizationId,
          ownLegalEntityId: template.ownLegalEntityId,
          supplierPartnerId: template.supplierPartnerId,
          supplierLegalEntityId: template.supplierLegalEntityId,
          payeeNameSnapshot: template.payeeNameSnapshot,
          payeeTaxIdSnapshot: null,
          categoryId: template.categoryId,
          defaultCostCenterId: template.defaultCostCenterId,
          defaultLocationId: template.defaultLocationId,
          source: "RECURRING",
          description: template.description,
          documentType: null,
          documentNumber: null,
          competenceDate: occurrence.competenceDate,
          issueDate: null,
          dueDate: occurrence.dueDate,
          originalAmountCents: occurrence.amountCents,
          discountCents: 0,
          interestCents: 0,
          penaltyCents: 0,
          otherAdditionsCents: 0,
          amountStatus: occurrence.amountStatus,
          notes: null,
          internalNotes: null
        });
        this.db.prepare("UPDATE accounts_payable SET recurring_template_id = ?, status = ? WHERE id = ?").run(template.id, occurrence.amountStatus === "CONFIRMED" ? "OPEN" : "SCHEDULED", detail.payable.id);
        created.push(this.getPayable(detail.payable.id));
      });
      const last = created.at(-1);
      if (last) this.db.prepare("UPDATE payable_recurring_templates SET last_generated_competence = ?, updated_at = ? WHERE id = ?").run(last.competenceDate, new Date().toISOString(), template.id);
      return created;
    });
    return run();
  }

  createPayableInstallmentGroup(input: unknown): { group: PayableInstallmentGroup; payables: AccountPayable[] } {
    const data = payableInstallmentGroupInputSchema.parse(input);
    this.assertPayableInputScope({
      organizationId: data.organizationId,
      ownLegalEntityId: data.ownLegalEntityId,
      supplierPartnerId: data.supplierPartnerId,
      supplierLegalEntityId: data.supplierLegalEntityId,
      categoryId: data.categoryId,
      defaultCostCenterId: data.defaultCostCenterId,
      defaultLocationId: data.defaultLocationId
    });
    const run = this.db.transaction(() => {
      const groupId = randomUUID();
      const now = new Date().toISOString();
      this.db.prepare("INSERT INTO payable_installment_groups (id, organization_id, own_legal_entity_id, supplier_partner_id, description, total_amount_cents, installment_count, first_due_date, interval_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(groupId, data.organizationId, data.ownLegalEntityId, data.supplierPartnerId, data.description, data.totalAmountCents, data.installmentCount, data.firstDueDate, data.intervalType, now, now);
      const amounts = splitCents(data.totalAmountCents, data.installmentCount);
      const payables: AccountPayable[] = [];
      amounts.forEach((amount, index) => {
        const dueDate = data.intervalType === "DAYS_30" ? addDays(data.firstDueDate, index * 30) : addMonthsSafe(data.firstDueDate, index);
        const detail = this.createAccountPayableDraft({
          organizationId: data.organizationId,
          ownLegalEntityId: data.ownLegalEntityId,
          supplierPartnerId: data.supplierPartnerId,
          supplierLegalEntityId: data.supplierLegalEntityId,
          payeeNameSnapshot: data.payeeNameSnapshot,
          payeeTaxIdSnapshot: null,
          categoryId: data.categoryId,
          defaultCostCenterId: data.defaultCostCenterId,
          defaultLocationId: data.defaultLocationId,
          source: "INSTALLMENT",
          description: `${data.description} ${index + 1}/${data.installmentCount}`,
          documentType: null,
          documentNumber: `${index + 1}/${data.installmentCount}`,
          competenceDate: dueDate.slice(0, 8) + "01",
          issueDate: null,
          dueDate,
          originalAmountCents: amount,
          discountCents: 0,
          interestCents: 0,
          penaltyCents: 0,
          otherAdditionsCents: 0,
          amountStatus: "CONFIRMED",
          notes: null,
          internalNotes: null
        });
        this.db.prepare("UPDATE accounts_payable SET installment_group_id = ?, installment_number = ?, installment_count = ?, status = 'OPEN' WHERE id = ?").run(groupId, index + 1, data.installmentCount, detail.payable.id);
        payables.push(this.getPayable(detail.payable.id));
      });
      return { group: this.getPayableInstallmentGroup(groupId), payables };
    });
    return run();
  }

  getPayableInstallmentGroup(id: string): PayableInstallmentGroup {
    const row = this.db.prepare("SELECT * FROM payable_installment_groups WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Parcelamento nao encontrado.");
    return mapPayableInstallmentGroup(row);
  }

  createPayablePayment(input: unknown): PayablePayment {
    const data = payablePaymentInputSchema.parse(input);
    this.assertLegalEntityScope(data.ownLegalEntityId, data.organizationId);
    if (data.financialAccountId) {
      const account = this.getFinancialAccount(data.financialAccountId);
      if (account.organizationId !== data.organizationId || account.ownLegalEntityId !== data.ownLegalEntityId) throw new Error("Conta financeira fora do escopo do pagamento.");
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO payable_payments (id, organization_id, own_legal_entity_id, financial_account_id, payment_date, amount_cents, payment_method, transaction_reference, payee_name_snapshot, notes, attachment_path, attachment_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?)")
      .run(id, data.organizationId, data.ownLegalEntityId, data.financialAccountId, data.paymentDate, data.amountCents, data.paymentMethod, data.transactionReference, data.payeeNameSnapshot, data.notes, data.attachmentPath, data.attachmentHash, now, now);
    return this.getPayablePayment(id);
  }

  allocatePayablePayment(input: unknown): AccountPayableDetail {
    const data = payablePaymentAllocationInputSchema.parse(input);
    const run = this.db.transaction(() => {
      const payment = this.getPayablePayment(data.payablePaymentId);
      const payable = this.getPayable(data.accountPayableId);
      if (payment.organizationId !== payable.organizationId || payment.ownLegalEntityId !== payable.ownLegalEntityId) throw new Error("Pagamento fora do escopo da conta.");
      if (payable.openAmountCents === null) throw new Error("Conta sem valor confirmado.");
      const allocated = this.sumPayablePaymentAllocated(payment.id);
      if (allocated + data.amountCents > payment.amountCents) throw new Error("Pagamento sem saldo disponivel.");
      if (data.amountCents > payable.openAmountCents) throw new Error("Pagamento maior que saldo aberto.");
      this.db.prepare("INSERT INTO payable_payment_allocations (id, payable_payment_id, account_payable_id, amount_cents, allocated_at) VALUES (?, ?, ?, ?, ?)")
        .run(randomUUID(), payment.id, payable.id, data.amountCents, new Date().toISOString());
      this.recalculatePayable(payable.id);
    });
    run();
    return this.getAccountPayable(data.accountPayableId);
  }

  cancelPayablePayment(id: string, reason: string): PayablePayment {
    const run = this.db.transaction(() => {
      const payment = this.getPayablePayment(id);
      const now = new Date().toISOString();
      const payableIds = (this.db.prepare("SELECT account_payable_id FROM payable_payment_allocations WHERE payable_payment_id = ? AND cancelled_at IS NULL").all(id) as Array<{ account_payable_id: string }>).map((row) => row.account_payable_id);
      this.db.prepare("UPDATE payable_payments SET status = 'CANCELLED', cancelled_at = ?, cancellation_reason = ?, updated_at = ? WHERE id = ?").run(now, reason, now, id);
      this.db.prepare("UPDATE payable_payment_allocations SET cancelled_at = ?, cancellation_reason = ? WHERE payable_payment_id = ? AND cancelled_at IS NULL").run(now, reason, id);
      payableIds.forEach((payableId) => this.recalculatePayable(payableId));
      return payment;
    });
    run();
    return this.getPayablePayment(id);
  }

  getPayablePayment(id: string): PayablePayment {
    const row = this.db.prepare("SELECT * FROM payable_payments WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Pagamento de conta nao encontrado.");
    return mapPayablePayment(row);
  }

  listPayablePayments(filters: { organizationId: string; ownLegalEntityId?: string }): PayablePayment[] {
    const where = ["organization_id = ?"];
    const params: unknown[] = [filters.organizationId];
    if (filters.ownLegalEntityId) {
      where.push("own_legal_entity_id = ?");
      params.push(filters.ownLegalEntityId);
    }
    return (this.db.prepare(`SELECT * FROM payable_payments WHERE ${where.join(" AND ")} ORDER BY payment_date DESC`).all(...params) as DbRecord[]).map(mapPayablePayment);
  }

  addPayableAttachment(input: unknown): PayableDocumentAttachment {
    const data = addPayableAttachmentInputSchema.parse(input);
    if (!this.directories) throw new Error("Diretorios da aplicacao indisponiveis.");
    const payable = this.getPayable(data.accountPayableId);
    const id = randomUUID();
    const stored = storePayableAttachment({ sourcePath: data.sourcePath ?? "", directories: this.directories, organizationId: payable.organizationId, ownLegalEntityId: payable.ownLegalEntityId, accountPayableId: payable.id, attachmentId: id });
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO payable_document_attachments (
      id, organization_id, own_legal_entity_id, account_payable_id, payable_payment_id, attachment_kind, attachment_type,
      original_file_name, stored_file_path, file_hash, mime_type, file_extension, file_size, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, NULL, 'PAYABLE_DOCUMENT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, payable.organizationId, payable.ownLegalEntityId, payable.id, data.attachmentType, stored.originalFileName, stored.storedFilePath, stored.fileHash, stored.mimeType, stored.fileExtension, stored.fileSize, data.description, now, now);
    return this.getPayableAttachment(id);
  }

  addPayablePaymentAttachment(input: unknown): PayableDocumentAttachment {
    const data = addPayablePaymentAttachmentInputSchema.parse(input);
    if (!this.directories) throw new Error("Diretorios da aplicacao indisponiveis.");
    const payment = this.getPayablePayment(data.payablePaymentId);
    const payableId = this.findFirstPayableForPayment(payment.id);
    if (!payableId) throw new Error("Pagamento precisa estar alocado antes de anexar comprovante.");
    const payable = this.getPayable(payableId);
    if (payable.organizationId !== payment.organizationId || payable.ownLegalEntityId !== payment.ownLegalEntityId) throw new Error("Pagamento fora do escopo da conta.");
    const id = randomUUID();
    const stored = storePayableAttachment({ sourcePath: data.sourcePath ?? "", directories: this.directories, organizationId: payable.organizationId, ownLegalEntityId: payable.ownLegalEntityId, accountPayableId: payable.id, payablePaymentId: payment.id, attachmentId: id });
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO payable_document_attachments (
      id, organization_id, own_legal_entity_id, account_payable_id, payable_payment_id, attachment_kind, attachment_type,
      original_file_name, stored_file_path, file_hash, mime_type, file_extension, file_size, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'PAYMENT_PROOF', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, payable.organizationId, payable.ownLegalEntityId, payable.id, payment.id, data.attachmentType, stored.originalFileName, stored.storedFilePath, stored.fileHash, stored.mimeType, stored.fileExtension, stored.fileSize, data.description, now, now);
    return this.getPayableAttachment(id);
  }

  listPayableAttachments(accountPayableId: string): PayableDocumentAttachment[] {
    const payable = this.getPayable(accountPayableId);
    return (this.db.prepare("SELECT * FROM payable_document_attachments WHERE account_payable_id = ? AND payable_payment_id IS NULL AND removed_at IS NULL ORDER BY created_at DESC").all(payable.id) as DbRecord[]).map(mapPayableDocumentAttachment);
  }

  listPayablePaymentAttachments(payablePaymentId: string): PayableDocumentAttachment[] {
    const payment = this.getPayablePayment(payablePaymentId);
    return (this.db.prepare("SELECT * FROM payable_document_attachments WHERE payable_payment_id = ? AND organization_id = ? AND own_legal_entity_id = ? AND removed_at IS NULL ORDER BY created_at DESC").all(payment.id, payment.organizationId, payment.ownLegalEntityId) as DbRecord[]).map(mapPayableDocumentAttachment);
  }

  getPayableAttachment(id: string): PayableDocumentAttachment {
    const row = this.db.prepare("SELECT * FROM payable_document_attachments WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Anexo nao encontrado.");
    return mapPayableDocumentAttachment(row);
  }

  getPayableAttachmentPath(id: string): string {
    const attachment = this.getPayableAttachment(id);
    if (attachment.removedAt) throw new Error("Anexo removido.");
    if (attachment.accountPayableId) this.getPayable(attachment.accountPayableId);
    if (attachment.payablePaymentId) this.getPayablePayment(attachment.payablePaymentId);
    return attachment.storedFilePath;
  }

  removePayableAttachment(id: string, reason: string | null): PayableDocumentAttachment {
    const attachment = this.getPayableAttachment(id);
    const payable = attachment.accountPayableId ? this.getPayable(attachment.accountPayableId) : null;
    if (payable && payable.status !== "DRAFT" && !reason?.trim()) throw new Error("Informe motivo para remover anexo de registro confirmado.");
    const now = new Date().toISOString();
    this.db.prepare("UPDATE payable_document_attachments SET removed_at = ?, removal_reason = ?, updated_at = ? WHERE id = ?").run(now, reason, now, id);
    return this.getPayableAttachment(id);
  }

  previewFinancialReport(input: unknown): FinancialReportPreview {
    const data = financialReportFiltersSchema.parse(input);
    const payables = this.queryFinancialReportPayables(data, "ACCOUNTS_PAYABLE");
    return this.buildFinancialPreview("ACCOUNTS_PAYABLE", data, payables);
  }

  async generateFinancialReport(input: unknown): Promise<FinancialReportGeneration> {
    const data = financialReportInputSchema.parse(input);
    if (!this.directories) throw new Error("Diretorios da aplicacao indisponiveis.");
    const organization = this.getOrganization(data.filters.organizationId);
    const ownLegalEntity = data.filters.ownLegalEntityId ? this.getLegalEntity(data.filters.ownLegalEntityId) : null;
    if (ownLegalEntity && ownLegalEntity.organizationId !== organization.id) throw new Error("CNPJ proprio fora da organizacao.");
    const payables = this.queryFinancialReportPayables(data.filters, data.reportType);
    const payments = this.queryFinancialReportPayments(data.filters, data.reportType);
    const preview = this.buildFinancialPreview(data.reportType, data.filters, payables, payments);
    const id = randomUUID();
    const result = await generateFinancialReportFile({
      directories: this.directories,
      organization,
      ownLegalEntity,
      reportType: data.reportType,
      format: data.format,
      filters: data.filters,
      preview,
      payables,
      payments,
      categories: this.listExpenseCategories(organization.id),
      locations: this.listLocations({ organizationId: organization.id, status: "all" }),
      costCenters: this.listCostCenters({ organizationId: organization.id, status: "all" }),
      partners: this.listBusinessPartners({ organizationId: organization.id, status: "all" }),
      reportId: id
    });
    this.db.prepare("INSERT INTO financial_report_generations (id, organization_id, own_legal_entity_id, report_type, format, filters_json, file_name, stored_file_path, file_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, organization.id, ownLegalEntity?.id ?? null, data.reportType, data.format, JSON.stringify(data.filters), result.fileName, result.storedFilePath, result.fileHash, new Date().toISOString());
    return this.getFinancialReportGeneration(id);
  }

  listFinancialReportGenerations(filters: { organizationId: string; ownLegalEntityId?: string | null }): FinancialReportGeneration[] {
    const where = ["organization_id = ?"];
    const params: unknown[] = [filters.organizationId];
    if (filters.ownLegalEntityId) {
      where.push("own_legal_entity_id = ?");
      params.push(filters.ownLegalEntityId);
    }
    return (this.db.prepare(`SELECT * FROM financial_report_generations WHERE ${where.join(" AND ")} ORDER BY created_at DESC`).all(...params) as DbRecord[]).map(mapFinancialReportGeneration);
  }

  getFinancialReportGeneration(id: string): FinancialReportGeneration {
    const row = this.db.prepare("SELECT * FROM financial_report_generations WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Relatorio nao encontrado.");
    return mapFinancialReportGeneration(row);
  }

  getFinancialReportPath(id: string): string {
    return this.getFinancialReportGeneration(id).storedFilePath;
  }

  getFinancialSummary(organizationId: string): FinancialSummary {
    this.assertOrganizationWritable(organizationId);
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + "01";
    const monthEnd = endOfMonth(monthStart);
    const sum = (sql: string, ...params: unknown[]): number => Number((this.db.prepare(sql).get(...params) as { total: number | null }).total ?? 0);
    const payableThisMonthCents = sum("SELECT COALESCE(SUM(final_amount_cents),0) AS total FROM accounts_payable WHERE organization_id = ? AND status != 'CANCELLED' AND due_date BETWEEN ? AND ?", organizationId, monthStart, monthEnd);
    const paidThisMonthCents = sum("SELECT COALESCE(SUM(amount_cents),0) AS total FROM payable_payments WHERE organization_id = ? AND status = 'CONFIRMED' AND payment_date BETWEEN ? AND ?", organizationId, monthStart, monthEnd);
    const openCents = sum("SELECT COALESCE(SUM(open_amount_cents),0) AS total FROM accounts_payable WHERE organization_id = ? AND status NOT IN ('CANCELLED','PAID')", organizationId);
    const overdueCents = sum("SELECT COALESCE(SUM(open_amount_cents),0) AS total FROM accounts_payable WHERE organization_id = ? AND status != 'CANCELLED' AND open_amount_cents > 0 AND due_date < ?", organizationId, today);
    const dueNext7DaysCents = sum("SELECT COALESCE(SUM(open_amount_cents),0) AS total FROM accounts_payable WHERE organization_id = ? AND status != 'CANCELLED' AND open_amount_cents > 0 AND due_date BETWEEN ? AND ?", organizationId, today, addDays(today, 7));
    const fixedExpensesCents = sum("SELECT COALESCE(SUM(ap.final_amount_cents),0) AS total FROM accounts_payable ap JOIN expense_categories ec ON ec.id = ap.category_id WHERE ap.organization_id = ? AND ap.status != 'CANCELLED' AND ec.expense_nature = 'FIXED'", organizationId);
    const variableExpensesCents = sum("SELECT COALESCE(SUM(ap.final_amount_cents),0) AS total FROM accounts_payable ap JOIN expense_categories ec ON ec.id = ap.category_id WHERE ap.organization_id = ? AND ap.status != 'CANCELLED' AND ec.expense_nature = 'VARIABLE'", organizationId);
    const byCategory = (this.db.prepare("SELECT ap.category_id, ec.name AS label, COALESCE(SUM(ap.final_amount_cents),0) AS amount FROM accounts_payable ap LEFT JOIN expense_categories ec ON ec.id = ap.category_id WHERE ap.organization_id = ? AND ap.status != 'CANCELLED' GROUP BY ap.category_id, ec.name ORDER BY amount DESC").all(organizationId) as DbRecord[]).map((row) => ({ categoryId: textOrNullLocal(row.category_id), label: String(row.label ?? "Sem categoria"), amountCents: Number(row.amount) }));
    const byLocation = (this.db.prepare("SELECT ap.default_location_id, COALESCE(l.name, 'Sem local') AS label, COALESCE(SUM(ap.final_amount_cents),0) AS amount FROM accounts_payable ap LEFT JOIN locations l ON l.id = ap.default_location_id WHERE ap.organization_id = ? AND ap.status != 'CANCELLED' GROUP BY ap.default_location_id, l.name ORDER BY amount DESC").all(organizationId) as DbRecord[]).map((row) => ({ locationId: textOrNullLocal(row.default_location_id), label: String(row.label), amountCents: Number(row.amount) }));
    const byLegalEntity = (this.db.prepare("SELECT ap.own_legal_entity_id, le.trade_name AS label, COALESCE(SUM(ap.final_amount_cents),0) AS amount FROM accounts_payable ap JOIN legal_entities le ON le.id = ap.own_legal_entity_id WHERE ap.organization_id = ? AND ap.status != 'CANCELLED' GROUP BY ap.own_legal_entity_id, le.trade_name ORDER BY amount DESC").all(organizationId) as DbRecord[]).map((row) => ({ ownLegalEntityId: String(row.own_legal_entity_id), label: String(row.label), amountCents: Number(row.amount) }));
    const receivableOpenCents = this.getBillingSummary(organizationId).openCents;
    return { payableThisMonthCents, paidThisMonthCents, openCents, overdueCents, dueNext7DaysCents, fixedExpensesCents, variableExpensesCents, byCategory, byLocation, byLegalEntity, projectedResultCents: receivableOpenCents - openCents, receivableOpenCents, payableOpenCents: openCents };
  }

  private getPayable(id: string): AccountPayable {
    const row = this.db.prepare("SELECT * FROM accounts_payable WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Conta a pagar nao encontrada.");
    return this.refreshPayableComputedStatus(mapAccountPayable(row));
  }

  private ensureDefaultExpenseCategories(organizationId: string): void {
    this.assertOrganizationWritable(organizationId);
    const now = new Date().toISOString();
    const defaults: Array<{ code: string; name: string; nature: string }> = [
      { code: "RENT", name: "Aluguel", nature: "FIXED" },
      { code: "WATER", name: "Agua", nature: "VARIABLE" },
      { code: "POWER", name: "Energia eletrica", nature: "VARIABLE" },
      { code: "PHONE_INTERNET", name: "Internet e telefone", nature: "FIXED" },
      { code: "ACCOUNTING", name: "Contabilidade", nature: "FIXED" },
      { code: "TAXES", name: "Impostos e taxas", nature: "TAX" },
      { code: "MAINTENANCE", name: "Manutencao", nature: "VARIABLE" },
      { code: "OFFICE_SUPPLIES", name: "Material de escritorio", nature: "VARIABLE" },
      { code: "OUTSOURCED_SERVICES", name: "Servicos terceirizados", nature: "OTHER" },
      { code: "BANK_FEES", name: "Despesas bancarias", nature: "FINANCIAL" },
      { code: "OTHER_EXPENSES", name: "Outras despesas", nature: "OTHER" }
    ];
    defaults.forEach((item) => {
      const exists = this.db.prepare("SELECT id FROM expense_categories WHERE organization_id = ? AND code = ?").get(organizationId, item.code);
      if (!exists) {
        this.db.prepare("INSERT INTO expense_categories (id, organization_id, parent_category_id, name, code, expense_nature, description, is_active, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, NULL, 1, ?, ?)")
          .run(randomUUID(), organizationId, item.name, item.code, item.nature, now, now);
      }
    });
  }

  private assertExpenseCategoryScope(id: string, organizationId: string): ExpenseCategory {
    const category = this.getExpenseCategory(id);
    if (category.organizationId !== organizationId) throw new Error("Categoria fora da organizacao.");
    return category;
  }

  private assertCostCenterScope(id: string, organizationId: string): CostCenter {
    const center = this.getCostCenter(id);
    if (center.organizationId !== organizationId) throw new Error("Centro de custo fora da organizacao.");
    return center;
  }

  private assertLegalEntityScope(id: string, organizationId: string): LegalEntity {
    const entity = this.getLegalEntity(id);
    if (entity.organizationId !== organizationId) throw new Error("CNPJ proprio fora da organizacao.");
    return entity;
  }

  private assertLocationScope(id: string, organizationId: string, ownLegalEntityId?: string | null): Location {
    const location = this.getLocation(id);
    if (location.organizationId !== organizationId) throw new Error("Local fora da organizacao.");
    if (ownLegalEntityId && location.legalEntityId && location.legalEntityId !== ownLegalEntityId) throw new Error("Local vinculado a outro CNPJ proprio.");
    return location;
  }

  private assertNoExpenseCategoryCycle(id: string, parentId: string): void {
    let current: string | null = parentId;
    while (current) {
      if (current === id) throw new Error("Ciclo na hierarquia de categorias.");
      const row = this.db.prepare("SELECT parent_category_id FROM expense_categories WHERE id = ?").get(current) as { parent_category_id: string | null } | undefined;
      current = row?.parent_category_id ?? null;
    }
  }

  private assertNoCostCenterCycle(id: string, parentId: string): void {
    let current: string | null = parentId;
    while (current) {
      if (current === id) throw new Error("Ciclo na hierarquia de centros de custo.");
      const row = this.db.prepare("SELECT parent_cost_center_id FROM cost_centers WHERE id = ?").get(current) as { parent_cost_center_id: string | null } | undefined;
      current = row?.parent_cost_center_id ?? null;
    }
  }

  private assertPayableInputScope(data: {
    organizationId: string;
    ownLegalEntityId: string;
    supplierPartnerId: string | null;
    supplierLegalEntityId?: string | null;
    categoryId: string;
    defaultCostCenterId: string | null;
    defaultLocationId: string | null;
  }): void {
    this.assertLegalEntityScope(data.ownLegalEntityId, data.organizationId);
    this.assertExpenseCategoryScope(data.categoryId, data.organizationId);
    if (data.defaultCostCenterId) this.assertCostCenterScope(data.defaultCostCenterId, data.organizationId);
    if (data.defaultLocationId) this.assertLocationScope(data.defaultLocationId, data.organizationId, data.ownLegalEntityId);
    if (data.supplierPartnerId) {
      this.getBusinessPartner(data.supplierPartnerId);
    }
    if (data.supplierLegalEntityId) {
      const legal = this.getPartnerLegalEntity(data.supplierLegalEntityId);
      if (data.supplierPartnerId && legal.businessPartnerId !== data.supplierPartnerId) throw new Error("Estabelecimento nao pertence ao favorecido.");
    }
  }

  private assertRecurringInputScope(data: ReturnType<typeof payableRecurringTemplateInputSchema.parse>): void {
    this.assertPayableInputScope({
      organizationId: data.organizationId,
      ownLegalEntityId: data.ownLegalEntityId,
      supplierPartnerId: data.supplierPartnerId,
      supplierLegalEntityId: data.supplierLegalEntityId,
      categoryId: data.categoryId,
      defaultCostCenterId: data.defaultCostCenterId,
      defaultLocationId: data.defaultLocationId
    });
  }

  private calculatePayableAmounts(original: number | null, discount: number, interest: number, penalty: number, additions: number, paid = 0): { finalAmountCents: number | null; openAmountCents: number | null } {
    if (original === null) return { finalAmountCents: null, openAmountCents: null };
    const finalAmountCents = original - discount + interest + penalty + additions;
    if (finalAmountCents < 0) throw new Error("Valor final nao pode ser negativo.");
    const openAmountCents = Math.max(0, finalAmountCents - paid);
    return { finalAmountCents, openAmountCents };
  }

  private recalculatePayable(id: string): void {
    const payable = this.getPayable(id);
    const paid = Number((this.db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payable_payment_allocations WHERE account_payable_id = ? AND cancelled_at IS NULL").get(id) as { total: number }).total);
    const totals = this.calculatePayableAmounts(payable.originalAmountCents, payable.discountCents, payable.interestCents, payable.penaltyCents, payable.otherAdditionsCents, paid);
    let status = payable.status;
    if (!["DRAFT", "SCHEDULED", "CONTESTED", "CANCELLED"].includes(status) && totals.openAmountCents !== null) {
      status = totals.openAmountCents === 0 ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "OPEN";
      if (status === "OPEN" && payable.dueDate < new Date().toISOString().slice(0, 10)) status = "OVERDUE";
    }
    this.db.prepare("UPDATE accounts_payable SET paid_amount_cents = ?, open_amount_cents = ?, final_amount_cents = ?, status = ?, updated_at = ? WHERE id = ?")
      .run(paid, totals.openAmountCents, totals.finalAmountCents, status, new Date().toISOString(), id);
  }

  private refreshPayableStatus(id: string): void {
    this.recalculatePayable(id);
  }

  private refreshPayableComputedStatus(payable: AccountPayable): AccountPayable {
    if (payable.status === "OPEN" && payable.openAmountCents !== null && payable.openAmountCents > 0 && payable.dueDate < new Date().toISOString().slice(0, 10)) {
      this.db.prepare("UPDATE accounts_payable SET status = 'OVERDUE', updated_at = ? WHERE id = ?").run(new Date().toISOString(), payable.id);
      return { ...payable, status: "OVERDUE" };
    }
    return payable;
  }

  private validatePayableAllocations(id: string): void {
    const payable = this.getPayable(id);
    const count = Number((this.db.prepare("SELECT COUNT(*) AS total FROM account_payable_allocations WHERE account_payable_id = ?").get(id) as { total: number }).total);
    if (count === 0 || payable.finalAmountCents === null) return;
    const total = Number((this.db.prepare("SELECT COALESCE(SUM(allocation_amount_cents), 0) AS total FROM account_payable_allocations WHERE account_payable_id = ?").get(id) as { total: number }).total);
    if (total !== payable.finalAmountCents) throw new Error("Soma dos rateios deve ser igual ao valor final da conta.");
  }

  private sumPayablePaymentAllocated(paymentId: string): number {
    return Number((this.db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payable_payment_allocations WHERE payable_payment_id = ? AND cancelled_at IS NULL").get(paymentId) as { total: number }).total);
  }

  private recordPayableStatus(id: string, previous: string | null, next: string, reason: string): void {
    this.db.prepare("INSERT INTO payable_status_history (id, account_payable_id, previous_status, new_status, reason, changed_by_user_id, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), id, previous, next, reason, "usuario-provisorio", new Date().toISOString());
  }

  private buildRecurringOccurrences(template: PayableRecurringTemplate, monthsAhead: number): Array<{ competenceDate: string; dueDate: string; amountCents: number | null; amountStatus: "ESTIMATED" | "CONFIRMED" }> {
    const result: Array<{ competenceDate: string; dueDate: string; amountCents: number | null; amountStatus: "ESTIMATED" | "CONFIRMED" }> = [];
    let competence = (template.lastGeneratedCompetence ? addMonthsSafe(template.lastGeneratedCompetence, 1) : template.startDate).slice(0, 8) + "01";
    for (let index = 0; index < monthsAhead; index += 1) {
      if (template.endDate && competence > template.endDate) break;
      const dueDate = withDayOfMonth(competence, template.dueDay);
      result.push({
        competenceDate: competence,
        dueDate,
        amountCents: template.amountMode === "FIXED" ? template.fixedAmountCents : template.estimatedAmountCents,
        amountStatus: template.amountMode === "FIXED" ? "CONFIRMED" : "ESTIMATED"
      });
      competence = addMonthsSafe(competence, frequencyMonths(template.frequency));
    }
    return result;
  }

  private cleanOptionalTaxId(value: string | null): string | null {
    return value ? value.replace(/\D/g, "") : null;
  }

  private findFirstPayableForPayment(paymentId: string): string | null {
    const row = this.db.prepare("SELECT account_payable_id FROM payable_payment_allocations WHERE payable_payment_id = ? AND cancelled_at IS NULL ORDER BY allocated_at LIMIT 1").get(paymentId) as { account_payable_id: string } | undefined;
    return row?.account_payable_id ?? null;
  }

  private queryFinancialReportPayables(filters: FinancialReportFilters, reportType: string): AccountPayable[] {
    this.assertOrganizationWritable(filters.organizationId);
    const where = ["ap.organization_id = ?"];
    const params: unknown[] = [filters.organizationId];
    if (filters.ownLegalEntityId) {
      this.assertLegalEntityScope(filters.ownLegalEntityId, filters.organizationId);
      where.push("ap.own_legal_entity_id = ?");
      params.push(filters.ownLegalEntityId);
    }
    if (filters.dateStart) { where.push("ap.due_date >= ?"); params.push(filters.dateStart); }
    if (filters.dateEnd) { where.push("ap.due_date <= ?"); params.push(filters.dateEnd); }
    if (filters.categoryId) { this.assertExpenseCategoryScope(filters.categoryId, filters.organizationId); where.push("ap.category_id = ?"); params.push(filters.categoryId); }
    if (filters.locationId) { this.assertLocationScope(filters.locationId, filters.organizationId, filters.ownLegalEntityId); where.push("ap.default_location_id = ?"); params.push(filters.locationId); }
    if (filters.costCenterId) { this.assertCostCenterScope(filters.costCenterId, filters.organizationId); where.push("ap.default_cost_center_id = ?"); params.push(filters.costCenterId); }
    if (filters.supplierPartnerId) { where.push("ap.supplier_partner_id = ?"); params.push(filters.supplierPartnerId); }
    if (filters.status) { where.push("ap.status = ?"); params.push(filters.status); } else { where.push("ap.status != 'CANCELLED'"); }
    if (reportType === "OVERDUE_PAYABLES") { where.push("ap.open_amount_cents > 0 AND ap.due_date < ?"); params.push(new Date().toISOString().slice(0, 10)); }
    if (reportType === "RECURRING") where.push("ap.recurring_template_id IS NOT NULL");
    if (reportType === "INSTALLMENTS") where.push("ap.installment_group_id IS NOT NULL");
    if (reportType === "FIXED_VARIABLE") where.push("ec.expense_nature IN ('FIXED','VARIABLE')");
    return (this.db.prepare(`SELECT ap.* FROM accounts_payable ap LEFT JOIN expense_categories ec ON ec.id = ap.category_id WHERE ${where.join(" AND ")} ORDER BY ap.due_date, ap.description`).all(...params) as DbRecord[]).map(mapAccountPayable);
  }

  private queryFinancialReportPayments(filters: FinancialReportFilters, reportType: string): PayablePayment[] {
    this.assertOrganizationWritable(filters.organizationId);
    const where = ["organization_id = ?"];
    const params: unknown[] = [filters.organizationId];
    if (filters.ownLegalEntityId) { where.push("own_legal_entity_id = ?"); params.push(filters.ownLegalEntityId); }
    if (filters.dateStart) { where.push("payment_date >= ?"); params.push(filters.dateStart); }
    if (filters.dateEnd) { where.push("payment_date <= ?"); params.push(filters.dateEnd); }
    if (reportType !== "PAYMENTS" && reportType !== "PROJECTED_CASH_FLOW") return [];
    return (this.db.prepare(`SELECT * FROM payable_payments WHERE ${where.join(" AND ")} ORDER BY payment_date`).all(...params) as DbRecord[]).map(mapPayablePayment);
  }

  private buildFinancialPreview(reportType: FinancialReportPreview["reportType"], filters: FinancialReportFilters, payables: AccountPayable[], payments: PayablePayment[] = []): FinancialReportPreview {
    const today = new Date().toISOString().slice(0, 10);
    const totalFinalCents = payables.reduce((sum, item) => sum + (item.finalAmountCents ?? 0), 0);
    const totalPaidCents = reportType === "PAYMENTS" ? payments.reduce((sum, item) => sum + item.amountCents, 0) : payables.reduce((sum, item) => sum + item.paidAmountCents, 0);
    const totalOpenCents = payables.reduce((sum, item) => sum + (item.openAmountCents ?? 0), 0);
    const totalOverdueCents = payables.filter((item) => item.status !== "CANCELLED" && (item.openAmountCents ?? 0) > 0 && item.dueDate < today).reduce((sum, item) => sum + (item.openAmountCents ?? 0), 0);
    return { reportType, filters, recordCount: reportType === "PAYMENTS" ? payments.length : payables.length, totalFinalCents, totalPaidCents, totalOpenCents, totalOverdueCents };
  }

  listDealConfirmations(input: unknown = {}): DealConfirmation[] {
    const filters = dealConfirmationListFiltersSchema.optional().parse(input) ?? {};
    return (this.db.prepare("SELECT * FROM deal_confirmations ORDER BY confirmation_date DESC, updated_at DESC").all() as DbRecord[])
      .map(mapDealConfirmation)
      .filter((item) => this.isOrganizationAllowed(item.organizationId))
      .filter((item) => !filters.organizationId || item.organizationId === filters.organizationId)
      .filter((item) => !filters.ownLegalEntityId || item.ownLegalEntityId === filters.ownLegalEntityId)
      .filter((item) => !filters.status || filters.status === "all" || item.status === filters.status)
      .filter((item) => !filters.signatureStatus || filters.signatureStatus === "all" || item.signatureStatus === filters.signatureStatus)
      .filter((item) => !filters.dateStart || item.confirmationDate >= filters.dateStart)
      .filter((item) => !filters.dateEnd || item.confirmationDate <= filters.dateEnd)
      .filter((item) => !filters.productId || this.dealHasProduct(item.id, filters.productId))
      .filter((item) => filters.withFiscalDocument === undefined || this.dealHasFiscalDocument(item.id) === filters.withFiscalDocument)
      .filter((item) => filters.withOperation === undefined || this.dealHasOperation(item.id) === filters.withOperation)
      .filter((item) => this.matchesDealSearch(item.id, filters.search));
  }

  getDealConfirmation(id: string): DealConfirmationDetail {
    const row = this.db.prepare("SELECT * FROM deal_confirmations WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Confirmacao nao encontrada.");
    const confirmation = mapDealConfirmation(row);
    if (!this.isOrganizationAllowed(confirmation.organizationId)) throw new Error("Confirmacao nao autorizada.");
    const parties = (this.db.prepare("SELECT * FROM deal_confirmation_parties WHERE deal_confirmation_id = ? ORDER BY sort_order, party_role").all(id) as DbRecord[]).map(mapDealConfirmationParty);
    const items = (this.db.prepare("SELECT * FROM deal_confirmation_items WHERE deal_confirmation_id = ? ORDER BY sort_order").all(id) as DbRecord[]).map(mapDealConfirmationItem);
    const operations = (this.db.prepare("SELECT o.* FROM operations o JOIN deal_confirmation_operations dco ON dco.operation_id = o.id WHERE dco.deal_confirmation_id = ? ORDER BY o.operation_date").all(id) as DbRecord[]).map(mapOperation);
    const fiscalDocuments = (this.db.prepare("SELECT fd.* FROM fiscal_documents fd JOIN deal_confirmation_fiscal_documents dcfd ON dcfd.fiscal_document_id = fd.id WHERE dcfd.deal_confirmation_id = ? ORDER BY fd.issue_date").all(id) as DbRecord[]).map(mapFiscalDocument);
    const clauses = (this.db.prepare("SELECT * FROM deal_confirmation_clauses WHERE deal_confirmation_id = ? ORDER BY sort_order").all(id) as DbRecord[]).map(mapDealConfirmationClause);
    const paymentTerms = (this.db.prepare("SELECT * FROM deal_payment_terms WHERE deal_confirmation_id = ? ORDER BY sort_order").all(id) as DbRecord[]).map(mapDealPaymentTerm);
    const signers = (this.db.prepare("SELECT * FROM deal_confirmation_signers WHERE deal_confirmation_id = ? ORDER BY signature_order").all(id) as DbRecord[]).map(mapDealConfirmationSigner);
    const documents = (this.db.prepare("SELECT * FROM deal_confirmation_document_versions WHERE deal_confirmation_id = ? ORDER BY version_number").all(id) as DbRecord[]).map(mapDealConfirmationDocumentVersion);
    const history = (this.db.prepare("SELECT * FROM deal_confirmation_status_history WHERE deal_confirmation_id = ? ORDER BY changed_at").all(id) as DbRecord[]).map(mapDealConfirmationStatusHistory);
    return { confirmation, parties, items, operations, fiscalDocuments, clauses, paymentTerms, signers, documents, history, pendingIssues: parseDealIssues(confirmation.pendingIssuesJson) };
  }

  createDealConfirmationDraft(input: unknown): DealConfirmationDetail {
    const data = dealConfirmationDraftInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const own = this.getLegalEntity(data.ownLegalEntityId);
    if (own.organizationId !== data.organizationId) throw new Error("CNPJ proprio pertence a outra organizacao.");
    if (data.templateId) this.assertDealTemplate(data.templateId, data.organizationId, data.ownLegalEntityId);
    const id = randomUUID();
    const now = new Date().toISOString();
    const template = data.templateId ? this.getDealConfirmationTemplate(data.templateId) : this.getDefaultDealTemplate(data.organizationId, data.ownLegalEntityId);
    const bankDefaults = this.resolveDealBankDefaults(own, data);
    const draftNumber = this.reserveNextDealConfirmationNumber(data.organizationId, data.ownLegalEntityId, now.slice(0, 4));
    const trx = this.db.transaction(() => {
      this.db.prepare(`INSERT INTO deal_confirmations (
        id, organization_id, own_legal_entity_id, template_id, confirmation_number, temporary_reference,
        confirmation_date, negotiation_date, status, signature_status, currency_code, total_quantity_sacks_decimal,
        total_commercial_amount_cents, delivery_location_snapshot, delivery_start_date, delivery_end_date,
        payment_terms_snapshot, quality_terms_snapshot, general_terms_snapshot, public_notes, internal_notes,
        brokerage_percentage_basis_points, bank_name, bank_code, bank_agency, bank_account, pix_key,
        template_snapshot_json, pending_issues_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'NOT_SENT', 'BRL', '0', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?)`)
        .run(id, data.organizationId, data.ownLegalEntityId, data.templateId ?? template?.id ?? null, draftNumber, draftNumber, data.confirmationDate, data.negotiationDate ?? null, data.deliveryLocationSnapshot ?? template?.defaultDeliveryTerms ?? null, data.deliveryStartDate ?? null, data.deliveryEndDate ?? null, data.paymentTermsSnapshot ?? template?.defaultPaymentTerms ?? null, data.qualityTermsSnapshot ?? template?.defaultQualityTerms ?? null, data.generalTermsSnapshot ?? template?.defaultGeneralTerms ?? null, data.publicNotes ?? null, data.internalNotes ?? null, data.brokeragePercentageBasisPoints ?? null, bankDefaults.bankName, bankDefaults.bankCode, bankDefaults.bankAgency, bankDefaults.bankAccount, bankDefaults.pixKey, template ? JSON.stringify(template) : null, now, now);
      this.addDealPartyInternal({ dealConfirmationId: id, partyRole: "ISSUER", ownLegalEntityId: own.id, businessPartnerId: null, partnerLegalEntityId: null, manualName: null, representativeName: null, sortOrder: 0 });
      this.recordDealStatus(id, null, "DRAFT", "Rascunho criado");
    });
    trx();
    this.refreshDealTotals(id);
    return this.getDealConfirmation(id);
  }

  createDealConfirmationFromOperations(input: unknown): DealConfirmationDetail {
    const data = dealConfirmationSourceInputSchema.parse(input);
    if (data.operationIds.length === 0) throw new Error("Selecione ao menos uma operacao.");
    const operations = data.operationIds.map((operationId) => this.getOperation(operationId));
    const operationOwnIds = [...new Set(operations.map((operation) => operation.ownLegalEntityId))];
    if (operationOwnIds.length > 1) throw new Error("Selecione operacoes do mesmo CNPJ proprio para gerar uma confirmacao.");
    const draft = this.createDealConfirmationDraft({ organizationId: data.organizationId, ownLegalEntityId: operationOwnIds[0] ?? data.ownLegalEntityId, confirmationDate: new Date().toISOString().slice(0, 10) });
    const trx = this.db.transaction(() => {
      data.operationIds.forEach((operationId) => {
        this.linkDealOperationInternal(draft.confirmation.id, operationId);
        const operation = this.getOperation(operationId);
        const product = operation.productId ? this.getProduct(operation.productId) : null;
        this.addDealItemInternal({
          dealConfirmationId: draft.confirmation.id,
          sortOrder: this.nextDealSortOrder("deal_confirmation_items", draft.confirmation.id),
          productId: operation.productId,
          productNameSnapshot: product?.name ?? "Cafe",
          productDescriptionSnapshot: product?.description ?? null,
          cropSnapshot: null,
          qualitySnapshot: null,
          packagingSnapshot: null,
          originSnapshot: null,
          destinationSnapshot: null,
          quantitySacksDecimal: operation.quantitySacks,
          sackWeightKgDecimal: product?.defaultSackWeightKg ? normalizeDecimalText(String(product.defaultSackWeightKg)) : "60",
          unitPriceDecimal: "0",
          totalAmountCents: null,
          totalOverrideReason: null,
          deliveryStartDate: null,
          deliveryEndDate: null,
          deliveryLocationSnapshot: null,
          notes: `Origem: operacao ${operation.id}`
        });
      });
    });
    trx();
    this.refreshDealTotals(draft.confirmation.id);
    return this.getDealConfirmation(draft.confirmation.id);
  }

  createDealConfirmationFromFiscalDocuments(input: unknown): DealConfirmationDetail {
    const data = dealConfirmationSourceInputSchema.parse(input);
    if (data.fiscalDocumentIds.length === 0) throw new Error("Selecione ao menos uma nota.");
    const fiscalDocuments = data.fiscalDocumentIds.map((documentId) => this.getFiscalDocument(documentId).document);
    const documentOwnIds = [...new Set(fiscalDocuments.map((document) => document.ownLegalEntityId))];
    if (documentOwnIds.length > 1) throw new Error("Selecione notas do mesmo CNPJ proprio para gerar uma confirmacao.");
    const draft = this.createDealConfirmationDraft({ organizationId: data.organizationId, ownLegalEntityId: documentOwnIds[0] ?? data.ownLegalEntityId, confirmationDate: new Date().toISOString().slice(0, 10) });
    const trx = this.db.transaction(() => {
      data.fiscalDocumentIds.forEach((documentId) => {
        this.linkDealFiscalDocumentInternal(draft.confirmation.id, documentId);
        const detail = this.getFiscalDocument(documentId);
        detail.operations.forEach((operation) => {
          this.linkDealOperationInternal(draft.confirmation.id, operation.id);
        });
        detail.items.forEach((item) => {
          const product = item.productId ? this.getProduct(item.productId) : null;
          this.addDealItemInternal({
            dealConfirmationId: draft.confirmation.id,
            sortOrder: this.nextDealSortOrder("deal_confirmation_items", draft.confirmation.id),
            productId: item.productId,
            productNameSnapshot: product?.name ?? item.description,
            productDescriptionSnapshot: item.description,
            cropSnapshot: null,
            qualitySnapshot: null,
            packagingSnapshot: null,
            originSnapshot: null,
            destinationSnapshot: null,
            quantitySacksDecimal: item.sacksQuantity ?? item.quantity,
            sackWeightKgDecimal: product?.defaultSackWeightKg ? normalizeDecimalText(String(product.defaultSackWeightKg)) : "60",
            unitPriceDecimal: item.unitPriceDecimal,
            totalAmountCents: item.totalAmountCents,
            totalOverrideReason: "Valor oficial importado da nota fiscal.",
            deliveryStartDate: null,
            deliveryEndDate: null,
            deliveryLocationSnapshot: null,
            notes: `Origem: NF ${detail.document.documentNumber}`
          });
        });
      });
    });
    trx();
    this.refreshDealTotals(draft.confirmation.id);
    return this.getDealConfirmation(draft.confirmation.id);
  }

  duplicateDealConfirmationAsDraft(id: string): DealConfirmationDetail {
    const source = this.getDealConfirmation(id);
    const draft = this.createDealConfirmationDraft({
      organizationId: source.confirmation.organizationId,
      ownLegalEntityId: source.confirmation.ownLegalEntityId,
      templateId: source.confirmation.templateId,
      confirmationDate: new Date().toISOString().slice(0, 10),
      negotiationDate: source.confirmation.negotiationDate,
      deliveryLocationSnapshot: source.confirmation.deliveryLocationSnapshot,
      deliveryStartDate: source.confirmation.deliveryStartDate,
      deliveryEndDate: source.confirmation.deliveryEndDate,
      paymentTermsSnapshot: source.confirmation.paymentTermsSnapshot,
      qualityTermsSnapshot: source.confirmation.qualityTermsSnapshot,
      generalTermsSnapshot: source.confirmation.generalTermsSnapshot,
      publicNotes: source.confirmation.publicNotes,
      internalNotes: source.confirmation.internalNotes
    });
    const trx = this.db.transaction(() => {
      source.parties.filter((party) => party.partyRole !== "ISSUER").forEach((party) => this.addDealPartyInternal({ ...party, dealConfirmationId: draft.confirmation.id }));
      source.items.forEach((item) => this.addDealItemInternal({ ...item, dealConfirmationId: draft.confirmation.id, totalAmountCents: item.totalWasManuallyOverridden ? item.totalAmountCents : null, totalOverrideReason: item.totalOverrideReason }));
      source.clauses.forEach((clause) => this.addDealClauseInternal({ ...clause, dealConfirmationId: draft.confirmation.id }));
      source.paymentTerms.forEach((term) => this.addDealPaymentTermInternal({ ...term, dealConfirmationId: draft.confirmation.id }));
      source.signers.forEach((signer) => this.addDealSignerInternal({ ...signer, dealConfirmationId: draft.confirmation.id, signatureStatus: "PENDING", signedAt: null }));
    });
    trx();
    this.refreshDealTotals(draft.confirmation.id);
    return this.getDealConfirmation(draft.confirmation.id);
  }

  deleteDealConfirmation(id: string): boolean {
    const detail = this.getDealConfirmation(id);
    this.assertOrganizationWritable(detail.confirmation.organizationId);
    const documentPaths = detail.documents.map((document) => document.storedFilePath).filter(Boolean);
    const trx = this.db.transaction(() => {
      this.db.prepare("UPDATE deal_confirmations SET replaced_by_confirmation_id = NULL, updated_at = ? WHERE replaced_by_confirmation_id = ?").run(new Date().toISOString(), id);
      [
        "deal_confirmation_status_history",
        "deal_confirmation_document_versions",
        "deal_confirmation_signers",
        "deal_payment_terms",
        "deal_confirmation_clauses",
        "deal_confirmation_fiscal_documents",
        "deal_confirmation_operations",
        "deal_confirmation_items",
        "deal_confirmation_parties"
      ].forEach((tableName) => {
        this.db.prepare(`DELETE FROM ${tableName} WHERE deal_confirmation_id = ?`).run(id);
      });
      this.db.prepare("DELETE FROM deal_confirmations WHERE id = ?").run(id);
    });
    trx();
    documentPaths.forEach((filePath) => {
      try {
        if (existsSync(filePath)) unlinkSync(filePath);
      } catch {
        // A remocao do registro e mais importante; a integridade de documentos consegue apontar sobras depois.
      }
    });
    return true;
  }

  updateDealConfirmationDraft(id: string, input: unknown): DealConfirmationDetail {
    this.assertDealEditable(id);
    const data = dealConfirmationUpdateSchema.parse(input);
    const current = this.getDealConfirmation(id).confirmation;
    if (data.templateId) this.assertDealTemplate(data.templateId, current.organizationId, current.ownLegalEntityId);
    this.db.prepare(`UPDATE deal_confirmations SET
      template_id = COALESCE(@templateId, template_id),
      confirmation_date = COALESCE(@confirmationDate, confirmation_date),
      negotiation_date = @negotiationDate,
      delivery_location_snapshot = @deliveryLocationSnapshot,
      delivery_start_date = @deliveryStartDate,
      delivery_end_date = @deliveryEndDate,
      payment_terms_snapshot = @paymentTermsSnapshot,
      quality_terms_snapshot = @qualityTermsSnapshot,
      general_terms_snapshot = @generalTermsSnapshot,
      public_notes = @publicNotes,
      internal_notes = @internalNotes,
      brokerage_percentage_basis_points = @brokeragePercentageBasisPoints,
      bank_name = @bankName,
      bank_code = @bankCode,
      bank_agency = @bankAgency,
      bank_account = @bankAccount,
      pix_key = @pixKey,
      updated_at = @updatedAt
      WHERE id = @id`)
      .run({
        id,
        templateId: data.templateId ?? current.templateId,
        confirmationDate: data.confirmationDate ?? current.confirmationDate,
        negotiationDate: data.negotiationDate ?? current.negotiationDate,
        deliveryLocationSnapshot: data.deliveryLocationSnapshot ?? current.deliveryLocationSnapshot,
        deliveryStartDate: data.deliveryStartDate ?? current.deliveryStartDate,
        deliveryEndDate: data.deliveryEndDate ?? current.deliveryEndDate,
        paymentTermsSnapshot: data.paymentTermsSnapshot ?? current.paymentTermsSnapshot,
        qualityTermsSnapshot: data.qualityTermsSnapshot ?? current.qualityTermsSnapshot,
        generalTermsSnapshot: data.generalTermsSnapshot ?? current.generalTermsSnapshot,
        publicNotes: data.publicNotes ?? current.publicNotes,
        internalNotes: data.internalNotes ?? current.internalNotes,
        brokeragePercentageBasisPoints: data.brokeragePercentageBasisPoints ?? current.brokeragePercentageBasisPoints,
        bankName: data.bankName ?? current.bankName,
        bankCode: data.bankCode ?? current.bankCode,
        bankAgency: data.bankAgency ?? current.bankAgency,
        bankAccount: data.bankAccount ?? current.bankAccount,
        pixKey: data.pixKey ?? current.pixKey,
        updatedAt: new Date().toISOString()
      });
    return this.getDealConfirmation(id);
  }

  addDealConfirmationItem(input: unknown): DealConfirmationItem {
    const data = dealConfirmationItemInputSchema.parse(input);
    this.assertDealEditable(data.dealConfirmationId);
    const item = this.addDealItemInternal(data);
    this.refreshDealTotals(data.dealConfirmationId);
    return item;
  }

  updateDealConfirmationItem(id: string, input: unknown): DealConfirmationItem {
    const current = this.getDealItem(id);
    this.assertDealEditable(current.dealConfirmationId);
    this.db.prepare("DELETE FROM deal_confirmation_items WHERE id = ?").run(id);
    const item = this.addDealItemInternal({ ...dealConfirmationItemInputSchema.parse(input), dealConfirmationId: current.dealConfirmationId });
    this.refreshDealTotals(current.dealConfirmationId);
    return item;
  }

  removeDealConfirmationItem(id: string): DealConfirmationDetail {
    const item = this.getDealItem(id);
    this.assertDealEditable(item.dealConfirmationId);
    this.db.prepare("DELETE FROM deal_confirmation_items WHERE id = ?").run(id);
    this.refreshDealTotals(item.dealConfirmationId);
    return this.getDealConfirmation(item.dealConfirmationId);
  }

  addDealConfirmationParty(input: unknown): DealConfirmationParty {
    const data = dealConfirmationPartyInputSchema.parse(input);
    this.assertDealEditable(data.dealConfirmationId);
    return this.addDealPartyInternal(data);
  }

  updateDealConfirmationParty(id: string, input: unknown): DealConfirmationParty {
    const current = this.getDealParty(id);
    this.assertDealEditable(current.dealConfirmationId);
    this.db.prepare("DELETE FROM deal_confirmation_parties WHERE id = ?").run(id);
    return this.addDealPartyInternal({ ...dealConfirmationPartyInputSchema.parse(input), dealConfirmationId: current.dealConfirmationId });
  }

  removeDealConfirmationParty(id: string): DealConfirmationDetail {
    const party = this.getDealParty(id);
    this.assertDealEditable(party.dealConfirmationId);
    if (party.partyRole === "ISSUER") throw new Error("Emissora obrigatoria nao pode ser removida.");
    this.db.prepare("DELETE FROM deal_confirmation_parties WHERE id = ?").run(id);
    return this.getDealConfirmation(party.dealConfirmationId);
  }

  linkDealOperation(dealConfirmationId: string, operationId: string): DealConfirmationDetail {
    this.assertDealEditableOrIssued(dealConfirmationId);
    this.linkDealOperationInternal(dealConfirmationId, operationId);
    return this.getDealConfirmation(dealConfirmationId);
  }

  unlinkDealOperation(dealConfirmationId: string, operationId: string): DealConfirmationDetail {
    this.assertDealEditable(dealConfirmationId);
    this.db.prepare("DELETE FROM deal_confirmation_operations WHERE deal_confirmation_id = ? AND operation_id = ?").run(dealConfirmationId, operationId);
    return this.getDealConfirmation(dealConfirmationId);
  }

  linkDealFiscalDocument(dealConfirmationId: string, fiscalDocumentId: string): DealConfirmationDetail {
    this.assertDealEditableOrIssued(dealConfirmationId);
    this.linkDealFiscalDocumentInternal(dealConfirmationId, fiscalDocumentId);
    return this.getDealConfirmation(dealConfirmationId);
  }

  unlinkDealFiscalDocument(dealConfirmationId: string, fiscalDocumentId: string): DealConfirmationDetail {
    this.assertDealEditable(dealConfirmationId);
    this.db.prepare("DELETE FROM deal_confirmation_fiscal_documents WHERE deal_confirmation_id = ? AND fiscal_document_id = ?").run(dealConfirmationId, fiscalDocumentId);
    return this.getDealConfirmation(dealConfirmationId);
  }

  addDealConfirmationClause(input: unknown): DealConfirmationClause {
    const data = dealConfirmationClauseInputSchema.parse(input);
    this.assertDealEditable(data.dealConfirmationId);
    return this.addDealClauseInternal(data);
  }

  updateDealConfirmationClause(id: string, input: unknown): DealConfirmationClause {
    const current = this.getDealClause(id);
    this.assertDealEditable(current.dealConfirmationId);
    const data = dealConfirmationClauseInputSchema.parse(input);
    this.db.prepare("UPDATE deal_confirmation_clauses SET clause_number = ?, title = ?, clause_text = ?, sort_order = ?, is_visible = ?, updated_at = ? WHERE id = ?")
      .run(data.clauseNumber, data.title, data.clauseText, data.sortOrder, data.isVisible ? 1 : 0, new Date().toISOString(), id);
    return this.getDealClause(id);
  }

  removeDealConfirmationClause(id: string): DealConfirmationDetail {
    const clause = this.getDealClause(id);
    this.assertDealEditable(clause.dealConfirmationId);
    this.db.prepare("DELETE FROM deal_confirmation_clauses WHERE id = ?").run(id);
    return this.getDealConfirmation(clause.dealConfirmationId);
  }

  reorderDealConfirmationClauses(dealConfirmationId: string, clauseIds: string[]): DealConfirmationDetail {
    this.assertDealEditable(dealConfirmationId);
    const trx = this.db.transaction(() => clauseIds.forEach((id, index) => this.db.prepare("UPDATE deal_confirmation_clauses SET sort_order = ?, updated_at = ? WHERE id = ? AND deal_confirmation_id = ?").run(index, new Date().toISOString(), id, dealConfirmationId)));
    trx();
    return this.getDealConfirmation(dealConfirmationId);
  }

  addDealPaymentTerm(input: unknown): DealPaymentTerm {
    const data = dealPaymentTermInputSchema.parse(input);
    this.assertDealEditable(data.dealConfirmationId);
    const term = this.addDealPaymentTermInternal(data);
    this.assertDealPaymentPercentages(data.dealConfirmationId);
    return term;
  }

  updateDealPaymentTerm(id: string, input: unknown): DealPaymentTerm {
    const current = this.getDealPaymentTerm(id);
    this.assertDealEditable(current.dealConfirmationId);
    const data = dealPaymentTermInputSchema.parse(input);
    this.db.prepare("UPDATE deal_payment_terms SET sort_order = ?, description = ?, percentage_basis_points = ?, amount_cents = ?, due_date = ?, days_after_event = ?, event_reference = ?, updated_at = ? WHERE id = ?")
      .run(data.sortOrder, data.description, data.percentageBasisPoints, data.amountCents, data.dueDate, data.daysAfterEvent, data.eventReference, new Date().toISOString(), id);
    this.assertDealPaymentPercentages(current.dealConfirmationId);
    return this.getDealPaymentTerm(id);
  }

  removeDealPaymentTerm(id: string): DealConfirmationDetail {
    const term = this.getDealPaymentTerm(id);
    this.assertDealEditable(term.dealConfirmationId);
    this.db.prepare("DELETE FROM deal_payment_terms WHERE id = ?").run(id);
    return this.getDealConfirmation(term.dealConfirmationId);
  }

  addDealSigner(input: unknown): DealConfirmationSigner {
    const data = dealConfirmationSignerInputSchema.parse(input);
    this.assertDealEditableOrIssued(data.dealConfirmationId);
    return this.addDealSignerInternal(data);
  }

  updateDealSigner(id: string, input: unknown): DealConfirmationSigner {
    const current = this.getDealSigner(id);
    this.assertDealEditableOrIssued(current.dealConfirmationId);
    const data = dealConfirmationSignerInputSchema.parse(input);
    this.db.prepare("UPDATE deal_confirmation_signers SET party_role = ?, name = ?, document_number = ?, position_title = ?, email = ?, phone = ?, signature_order = ?, signature_status = ?, signed_at = ?, notes = ?, updated_at = ? WHERE id = ?")
      .run(data.partyRole, data.name, data.documentNumber, data.positionTitle, data.email, data.phone, data.signatureOrder, data.signatureStatus, data.signedAt ?? null, data.notes, new Date().toISOString(), id);
    this.refreshDealSignatureStatus(current.dealConfirmationId);
    return this.getDealSigner(id);
  }

  removeDealSigner(id: string): DealConfirmationDetail {
    const signer = this.getDealSigner(id);
    this.assertDealEditable(signer.dealConfirmationId);
    this.db.prepare("DELETE FROM deal_confirmation_signers WHERE id = ?").run(id);
    return this.getDealConfirmation(signer.dealConfirmationId);
  }

  calculateDealTotals(id: string): { totalQuantitySacksDecimal: string; totalCommercialAmountCents: number } {
    this.refreshDealTotals(id);
    const deal = this.getDealConfirmation(id).confirmation;
    return { totalQuantitySacksDecimal: deal.totalQuantitySacksDecimal, totalCommercialAmountCents: deal.totalCommercialAmountCents };
  }

  listDealPendingIssues(id: string): DealConfirmationDetail["pendingIssues"] {
    return this.validateDealForIssue(id);
  }

  submitDealConfirmationForReview(id: string): DealConfirmationDetail {
    const detail = this.getDealConfirmation(id);
    if (detail.confirmation.status !== "DRAFT") throw new Error("Somente rascunho pode ir para conferencia.");
    const now = new Date().toISOString();
    this.db.prepare("UPDATE deal_confirmations SET status = 'PENDING_REVIEW', updated_at = ? WHERE id = ?").run(now, id);
    this.recordDealStatus(id, "DRAFT", "PENDING_REVIEW", "Enviado para conferencia");
    return this.getDealConfirmation(id);
  }

  async generateDealConfirmationPreview(id: string): Promise<DealConfirmationDetail> {
    return this.generateDealDocument(id, true);
  }

  async issueDealConfirmation(id: string): Promise<DealConfirmationDetail> {
    const issues = this.validateDealForIssue(id);
    if (issues.some((issue) => issue.severity === "critical")) throw new Error(`Pendencias criticas impedem emissao: ${issues.map((issue) => issue.message).join("; ")}`);
    const before = this.getDealConfirmation(id);
    if (!["DRAFT", "PENDING_REVIEW"].includes(before.confirmation.status)) throw new Error("Confirmacao ja emitida ou encerrada.");
    const now = new Date().toISOString();
    let versionId = "";
    const trx = this.db.transaction(() => {
      const number = before.confirmation.confirmationNumber ?? this.reserveNextDealConfirmationNumber(before.confirmation.organizationId, before.confirmation.ownLegalEntityId, now.slice(0, 4));
      this.refreshDealTotals(id);
      this.db.prepare("UPDATE deal_confirmations SET confirmation_number = ?, status = 'ISSUED', signature_status = 'NOT_SENT', issued_at = ?, updated_at = ?, pending_issues_json = ?, template_snapshot_json = COALESCE(template_snapshot_json, ?) WHERE id = ?")
        .run(number, now, now, JSON.stringify(issues), JSON.stringify(this.getDefaultDealTemplate(before.confirmation.organizationId, before.confirmation.ownLegalEntityId)), id);
      this.recordDealStatus(id, before.confirmation.status, "ISSUED", "Confirmacao emitida");
      versionId = randomUUID();
    });
    trx();
    const generated = await this.generateDealDocumentVersion(id, "ISSUED_ORIGINAL", versionId, false, "Documento original emitido");
    this.db.prepare("UPDATE deal_confirmations SET issued_document_version_id = ?, updated_at = ? WHERE id = ?").run(generated.id, new Date().toISOString(), id);
    return this.getDealConfirmation(id);
  }

  markDealConfirmationSentForSignature(id: string): DealConfirmationDetail {
    const detail = this.getDealConfirmation(id);
    if (!["ISSUED", "SENT_FOR_SIGNATURE"].includes(detail.confirmation.status)) throw new Error("Somente confirmacao emitida pode ser enviada para assinatura.");
    const now = new Date().toISOString();
    this.db.prepare("UPDATE deal_confirmations SET status = 'SENT_FOR_SIGNATURE', signature_status = 'WAITING_SIGNATURE', sent_for_signature_at = COALESCE(sent_for_signature_at, ?), updated_at = ? WHERE id = ?").run(now, now, id);
    this.recordDealStatus(id, detail.confirmation.status, "SENT_FOR_SIGNATURE", "Envio externo para assinatura registrado");
    return this.getDealConfirmation(id);
  }

  importSignedDealConfirmationDocument(id: string, input: unknown): DealConfirmationDetail {
    if (!this.directories) throw new Error("Diretorios locais nao configurados.");
    const data = signedDealDocumentInputSchema.parse(input);
    const sourcePath = data.sourcePath;
    if (!sourcePath) throw new Error("Caminho do PDF assinado nao informado.");
    const detail = this.getDealConfirmation(id);
    if (!["ISSUED", "SENT_FOR_SIGNATURE", "SIGNED"].includes(detail.confirmation.status)) throw new Error("Somente confirmacao emitida recebe PDF assinado.");
    const versionId = randomUUID();
    const stored = storeSignedDealConfirmationPdf({ sourcePath, directories: this.directories, organizationId: detail.confirmation.organizationId, ownLegalEntityId: detail.confirmation.ownLegalEntityId, confirmationId: id, versionId });
    const existing = detail.documents.find((doc) => doc.fileHash === stored.fileHash);
    if (existing) throw new Error("Este PDF ja esta registrado na confirmacao.");
    const now = new Date().toISOString();
    const version = this.nextDealDocumentVersion(id);
    this.db.prepare("UPDATE deal_confirmation_document_versions SET is_current = 0 WHERE deal_confirmation_id = ? AND document_type = 'SIGNED_EXTERNAL'").run(id);
    this.db.prepare(`INSERT INTO deal_confirmation_document_versions (
      id, deal_confirmation_id, version_number, document_type, original_file_name, stored_file_path,
      mime_type, file_size, file_hash, generated_by_system, is_current, notes, created_at
    ) VALUES (?, ?, ?, 'SIGNED_EXTERNAL', ?, ?, ?, ?, ?, 0, 1, ?, ?)`)
      .run(versionId, id, version, stored.originalFileName, stored.storedFilePath, stored.mimeType, stored.fileSize, stored.fileHash, data.notes ?? "Assinatura registrada externamente", now);
    this.db.prepare("UPDATE deal_confirmations SET signed_document_version_id = ?, status = 'SIGNED', signature_status = 'SIGNED', signed_at = ?, updated_at = ? WHERE id = ?").run(versionId, now, now, id);
    this.recordDealStatus(id, detail.confirmation.status, "SIGNED", "PDF assinado externamente importado");
    return this.getDealConfirmation(id);
  }

  updateDealSignatureStatus(id: string, signatureStatus: unknown): DealConfirmationDetail {
    const status = dealSignatureStatusSchema.parse(signatureStatus);
    const detail = this.getDealConfirmation(id);
    if (detail.confirmation.status === "CANCELLED" || detail.confirmation.status === "REPLACED") throw new Error("Confirmacao encerrada nao pode alterar assinatura.");
    const nextStatus: DealConfirmationStatus = status === "SIGNED" ? "SIGNED" : detail.confirmation.status;
    const now = new Date().toISOString();
    this.db.prepare("UPDATE deal_confirmations SET signature_status = ?, status = ?, signed_at = CASE WHEN ? = 'SIGNED' THEN COALESCE(signed_at, ?) ELSE signed_at END, updated_at = ? WHERE id = ?").run(status, nextStatus, status, now, now, id);
    this.recordDealStatus(id, detail.confirmation.status, nextStatus, `Status de assinatura: ${status}`);
    return this.getDealConfirmation(id);
  }

  cancelDealConfirmation(id: string, reason: string): DealConfirmationDetail {
    if (!reason.trim()) throw new Error("Motivo de cancelamento obrigatorio.");
    const detail = this.getDealConfirmation(id);
    if (detail.confirmation.status === "CANCELLED") return detail;
    if (detail.confirmation.status === "REPLACED") throw new Error("Confirmacao substituida nao pode ser cancelada novamente.");
    const now = new Date().toISOString();
    this.db.prepare("UPDATE deal_confirmations SET status = 'CANCELLED', cancelled_at = ?, cancellation_reason = ?, updated_at = ? WHERE id = ?").run(now, reason, now, id);
    this.recordDealStatus(id, detail.confirmation.status, "CANCELLED", reason);
    return this.getDealConfirmation(id);
  }

  replaceDealConfirmation(id: string, reason: string): DealConfirmationDetail {
    if (!reason.trim()) throw new Error("Motivo de substituicao obrigatorio.");
    const replacement = this.duplicateDealConfirmationAsDraft(id);
    const detail = this.getDealConfirmation(id);
    const now = new Date().toISOString();
    this.db.prepare("UPDATE deal_confirmations SET status = 'REPLACED', replaced_by_confirmation_id = ?, updated_at = ? WHERE id = ?").run(replacement.confirmation.id, now, id);
    this.recordDealStatus(id, detail.confirmation.status, "REPLACED", reason);
    return replacement;
  }

  listDealConfirmationTemplates(filters: { organizationId?: string; ownLegalEntityId?: string; status?: "active" | "inactive" | "all" } = {}): DealConfirmationTemplate[] {
    return (this.db.prepare("SELECT * FROM deal_confirmation_templates ORDER BY name, version DESC").all() as DbRecord[])
      .map(mapDealConfirmationTemplate)
      .filter((item) => this.isOrganizationAllowed(item.organizationId))
      .filter((item) => !filters.organizationId || item.organizationId === filters.organizationId)
      .filter((item) => !filters.ownLegalEntityId || item.ownLegalEntityId === filters.ownLegalEntityId)
      .filter((item) => this.matchesStatus(item.isActive, filters.status));
  }

  getDealConfirmationTemplate(id: string): DealConfirmationTemplate {
    const row = this.db.prepare("SELECT * FROM deal_confirmation_templates WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Template de confirmacao nao encontrado.");
    const template = mapDealConfirmationTemplate(row);
    if (!this.isOrganizationAllowed(template.organizationId)) throw new Error("Template nao autorizado.");
    return template;
  }

  createDealConfirmationTemplate(input: unknown): DealConfirmationTemplate {
    const data = dealConfirmationTemplateInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    if (data.ownLegalEntityId) {
      const own = this.getLegalEntity(data.ownLegalEntityId);
      if (own.organizationId !== data.organizationId) throw new Error("CNPJ do template pertence a outra organizacao.");
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    const trx = this.db.transaction(() => {
      if (data.isDefault) this.clearDefaultDealTemplate(data.organizationId, data.ownLegalEntityId);
      this.db.prepare(`INSERT INTO deal_confirmation_templates (
        id, organization_id, own_legal_entity_id, name, description, version, title, subtitle, layout_mode,
        default_payment_terms, default_delivery_terms, default_quality_terms, default_general_terms,
        show_broker, show_commercial_values, show_item_origins, show_signature_blocks, signature_block_count,
        is_default, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, data.organizationId, data.ownLegalEntityId, data.name, data.description, data.title, data.subtitle, data.layoutMode, data.defaultPaymentTerms, data.defaultDeliveryTerms, data.defaultQualityTerms, data.defaultGeneralTerms, data.showBroker ? 1 : 0, data.showCommercialValues ? 1 : 0, data.showItemOrigins ? 1 : 0, data.showSignatureBlocks ? 1 : 0, data.signatureBlockCount, data.isDefault ? 1 : 0, data.isActive ? 1 : 0, now, now);
    });
    trx();
    return this.getDealConfirmationTemplate(id);
  }

  updateDealConfirmationTemplate(id: string, input: unknown): DealConfirmationTemplate {
    const current = this.getDealConfirmationTemplate(id);
    const data = dealConfirmationTemplateInputSchema.parse(input);
    if (current.organizationId !== data.organizationId) throw new Error("Nao e permitido mover template entre organizacoes.");
    const trx = this.db.transaction(() => {
      if (data.isDefault) this.clearDefaultDealTemplate(data.organizationId, data.ownLegalEntityId, id);
      this.db.prepare(`UPDATE deal_confirmation_templates SET own_legal_entity_id = ?, name = ?, description = ?, version = version + 1, title = ?, subtitle = ?, layout_mode = ?,
        default_payment_terms = ?, default_delivery_terms = ?, default_quality_terms = ?, default_general_terms = ?,
        show_broker = ?, show_commercial_values = ?, show_item_origins = ?, show_signature_blocks = ?, signature_block_count = ?,
        is_default = ?, is_active = ?, updated_at = ? WHERE id = ?`)
        .run(data.ownLegalEntityId, data.name, data.description, data.title, data.subtitle, data.layoutMode, data.defaultPaymentTerms, data.defaultDeliveryTerms, data.defaultQualityTerms, data.defaultGeneralTerms, data.showBroker ? 1 : 0, data.showCommercialValues ? 1 : 0, data.showItemOrigins ? 1 : 0, data.showSignatureBlocks ? 1 : 0, data.signatureBlockCount, data.isDefault ? 1 : 0, data.isActive ? 1 : 0, new Date().toISOString(), id);
    });
    trx();
    return this.getDealConfirmationTemplate(id);
  }

  duplicateDealConfirmationTemplate(id: string): DealConfirmationTemplate {
    const source = this.getDealConfirmationTemplate(id);
    return this.createDealConfirmationTemplate({ ...source, name: `${source.name} (copia)`, isDefault: false, isActive: true });
  }

  setDefaultDealConfirmationTemplate(id: string): DealConfirmationTemplate {
    const template = this.getDealConfirmationTemplate(id);
    const trx = this.db.transaction(() => {
      this.clearDefaultDealTemplate(template.organizationId, template.ownLegalEntityId, id);
      this.db.prepare("UPDATE deal_confirmation_templates SET is_default = 1, is_active = 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    });
    trx();
    return this.getDealConfirmationTemplate(id);
  }

  activateDealConfirmationTemplate(id: string): DealConfirmationTemplate {
    this.getDealConfirmationTemplate(id);
    this.db.prepare("UPDATE deal_confirmation_templates SET is_active = 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getDealConfirmationTemplate(id);
  }

  deactivateDealConfirmationTemplate(id: string): DealConfirmationTemplate {
    this.getDealConfirmationTemplate(id);
    this.db.prepare("UPDATE deal_confirmation_templates SET is_active = 0, is_default = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getDealConfirmationTemplate(id);
  }

  previewDealConfirmationTemplate(id: string): DealConfirmationTemplate {
    return this.getDealConfirmationTemplate(id);
  }

  listDealClauseTemplates(organizationId: string): DealClauseTemplate[] {
    this.assertOrganizationWritable(organizationId);
    return (this.db.prepare("SELECT * FROM deal_clause_templates WHERE organization_id = ? ORDER BY category, name").all(organizationId) as DbRecord[]).map(mapDealClauseTemplate);
  }

  getDealClauseTemplate(id: string): DealClauseTemplate {
    const row = this.db.prepare("SELECT * FROM deal_clause_templates WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Clausula da biblioteca nao encontrada.");
    const clause = mapDealClauseTemplate(row);
    if (!this.isOrganizationAllowed(clause.organizationId)) throw new Error("Clausula nao autorizada.");
    return clause;
  }

  createDealClauseTemplate(input: unknown): DealClauseTemplate {
    const data = dealClauseTemplateInputSchema.parse(input);
    this.assertOrganizationWritable(data.organizationId);
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO deal_clause_templates (id, organization_id, name, title, clause_text, category, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.organizationId, data.name, data.title, data.clauseText, data.category, data.isActive ? 1 : 0, now, now);
    return this.getDealClauseTemplate(id);
  }

  updateDealClauseTemplate(id: string, input: unknown): DealClauseTemplate {
    const current = this.getDealClauseTemplate(id);
    const data = dealClauseTemplateInputSchema.parse(input);
    if (current.organizationId !== data.organizationId) throw new Error("Nao e permitido mover clausula entre organizacoes.");
    this.db.prepare("UPDATE deal_clause_templates SET name = ?, title = ?, clause_text = ?, category = ?, is_active = ?, updated_at = ? WHERE id = ?")
      .run(data.name, data.title, data.clauseText, data.category, data.isActive ? 1 : 0, new Date().toISOString(), id);
    return this.getDealClauseTemplate(id);
  }

  duplicateDealClauseTemplate(id: string): DealClauseTemplate {
    const source = this.getDealClauseTemplate(id);
    return this.createDealClauseTemplate({ ...source, name: `${source.name} (copia)`, isActive: true });
  }

  activateDealClauseTemplate(id: string): DealClauseTemplate {
    this.getDealClauseTemplate(id);
    this.db.prepare("UPDATE deal_clause_templates SET is_active = 1, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getDealClauseTemplate(id);
  }

  deactivateDealClauseTemplate(id: string): DealClauseTemplate {
    this.getDealClauseTemplate(id);
    this.db.prepare("UPDATE deal_clause_templates SET is_active = 0, updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    return this.getDealClauseTemplate(id);
  }

  previewDealConfirmationNumber(organizationId: string, ownLegalEntityId: string): string {
    this.assertOrganizationWritable(organizationId);
    const own = this.getLegalEntity(ownLegalEntityId);
    if (own.organizationId !== organizationId) throw new Error("CNPJ proprio pertence a outra organizacao.");
    const year = Number(new Date().toISOString().slice(0, 4));
    const expectedPrefix = this.defaultDealConfirmationPrefix(organizationId, ownLegalEntityId);
    const row = this.db.prepare("SELECT * FROM document_sequences WHERE organization_id = ? AND own_legal_entity_id = ? AND document_type = 'DEAL_CONFIRMATION' AND year = ? AND prefix = ? AND is_active = 1").get(organizationId, ownLegalEntityId, year, expectedPrefix) as DbRecord | undefined;
    const prefix = String(row?.prefix ?? expectedPrefix);
    const padding = Number(row?.padding ?? 4);
    const next = Number(row?.current_number ?? 0) + 1;
    return `${prefix}${String(next).padStart(padding, "0")}`;
  }

  reserveDealConfirmationNumber(organizationId: string, ownLegalEntityId: string): string {
    return this.reserveNextDealConfirmationNumber(organizationId, ownLegalEntityId, new Date().toISOString().slice(0, 4));
  }

  getDealConfirmationSummary(input: unknown): DealConfirmationSummary {
    const filters = confirmationReportInputSchema.shape.filters.parse(input);
    const details = this.queryDealConfirmationDetails(filters);
    const active = details.filter((detail) => detail.confirmation.status !== "CANCELLED" && detail.confirmation.status !== "REPLACED");
    return {
      confirmations: details.length,
      totalSacksDecimal: this.sumDecimals(active.map((detail) => detail.confirmation.totalQuantitySacksDecimal)),
      totalCommercialAmountCents: active.reduce((sum, detail) => sum + detail.confirmation.totalCommercialAmountCents, 0),
      drafts: details.filter((detail) => detail.confirmation.status === "DRAFT").length,
      pendingReview: details.filter((detail) => detail.confirmation.status === "PENDING_REVIEW").length,
      issued: details.filter((detail) => detail.confirmation.status === "ISSUED").length,
      waitingSignature: details.filter((detail) => detail.confirmation.signatureStatus === "WAITING_SIGNATURE").length,
      signed: details.filter((detail) => detail.confirmation.status === "SIGNED").length,
      cancelled: details.filter((detail) => detail.confirmation.status === "CANCELLED").length,
      withoutFiscalDocument: details.filter((detail) => detail.fiscalDocuments.length === 0).length,
      withoutOperation: details.filter((detail) => detail.operations.length === 0).length
    };
  }

  async generateConfirmationReport(input: unknown): Promise<ConfirmationReportGeneration> {
    if (!this.directories) throw new Error("Diretorios locais nao configurados.");
    const data = confirmationReportInputSchema.parse(input);
    const organization = this.getOrganization(data.filters.organizationId);
    const ownLegalEntity = data.filters.ownLegalEntityId ? this.getLegalEntity(data.filters.ownLegalEntityId) : null;
    const result = await generateDealConfirmationReportFile({
      directories: this.directories,
      organization,
      ownLegalEntity,
      reportType: data.reportType,
      format: data.format,
      filters: data.filters,
      confirmations: this.queryDealConfirmationDetails(data.filters),
      partners: this.listBusinessPartners({ organizationId: data.filters.organizationId }),
      reportId: randomUUID()
    });
    return { ...result, format: data.format };
  }

  getDealDocumentVersion(id: string): DealConfirmationDocumentVersion {
    const row = this.db.prepare("SELECT * FROM deal_confirmation_document_versions WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Versao documental nao encontrada.");
    const version = mapDealConfirmationDocumentVersion(row);
    this.getDealConfirmation(version.dealConfirmationId);
    return version;
  }

  listDealDocumentVersions(id: string): DealConfirmationDocumentVersion[] {
    return this.getDealConfirmation(id).documents;
  }

  getDealDocumentPath(versionId: string): string {
    return this.getDealDocumentVersion(versionId).storedFilePath;
  }

  calculateDealDocumentHash(versionId: string): string {
    return this.getDealDocumentVersion(versionId).fileHash;
  }

  validateSignedDealPdf(versionId: string): { validPdfStored: boolean; cryptographicSignatureValidated: false; message: string } {
    const version = this.getDealDocumentVersion(versionId);
    return { validPdfStored: version.mimeType === "application/pdf" && version.documentType === "SIGNED_EXTERNAL", cryptographicSignatureValidated: false, message: "PDF armazenado; assinatura externa nao foi validada criptograficamente nesta etapa." };
  }

  private assertDealEditable(id: string): DealConfirmationDetail {
    const detail = this.getDealConfirmation(id);
    if (!["DRAFT", "PENDING_REVIEW"].includes(detail.confirmation.status)) throw new Error("Confirmacao emitida, assinada, cancelada ou substituida nao pode ser editada.");
    return detail;
  }

  private assertDealEditableOrIssued(id: string): DealConfirmationDetail {
    const detail = this.getDealConfirmation(id);
    if (["CANCELLED", "REPLACED"].includes(detail.confirmation.status)) throw new Error("Confirmacao encerrada nao pode ser alterada.");
    return detail;
  }

  private getDealItem(id: string): DealConfirmationItem {
    const row = this.db.prepare("SELECT * FROM deal_confirmation_items WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Item da confirmacao nao encontrado.");
    return mapDealConfirmationItem(row);
  }

  private getDealParty(id: string): DealConfirmationParty {
    const row = this.db.prepare("SELECT * FROM deal_confirmation_parties WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Participante da confirmacao nao encontrado.");
    return mapDealConfirmationParty(row);
  }

  private getDealClause(id: string): DealConfirmationClause {
    const row = this.db.prepare("SELECT * FROM deal_confirmation_clauses WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Clausula da confirmacao nao encontrada.");
    return mapDealConfirmationClause(row);
  }

  private getDealPaymentTerm(id: string): DealPaymentTerm {
    const row = this.db.prepare("SELECT * FROM deal_payment_terms WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Condicao de pagamento nao encontrada.");
    return mapDealPaymentTerm(row);
  }

  private getDealSigner(id: string): DealConfirmationSigner {
    const row = this.db.prepare("SELECT * FROM deal_confirmation_signers WHERE id = ?").get(id) as DbRecord | undefined;
    if (!row) throw new Error("Assinante nao encontrado.");
    return mapDealConfirmationSigner(row);
  }

  private assertDealTemplate(id: string, organizationId: string, ownLegalEntityId: string): void {
    const template = this.getDealConfirmationTemplate(id);
    if (template.organizationId !== organizationId) throw new Error("Template pertence a outra organizacao.");
    if (template.ownLegalEntityId && template.ownLegalEntityId !== ownLegalEntityId) throw new Error("Template pertence a outro CNPJ proprio.");
    if (!template.isActive) throw new Error("Template inativo.");
  }

  private getDefaultDealTemplate(organizationId: string, ownLegalEntityId: string): DealConfirmationTemplate | null {
    return this.listDealConfirmationTemplates({ organizationId, status: "active" }).find((template) => template.ownLegalEntityId === ownLegalEntityId && template.isDefault)
      ?? this.listDealConfirmationTemplates({ organizationId, status: "active" }).find((template) => template.ownLegalEntityId === null && template.isDefault)
      ?? null;
  }

  private clearDefaultDealTemplate(organizationId: string, ownLegalEntityId: string | null, exceptId?: string): void {
    if (ownLegalEntityId) {
      this.db.prepare("UPDATE deal_confirmation_templates SET is_default = 0 WHERE organization_id = ? AND own_legal_entity_id = ? AND id <> ?").run(organizationId, ownLegalEntityId, exceptId ?? "");
    } else {
      this.db.prepare("UPDATE deal_confirmation_templates SET is_default = 0 WHERE organization_id = ? AND own_legal_entity_id IS NULL AND id <> ?").run(organizationId, exceptId ?? "");
    }
  }

  private addDealPartyInternal(data: Partial<DealConfirmationParty> & ReturnType<typeof dealConfirmationPartyInputSchema.parse>): DealConfirmationParty {
    const detail = this.getDealConfirmation(data.dealConfirmationId);
    const snapshot = this.buildDealPartySnapshot(data, detail.confirmation.organizationId, detail.confirmation.ownLegalEntityId);
    if (data.partyRole === "ISSUER" && data.ownLegalEntityId !== detail.confirmation.ownLegalEntityId) throw new Error("Emissora deve ser o CNPJ proprio da confirmacao.");
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare(`INSERT INTO deal_confirmation_parties (
      id, deal_confirmation_id, party_role, business_partner_id, partner_legal_entity_id,
      own_legal_entity_id, manual_name, snapshot_json, representative_name, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.dealConfirmationId, data.partyRole, data.businessPartnerId ?? null, data.partnerLegalEntityId ?? null, data.ownLegalEntityId ?? null, data.manualName ?? null, JSON.stringify(snapshot), data.representativeName ?? null, data.sortOrder ?? 0, now, now);
    return this.getDealParty(id);
  }

  private buildDealPartySnapshot(data: Partial<DealConfirmationParty> & ReturnType<typeof dealConfirmationPartyInputSchema.parse>, organizationId: string, ownLegalEntityId: string): DealPartySnapshot {
    if (data.ownLegalEntityId) {
      const own = this.getLegalEntity(data.ownLegalEntityId);
      if (own.organizationId !== organizationId || data.ownLegalEntityId !== ownLegalEntityId) throw new Error("CNPJ proprio incompativel com a confirmacao.");
      return { name: own.tradeName, legalName: own.legalName, taxId: own.cnpj, stateRegistration: own.stateRegistration, addressLine: own.addressLine, addressNumber: own.addressNumber, addressComplement: own.addressComplement, district: own.district, city: own.city, state: own.state, postalCode: own.postalCode, phone: own.phone, email: own.email, representativeName: data.representativeName ?? null, role: data.partyRole };
    }
    if (data.businessPartnerId) {
      const partner = this.getBusinessPartner(data.businessPartnerId);
      const entity = data.partnerLegalEntityId ? this.getPartnerLegalEntity(data.partnerLegalEntityId) : this.listPartnerLegalEntities(partner.id).find((item) => item.isPrimary) ?? null;
      if (entity && entity.businessPartnerId !== partner.id) throw new Error("Estabelecimento pertence a outro parceiro.");
      return { name: entity?.tradeName ?? partner.displayName, legalName: entity?.legalName ?? null, taxId: entity?.cnpj ?? null, stateRegistration: entity?.stateRegistration ?? null, addressLine: entity?.addressLine ?? null, addressNumber: entity?.addressNumber ?? null, addressComplement: entity?.addressComplement ?? null, district: entity?.district ?? null, city: entity?.city ?? null, state: entity?.state ?? null, postalCode: entity?.postalCode ?? null, phone: entity?.phone ?? null, email: entity?.email ?? null, representativeName: data.representativeName ?? null, role: data.partyRole };
    }
    if (!data.manualName) throw new Error("Participante manual exige nome.");
    return { name: data.manualName, legalName: null, taxId: null, stateRegistration: null, addressLine: null, addressNumber: null, addressComplement: null, district: null, city: null, state: null, postalCode: null, phone: null, email: null, representativeName: data.representativeName ?? null, role: data.partyRole };
  }

  private addDealItemInternal(data: DealItemInput): DealConfirmationItem {
    const detail = this.getDealConfirmation(data.dealConfirmationId);
    if (data.productId) {
      const product = this.getProduct(data.productId);
      if (product.organizationId !== detail.confirmation.organizationId) throw new Error("Produto pertence a outra organizacao.");
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    const quantity = normalizeDecimalText(data.quantitySacksDecimal);
    const sackWeight = normalizeDecimalText(data.sackWeightKgDecimal);
    const unitPrice = normalizeDecimalText(data.unitPriceDecimal);
    const calculated = multiplyDecimalTextsToCents(quantity, unitPrice);
    const override = data.totalAmountCents !== null && data.totalAmountCents !== undefined && data.totalAmountCents !== calculated;
    if (override && !data.totalOverrideReason) throw new Error("Total manual divergente exige justificativa.");
    const totalWeight = multiplyDecimalTexts(quantity, sackWeight);
    this.db.prepare(`INSERT INTO deal_confirmation_items (
      id, deal_confirmation_id, sort_order, product_id, product_name_snapshot, product_description_snapshot,
      crop_snapshot, quality_snapshot, packaging_snapshot, origin_snapshot, destination_snapshot,
      quantity_sacks_decimal, sack_weight_kg_decimal, total_weight_kg_decimal, unit_price_decimal,
      calculated_total_amount_cents, total_amount_cents, total_was_manually_overridden, total_override_reason,
      delivery_start_date, delivery_end_date, delivery_location_snapshot, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, data.dealConfirmationId, data.sortOrder, data.productId, data.productNameSnapshot, data.productDescriptionSnapshot, data.cropSnapshot, data.qualitySnapshot, data.packagingSnapshot, data.originSnapshot, data.destinationSnapshot, quantity, sackWeight, totalWeight, unitPrice, calculated, data.totalAmountCents ?? calculated, override ? 1 : 0, override ? data.totalOverrideReason : null, data.deliveryStartDate, data.deliveryEndDate, data.deliveryLocationSnapshot, data.notes, now, now);
    return this.getDealItem(id);
  }

  private addDealClauseInternal(data: Partial<DealConfirmationClause> & ReturnType<typeof dealConfirmationClauseInputSchema.parse>): DealConfirmationClause {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO deal_confirmation_clauses (id, deal_confirmation_id, clause_number, title, clause_text, sort_order, is_visible, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.dealConfirmationId, data.clauseNumber, data.title, data.clauseText, data.sortOrder, data.isVisible ? 1 : 0, now, now);
    return this.getDealClause(id);
  }

  private addDealPaymentTermInternal(data: Partial<DealPaymentTerm> & ReturnType<typeof dealPaymentTermInputSchema.parse>): DealPaymentTerm {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO deal_payment_terms (id, deal_confirmation_id, sort_order, description, percentage_basis_points, amount_cents, due_date, days_after_event, event_reference, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.dealConfirmationId, data.sortOrder, data.description, data.percentageBasisPoints, data.amountCents, data.dueDate, data.daysAfterEvent, data.eventReference, now, now);
    return this.getDealPaymentTerm(id);
  }

  private addDealSignerInternal(data: Partial<DealConfirmationSigner> & ReturnType<typeof dealConfirmationSignerInputSchema.parse>): DealConfirmationSigner {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO deal_confirmation_signers (id, deal_confirmation_id, party_role, name, document_number, position_title, email, phone, signature_order, signature_status, signed_at, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, data.dealConfirmationId, data.partyRole, data.name, data.documentNumber, data.positionTitle, data.email, data.phone, data.signatureOrder, data.signatureStatus, data.signedAt ?? null, data.notes, now, now);
    this.refreshDealSignatureStatus(data.dealConfirmationId);
    return this.getDealSigner(id);
  }

  private linkDealOperationInternal(dealConfirmationId: string, operationId: string): void {
    const deal = this.getDealConfirmation(dealConfirmationId).confirmation;
    const operation = this.getOperation(operationId);
    if (operation.organizationId !== deal.organizationId) throw new Error("Operacao pertence a outra organizacao.");
    if (operation.ownLegalEntityId !== deal.ownLegalEntityId) throw new Error("Operacao pertence a outro CNPJ proprio.");
    this.db.prepare("INSERT OR IGNORE INTO deal_confirmation_operations (id, deal_confirmation_id, operation_id, created_at) VALUES (?, ?, ?, ?)").run(randomUUID(), dealConfirmationId, operationId, new Date().toISOString());
  }

  private linkDealFiscalDocumentInternal(dealConfirmationId: string, fiscalDocumentId: string): void {
    const deal = this.getDealConfirmation(dealConfirmationId).confirmation;
    const document = this.getFiscalDocument(fiscalDocumentId).document;
    if (document.organizationId !== deal.organizationId) throw new Error("Nota pertence a outra organizacao.");
    if (document.ownLegalEntityId !== deal.ownLegalEntityId) throw new Error("Nota pertence a outro CNPJ proprio.");
    this.db.prepare("INSERT OR IGNORE INTO deal_confirmation_fiscal_documents (id, deal_confirmation_id, fiscal_document_id, created_at) VALUES (?, ?, ?, ?)").run(randomUUID(), dealConfirmationId, fiscalDocumentId, new Date().toISOString());
  }

  private refreshDealTotals(id: string): void {
    const items = (this.db.prepare("SELECT * FROM deal_confirmation_items WHERE deal_confirmation_id = ?").all(id) as DbRecord[]).map(mapDealConfirmationItem);
    const totalSacks = this.sumDecimals(items.map((item) => item.quantitySacksDecimal));
    const totalCents = items.reduce((sum, item) => sum + item.totalAmountCents, 0);
    this.db.prepare("UPDATE deal_confirmations SET total_quantity_sacks_decimal = ?, total_commercial_amount_cents = ?, updated_at = ? WHERE id = ?").run(totalSacks, totalCents, new Date().toISOString(), id);
  }

  private validateDealForIssue(id: string): DealConfirmationDetail["pendingIssues"] {
    const detail = this.getDealConfirmation(id);
    const issues: DealConfirmationDetail["pendingIssues"] = [];
    const has = (role: DealPartyRole): boolean => detail.parties.some((party) => party.partyRole === role);
    if (!has("ISSUER")) issues.push({ code: "ISSUER_MISSING", severity: "critical", message: "Emissora ausente." });
    if (!has("SELLER")) issues.push({ code: "SELLER_MISSING", severity: "critical", message: "Vendedor ausente." });
    if (!has("BUYER")) issues.push({ code: "BUYER_MISSING", severity: "critical", message: "Comprador ausente." });
    if (detail.items.length === 0) issues.push({ code: "ITEMS_MISSING", severity: "critical", message: "Nenhum item informado." });
    detail.items.forEach((item) => {
      if (decimalTextToScaled(item.quantitySacksDecimal) <= 0n) issues.push({ code: "INVALID_QUANTITY", severity: "critical", message: "Quantidade invalida." });
      if (decimalTextToScaled(item.sackWeightKgDecimal) <= 0n) issues.push({ code: "INVALID_SACK_WEIGHT", severity: "critical", message: "Peso da saca invalido." });
      if (item.totalWasManuallyOverridden && !item.totalOverrideReason) issues.push({ code: "TOTAL_OVERRIDE_REASON", severity: "critical", message: "Override de total sem justificativa." });
    });
    if (!detail.confirmation.paymentTermsSnapshot && detail.paymentTerms.length === 0) issues.push({ code: "PAYMENT_MISSING", severity: "warning", message: "Condicao de pagamento ausente." });
    if (!detail.confirmation.deliveryLocationSnapshot && detail.items.every((item) => !item.deliveryLocationSnapshot)) issues.push({ code: "DELIVERY_MISSING", severity: "warning", message: "Entrega/descarga ausente." });
    if (detail.clauses.length === 0) issues.push({ code: "CLAUSES_NOT_REVIEWED", severity: "warning", message: "Clausulas nao revisadas." });
    this.db.prepare("UPDATE deal_confirmations SET pending_issues_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(issues), new Date().toISOString(), id);
    return issues;
  }

  private assertDealPaymentPercentages(id: string): void {
    const terms = this.getDealConfirmation(id).paymentTerms;
    const withPercent = terms.filter((term) => term.percentageBasisPoints !== null);
    if (withPercent.length > 0) {
      const total = withPercent.reduce((sum, term) => sum + (term.percentageBasisPoints ?? 0), 0);
      if (total !== 10000) throw new Error("Quando percentuais forem usados, a soma deve ser 100%.");
    }
  }

  private refreshDealSignatureStatus(id: string): void {
    const detail = this.getDealConfirmation(id);
    const statuses = detail.signers.map((signer) => signer.signatureStatus);
    const signatureStatus = statuses.length === 0 || statuses.every((status) => status === "NOT_REQUIRED") ? "NOT_APPLICABLE" : statuses.every((status) => status === "SIGNED_EXTERNALLY" || status === "NOT_REQUIRED") ? "SIGNED" : statuses.some((status) => status === "SIGNED_EXTERNALLY") ? "PARTIALLY_SIGNED" : statuses.some((status) => status === "REJECTED") ? "REJECTED" : detail.confirmation.signatureStatus;
    this.db.prepare("UPDATE deal_confirmations SET signature_status = ?, updated_at = ? WHERE id = ?").run(signatureStatus, new Date().toISOString(), id);
  }

  private recordDealStatus(id: string, previousStatus: DealConfirmationStatus | null, newStatus: DealConfirmationStatus, reason: string | null): void {
    this.db.prepare("INSERT INTO deal_confirmation_status_history (id, deal_confirmation_id, previous_status, new_status, reason, changed_by_user_id, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), id, previousStatus, newStatus, reason, "usuario-provisorio", new Date().toISOString());
  }

  private reserveNextDealConfirmationNumber(organizationId: string, ownLegalEntityId: string, yearText: string): string {
    const year = Number(yearText);
    const now = new Date().toISOString();
    const prefix = this.defaultDealConfirmationPrefix(organizationId, ownLegalEntityId);
    let row = this.db.prepare("SELECT * FROM document_sequences WHERE organization_id = ? AND own_legal_entity_id = ? AND document_type = 'DEAL_CONFIRMATION' AND year = ? AND prefix = ? AND is_active = 1").get(organizationId, ownLegalEntityId, year, prefix) as DbRecord | undefined;
    if (!row) {
      this.db.prepare("INSERT INTO document_sequences (id, organization_id, own_legal_entity_id, document_type, year, prefix, current_number, padding, is_active, created_at, updated_at) VALUES (?, ?, ?, 'DEAL_CONFIRMATION', ?, ?, 0, 4, 1, ?, ?)")
        .run(randomUUID(), organizationId, ownLegalEntityId, year, prefix, now, now);
      row = this.db.prepare("SELECT * FROM document_sequences WHERE organization_id = ? AND own_legal_entity_id = ? AND document_type = 'DEAL_CONFIRMATION' AND year = ? AND prefix = ? AND is_active = 1").get(organizationId, ownLegalEntityId, year, prefix) as DbRecord;
    }
    const next = Number(row.current_number) + 1;
    this.db.prepare("UPDATE document_sequences SET current_number = ?, updated_at = ? WHERE id = ?").run(next, now, row.id);
    return `${String(row.prefix ?? "")}${String(next).padStart(Number(row.padding), "0")}`;
  }

  private defaultDealConfirmationPrefix(organizationId: string, ownLegalEntityId: string): string {
    const own = this.getLegalEntity(ownLegalEntityId);
    const explicitPrefix = own.documentPrefix?.trim();
    if (explicitPrefix) return explicitPrefix.endsWith(" ") ? explicitPrefix : `${explicitPrefix} `;
    const organization = this.getOrganization(organizationId);
    const text = `${organization.slug} ${organization.displayName} ${organization.appDisplayName} ${own.tradeName} ${own.legalName}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (text.includes("grao")) return "GG ";
    if (text.includes("villa") || text.includes("coffee")) return "VC ";
    return "CN ";
  }

  private async generateDealDocument(id: string, draft: boolean): Promise<DealConfirmationDetail> {
    if (draft) this.ensureDealConfirmationNumber(id);
    const versionId = randomUUID();
    const documentType = draft ? "GENERATED_DRAFT" : "ISSUED_ORIGINAL";
    await this.generateDealDocumentVersion(id, documentType, versionId, draft, draft ? "Previa com marca d'agua" : "Documento emitido");
    return this.getDealConfirmation(id);
  }

  private ensureDealConfirmationNumber(id: string): void {
    const detail = this.getDealConfirmation(id);
    if (detail.confirmation.confirmationNumber) return;
    const number = this.reserveNextDealConfirmationNumber(detail.confirmation.organizationId, detail.confirmation.ownLegalEntityId, new Date().toISOString().slice(0, 4));
    this.db.prepare("UPDATE deal_confirmations SET confirmation_number = ?, updated_at = ? WHERE id = ?").run(number, new Date().toISOString(), id);
  }

  private async generateDealDocumentVersion(id: string, documentType: DealConfirmationDocumentVersion["documentType"], versionId: string, draft: boolean, notes: string): Promise<DealConfirmationDocumentVersion> {
    if (!this.directories) throw new Error("Diretorios locais nao configurados.");
    const detail = this.getDealConfirmation(id);
    const organization = this.getOrganization(detail.confirmation.organizationId);
    const ownLegalEntity = this.getLegalEntity(detail.confirmation.ownLegalEntityId);
    const stored = await generateDealConfirmationPdf({ directories: this.directories, organization, ownLegalEntity, detail, versionId, draft });
    const version = this.nextDealDocumentVersion(id);
    const now = new Date().toISOString();
    this.db.prepare("UPDATE deal_confirmation_document_versions SET is_current = 0 WHERE deal_confirmation_id = ? AND document_type = ?").run(id, documentType);
    this.db.prepare(`INSERT INTO deal_confirmation_document_versions (
      id, deal_confirmation_id, version_number, document_type, original_file_name, stored_file_path,
      mime_type, file_size, file_hash, generated_by_system, is_current, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`)
      .run(versionId, id, version, documentType, stored.originalFileName, stored.storedFilePath, stored.mimeType, stored.fileSize, stored.fileHash, notes, now);
    return this.getDealDocumentVersion(versionId);
  }

  private nextDealDocumentVersion(id: string): number {
    const row = this.db.prepare("SELECT COALESCE(MAX(version_number), 0) AS version FROM deal_confirmation_document_versions WHERE deal_confirmation_id = ?").get(id) as { version: number };
    return Number(row.version) + 1;
  }

  private nextDealSortOrder(table: "deal_confirmation_items", dealConfirmationId: string): number {
    const row = this.db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM ${table} WHERE deal_confirmation_id = ?`).get(dealConfirmationId) as { next: number };
    return Number(row.next);
  }

  private dealHasProduct(id: string, productId: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM deal_confirmation_items WHERE deal_confirmation_id = ? AND product_id = ? LIMIT 1").get(id, productId));
  }

  private dealHasFiscalDocument(id: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM deal_confirmation_fiscal_documents WHERE deal_confirmation_id = ? LIMIT 1").get(id));
  }

  private dealHasOperation(id: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM deal_confirmation_operations WHERE deal_confirmation_id = ? LIMIT 1").get(id));
  }

  private matchesDealSearch(id: string, search?: string): boolean {
    if (!search?.trim()) return true;
    const detail = this.getDealConfirmation(id);
    const values = [
      detail.confirmation.confirmationNumber ?? "",
      detail.confirmation.temporaryReference,
      detail.confirmation.publicNotes ?? "",
      ...detail.items.map((item) => item.productNameSnapshot),
      ...detail.parties.map((party) => {
        try { return String((JSON.parse(party.snapshotJson) as { name?: string; taxId?: string }).name ?? "") + " " + String((JSON.parse(party.snapshotJson) as { taxId?: string }).taxId ?? ""); } catch { return party.manualName ?? ""; }
      })
    ];
    return this.matchesSearch(values, search);
  }

  private queryDealConfirmationDetails(filters: ConfirmationReportFilters): DealConfirmationDetail[] {
    return this.listDealConfirmations({
      organizationId: filters.organizationId,
      ownLegalEntityId: filters.ownLegalEntityId ?? undefined,
      dateStart: filters.dateStart ?? undefined,
      dateEnd: filters.dateEnd ?? undefined,
      status: filters.status ? (filters.status as DealConfirmationStatus) : undefined,
      signatureStatus: filters.signatureStatus ? (filters.signatureStatus as DealConfirmation["signatureStatus"]) : undefined,
      productId: filters.productId ?? undefined
    }).map((confirmation) => this.getDealConfirmation(confirmation.id))
      .filter((detail) => !filters.sellerPartnerId || detail.parties.some((party) => party.partyRole === "SELLER" && party.businessPartnerId === filters.sellerPartnerId))
      .filter((detail) => !filters.buyerPartnerId || detail.parties.some((party) => party.partyRole === "BUYER" && party.businessPartnerId === filters.buyerPartnerId));
  }

  private sumDecimals(values: string[]): string {
    const total = values.reduce((sum, value) => sum + decimalTextToScaled(value), 0n);
    const scale = 1_000_000n;
    const whole = total / scale;
    const fraction = (total % scale).toString().padStart(6, "0").replace(/0+$/, "");
    return fraction ? `${whole}.${fraction}` : whole.toString();
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

  private isOrganizationAllowed(organizationId: string): boolean {
    void organizationId;
    return true;
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

  private resolveDealBankDefaults(
    ownLegalEntity: LegalEntity,
    data: ReturnType<typeof dealConfirmationDraftInputSchema.parse>
  ): { bankName: string | null; bankCode: string | null; bankAgency: string | null; bankAccount: string | null; pixKey: string | null } {
    return {
      bankName: data.bankName ?? ownLegalEntity.defaultBankName ?? null,
      bankCode: data.bankCode ?? ownLegalEntity.defaultBankCode ?? null,
      bankAgency: data.bankAgency ?? ownLegalEntity.defaultBankAgency ?? null,
      bankAccount: data.bankAccount ?? ownLegalEntity.defaultBankAccount ?? null,
      pixKey: data.pixKey ?? ownLegalEntity.defaultPixKey ?? null
    };
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
    void organizationId;
    const partner = this.getBusinessPartner(businessPartnerId);
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

function normalizeXmlUnit(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_-]+/g, "");
}

function isXmlSackUnit(value: string): boolean {
  return ["SC", "SAC", "SACA", "SACAS", "SACK", "SACKS"].includes(normalizeXmlUnit(value));
}

function isXmlKgUnit(value: string): boolean {
  return ["KG", "KGS", "KILO", "KILOS", "QUILO", "QUILOS"].includes(normalizeXmlUnit(value));
}

function isXmlTonUnit(value: string): boolean {
  return ["T", "TON", "TONS", "TONELADA", "TONELADAS"].includes(normalizeXmlUnit(value));
}

function isXmlBigBagUnit(value: string): boolean {
  return ["BB", "BAG", "BAGS", "BIGBAG", "BIGBAGS"].includes(normalizeXmlUnit(value));
}

function multiplyDecimalTexts(left: string, right: string): string {
  const scale = 1_000_000n;
  const result = (decimalTextToScaled(left) * decimalTextToScaled(right) + scale / 2n) / scale;
  const whole = result / scale;
  const fraction = (result % scale).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function multiplyDecimalTextsToCents(quantity: string, unitPriceDecimal: string): number {
  const scale = 1_000_000n;
  const centsScale = 100n;
  const quantityScaled = decimalTextToScaled(quantity);
  const priceScaled = decimalTextToScaled(unitPriceDecimal);
  const numerator = quantityScaled * priceScaled * centsScale;
  const denominator = scale * scale;
  return Number((numerator + denominator / 2n) / denominator);
}

function parseDealIssues(value: string): DealConfirmationDetail["pendingIssues"] {
  try {
    const parsed = JSON.parse(value) as DealConfirmationDetail["pendingIssues"];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(value: string, days: number): string {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function daysBetweenDates(fromValue: string, toValue: string): number {
  const from = parseLocalDate(fromValue.slice(0, 10));
  const to = parseLocalDate(toValue.slice(0, 10));
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function addMonthsSafe(value: string, months: number): string {
  const date = parseLocalDate(value);
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return isoDate(target);
}

function withDayOfMonth(value: string, day: number): string {
  const date = parseLocalDate(value);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return isoDate(new Date(date.getFullYear(), date.getMonth(), Math.min(day, lastDay)));
}

function endOfMonth(value: string): string {
  const date = parseLocalDate(value);
  return isoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function frequencyMonths(frequency: string): number {
  if (frequency === "BIMONTHLY") return 2;
  if (frequency === "QUARTERLY") return 3;
  if (frequency === "SEMIANNUAL") return 6;
  if (frequency === "ANNUAL") return 12;
  return 1;
}

function splitCents(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index === count - 1 ? remainder : 0));
}

function textOrNullLocal(value: unknown): string | null {
  return typeof value === "string" ? value : null;
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
