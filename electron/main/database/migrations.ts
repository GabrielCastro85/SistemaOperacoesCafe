import type Database from "better-sqlite3";

export interface Migration {
  name: string;
  up: (db: Database.Database) => void;
}

export const migrations: Migration[] = [
  {
    name: "001_initial_foundation",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS migration_history (
          id TEXT PRIMARY KEY,
          migration_name TEXT NOT NULL UNIQUE,
          executed_at TEXT NOT NULL,
          checksum TEXT
        );

        CREATE TABLE IF NOT EXISTS organizations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          app_display_name TEXT NOT NULL,
          logo_path TEXT,
          icon_path TEXT,
          primary_color TEXT NOT NULL,
          secondary_color TEXT NOT NULL,
          accent_color TEXT NOT NULL,
          theme_mode TEXT NOT NULL CHECK (theme_mode IN ('light', 'dark')),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS legal_entities (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          legal_name TEXT NOT NULL,
          trade_name TEXT NOT NULL,
          cnpj TEXT,
          state_registration TEXT,
          municipal_registration TEXT,
          email TEXT,
          phone TEXT,
          address_line TEXT NOT NULL,
          address_number TEXT NOT NULL,
          address_complement TEXT,
          district TEXT NOT NULL,
          city TEXT NOT NULL,
          state TEXT NOT NULL,
          postal_code TEXT NOT NULL,
          document_prefix TEXT,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id)
        );

        CREATE INDEX IF NOT EXISTS idx_legal_entities_organization_id ON legal_entities(organization_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_entities_cnpj_unique ON legal_entities(cnpj) WHERE cnpj IS NOT NULL;

        CREATE TABLE IF NOT EXISTS locations (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          legal_entity_id TEXT,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('OFFICE', 'BRANCH', 'WAREHOUSE', 'PROPERTY', 'STORAGE', 'OTHER')),
          description TEXT,
          address_line TEXT,
          address_number TEXT,
          address_complement TEXT,
          district TEXT,
          city TEXT,
          state TEXT,
          postal_code TEXT,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id)
        );

        CREATE INDEX IF NOT EXISTS idx_locations_organization_id ON locations(organization_id);
        CREATE INDEX IF NOT EXISTS idx_locations_legal_entity_id ON locations(legal_entity_id);

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          organization_id TEXT,
          default_legal_entity_id TEXT,
          name TEXT NOT NULL,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR', 'VIEWER')),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (default_legal_entity_id) REFERENCES legal_entities(id)
        );

        CREATE TABLE IF NOT EXISTS installation_profiles (
          id TEXT PRIMARY KEY,
          installation_name TEXT NOT NULL,
          app_variant TEXT NOT NULL CHECK (app_variant IN ('villa', 'grao', 'multiempresa')),
          default_organization_id TEXT,
          default_legal_entity_id TEXT,
          allow_organization_switch INTEGER NOT NULL CHECK (allow_organization_switch IN (0, 1)),
          allow_legal_entity_switch INTEGER NOT NULL CHECK (allow_legal_entity_switch IN (0, 1)),
          completed_setup INTEGER NOT NULL CHECK (completed_setup IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (default_organization_id) REFERENCES organizations(id),
          FOREIGN KEY (default_legal_entity_id) REFERENCES legal_entities(id)
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          value TEXT NOT NULL,
          value_type TEXT NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    }
  },
  {
    name: "002_seed_demo_data",
    up: (db) => {
      const now = new Date().toISOString();
      const insertOrganization = db.prepare(`
        INSERT OR IGNORE INTO organizations (
          id, name, slug, display_name, app_display_name, logo_path, icon_path,
          primary_color, secondary_color, accent_color, theme_mode, is_active, created_at, updated_at
        ) VALUES (@id, @name, @slug, @displayName, @appDisplayName, @logoPath, @iconPath,
          @primaryColor, @secondaryColor, @accentColor, @themeMode, @isActive, @createdAt, @updatedAt)
      `);
      const insertLegalEntity = db.prepare(`
        INSERT OR IGNORE INTO legal_entities (
          id, organization_id, legal_name, trade_name, cnpj, state_registration, municipal_registration,
          email, phone, address_line, address_number, address_complement, district, city, state,
          postal_code, document_prefix, is_active, created_at, updated_at
        ) VALUES (@id, @organizationId, @legalName, @tradeName, @cnpj, @stateRegistration, @municipalRegistration,
          @email, @phone, @addressLine, @addressNumber, @addressComplement, @district, @city, @state,
          @postalCode, @documentPrefix, @isActive, @createdAt, @updatedAt)
      `);
      const insertLocation = db.prepare(`
        INSERT OR IGNORE INTO locations (
          id, organization_id, legal_entity_id, name, type, description, address_line, address_number,
          address_complement, district, city, state, postal_code, is_active, created_at, updated_at
        ) VALUES (@id, @organizationId, @legalEntityId, @name, @type, @description, @addressLine, @addressNumber,
          @addressComplement, @district, @city, @state, @postalCode, @isActive, @createdAt, @updatedAt)
      `);
      const villaId = "11111111-1111-4111-8111-111111111111";
      const graoId = "22222222-2222-4222-8222-222222222222";
      insertOrganization.run({
        id: villaId,
        name: "Villa Coffee",
        slug: "villa-coffee",
        displayName: "Villa Coffee",
        appDisplayName: "Villa Coffee Operacoes",
        logoPath: null,
        iconPath: null,
        primaryColor: "#111111",
        secondaryColor: "#D7B46A",
        accentColor: "#2F6B45",
        themeMode: "dark",
        isActive: 1,
        createdAt: now,
        updatedAt: now
      });
      insertOrganization.run({
        id: graoId,
        name: "Grao & Grao",
        slug: "grao-e-grao",
        displayName: "Grao & Grao",
        appDisplayName: "Grao & Grao Operacoes",
        logoPath: null,
        iconPath: null,
        primaryColor: "#1F6F43",
        secondaryColor: "#F3EFE2",
        accentColor: "#6B4A2E",
        themeMode: "light",
        isActive: 1,
        createdAt: now,
        updatedAt: now
      });

      const entities = [
        ["33333333-3333-4333-8333-333333333331", villaId, "Villa Coffee MG - Demonstracao", "Villa Coffee MG", "MG"],
        ["33333333-3333-4333-8333-333333333332", villaId, "Villa Coffee ES - Demonstracao", "Villa Coffee ES", "ES"],
        ["44444444-4444-4444-8444-444444444441", graoId, "Grao & Grao MG - Demonstracao", "Grao & Grao MG", "MG"],
        ["44444444-4444-4444-8444-444444444442", graoId, "Grao & Grao SP - Demonstracao", "Grao & Grao SP", "SP"],
        ["44444444-4444-4444-8444-444444444443", graoId, "Grao & Grao DF - Demonstracao", "Grao & Grao DF", "DF"]
      ] as const;

      entities.forEach(([id, organizationId, legalName, tradeName, state]) => {
        insertLegalEntity.run({
          id,
          organizationId,
          legalName,
          tradeName,
          cnpj: null,
          stateRegistration: null,
          municipalRegistration: null,
          email: null,
          phone: null,
          addressLine: "Endereco pendente",
          addressNumber: "S/N",
          addressComplement: "Dados demonstrativos",
          district: "Pendente",
          city: "Pendente",
          state,
          postalCode: "00000000",
          documentPrefix: null,
          isActive: 1,
          createdAt: now,
          updatedAt: now
        });
      });

      [
        ["55555555-5555-4555-8555-555555555551", villaId, entities[0][0], "Escritorio principal", "OFFICE"],
        ["55555555-5555-4555-8555-555555555552", villaId, entities[0][0], "Armazem principal", "WAREHOUSE"],
        ["66666666-6666-4666-8666-666666666661", graoId, entities[2][0], "Filial administrativa", "BRANCH"],
        ["66666666-6666-4666-8666-666666666662", graoId, entities[2][0], "Armazem principal", "WAREHOUSE"]
      ].forEach(([id, organizationId, legalEntityId, name, type]) => {
        insertLocation.run({
          id,
          organizationId,
          legalEntityId,
          name,
          type,
          description: "Local ficticio para desenvolvimento",
          addressLine: null,
          addressNumber: null,
          addressComplement: null,
          district: null,
          city: null,
          state: null,
          postalCode: null,
          isActive: 1,
          createdAt: now,
          updatedAt: now
        });
      });
    }
  },
  {
    name: "003_admin_modules",
    up: (db) => {
      const columns = (table: string): string[] =>
        (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
      const organizationColumns = columns("organizations");
      const legalEntityColumns = columns("legal_entities");
      if (!organizationColumns.includes("compact_logo_path")) {
        db.exec("ALTER TABLE organizations ADD COLUMN compact_logo_path TEXT");
      }
      if (!legalEntityColumns.includes("is_draft")) {
        db.exec("ALTER TABLE legal_entities ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 1 CHECK (is_draft IN (0, 1))");
      }
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);
        CREATE INDEX IF NOT EXISTS idx_organizations_name_search ON organizations(name, display_name);
        CREATE INDEX IF NOT EXISTS idx_legal_entities_is_active ON legal_entities(is_active);
        CREATE INDEX IF NOT EXISTS idx_legal_entities_state ON legal_entities(state);
        CREATE INDEX IF NOT EXISTS idx_legal_entities_trade_name_search ON legal_entities(trade_name, legal_name);
        CREATE INDEX IF NOT EXISTS idx_locations_is_active ON locations(is_active);
        CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(type);
        CREATE INDEX IF NOT EXISTS idx_locations_name_search ON locations(name);
      `);
    }
  },
  {
    name: "004_partners_products_billing",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS business_partners (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          notes TEXT,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_business_partners_organization_id ON business_partners(organization_id);
        CREATE INDEX IF NOT EXISTS idx_business_partners_display_name ON business_partners(display_name);
        CREATE INDEX IF NOT EXISTS idx_business_partners_is_active ON business_partners(is_active);

        CREATE TABLE IF NOT EXISTS business_partner_roles (
          id TEXT PRIMARY KEY,
          business_partner_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('CLIENT','SUPPLIER','SELLER','BUYER','DESTINATION','CARRIER','SERVICE_PROVIDER','OTHER')),
          created_at TEXT NOT NULL,
          UNIQUE (business_partner_id, role),
          FOREIGN KEY (business_partner_id) REFERENCES business_partners(id)
        );
        CREATE INDEX IF NOT EXISTS idx_business_partner_roles_business_partner_id ON business_partner_roles(business_partner_id);

        CREATE TABLE IF NOT EXISTS partner_legal_entities (
          id TEXT PRIMARY KEY,
          business_partner_id TEXT NOT NULL,
          legal_name TEXT NOT NULL,
          trade_name TEXT NOT NULL,
          cnpj TEXT,
          state_registration TEXT,
          municipal_registration TEXT,
          email TEXT,
          phone TEXT,
          address_line TEXT,
          address_number TEXT,
          address_complement TEXT,
          district TEXT,
          city TEXT,
          state TEXT,
          postal_code TEXT,
          is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          is_draft INTEGER NOT NULL DEFAULT 0 CHECK (is_draft IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (business_partner_id) REFERENCES business_partners(id)
        );
        CREATE INDEX IF NOT EXISTS idx_partner_legal_entities_business_partner_id ON partner_legal_entities(business_partner_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_legal_entities_cnpj_unique ON partner_legal_entities(cnpj) WHERE cnpj IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_legal_entities_one_primary ON partner_legal_entities(business_partner_id) WHERE is_primary = 1 AND is_active = 1;

        CREATE TABLE IF NOT EXISTS partner_contacts (
          id TEXT PRIMARY KEY,
          business_partner_id TEXT NOT NULL,
          partner_legal_entity_id TEXT,
          name TEXT NOT NULL,
          department TEXT,
          email TEXT,
          phone TEXT,
          mobile TEXT,
          preferred_contact_method TEXT NOT NULL CHECK (preferred_contact_method IN ('PHONE','MOBILE','EMAIL','WHATSAPP','OTHER')),
          is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
          notes TEXT,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (business_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (partner_legal_entity_id) REFERENCES partner_legal_entities(id)
        );
        CREATE INDEX IF NOT EXISTS idx_partner_contacts_business_partner_id ON partner_contacts(business_partner_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_contacts_one_primary ON partner_contacts(business_partner_id) WHERE is_primary = 1 AND is_active = 1;

        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          name TEXT NOT NULL,
          code TEXT,
          category TEXT NOT NULL CHECK (category IN ('COFFEE_ARABICA','COFFEE_CONILON','COFFEE_OTHER','OTHER')),
          default_unit TEXT NOT NULL CHECK (default_unit IN ('SACK','KG','TON','UNIT')),
          default_sack_weight_kg REAL,
          description TEXT,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_products_organization_id ON products(organization_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code_org_unique ON products(organization_id, code) WHERE code IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

        CREATE TABLE IF NOT EXISTS client_billing_profiles (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          business_partner_id TEXT NOT NULL UNIQUE,
          own_legal_entity_id TEXT,
          periodicity TEXT NOT NULL CHECK (periodicity IN ('WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY','CUSTOM')),
          closing_weekday INTEGER,
          closing_day_of_month INTEGER,
          due_days_after_closing INTEGER NOT NULL,
          auto_include_unbilled_operations INTEGER NOT NULL CHECK (auto_include_unbilled_operations IN (0, 1)),
          notes TEXT,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (business_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id)
        );
        CREATE INDEX IF NOT EXISTS idx_client_billing_profiles_business_partner_id ON client_billing_profiles(business_partner_id);

        CREATE TABLE IF NOT EXISTS service_rate_rules (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          business_partner_id TEXT NOT NULL,
          own_legal_entity_id TEXT,
          product_id TEXT,
          operation_scope TEXT NOT NULL CHECK (operation_scope IN ('INTERNAL','EXTERNAL','ALL')),
          rate_type TEXT NOT NULL CHECK (rate_type IN ('PER_SACK')),
          rate_value_cents INTEGER NOT NULL,
          effective_from TEXT NOT NULL,
          effective_to TEXT,
          priority INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (business_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        );
        CREATE INDEX IF NOT EXISTS idx_service_rate_rules_business_partner_id ON service_rate_rules(business_partner_id);
        CREATE INDEX IF NOT EXISTS idx_service_rate_rules_organization_id ON service_rate_rules(organization_id);
        CREATE INDEX IF NOT EXISTS idx_service_rate_rules_own_legal_entity_id ON service_rate_rules(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_service_rate_rules_product_id ON service_rate_rules(product_id);
        CREATE INDEX IF NOT EXISTS idx_service_rate_rules_effective_from ON service_rate_rules(effective_from);
        CREATE INDEX IF NOT EXISTS idx_service_rate_rules_effective_to ON service_rate_rules(effective_to);
        CREATE INDEX IF NOT EXISTS idx_service_rate_rules_is_active ON service_rate_rules(is_active);
      `);
      const now = new Date().toISOString();
      const insertProduct = db.prepare(`
        INSERT OR IGNORE INTO products (
          id, organization_id, name, code, category, default_unit, default_sack_weight_kg,
          description, is_active, created_at, updated_at
        ) VALUES (@id, @organizationId, @name, @code, @category, @defaultUnit, @defaultSackWeightKg,
          @description, 1, @createdAt, @updatedAt)
      `);
      ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"].forEach((organizationId, index) => {
        insertProduct.run({
          id: `77777777-7777-4777-8777-7777777777${index}1`,
          organizationId,
          name: "Cafe Arabica",
          code: "CAFE-ARABICA",
          category: "COFFEE_ARABICA",
          defaultUnit: "SACK",
          defaultSackWeightKg: 60,
          description: "Produto demonstrativo",
          createdAt: now,
          updatedAt: now
        });
        insertProduct.run({
          id: `77777777-7777-4777-8777-7777777777${index}2`,
          organizationId,
          name: "Cafe Conilon",
          code: "CAFE-CONILON",
          category: "COFFEE_CONILON",
          defaultUnit: "SACK",
          defaultSackWeightKg: 60,
          description: "Produto demonstrativo",
          createdAt: now,
          updatedAt: now
        });
      });
    }
  },
  {
    name: "005_manual_invoices_operations",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS fiscal_documents (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          responsible_partner_id TEXT NOT NULL,
          partner_legal_entity_id TEXT,
          document_type TEXT NOT NULL CHECK (document_type IN ('MANUAL_INVOICE')),
          access_key TEXT,
          document_number TEXT NOT NULL,
          series TEXT,
          issue_date TEXT NOT NULL,
          total_amount_cents INTEGER NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('DRAFT','PENDING','CONFIRMED','CANCELED')),
          has_pending_issues INTEGER NOT NULL CHECK (has_pending_issues IN (0, 1)),
          pending_notes TEXT,
          duplicate_warning TEXT,
          notes TEXT,
          confirmed_at TEXT,
          canceled_at TEXT,
          cancel_reason TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (responsible_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (partner_legal_entity_id) REFERENCES partner_legal_entities(id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_documents_access_key_unique ON fiscal_documents(access_key) WHERE access_key IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_organization_id ON fiscal_documents(organization_id);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_own_legal_entity_id ON fiscal_documents(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_responsible_partner_id ON fiscal_documents(responsible_partner_id);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status ON fiscal_documents(status);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_issue_date ON fiscal_documents(issue_date);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_possible_duplicate ON fiscal_documents(organization_id, responsible_partner_id, document_number, series, issue_date, total_amount_cents);

        CREATE TABLE IF NOT EXISTS fiscal_document_items (
          id TEXT PRIMARY KEY,
          fiscal_document_id TEXT NOT NULL,
          product_id TEXT,
          description TEXT NOT NULL,
          quantity_decimal TEXT NOT NULL,
          unit TEXT NOT NULL CHECK (unit IN ('SACK','KG','TON','UNIT')),
          unit_price_decimal TEXT NOT NULL,
          total_amount_cents INTEGER NOT NULL,
          sacks_quantity_decimal TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (fiscal_document_id) REFERENCES fiscal_documents(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        );
        CREATE INDEX IF NOT EXISTS idx_fiscal_document_items_document_id ON fiscal_document_items(fiscal_document_id);
        CREATE INDEX IF NOT EXISTS idx_fiscal_document_items_product_id ON fiscal_document_items(product_id);

        CREATE TABLE IF NOT EXISTS operations (
          id TEXT PRIMARY KEY,
          fiscal_document_id TEXT NOT NULL,
          fiscal_document_item_id TEXT,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          responsible_partner_id TEXT NOT NULL,
          product_id TEXT,
          operation_type TEXT NOT NULL CHECK (operation_type IN ('PURCHASE','SALE')),
          operation_scope TEXT NOT NULL CHECK (operation_scope IN ('INTERNAL','EXTERNAL')),
          operation_date TEXT NOT NULL,
          quantity_sacks_decimal TEXT NOT NULL,
          service_rate_rule_id TEXT,
          applied_rate_value_cents INTEGER NOT NULL,
          service_amount_cents INTEGER NOT NULL,
          rate_was_manually_overridden INTEGER NOT NULL CHECK (rate_was_manually_overridden IN (0, 1)),
          manual_rate_value_cents INTEGER,
          manual_override_reason TEXT,
          notes TEXT,
          status TEXT NOT NULL CHECK (status IN ('DRAFT','PENDING','CONFIRMED','CANCELED')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (fiscal_document_id) REFERENCES fiscal_documents(id),
          FOREIGN KEY (fiscal_document_item_id) REFERENCES fiscal_document_items(id),
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (responsible_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (product_id) REFERENCES products(id),
          FOREIGN KEY (service_rate_rule_id) REFERENCES service_rate_rules(id)
        );
        CREATE INDEX IF NOT EXISTS idx_operations_fiscal_document_id ON operations(fiscal_document_id);
        CREATE INDEX IF NOT EXISTS idx_operations_organization_id ON operations(organization_id);
        CREATE INDEX IF NOT EXISTS idx_operations_responsible_partner_id ON operations(responsible_partner_id);
        CREATE INDEX IF NOT EXISTS idx_operations_operation_date ON operations(operation_date);
        CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
      `);
    }
  },
  {
    name: "006_spreadsheet_imports",
    up: (db) => {
      const columns = (table: string): string[] =>
        (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
      const fiscalColumns = columns("fiscal_documents");
      const operationColumns = columns("operations");
      if (!fiscalColumns.includes("source")) db.exec("ALTER TABLE fiscal_documents ADD COLUMN source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','SPREADSHEET'))");
      if (!fiscalColumns.includes("import_job_id")) db.exec("ALTER TABLE fiscal_documents ADD COLUMN import_job_id TEXT");
      if (!fiscalColumns.includes("import_row_id")) db.exec("ALTER TABLE fiscal_documents ADD COLUMN import_row_id TEXT");
      if (!operationColumns.includes("source")) db.exec("ALTER TABLE operations ADD COLUMN source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','SPREADSHEET'))");
      if (!operationColumns.includes("import_job_id")) db.exec("ALTER TABLE operations ADD COLUMN import_job_id TEXT");
      if (!operationColumns.includes("import_row_id")) db.exec("ALTER TABLE operations ADD COLUMN import_row_id TEXT");
      db.exec(`
        CREATE TABLE IF NOT EXISTS spreadsheet_mapping_templates (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          name TEXT NOT NULL,
          import_type TEXT NOT NULL CHECK (import_type IN ('GENERAL_SALES','CLIENT_INDIVIDUAL','CUSTOM')),
          sheet_name_pattern TEXT,
          header_row INTEGER NOT NULL,
          column_mapping_json TEXT NOT NULL,
          default_commercial_flow TEXT CHECK (default_commercial_flow IN ('PURCHASE','SALE')),
          default_operation_scope TEXT CHECK (default_operation_scope IN ('INTERNAL','EXTERNAL')),
          default_product_id TEXT,
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (default_product_id) REFERENCES products(id)
        );
        CREATE INDEX IF NOT EXISTS idx_spreadsheet_mapping_templates_organization_id ON spreadsheet_mapping_templates(organization_id);
        CREATE INDEX IF NOT EXISTS idx_spreadsheet_mapping_templates_is_active ON spreadsheet_mapping_templates(is_active);

        CREATE TABLE IF NOT EXISTS spreadsheet_import_jobs (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          mapping_template_id TEXT,
          original_file_name TEXT NOT NULL,
          stored_file_path TEXT,
          selected_sheet_name TEXT NOT NULL,
          import_type TEXT NOT NULL CHECK (import_type IN ('GENERAL_SALES','CLIENT_INDIVIDUAL','CUSTOM')),
          status TEXT NOT NULL CHECK (status IN ('DRAFT','VALIDATED','PROCESSING','COMPLETED','COMPLETED_WITH_ERRORS','CANCELLED','FAILED','REVERTED')),
          total_rows INTEGER NOT NULL DEFAULT 0,
          valid_rows INTEGER NOT NULL DEFAULT 0,
          warning_rows INTEGER NOT NULL DEFAULT 0,
          error_rows INTEGER NOT NULL DEFAULT 0,
          imported_rows INTEGER NOT NULL DEFAULT 0,
          duplicate_rows INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT,
          cancelled_at TEXT,
          created_by_user_id TEXT,
          settings_json TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (mapping_template_id) REFERENCES spreadsheet_mapping_templates(id)
        );
        CREATE INDEX IF NOT EXISTS idx_spreadsheet_import_jobs_organization_id ON spreadsheet_import_jobs(organization_id);
        CREATE INDEX IF NOT EXISTS idx_spreadsheet_import_jobs_own_legal_entity_id ON spreadsheet_import_jobs(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_spreadsheet_import_jobs_status ON spreadsheet_import_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_spreadsheet_import_jobs_created_at ON spreadsheet_import_jobs(created_at);

        CREATE TABLE IF NOT EXISTS spreadsheet_import_rows (
          id TEXT PRIMARY KEY,
          import_job_id TEXT NOT NULL,
          sheet_name TEXT NOT NULL,
          source_row_number INTEGER NOT NULL,
          raw_data_json TEXT NOT NULL,
          normalized_data_json TEXT,
          status TEXT NOT NULL CHECK (status IN ('PENDING','VALID','WARNING','ERROR','DUPLICATE','IMPORTED','SKIPPED','REVERTED')),
          fiscal_document_id TEXT,
          operation_id TEXT,
          error_code TEXT,
          error_message TEXT,
          warning_codes_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (import_job_id) REFERENCES spreadsheet_import_jobs(id),
          FOREIGN KEY (fiscal_document_id) REFERENCES fiscal_documents(id),
          FOREIGN KEY (operation_id) REFERENCES operations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_spreadsheet_import_rows_import_job_id ON spreadsheet_import_rows(import_job_id);
        CREATE INDEX IF NOT EXISTS idx_spreadsheet_import_rows_source_row_number ON spreadsheet_import_rows(source_row_number);
        CREATE INDEX IF NOT EXISTS idx_spreadsheet_import_rows_status ON spreadsheet_import_rows(status);
        CREATE INDEX IF NOT EXISTS idx_spreadsheet_import_rows_fiscal_document_id ON spreadsheet_import_rows(fiscal_document_id);
        CREATE INDEX IF NOT EXISTS idx_spreadsheet_import_rows_operation_id ON spreadsheet_import_rows(operation_id);

        CREATE TABLE IF NOT EXISTS partner_aliases (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          business_partner_id TEXT NOT NULL,
          partner_legal_entity_id TEXT,
          alias TEXT NOT NULL,
          normalized_alias TEXT NOT NULL,
          source TEXT NOT NULL,
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (business_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (partner_legal_entity_id) REFERENCES partner_legal_entities(id)
        );
        CREATE INDEX IF NOT EXISTS idx_partner_aliases_organization_id ON partner_aliases(organization_id);
        CREATE INDEX IF NOT EXISTS idx_partner_aliases_business_partner_id ON partner_aliases(business_partner_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_aliases_active_unique ON partner_aliases(organization_id, normalized_alias) WHERE is_active = 1;
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_import_job_id ON fiscal_documents(import_job_id);
        CREATE INDEX IF NOT EXISTS idx_operations_import_job_id ON operations(import_job_id);
      `);
    }
  },
  {
    name: "007_xml_imports",
    up: (db) => {
      const columns = (table: string): string[] =>
        (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
      const fiscalColumns = columns("fiscal_documents");
      if (!fiscalColumns.includes("xml_file_path")) {
        db.exec(`
          PRAGMA foreign_keys = OFF;
          CREATE TABLE fiscal_documents_007 (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            own_legal_entity_id TEXT NOT NULL,
            responsible_partner_id TEXT NOT NULL,
            partner_legal_entity_id TEXT,
            document_type TEXT NOT NULL CHECK (document_type IN ('MANUAL_INVOICE')),
            access_key TEXT,
            document_number TEXT NOT NULL,
            series TEXT,
            issue_date TEXT NOT NULL,
            total_amount_cents INTEGER NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('DRAFT','PENDING','CONFIRMED','CANCELED')),
            has_pending_issues INTEGER NOT NULL CHECK (has_pending_issues IN (0, 1)),
            pending_notes TEXT,
            duplicate_warning TEXT,
            notes TEXT,
            confirmed_at TEXT,
            canceled_at TEXT,
            cancel_reason TEXT,
            source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','SPREADSHEET','XML')),
            import_job_id TEXT,
            import_row_id TEXT,
            xml_file_path TEXT,
            xml_file_hash TEXT,
            protocol_number TEXT,
            protocol_date TEXT,
            authorization_status_code TEXT,
            authorization_status_message TEXT,
            xml_import_job_id TEXT,
            merged_from_source TEXT CHECK (merged_from_source IN ('MANUAL','SPREADSHEET','XML')),
            merged_at TEXT,
            direction TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (direction IN ('INBOUND','OUTBOUND','UNKNOWN')),
            fiscal_snapshot_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (organization_id) REFERENCES organizations(id),
            FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
            FOREIGN KEY (responsible_partner_id) REFERENCES business_partners(id),
            FOREIGN KEY (partner_legal_entity_id) REFERENCES partner_legal_entities(id)
          );
          INSERT INTO fiscal_documents_007 (
            id, organization_id, own_legal_entity_id, responsible_partner_id, partner_legal_entity_id, document_type,
            access_key, document_number, series, issue_date, total_amount_cents, status, has_pending_issues,
            pending_notes, duplicate_warning, notes, confirmed_at, canceled_at, cancel_reason, source, import_job_id,
            import_row_id, created_at, updated_at
          )
          SELECT id, organization_id, own_legal_entity_id, responsible_partner_id, partner_legal_entity_id, document_type,
            access_key, document_number, series, issue_date, total_amount_cents, status, has_pending_issues,
            pending_notes, duplicate_warning, notes, confirmed_at, canceled_at, cancel_reason,
            COALESCE(source, 'MANUAL'), import_job_id, import_row_id, created_at, updated_at
          FROM fiscal_documents;
          DROP TABLE fiscal_documents;
          ALTER TABLE fiscal_documents_007 RENAME TO fiscal_documents;
          PRAGMA foreign_keys = ON;
        `);
      }
      const operationColumns = columns("operations");
      if (!operationColumns.includes("xml_import_job_id")) {
        db.exec(`
          PRAGMA foreign_keys = OFF;
          CREATE TABLE operations_007 (
            id TEXT PRIMARY KEY,
            fiscal_document_id TEXT NOT NULL,
            fiscal_document_item_id TEXT,
            organization_id TEXT NOT NULL,
            own_legal_entity_id TEXT NOT NULL,
            responsible_partner_id TEXT NOT NULL,
            product_id TEXT,
            operation_type TEXT NOT NULL CHECK (operation_type IN ('PURCHASE','SALE')),
            operation_scope TEXT NOT NULL CHECK (operation_scope IN ('INTERNAL','EXTERNAL')),
            operation_date TEXT NOT NULL,
            quantity_sacks_decimal TEXT NOT NULL,
            service_rate_rule_id TEXT,
            applied_rate_value_cents INTEGER NOT NULL,
            service_amount_cents INTEGER NOT NULL,
            rate_was_manually_overridden INTEGER NOT NULL CHECK (rate_was_manually_overridden IN (0, 1)),
            manual_rate_value_cents INTEGER,
            manual_override_reason TEXT,
            notes TEXT,
            status TEXT NOT NULL CHECK (status IN ('DRAFT','PENDING','CONFIRMED','CANCELED')),
            source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','SPREADSHEET','XML')),
            import_job_id TEXT,
            import_row_id TEXT,
            xml_import_job_id TEXT,
            classification_rule_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (fiscal_document_id) REFERENCES fiscal_documents(id),
            FOREIGN KEY (fiscal_document_item_id) REFERENCES fiscal_document_items(id),
            FOREIGN KEY (organization_id) REFERENCES organizations(id),
            FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
            FOREIGN KEY (responsible_partner_id) REFERENCES business_partners(id),
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (service_rate_rule_id) REFERENCES service_rate_rules(id)
          );
          INSERT INTO operations_007 (
            id, fiscal_document_id, fiscal_document_item_id, organization_id, own_legal_entity_id, responsible_partner_id,
            product_id, operation_type, operation_scope, operation_date, quantity_sacks_decimal, service_rate_rule_id,
            applied_rate_value_cents, service_amount_cents, rate_was_manually_overridden, manual_rate_value_cents,
            manual_override_reason, notes, status, source, import_job_id, import_row_id, created_at, updated_at
          )
          SELECT id, fiscal_document_id, fiscal_document_item_id, organization_id, own_legal_entity_id, responsible_partner_id,
            product_id, operation_type, operation_scope, operation_date, quantity_sacks_decimal, service_rate_rule_id,
            applied_rate_value_cents, service_amount_cents, rate_was_manually_overridden, manual_rate_value_cents,
            manual_override_reason, notes, status, COALESCE(source, 'MANUAL'), import_job_id, import_row_id, created_at, updated_at
          FROM operations;
          DROP TABLE operations;
          ALTER TABLE operations_007 RENAME TO operations;
          PRAGMA foreign_keys = ON;
        `);
      }
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_documents_access_key_unique ON fiscal_documents(access_key) WHERE access_key IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_organization_id ON fiscal_documents(organization_id);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_own_legal_entity_id ON fiscal_documents(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_responsible_partner_id ON fiscal_documents(responsible_partner_id);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status ON fiscal_documents(status);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_issue_date ON fiscal_documents(issue_date);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_possible_duplicate ON fiscal_documents(organization_id, responsible_partner_id, document_number, series, issue_date, total_amount_cents);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_import_job_id ON fiscal_documents(import_job_id);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_xml_import_job_id ON fiscal_documents(xml_import_job_id);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_xml_file_hash ON fiscal_documents(xml_file_hash);
        CREATE INDEX IF NOT EXISTS idx_fiscal_documents_source ON fiscal_documents(source);

        CREATE INDEX IF NOT EXISTS idx_operations_fiscal_document_id ON operations(fiscal_document_id);
        CREATE INDEX IF NOT EXISTS idx_operations_organization_id ON operations(organization_id);
        CREATE INDEX IF NOT EXISTS idx_operations_responsible_partner_id ON operations(responsible_partner_id);
        CREATE INDEX IF NOT EXISTS idx_operations_operation_date ON operations(operation_date);
        CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
        CREATE INDEX IF NOT EXISTS idx_operations_import_job_id ON operations(import_job_id);
        CREATE INDEX IF NOT EXISTS idx_operations_xml_import_job_id ON operations(xml_import_job_id);
        CREATE INDEX IF NOT EXISTS idx_operations_classification_rule_id ON operations(classification_rule_id);

        CREATE TABLE IF NOT EXISTS xml_import_jobs (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('DRAFT','INSPECTING','VALIDATED','PROCESSING','COMPLETED','COMPLETED_WITH_ERRORS','CANCELLED','FAILED','REVERTED')),
          source_type TEXT NOT NULL CHECK (source_type IN ('FILE','MULTIPLE_FILES','FOLDER','DRAG_DROP')),
          selected_folder TEXT,
          include_subfolders INTEGER NOT NULL CHECK (include_subfolders IN (0, 1)),
          total_files INTEGER NOT NULL DEFAULT 0,
          valid_files INTEGER NOT NULL DEFAULT 0,
          warning_files INTEGER NOT NULL DEFAULT 0,
          duplicate_files INTEGER NOT NULL DEFAULT 0,
          error_files INTEGER NOT NULL DEFAULT 0,
          imported_notes INTEGER NOT NULL DEFAULT 0,
          imported_events INTEGER NOT NULL DEFAULT 0,
          created_operations INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT,
          cancelled_at TEXT,
          reverted_at TEXT,
          settings_json TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_xml_import_jobs_organization_id ON xml_import_jobs(organization_id);
        CREATE INDEX IF NOT EXISTS idx_xml_import_jobs_status ON xml_import_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_xml_import_jobs_created_at ON xml_import_jobs(created_at);

        CREATE TABLE IF NOT EXISTS xml_import_files (
          id TEXT PRIMARY KEY,
          import_job_id TEXT NOT NULL,
          original_file_name TEXT NOT NULL,
          stored_file_path TEXT,
          file_hash TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          xml_type TEXT NOT NULL CHECK (xml_type IN ('NFE_PROC','NFE','EVENT_CANCELLATION','EVENT_CORRECTION_LETTER','EVENT_OTHER','UNKNOWN')),
          access_key TEXT,
          status TEXT NOT NULL CHECK (status IN ('PENDING','VALID','WARNING','PENDING_REVIEW','DUPLICATE','ERROR','IMPORTED','SKIPPED','REVERTED')),
          fiscal_document_id TEXT,
          fiscal_document_event_id TEXT,
          error_code TEXT,
          error_message TEXT,
          warning_codes_json TEXT,
          extracted_data_json TEXT,
          resolution_data_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (import_job_id) REFERENCES xml_import_jobs(id),
          FOREIGN KEY (fiscal_document_id) REFERENCES fiscal_documents(id),
          FOREIGN KEY (fiscal_document_event_id) REFERENCES fiscal_document_events(id)
        );
        CREATE INDEX IF NOT EXISTS idx_xml_import_files_import_job_id ON xml_import_files(import_job_id);
        CREATE INDEX IF NOT EXISTS idx_xml_import_files_file_hash ON xml_import_files(file_hash);
        CREATE INDEX IF NOT EXISTS idx_xml_import_files_access_key ON xml_import_files(access_key);
        CREATE INDEX IF NOT EXISTS idx_xml_import_files_xml_type ON xml_import_files(xml_type);
        CREATE INDEX IF NOT EXISTS idx_xml_import_files_status ON xml_import_files(status);
        CREATE INDEX IF NOT EXISTS idx_xml_import_files_fiscal_document_id ON xml_import_files(fiscal_document_id);

        CREATE TABLE IF NOT EXISTS fiscal_document_events (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          fiscal_document_id TEXT,
          access_key TEXT NOT NULL,
          event_type TEXT NOT NULL CHECK (event_type IN ('CANCELLATION','CORRECTION_LETTER','OTHER')),
          sequence_number TEXT NOT NULL,
          event_date TEXT,
          protocol_number TEXT,
          status_code TEXT,
          status_message TEXT,
          correction_text TEXT,
          xml_file_path TEXT,
          file_hash TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (fiscal_document_id) REFERENCES fiscal_documents(id)
        );
        CREATE INDEX IF NOT EXISTS idx_fiscal_document_events_organization_id ON fiscal_document_events(organization_id);
        CREATE INDEX IF NOT EXISTS idx_fiscal_document_events_document_id ON fiscal_document_events(fiscal_document_id);
        CREATE INDEX IF NOT EXISTS idx_fiscal_document_events_access_key ON fiscal_document_events(access_key);
        CREATE INDEX IF NOT EXISTS idx_fiscal_document_events_event_type ON fiscal_document_events(event_type);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_document_events_unique ON fiscal_document_events(access_key, event_type, sequence_number, COALESCE(protocol_number, ''));

        CREATE TABLE IF NOT EXISTS product_aliases (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          issuer_partner_legal_entity_id TEXT,
          source_product_code TEXT,
          source_description TEXT NOT NULL,
          normalized_description TEXT NOT NULL,
          ncm TEXT,
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (product_id) REFERENCES products(id),
          FOREIGN KEY (issuer_partner_legal_entity_id) REFERENCES partner_legal_entities(id)
        );
        CREATE INDEX IF NOT EXISTS idx_product_aliases_organization_id ON product_aliases(organization_id);
        CREATE INDEX IF NOT EXISTS idx_product_aliases_product_id ON product_aliases(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_aliases_description ON product_aliases(normalized_description);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_product_aliases_active_unique ON product_aliases(organization_id, COALESCE(issuer_partner_legal_entity_id, ''), COALESCE(source_product_code, ''), normalized_description, COALESCE(ncm, '')) WHERE is_active = 1;

        CREATE TABLE IF NOT EXISTS operation_classification_rules (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT,
          issuer_partner_legal_entity_id TEXT,
          recipient_partner_legal_entity_id TEXT,
          destination_partner_id TEXT,
          product_id TEXT,
          client_partner_id TEXT NOT NULL,
          commercial_flow TEXT CHECK (commercial_flow IN ('PURCHASE','SALE')),
          operation_scope TEXT NOT NULL CHECK (operation_scope IN ('INTERNAL','EXTERNAL')),
          priority INTEGER NOT NULL,
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (issuer_partner_legal_entity_id) REFERENCES partner_legal_entities(id),
          FOREIGN KEY (recipient_partner_legal_entity_id) REFERENCES partner_legal_entities(id),
          FOREIGN KEY (destination_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (product_id) REFERENCES products(id),
          FOREIGN KEY (client_partner_id) REFERENCES business_partners(id)
        );
        CREATE INDEX IF NOT EXISTS idx_operation_classification_rules_organization_id ON operation_classification_rules(organization_id);
        CREATE INDEX IF NOT EXISTS idx_operation_classification_rules_active ON operation_classification_rules(is_active);
        CREATE INDEX IF NOT EXISTS idx_operation_classification_rules_scope ON operation_classification_rules(operation_scope);

        CREATE TABLE IF NOT EXISTS fiscal_document_merge_history (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          fiscal_document_id TEXT NOT NULL,
          xml_import_job_id TEXT,
          previous_source TEXT CHECK (previous_source IN ('MANUAL','SPREADSHEET','XML')),
          decision TEXT NOT NULL,
          differences_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (fiscal_document_id) REFERENCES fiscal_documents(id),
          FOREIGN KEY (xml_import_job_id) REFERENCES xml_import_jobs(id)
        );
        CREATE INDEX IF NOT EXISTS idx_fiscal_document_merge_history_document_id ON fiscal_document_merge_history(fiscal_document_id);
        CREATE INDEX IF NOT EXISTS idx_fiscal_document_merge_history_xml_job_id ON fiscal_document_merge_history(xml_import_job_id);
      `);
    }
  },
  {
    name: "008_client_charges_ledger",
    up: (db) => {
      const columns = (table: string): string[] =>
        (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
      const operationColumns = columns("operations");
      if (!operationColumns.includes("billing_status")) db.exec("ALTER TABLE operations ADD COLUMN billing_status TEXT NOT NULL DEFAULT 'UNBILLED' CHECK (billing_status IN ('UNBILLED','RESERVED','BILLED'))");
      if (!operationColumns.includes("client_charge_id")) db.exec("ALTER TABLE operations ADD COLUMN client_charge_id TEXT");
      db.exec(`
        CREATE TABLE IF NOT EXISTS client_charges (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          client_partner_id TEXT NOT NULL,
          billing_profile_id TEXT,
          charge_number TEXT,
          reference_code TEXT,
          periodicity TEXT NOT NULL CHECK (periodicity IN ('WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY','CUSTOM')),
          period_start TEXT NOT NULL,
          period_end TEXT NOT NULL,
          issue_date TEXT,
          due_date TEXT,
          status TEXT NOT NULL CHECK (status IN ('DRAFT','PENDING_REVIEW','ISSUED','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED','REPLACED')),
          subtotal_services_cents INTEGER NOT NULL DEFAULT 0,
          additions_cents INTEGER NOT NULL DEFAULT 0,
          deductions_cents INTEGER NOT NULL DEFAULT 0,
          final_amount_cents INTEGER NOT NULL DEFAULT 0,
          paid_amount_cents INTEGER NOT NULL DEFAULT 0,
          open_amount_cents INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          internal_notes TEXT,
          pdf_file_path TEXT,
          pdf_file_hash TEXT,
          excel_file_path TEXT,
          image_file_path TEXT,
          snapshot_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          issued_at TEXT,
          cancelled_at TEXT,
          cancellation_reason TEXT,
          replaced_by_charge_id TEXT,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (client_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (billing_profile_id) REFERENCES client_billing_profiles(id),
          FOREIGN KEY (replaced_by_charge_id) REFERENCES client_charges(id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_client_charges_number_unique ON client_charges(organization_id, own_legal_entity_id, charge_number) WHERE charge_number IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_client_charges_organization_id ON client_charges(organization_id);
        CREATE INDEX IF NOT EXISTS idx_client_charges_own_legal_entity_id ON client_charges(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_client_charges_client_partner_id ON client_charges(client_partner_id);
        CREATE INDEX IF NOT EXISTS idx_client_charges_period ON client_charges(period_start, period_end);
        CREATE INDEX IF NOT EXISTS idx_client_charges_issue_date ON client_charges(issue_date);
        CREATE INDEX IF NOT EXISTS idx_client_charges_due_date ON client_charges(due_date);
        CREATE INDEX IF NOT EXISTS idx_client_charges_status ON client_charges(status);

        CREATE TABLE IF NOT EXISTS client_charge_operations (
          id TEXT PRIMARY KEY,
          client_charge_id TEXT NOT NULL,
          operation_id TEXT NOT NULL,
          operation_date_snapshot TEXT NOT NULL,
          fiscal_document_number_snapshot TEXT,
          fiscal_document_series_snapshot TEXT,
          issuer_name_snapshot TEXT,
          destination_name_snapshot TEXT,
          product_name_snapshot TEXT,
          operation_scope_snapshot TEXT NOT NULL CHECK (operation_scope_snapshot IN ('INTERNAL','EXTERNAL')),
          quantity_sacks_decimal_snapshot TEXT NOT NULL,
          service_rate_cents_snapshot INTEGER NOT NULL,
          service_amount_cents_snapshot INTEGER NOT NULL,
          released_at TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (client_charge_id) REFERENCES client_charges(id),
          FOREIGN KEY (operation_id) REFERENCES operations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_client_charge_operations_charge_id ON client_charge_operations(client_charge_id);
        CREATE INDEX IF NOT EXISTS idx_client_charge_operations_operation_id ON client_charge_operations(operation_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_client_charge_operations_active_unique ON client_charge_operations(operation_id) WHERE released_at IS NULL;

        CREATE TABLE IF NOT EXISTS client_charge_adjustments (
          id TEXT PRIMARY KEY,
          client_charge_id TEXT NOT NULL,
          ledger_entry_id TEXT,
          adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('ADVANCE','CREDIT','DISCOUNT','SURCHARGE','REIMBURSEMENT','PREVIOUS_BALANCE','MANUAL_ADJUSTMENT','OTHER')),
          effect TEXT NOT NULL CHECK (effect IN ('INCREASE_RECEIVABLE','REDUCE_RECEIVABLE')),
          description TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          sort_order INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (client_charge_id) REFERENCES client_charges(id)
        );
        CREATE INDEX IF NOT EXISTS idx_client_charge_adjustments_charge_id ON client_charge_adjustments(client_charge_id);
        CREATE INDEX IF NOT EXISTS idx_client_charge_adjustments_ledger_entry_id ON client_charge_adjustments(ledger_entry_id);

        CREATE TABLE IF NOT EXISTS client_ledger_entries (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          client_partner_id TEXT NOT NULL,
          client_charge_id TEXT,
          entry_type TEXT NOT NULL CHECK (entry_type IN ('SERVICE_CHARGE','ADVANCE_RECEIVED','PAYMENT_RECEIVED','DISCOUNT','CREDIT','SURCHARGE','REIMBURSEMENT','PREVIOUS_BALANCE','MANUAL_ADJUSTMENT','REVERSAL','OTHER')),
          effect TEXT NOT NULL CHECK (effect IN ('INCREASE_RECEIVABLE','REDUCE_RECEIVABLE')),
          amount_cents INTEGER NOT NULL,
          entry_date TEXT NOT NULL,
          description TEXT NOT NULL,
          reference_number TEXT,
          notes TEXT,
          attachment_path TEXT,
          status TEXT NOT NULL CHECK (status IN ('DRAFT','CONFIRMED','CANCELLED')),
          available_amount_cents INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          cancelled_at TEXT,
          cancellation_reason TEXT,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (client_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (client_charge_id) REFERENCES client_charges(id)
        );
        CREATE INDEX IF NOT EXISTS idx_client_ledger_entries_organization_id ON client_ledger_entries(organization_id);
        CREATE INDEX IF NOT EXISTS idx_client_ledger_entries_own_legal_entity_id ON client_ledger_entries(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_client_ledger_entries_client_partner_id ON client_ledger_entries(client_partner_id);
        CREATE INDEX IF NOT EXISTS idx_client_ledger_entries_charge_id ON client_ledger_entries(client_charge_id);
        CREATE INDEX IF NOT EXISTS idx_client_ledger_entries_type ON client_ledger_entries(entry_type);
        CREATE INDEX IF NOT EXISTS idx_client_ledger_entries_date ON client_ledger_entries(entry_date);
        CREATE INDEX IF NOT EXISTS idx_client_ledger_entries_status ON client_ledger_entries(status);

        CREATE TABLE IF NOT EXISTS client_credit_allocations (
          id TEXT PRIMARY KEY,
          ledger_entry_id TEXT NOT NULL,
          client_charge_id TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          allocated_at TEXT NOT NULL,
          cancelled_at TEXT,
          cancellation_reason TEXT,
          FOREIGN KEY (ledger_entry_id) REFERENCES client_ledger_entries(id),
          FOREIGN KEY (client_charge_id) REFERENCES client_charges(id)
        );
        CREATE INDEX IF NOT EXISTS idx_client_credit_allocations_ledger_entry_id ON client_credit_allocations(ledger_entry_id);
        CREATE INDEX IF NOT EXISTS idx_client_credit_allocations_charge_id ON client_credit_allocations(client_charge_id);

        CREATE TABLE IF NOT EXISTS client_payments (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          client_partner_id TEXT NOT NULL,
          payment_date TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          payment_method TEXT NOT NULL CHECK (payment_method IN ('PIX','BANK_TRANSFER','CASH','CHECK','OFFSET','OTHER')),
          bank_account_description TEXT,
          transaction_reference TEXT,
          notes TEXT,
          attachment_path TEXT,
          status TEXT NOT NULL CHECK (status IN ('CONFIRMED','CANCELLED')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          cancelled_at TEXT,
          cancellation_reason TEXT,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (client_partner_id) REFERENCES business_partners(id)
        );
        CREATE INDEX IF NOT EXISTS idx_client_payments_client_partner_id ON client_payments(client_partner_id);
        CREATE INDEX IF NOT EXISTS idx_client_payments_payment_date ON client_payments(payment_date);
        CREATE INDEX IF NOT EXISTS idx_client_payments_status ON client_payments(status);

        CREATE TABLE IF NOT EXISTS client_payment_allocations (
          id TEXT PRIMARY KEY,
          client_payment_id TEXT NOT NULL,
          client_charge_id TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          allocated_at TEXT NOT NULL,
          cancelled_at TEXT,
          cancellation_reason TEXT,
          FOREIGN KEY (client_payment_id) REFERENCES client_payments(id),
          FOREIGN KEY (client_charge_id) REFERENCES client_charges(id)
        );
        CREATE INDEX IF NOT EXISTS idx_client_payment_allocations_payment_id ON client_payment_allocations(client_payment_id);
        CREATE INDEX IF NOT EXISTS idx_client_payment_allocations_charge_id ON client_payment_allocations(client_charge_id);

        CREATE TABLE IF NOT EXISTS document_sequences (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          document_type TEXT NOT NULL CHECK (document_type IN ('CLIENT_CHARGE')),
          year INTEGER,
          prefix TEXT,
          current_number INTEGER NOT NULL,
          padding INTEGER NOT NULL,
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_document_sequences_unique ON document_sequences(organization_id, own_legal_entity_id, document_type, COALESCE(year, 0), COALESCE(prefix, '')) WHERE is_active = 1;

        CREATE TABLE IF NOT EXISTS charge_document_versions (
          id TEXT PRIMARY KEY,
          client_charge_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          pdf_file_path TEXT,
          pdf_file_hash TEXT,
          excel_file_path TEXT,
          excel_file_hash TEXT,
          image_file_path TEXT,
          image_file_hash TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (client_charge_id) REFERENCES client_charges(id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_charge_document_versions_unique ON charge_document_versions(client_charge_id, version);
        CREATE INDEX IF NOT EXISTS idx_charge_document_versions_charge_id ON charge_document_versions(client_charge_id);

        CREATE TABLE IF NOT EXISTS charge_status_history (
          id TEXT PRIMARY KEY,
          client_charge_id TEXT NOT NULL,
          previous_status TEXT,
          next_status TEXT NOT NULL,
          reason TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (client_charge_id) REFERENCES client_charges(id)
        );
        CREATE INDEX IF NOT EXISTS idx_charge_status_history_charge_id ON charge_status_history(client_charge_id);

        CREATE INDEX IF NOT EXISTS idx_operations_billing_status ON operations(billing_status);
        CREATE INDEX IF NOT EXISTS idx_operations_client_charge_id ON operations(client_charge_id);
      `);
    }
  }
];
