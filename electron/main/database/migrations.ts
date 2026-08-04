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
  },
  {
    name: "009_accounts_payable",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS expense_categories (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          parent_category_id TEXT,
          name TEXT NOT NULL,
          code TEXT,
          expense_nature TEXT NOT NULL CHECK (expense_nature IN ('FIXED','VARIABLE','TAX','PERSONNEL','FINANCIAL','INVESTMENT','OTHER')),
          description TEXT,
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (parent_category_id) REFERENCES expense_categories(id)
        );
        CREATE INDEX IF NOT EXISTS idx_expense_categories_organization_id ON expense_categories(organization_id);
        CREATE INDEX IF NOT EXISTS idx_expense_categories_parent_category_id ON expense_categories(parent_category_id);
        CREATE INDEX IF NOT EXISTS idx_expense_categories_is_active ON expense_categories(is_active);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_categories_code_unique ON expense_categories(organization_id, code) WHERE code IS NOT NULL;

        CREATE TABLE IF NOT EXISTS cost_centers (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT,
          location_id TEXT,
          parent_cost_center_id TEXT,
          name TEXT NOT NULL,
          code TEXT,
          description TEXT,
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (location_id) REFERENCES locations(id),
          FOREIGN KEY (parent_cost_center_id) REFERENCES cost_centers(id)
        );
        CREATE INDEX IF NOT EXISTS idx_cost_centers_organization_id ON cost_centers(organization_id);
        CREATE INDEX IF NOT EXISTS idx_cost_centers_own_legal_entity_id ON cost_centers(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_cost_centers_location_id ON cost_centers(location_id);
        CREATE INDEX IF NOT EXISTS idx_cost_centers_is_active ON cost_centers(is_active);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_centers_code_unique ON cost_centers(organization_id, code) WHERE code IS NOT NULL;

        CREATE TABLE IF NOT EXISTS financial_accounts (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          name TEXT NOT NULL,
          account_type TEXT NOT NULL CHECK (account_type IN ('BANK_ACCOUNT','CASH','DIGITAL_WALLET','OTHER')),
          bank_name TEXT,
          branch TEXT,
          account_identifier_masked TEXT,
          pix_key_description TEXT,
          notes TEXT,
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id)
        );
        CREATE INDEX IF NOT EXISTS idx_financial_accounts_organization_id ON financial_accounts(organization_id);
        CREATE INDEX IF NOT EXISTS idx_financial_accounts_own_legal_entity_id ON financial_accounts(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_financial_accounts_is_active ON financial_accounts(is_active);

        CREATE TABLE IF NOT EXISTS payable_recurring_templates (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          supplier_partner_id TEXT,
          supplier_legal_entity_id TEXT,
          payee_name_snapshot TEXT NOT NULL,
          category_id TEXT NOT NULL,
          default_cost_center_id TEXT,
          default_location_id TEXT,
          description TEXT NOT NULL,
          amount_mode TEXT NOT NULL CHECK (amount_mode IN ('FIXED','VARIABLE')),
          fixed_amount_cents INTEGER,
          estimated_amount_cents INTEGER,
          frequency TEXT NOT NULL CHECK (frequency IN ('MONTHLY','BIMONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL','CUSTOM')),
          due_day INTEGER NOT NULL,
          generation_lead_days INTEGER NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT,
          auto_generate_on_open INTEGER NOT NULL CHECK (auto_generate_on_open IN (0, 1)),
          last_generated_competence TEXT,
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (supplier_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (supplier_legal_entity_id) REFERENCES partner_legal_entities(id),
          FOREIGN KEY (category_id) REFERENCES expense_categories(id),
          FOREIGN KEY (default_cost_center_id) REFERENCES cost_centers(id),
          FOREIGN KEY (default_location_id) REFERENCES locations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_payable_recurring_templates_organization_id ON payable_recurring_templates(organization_id);
        CREATE INDEX IF NOT EXISTS idx_payable_recurring_templates_own_legal_entity_id ON payable_recurring_templates(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_payable_recurring_templates_is_active ON payable_recurring_templates(is_active);
        CREATE INDEX IF NOT EXISTS idx_payable_recurring_templates_last_generated ON payable_recurring_templates(last_generated_competence);

        CREATE TABLE IF NOT EXISTS payable_installment_groups (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          supplier_partner_id TEXT,
          description TEXT NOT NULL,
          total_amount_cents INTEGER NOT NULL,
          installment_count INTEGER NOT NULL,
          first_due_date TEXT NOT NULL,
          interval_type TEXT NOT NULL CHECK (interval_type IN ('MONTHLY','DAYS_30','CUSTOM')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          cancelled_at TEXT,
          cancellation_reason TEXT,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (supplier_partner_id) REFERENCES business_partners(id)
        );
        CREATE INDEX IF NOT EXISTS idx_payable_installment_groups_organization_id ON payable_installment_groups(organization_id);
        CREATE INDEX IF NOT EXISTS idx_payable_installment_groups_own_legal_entity_id ON payable_installment_groups(own_legal_entity_id);

        CREATE TABLE IF NOT EXISTS accounts_payable (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          supplier_partner_id TEXT,
          supplier_legal_entity_id TEXT,
          payee_name_snapshot TEXT NOT NULL,
          payee_tax_id_snapshot TEXT,
          category_id TEXT NOT NULL,
          default_cost_center_id TEXT,
          default_location_id TEXT,
          recurring_template_id TEXT,
          installment_group_id TEXT,
          installment_number INTEGER,
          installment_count INTEGER,
          source TEXT NOT NULL CHECK (source IN ('MANUAL','RECURRING','INSTALLMENT','IMPORT')),
          description TEXT NOT NULL,
          document_type TEXT,
          document_number TEXT,
          competence_date TEXT NOT NULL,
          issue_date TEXT,
          due_date TEXT NOT NULL,
          original_amount_cents INTEGER,
          discount_cents INTEGER NOT NULL DEFAULT 0,
          interest_cents INTEGER NOT NULL DEFAULT 0,
          penalty_cents INTEGER NOT NULL DEFAULT 0,
          other_additions_cents INTEGER NOT NULL DEFAULT 0,
          final_amount_cents INTEGER,
          paid_amount_cents INTEGER NOT NULL DEFAULT 0,
          open_amount_cents INTEGER,
          amount_status TEXT NOT NULL CHECK (amount_status IN ('PENDING','ESTIMATED','CONFIRMED')),
          status TEXT NOT NULL CHECK (status IN ('DRAFT','SCHEDULED','OPEN','PARTIALLY_PAID','PAID','OVERDUE','CONTESTED','CANCELLED')),
          notes TEXT,
          internal_notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          confirmed_at TEXT,
          cancelled_at TEXT,
          cancellation_reason TEXT,
          contested_at TEXT,
          contest_reason TEXT,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (supplier_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (supplier_legal_entity_id) REFERENCES partner_legal_entities(id),
          FOREIGN KEY (category_id) REFERENCES expense_categories(id),
          FOREIGN KEY (default_cost_center_id) REFERENCES cost_centers(id),
          FOREIGN KEY (default_location_id) REFERENCES locations(id),
          FOREIGN KEY (recurring_template_id) REFERENCES payable_recurring_templates(id),
          FOREIGN KEY (installment_group_id) REFERENCES payable_installment_groups(id)
        );
        CREATE INDEX IF NOT EXISTS idx_accounts_payable_organization_id ON accounts_payable(organization_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_payable_own_legal_entity_id ON accounts_payable(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_payable_supplier_partner_id ON accounts_payable(supplier_partner_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_payable_category_id ON accounts_payable(category_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_payable_default_cost_center_id ON accounts_payable(default_cost_center_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_payable_default_location_id ON accounts_payable(default_location_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_payable_competence_date ON accounts_payable(competence_date);
        CREATE INDEX IF NOT EXISTS idx_accounts_payable_due_date ON accounts_payable(due_date);
        CREATE INDEX IF NOT EXISTS idx_accounts_payable_status ON accounts_payable(status);
        CREATE INDEX IF NOT EXISTS idx_accounts_payable_recurring_template_id ON accounts_payable(recurring_template_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_payable_installment_group_id ON accounts_payable(installment_group_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_payable_source ON accounts_payable(source);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_payable_recurring_competence_unique ON accounts_payable(recurring_template_id, competence_date) WHERE recurring_template_id IS NOT NULL AND status != 'CANCELLED';
        CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_payable_installment_unique ON accounts_payable(installment_group_id, installment_number) WHERE installment_group_id IS NOT NULL AND installment_number IS NOT NULL;

        CREATE TABLE IF NOT EXISTS account_payable_allocations (
          id TEXT PRIMARY KEY,
          account_payable_id TEXT NOT NULL,
          cost_center_id TEXT,
          location_id TEXT,
          allocation_amount_cents INTEGER NOT NULL,
          allocation_basis_points INTEGER,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (account_payable_id) REFERENCES accounts_payable(id),
          FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id),
          FOREIGN KEY (location_id) REFERENCES locations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_account_payable_allocations_payable_id ON account_payable_allocations(account_payable_id);
        CREATE INDEX IF NOT EXISTS idx_account_payable_allocations_cost_center_id ON account_payable_allocations(cost_center_id);
        CREATE INDEX IF NOT EXISTS idx_account_payable_allocations_location_id ON account_payable_allocations(location_id);

        CREATE TABLE IF NOT EXISTS payable_payments (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          financial_account_id TEXT,
          payment_date TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          payment_method TEXT NOT NULL CHECK (payment_method IN ('PIX','BANK_TRANSFER','BOLETO','CASH','CHECK','CARD','DIRECT_DEBIT','OFFSET','OTHER')),
          transaction_reference TEXT,
          payee_name_snapshot TEXT NOT NULL,
          notes TEXT,
          attachment_path TEXT,
          attachment_hash TEXT,
          status TEXT NOT NULL CHECK (status IN ('CONFIRMED','CANCELLED')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          cancelled_at TEXT,
          cancellation_reason TEXT,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (financial_account_id) REFERENCES financial_accounts(id)
        );
        CREATE INDEX IF NOT EXISTS idx_payable_payments_organization_id ON payable_payments(organization_id);
        CREATE INDEX IF NOT EXISTS idx_payable_payments_own_legal_entity_id ON payable_payments(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_payable_payments_payment_date ON payable_payments(payment_date);
        CREATE INDEX IF NOT EXISTS idx_payable_payments_status ON payable_payments(status);

        CREATE TABLE IF NOT EXISTS payable_payment_allocations (
          id TEXT PRIMARY KEY,
          payable_payment_id TEXT NOT NULL,
          account_payable_id TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          allocated_at TEXT NOT NULL,
          cancelled_at TEXT,
          cancellation_reason TEXT,
          FOREIGN KEY (payable_payment_id) REFERENCES payable_payments(id),
          FOREIGN KEY (account_payable_id) REFERENCES accounts_payable(id)
        );
        CREATE INDEX IF NOT EXISTS idx_payable_payment_allocations_payment_id ON payable_payment_allocations(payable_payment_id);
        CREATE INDEX IF NOT EXISTS idx_payable_payment_allocations_payable_id ON payable_payment_allocations(account_payable_id);

        CREATE TABLE IF NOT EXISTS payable_status_history (
          id TEXT PRIMARY KEY,
          account_payable_id TEXT NOT NULL,
          previous_status TEXT,
          new_status TEXT NOT NULL,
          reason TEXT,
          changed_by_user_id TEXT,
          changed_at TEXT NOT NULL,
          FOREIGN KEY (account_payable_id) REFERENCES accounts_payable(id)
        );
        CREATE INDEX IF NOT EXISTS idx_payable_status_history_payable_id ON payable_status_history(account_payable_id);

        CREATE TABLE IF NOT EXISTS payable_document_attachments (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          account_payable_id TEXT,
          payable_payment_id TEXT,
          attachment_kind TEXT NOT NULL CHECK (attachment_kind IN ('PAYABLE_DOCUMENT','PAYMENT_PROOF','OTHER')),
          original_file_name TEXT NOT NULL,
          stored_file_path TEXT NOT NULL,
          file_hash TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (account_payable_id) REFERENCES accounts_payable(id),
          FOREIGN KEY (payable_payment_id) REFERENCES payable_payments(id)
        );
        CREATE INDEX IF NOT EXISTS idx_payable_document_attachments_payable_id ON payable_document_attachments(account_payable_id);
        CREATE INDEX IF NOT EXISTS idx_payable_document_attachments_payment_id ON payable_document_attachments(payable_payment_id);
      `);
    }
  },
  {
    name: "010_financial_attachments_reports",
    up: (db) => {
      const columns = (table: string): string[] =>
        (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
      const attachmentColumns = columns("payable_document_attachments");
      if (!attachmentColumns.includes("attachment_type")) db.exec("ALTER TABLE payable_document_attachments ADD COLUMN attachment_type TEXT NOT NULL DEFAULT 'OTHER' CHECK (attachment_type IN ('INVOICE','BILL','CONTRACT','RECEIPT','SUPPORTING_DOCUMENT','OTHER'))");
      if (!attachmentColumns.includes("file_extension")) db.exec("ALTER TABLE payable_document_attachments ADD COLUMN file_extension TEXT NOT NULL DEFAULT ''");
      if (!attachmentColumns.includes("description")) db.exec("ALTER TABLE payable_document_attachments ADD COLUMN description TEXT");
      if (!attachmentColumns.includes("updated_at")) db.exec("ALTER TABLE payable_document_attachments ADD COLUMN updated_at TEXT");
      if (!attachmentColumns.includes("removed_at")) db.exec("ALTER TABLE payable_document_attachments ADD COLUMN removed_at TEXT");
      if (!attachmentColumns.includes("removal_reason")) db.exec("ALTER TABLE payable_document_attachments ADD COLUMN removal_reason TEXT");
      db.exec(`
        UPDATE payable_document_attachments SET updated_at = COALESCE(updated_at, created_at) WHERE updated_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_payable_document_attachments_organization_id ON payable_document_attachments(organization_id);
        CREATE INDEX IF NOT EXISTS idx_payable_document_attachments_removed_at ON payable_document_attachments(removed_at);
        CREATE TABLE IF NOT EXISTS financial_report_generations (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT,
          report_type TEXT NOT NULL CHECK (report_type IN ('ACCOUNTS_PAYABLE','OVERDUE_PAYABLES','PAYMENTS','BY_LEGAL_ENTITY','BY_LOCATION','BY_COST_CENTER','BY_CATEGORY','BY_SUPPLIER','FIXED_VARIABLE','RECURRING','INSTALLMENTS','PROJECTED_CASH_FLOW')),
          format TEXT NOT NULL CHECK (format IN ('PDF','EXCEL')),
          filters_json TEXT NOT NULL,
          file_name TEXT NOT NULL,
          stored_file_path TEXT NOT NULL,
          file_hash TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id)
        );
        CREATE INDEX IF NOT EXISTS idx_financial_report_generations_organization_id ON financial_report_generations(organization_id);
        CREATE INDEX IF NOT EXISTS idx_financial_report_generations_own_legal_entity_id ON financial_report_generations(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_financial_report_generations_type ON financial_report_generations(report_type);
        CREATE INDEX IF NOT EXISTS idx_financial_report_generations_created_at ON financial_report_generations(created_at);
      `);
    }
  },
  {
    name: "011_deal_confirmations",
    up: (db) => {
      db.exec(`
        DROP INDEX IF EXISTS idx_document_sequences_unique;
        CREATE TABLE IF NOT EXISTS document_sequences_v2 (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          document_type TEXT NOT NULL CHECK (document_type IN ('CLIENT_CHARGE','DEAL_CONFIRMATION')),
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
        INSERT OR IGNORE INTO document_sequences_v2 (
          id, organization_id, own_legal_entity_id, document_type, year, prefix,
          current_number, padding, is_active, created_at, updated_at
        )
        SELECT id, organization_id, own_legal_entity_id, document_type, year, prefix,
          current_number, padding, is_active, created_at, updated_at
        FROM document_sequences;
        DROP TABLE IF EXISTS document_sequences;
        ALTER TABLE document_sequences_v2 RENAME TO document_sequences;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_document_sequences_unique ON document_sequences(organization_id, own_legal_entity_id, document_type, COALESCE(year, 0), COALESCE(prefix, '')) WHERE is_active = 1;

        CREATE TABLE IF NOT EXISTS deal_confirmation_templates (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT,
          name TEXT NOT NULL,
          description TEXT,
          version INTEGER NOT NULL,
          title TEXT NOT NULL,
          subtitle TEXT,
          layout_mode TEXT NOT NULL CHECK (layout_mode IN ('STANDARD','COMPACT','DETAILED')),
          default_payment_terms TEXT,
          default_delivery_terms TEXT,
          default_quality_terms TEXT,
          default_general_terms TEXT,
          show_broker INTEGER NOT NULL CHECK (show_broker IN (0, 1)),
          show_commercial_values INTEGER NOT NULL CHECK (show_commercial_values IN (0, 1)),
          show_item_origins INTEGER NOT NULL CHECK (show_item_origins IN (0, 1)),
          show_signature_blocks INTEGER NOT NULL CHECK (show_signature_blocks IN (0, 1)),
          signature_block_count INTEGER NOT NULL,
          is_default INTEGER NOT NULL CHECK (is_default IN (0, 1)),
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_templates_organization_id ON deal_confirmation_templates(organization_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_templates_own_legal_entity_id ON deal_confirmation_templates(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_templates_is_default ON deal_confirmation_templates(is_default);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_templates_is_active ON deal_confirmation_templates(is_active);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_confirmation_templates_default_org ON deal_confirmation_templates(organization_id) WHERE own_legal_entity_id IS NULL AND is_default = 1 AND is_active = 1;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_confirmation_templates_default_entity ON deal_confirmation_templates(organization_id, own_legal_entity_id) WHERE own_legal_entity_id IS NOT NULL AND is_default = 1 AND is_active = 1;

        CREATE TABLE IF NOT EXISTS deal_clause_templates (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          name TEXT NOT NULL,
          title TEXT,
          clause_text TEXT NOT NULL,
          category TEXT NOT NULL CHECK (category IN ('PAYMENT','DELIVERY','QUALITY','RESPONSIBILITY','CANCELLATION','GENERAL','OTHER')),
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_clause_templates_organization_id ON deal_clause_templates(organization_id);
        CREATE INDEX IF NOT EXISTS idx_deal_clause_templates_category ON deal_clause_templates(category);
        CREATE INDEX IF NOT EXISTS idx_deal_clause_templates_is_active ON deal_clause_templates(is_active);

        CREATE TABLE IF NOT EXISTS deal_confirmations (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          own_legal_entity_id TEXT NOT NULL,
          template_id TEXT,
          confirmation_number TEXT,
          temporary_reference TEXT NOT NULL,
          confirmation_date TEXT NOT NULL,
          negotiation_date TEXT,
          status TEXT NOT NULL CHECK (status IN ('DRAFT','PENDING_REVIEW','ISSUED','SENT_FOR_SIGNATURE','SIGNED','CANCELLED','REPLACED')),
          signature_status TEXT NOT NULL CHECK (signature_status IN ('NOT_APPLICABLE','NOT_SENT','WAITING_SIGNATURE','PARTIALLY_SIGNED','SIGNED','REJECTED')),
          currency_code TEXT NOT NULL,
          total_quantity_sacks_decimal TEXT NOT NULL,
          total_commercial_amount_cents INTEGER NOT NULL,
          delivery_location_snapshot TEXT,
          delivery_start_date TEXT,
          delivery_end_date TEXT,
          payment_terms_snapshot TEXT,
          quality_terms_snapshot TEXT,
          general_terms_snapshot TEXT,
          public_notes TEXT,
          internal_notes TEXT,
          template_snapshot_json TEXT,
          pending_issues_json TEXT NOT NULL DEFAULT '[]',
          issued_document_version_id TEXT,
          signed_document_version_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          issued_at TEXT,
          sent_for_signature_at TEXT,
          signed_at TEXT,
          cancelled_at TEXT,
          cancellation_reason TEXT,
          replaced_by_confirmation_id TEXT,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (template_id) REFERENCES deal_confirmation_templates(id),
          FOREIGN KEY (replaced_by_confirmation_id) REFERENCES deal_confirmations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_confirmations_organization_id ON deal_confirmations(organization_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmations_own_legal_entity_id ON deal_confirmations(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmations_confirmation_number ON deal_confirmations(confirmation_number);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmations_confirmation_date ON deal_confirmations(confirmation_date);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmations_status ON deal_confirmations(status);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmations_signature_status ON deal_confirmations(signature_status);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmations_replaced_by ON deal_confirmations(replaced_by_confirmation_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_confirmations_number_unique ON deal_confirmations(organization_id, own_legal_entity_id, confirmation_number) WHERE confirmation_number IS NOT NULL;

        CREATE TABLE IF NOT EXISTS deal_confirmation_parties (
          id TEXT PRIMARY KEY,
          deal_confirmation_id TEXT NOT NULL,
          party_role TEXT NOT NULL CHECK (party_role IN ('ISSUER','BROKER','SELLER','BUYER','DELIVERY_RECIPIENT','OTHER')),
          business_partner_id TEXT,
          partner_legal_entity_id TEXT,
          own_legal_entity_id TEXT,
          manual_name TEXT,
          snapshot_json TEXT NOT NULL,
          representative_name TEXT,
          sort_order INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (deal_confirmation_id) REFERENCES deal_confirmations(id),
          FOREIGN KEY (business_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (partner_legal_entity_id) REFERENCES partner_legal_entities(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_parties_deal_id ON deal_confirmation_parties(deal_confirmation_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_parties_role ON deal_confirmation_parties(party_role);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_parties_partner_id ON deal_confirmation_parties(business_partner_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_parties_partner_legal_entity_id ON deal_confirmation_parties(partner_legal_entity_id);

        CREATE TABLE IF NOT EXISTS deal_confirmation_items (
          id TEXT PRIMARY KEY,
          deal_confirmation_id TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          product_id TEXT,
          product_name_snapshot TEXT NOT NULL,
          product_description_snapshot TEXT,
          crop_snapshot TEXT,
          quality_snapshot TEXT,
          packaging_snapshot TEXT,
          origin_snapshot TEXT,
          destination_snapshot TEXT,
          quantity_sacks_decimal TEXT NOT NULL,
          sack_weight_kg_decimal TEXT NOT NULL,
          total_weight_kg_decimal TEXT,
          unit_price_decimal TEXT NOT NULL,
          calculated_total_amount_cents INTEGER NOT NULL,
          total_amount_cents INTEGER NOT NULL,
          total_was_manually_overridden INTEGER NOT NULL CHECK (total_was_manually_overridden IN (0, 1)),
          total_override_reason TEXT,
          delivery_start_date TEXT,
          delivery_end_date TEXT,
          delivery_location_snapshot TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (deal_confirmation_id) REFERENCES deal_confirmations(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_items_deal_id ON deal_confirmation_items(deal_confirmation_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_items_product_id ON deal_confirmation_items(product_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_items_sort_order ON deal_confirmation_items(deal_confirmation_id, sort_order);

        CREATE TABLE IF NOT EXISTS deal_confirmation_operations (
          id TEXT PRIMARY KEY,
          deal_confirmation_id TEXT NOT NULL,
          operation_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (deal_confirmation_id) REFERENCES deal_confirmations(id),
          FOREIGN KEY (operation_id) REFERENCES operations(id),
          UNIQUE (deal_confirmation_id, operation_id)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_operations_deal_id ON deal_confirmation_operations(deal_confirmation_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_operations_operation_id ON deal_confirmation_operations(operation_id);

        CREATE TABLE IF NOT EXISTS deal_confirmation_fiscal_documents (
          id TEXT PRIMARY KEY,
          deal_confirmation_id TEXT NOT NULL,
          fiscal_document_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (deal_confirmation_id) REFERENCES deal_confirmations(id),
          FOREIGN KEY (fiscal_document_id) REFERENCES fiscal_documents(id),
          UNIQUE (deal_confirmation_id, fiscal_document_id)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_fiscal_documents_deal_id ON deal_confirmation_fiscal_documents(deal_confirmation_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_fiscal_documents_document_id ON deal_confirmation_fiscal_documents(fiscal_document_id);

        CREATE TABLE IF NOT EXISTS deal_confirmation_clauses (
          id TEXT PRIMARY KEY,
          deal_confirmation_id TEXT NOT NULL,
          clause_number TEXT,
          title TEXT,
          clause_text TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          is_visible INTEGER NOT NULL CHECK (is_visible IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (deal_confirmation_id) REFERENCES deal_confirmations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_clauses_deal_id ON deal_confirmation_clauses(deal_confirmation_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_clauses_sort_order ON deal_confirmation_clauses(deal_confirmation_id, sort_order);

        CREATE TABLE IF NOT EXISTS deal_payment_terms (
          id TEXT PRIMARY KEY,
          deal_confirmation_id TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          description TEXT NOT NULL,
          percentage_basis_points INTEGER,
          amount_cents INTEGER,
          due_date TEXT,
          days_after_event INTEGER,
          event_reference TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (deal_confirmation_id) REFERENCES deal_confirmations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_payment_terms_deal_id ON deal_payment_terms(deal_confirmation_id);

        CREATE TABLE IF NOT EXISTS deal_confirmation_signers (
          id TEXT PRIMARY KEY,
          deal_confirmation_id TEXT NOT NULL,
          party_role TEXT NOT NULL CHECK (party_role IN ('ISSUER','BROKER','SELLER','BUYER','WITNESS','OTHER')),
          name TEXT NOT NULL,
          document_number TEXT,
          position_title TEXT,
          email TEXT,
          phone TEXT,
          signature_order INTEGER NOT NULL,
          signature_status TEXT NOT NULL CHECK (signature_status IN ('PENDING','SIGNED_EXTERNALLY','REJECTED','NOT_REQUIRED')),
          signed_at TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (deal_confirmation_id) REFERENCES deal_confirmations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_signers_deal_id ON deal_confirmation_signers(deal_confirmation_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_signers_status ON deal_confirmation_signers(signature_status);

        CREATE TABLE IF NOT EXISTS deal_confirmation_document_versions (
          id TEXT PRIMARY KEY,
          deal_confirmation_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          document_type TEXT NOT NULL CHECK (document_type IN ('GENERATED_DRAFT','ISSUED_ORIGINAL','SIGNED_EXTERNAL','SUPPORTING_DOCUMENT','CANCELLED_COPY','REPLACEMENT_COPY')),
          original_file_name TEXT NOT NULL,
          stored_file_path TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          file_hash TEXT NOT NULL,
          generated_by_system INTEGER NOT NULL CHECK (generated_by_system IN (0, 1)),
          is_current INTEGER NOT NULL CHECK (is_current IN (0, 1)),
          notes TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (deal_confirmation_id) REFERENCES deal_confirmations(id),
          UNIQUE (deal_confirmation_id, version_number)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_documents_deal_id ON deal_confirmation_document_versions(deal_confirmation_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_documents_type ON deal_confirmation_document_versions(document_type);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_documents_hash ON deal_confirmation_document_versions(file_hash);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_documents_current ON deal_confirmation_document_versions(deal_confirmation_id, document_type, is_current);

        CREATE TABLE IF NOT EXISTS deal_confirmation_status_history (
          id TEXT PRIMARY KEY,
          deal_confirmation_id TEXT NOT NULL,
          previous_status TEXT,
          new_status TEXT NOT NULL,
          reason TEXT,
          changed_by_user_id TEXT,
          changed_at TEXT NOT NULL,
          FOREIGN KEY (deal_confirmation_id) REFERENCES deal_confirmations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_status_history_deal_id ON deal_confirmation_status_history(deal_confirmation_id);
        CREATE INDEX IF NOT EXISTS idx_deal_confirmation_status_history_changed_at ON deal_confirmation_status_history(changed_at);
      `);
    }
  },
  {
    name: "012_users_permissions_audit",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS app_users (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          username TEXT NOT NULL,
          normalized_username TEXT NOT NULL UNIQUE,
          email TEXT,
          status TEXT NOT NULL CHECK (status IN ('ACTIVE','INACTIVE','LOCKED')),
          must_change_password INTEGER NOT NULL CHECK (must_change_password IN (0, 1)),
          failed_login_attempts INTEGER NOT NULL DEFAULT 0,
          locked_at TEXT,
          last_login_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_app_users_status ON app_users(status);
        CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);

        CREATE TABLE IF NOT EXISTS user_credentials (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          credential_format TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_changed_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES app_users(id)
        );

        CREATE TABLE IF NOT EXISTS user_password_history (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          credential_format TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES app_users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_user_password_history_user_id ON user_password_history(user_id);

        CREATE TABLE IF NOT EXISTS roles (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          scope_type TEXT NOT NULL CHECK (scope_type IN ('GLOBAL','ORGANIZATION','LEGAL_ENTITY')),
          is_system INTEGER NOT NULL CHECK (is_system IN (0, 1)),
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS permissions (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT,
          module TEXT NOT NULL,
          risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1))
        );
        CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);

        CREATE TABLE IF NOT EXISTS role_permissions (
          id TEXT PRIMARY KEY,
          role_id TEXT NOT NULL,
          permission_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (role_id) REFERENCES roles(id),
          FOREIGN KEY (permission_id) REFERENCES permissions(id),
          UNIQUE (role_id, permission_id)
        );

        CREATE TABLE IF NOT EXISTS user_role_assignments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          role_id TEXT NOT NULL,
          organization_id TEXT,
          legal_entity_id TEXT,
          assigned_at TEXT NOT NULL,
          expires_at TEXT,
          is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
          FOREIGN KEY (user_id) REFERENCES app_users(id),
          FOREIGN KEY (role_id) REFERENCES roles(id),
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id)
        );
        CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id ON user_role_assignments(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_role_assignments_scope ON user_role_assignments(organization_id, legal_entity_id);

        CREATE TABLE IF NOT EXISTS user_role_legal_entity_access (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          organization_id TEXT NOT NULL,
          legal_entity_id TEXT,
          access_mode TEXT NOT NULL CHECK (access_mode IN ('ALL','SPECIFIC')),
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES app_users(id),
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (legal_entity_id) REFERENCES legal_entities(id)
        );
        CREATE INDEX IF NOT EXISTS idx_user_legal_entity_access_user_id ON user_role_legal_entity_access(user_id);

        CREATE TABLE IF NOT EXISTS local_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('ACTIVE','LOCKED','LOGGED_OUT','EXPIRED')),
          created_at TEXT NOT NULL,
          last_activity_at TEXT NOT NULL,
          locked_at TEXT,
          logout_at TEXT,
          expires_at TEXT,
          machine_name TEXT,
          FOREIGN KEY (user_id) REFERENCES app_users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_local_sessions_user_id ON local_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_local_sessions_status ON local_sessions(status);

        CREATE TABLE IF NOT EXISTS audit_events (
          id TEXT PRIMARY KEY,
          occurred_at TEXT NOT NULL,
          actor_user_id TEXT,
          actor_username TEXT,
          session_id TEXT,
          action TEXT NOT NULL,
          entity_type TEXT,
          entity_id TEXT,
          organization_id TEXT,
          legal_entity_id TEXT,
          result TEXT NOT NULL CHECK (result IN ('SUCCESS','DENIED','FAILED')),
          severity TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL')),
          reason TEXT,
          metadata_json TEXT NOT NULL,
          previous_hash TEXT,
          event_hash TEXT NOT NULL,
          FOREIGN KEY (actor_user_id) REFERENCES app_users(id),
          FOREIGN KEY (session_id) REFERENCES local_sessions(id)
        );
        CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at ON audit_events(occurred_at);
        CREATE INDEX IF NOT EXISTS idx_audit_events_actor_user_id ON audit_events(actor_user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);

        INSERT OR IGNORE INTO roles (id, code, name, description, scope_type, is_system, is_active, created_at, updated_at) VALUES
          ('role-system-admin', 'SYSTEM_ADMIN', 'Administrador do sistema', 'Acesso total, incluindo usuarios, roles e auditoria.', 'GLOBAL', 1, 1, datetime('now'), datetime('now')),
          ('role-ops-manager', 'OPERATIONS_MANAGER', 'Gestor operacional', 'Gerencia notas, operacoes, importacoes e confirmacoes.', 'ORGANIZATION', 1, 1, datetime('now'), datetime('now')),
          ('role-finance-manager', 'FINANCE_MANAGER', 'Gestor financeiro', 'Gerencia cobrancas, conta-corrente, contas a pagar e relatorios.', 'ORGANIZATION', 1, 1, datetime('now'), datetime('now')),
          ('role-operator', 'OPERATOR', 'Operador', 'Lanca e consulta rotinas do dia a dia.', 'LEGAL_ENTITY', 1, 1, datetime('now'), datetime('now')),
          ('role-viewer', 'VIEWER', 'Consulta', 'Acesso somente leitura.', 'LEGAL_ENTITY', 1, 1, datetime('now'), datetime('now'));

        INSERT OR IGNORE INTO permissions (id, code, name, description, module, risk_level, is_active) VALUES
          ('perm-system-bootstrap', 'system.bootstrap', 'Criar primeiro administrador', 'Permite concluir a criacao local inicial.', 'system', 'CRITICAL', 1),
          ('perm-system-view', 'system.view', 'Ver sistema', 'Permite abrir diagnosticos e contexto do app.', 'system', 'LOW', 1),
          ('perm-settings-manage', 'settings.manage', 'Gerenciar configuracoes', 'Permite alterar organizacoes, filiais e parametrizacoes.', 'settings', 'HIGH', 1),
          ('perm-users-view', 'users.view', 'Ver usuarios', 'Permite listar usuarios e perfis.', 'access', 'MEDIUM', 1),
          ('perm-users-manage', 'users.manage', 'Gerenciar usuarios', 'Permite criar, alterar, bloquear e reativar usuarios.', 'access', 'CRITICAL', 1),
          ('perm-roles-view', 'roles.view', 'Ver roles', 'Permite consultar matriz de permissoes.', 'access', 'MEDIUM', 1),
          ('perm-roles-manage', 'roles.manage', 'Gerenciar roles', 'Permite alterar atribuicoes de roles.', 'access', 'CRITICAL', 1),
          ('perm-audit-view', 'audit.view', 'Ver auditoria', 'Permite consultar trilha de auditoria.', 'audit', 'HIGH', 1),
          ('perm-operations-view', 'operations.view', 'Ver operacoes', 'Permite consultar notas e operacoes.', 'operations', 'LOW', 1),
          ('perm-operations-manage', 'operations.manage', 'Gerenciar operacoes', 'Permite criar, confirmar e cancelar notas/operacoes.', 'operations', 'HIGH', 1),
          ('perm-imports-manage', 'imports.manage', 'Gerenciar importacoes', 'Permite importar e reverter XML/planilhas.', 'operations', 'HIGH', 1),
          ('perm-commercial-view', 'commercial.view', 'Ver cadastros comerciais', 'Permite consultar parceiros, produtos e regras.', 'commercial', 'LOW', 1),
          ('perm-commercial-manage', 'commercial.manage', 'Gerenciar cadastros comerciais', 'Permite alterar parceiros, produtos e regras.', 'commercial', 'HIGH', 1),
          ('perm-billing-manage', 'billing.manage', 'Gerenciar cobrancas', 'Permite emitir cobrancas e lancar recebimentos.', 'billing', 'HIGH', 1),
          ('perm-finance-view', 'finance.view', 'Ver financeiro', 'Permite consultar financeiro e relatórios.', 'finance', 'MEDIUM', 1),
          ('perm-finance-manage', 'finance.manage', 'Gerenciar financeiro', 'Permite criar contas a pagar, pagamentos e anexos.', 'finance', 'HIGH', 1),
          ('perm-confirmations-manage', 'confirmations.manage', 'Gerenciar confirmacoes', 'Permite emitir, cancelar e substituir confirmacoes.', 'confirmations', 'HIGH', 1);

        INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at)
        SELECT 'rp-admin-' || permissions.id, 'role-system-admin', permissions.id, datetime('now') FROM permissions;

        INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at)
        SELECT 'rp-ops-' || permissions.id, 'role-ops-manager', permissions.id, datetime('now') FROM permissions
        WHERE code IN ('system.view','operations.view','operations.manage','imports.manage','commercial.view','commercial.manage','billing.manage','confirmations.manage','finance.view');

        INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at)
        SELECT 'rp-fin-' || permissions.id, 'role-finance-manager', permissions.id, datetime('now') FROM permissions
        WHERE code IN ('system.view','commercial.view','operations.view','billing.manage','finance.view','finance.manage','audit.view');

        INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at)
        SELECT 'rp-op-' || permissions.id, 'role-operator', permissions.id, datetime('now') FROM permissions
        WHERE code IN ('system.view','operations.view','operations.manage','commercial.view','finance.view');

        INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at)
        SELECT 'rp-view-' || permissions.id, 'role-viewer', permissions.id, datetime('now') FROM permissions
        WHERE code IN ('system.view','operations.view','commercial.view','finance.view','roles.view');
      `);
    }
  },
  {
    name: "013_backups_integrity",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS backup_jobs (
          id TEXT PRIMARY KEY,
          backup_type TEXT NOT NULL CHECK (backup_type IN ('FULL','DATABASE_ONLY','DOCUMENTS_ONLY')),
          trigger_type TEXT NOT NULL CHECK (trigger_type IN ('MANUAL','AUTOMATIC','PRE_MIGRATION','PRE_RESTORE','RECOVERY')),
          status TEXT NOT NULL CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED','DELETED','MISSING')),
          destination_type TEXT NOT NULL CHECK (destination_type IN ('INTERNAL','EXTERNAL')),
          destination_display_name TEXT NOT NULL,
          stored_file_path TEXT,
          file_name TEXT NOT NULL,
          format_version INTEGER NOT NULL,
          encrypted INTEGER NOT NULL CHECK (encrypted IN (0, 1)),
          file_size INTEGER,
          file_hash TEXT,
          database_hash TEXT,
          migration_version TEXT,
          application_version TEXT NOT NULL,
          application_variant TEXT,
          source_installation_id TEXT,
          file_count INTEGER NOT NULL DEFAULT 0,
          document_count INTEGER NOT NULL DEFAULT 0,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          created_by_user_id TEXT,
          error_code TEXT,
          error_message TEXT,
          is_protected INTEGER NOT NULL CHECK (is_protected IN (0, 1)) DEFAULT 0,
          protection_reason TEXT,
          verified_at TEXT,
          verification_status TEXT CHECK (verification_status IN ('PENDING','VALID','INVALID','WARNING')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (created_by_user_id) REFERENCES app_users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_backup_jobs_status ON backup_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_backup_jobs_trigger_type ON backup_jobs(trigger_type);
        CREATE INDEX IF NOT EXISTS idx_backup_jobs_created_at ON backup_jobs(created_at);
        CREATE INDEX IF NOT EXISTS idx_backup_jobs_completed_at ON backup_jobs(completed_at);
        CREATE INDEX IF NOT EXISTS idx_backup_jobs_is_protected ON backup_jobs(is_protected);
        CREATE INDEX IF NOT EXISTS idx_backup_jobs_file_hash ON backup_jobs(file_hash);

        CREATE TABLE IF NOT EXISTS backup_file_entries (
          id TEXT PRIMARY KEY,
          backup_job_id TEXT NOT NULL,
          relative_path TEXT NOT NULL,
          category TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          file_hash TEXT NOT NULL,
          modified_at TEXT,
          entity_id TEXT,
          document_type TEXT,
          is_required INTEGER NOT NULL CHECK (is_required IN (0, 1)),
          created_at TEXT NOT NULL,
          FOREIGN KEY (backup_job_id) REFERENCES backup_jobs(id),
          UNIQUE (backup_job_id, relative_path)
        );
        CREATE INDEX IF NOT EXISTS idx_backup_file_entries_backup_job_id ON backup_file_entries(backup_job_id);
        CREATE INDEX IF NOT EXISTS idx_backup_file_entries_category ON backup_file_entries(category);

        CREATE TABLE IF NOT EXISTS backup_settings (
          id TEXT PRIMARY KEY,
          installation_id TEXT,
          automatic_backup_enabled INTEGER NOT NULL CHECK (automatic_backup_enabled IN (0, 1)),
          frequency TEXT NOT NULL CHECK (frequency IN ('DISABLED','DAILY','WEEKLY','MONTHLY')),
          preferred_hour INTEGER,
          backup_type TEXT NOT NULL CHECK (backup_type IN ('FULL','DATABASE_ONLY','DOCUMENTS_ONLY')),
          destination_type TEXT NOT NULL CHECK (destination_type IN ('INTERNAL','EXTERNAL')),
          destination_path_stored_securely TEXT,
          encrypted INTEGER NOT NULL CHECK (encrypted IN (0, 1)),
          retention_max_count INTEGER NOT NULL,
          retention_max_days INTEGER,
          last_backup_at TEXT,
          next_backup_at TEXT,
          run_once_per_period INTEGER NOT NULL CHECK (run_once_per_period IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS restore_jobs (
          id TEXT PRIMARY KEY,
          backup_job_id TEXT,
          source_file_name TEXT NOT NULL,
          source_file_hash TEXT,
          source_application_version TEXT,
          source_migration_version TEXT,
          source_variant TEXT,
          status TEXT NOT NULL CHECK (status IN ('VALIDATING','READY','RESTORING','COMPLETED','FAILED','ROLLED_BACK','CANCELLED')),
          pre_restore_backup_job_id TEXT,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          executed_by_user_id TEXT NOT NULL,
          error_code TEXT,
          error_message TEXT,
          rollback_performed INTEGER NOT NULL CHECK (rollback_performed IN (0, 1)),
          rollback_succeeded INTEGER CHECK (rollback_succeeded IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (backup_job_id) REFERENCES backup_jobs(id),
          FOREIGN KEY (pre_restore_backup_job_id) REFERENCES backup_jobs(id),
          FOREIGN KEY (executed_by_user_id) REFERENCES app_users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_restore_jobs_status ON restore_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_restore_jobs_started_at ON restore_jobs(started_at);
        CREATE INDEX IF NOT EXISTS idx_restore_jobs_executed_by_user_id ON restore_jobs(executed_by_user_id);

        CREATE TABLE IF NOT EXISTS integrity_check_runs (
          id TEXT PRIMARY KEY,
          check_type TEXT NOT NULL CHECK (check_type IN ('DATABASE_QUICK','DATABASE_FULL','DOCUMENTS','BACKUP','TEMPORARIES','SUMMARY')),
          status TEXT NOT NULL CHECK (status IN ('RUNNING','OK','WARNING','FAILED')),
          started_at TEXT NOT NULL,
          completed_at TEXT,
          duration_ms INTEGER,
          checked_items INTEGER NOT NULL DEFAULT 0,
          problem_count INTEGER NOT NULL DEFAULT 0,
          report_path TEXT,
          created_by_user_id TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (created_by_user_id) REFERENCES app_users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_integrity_check_runs_check_type ON integrity_check_runs(check_type);
        CREATE INDEX IF NOT EXISTS idx_integrity_check_runs_status ON integrity_check_runs(status);
        CREATE INDEX IF NOT EXISTS idx_integrity_check_runs_started_at ON integrity_check_runs(started_at);
        CREATE INDEX IF NOT EXISTS idx_integrity_check_runs_completed_at ON integrity_check_runs(completed_at);

        CREATE TABLE IF NOT EXISTS integrity_check_findings (
          id TEXT PRIMARY KEY,
          integrity_check_run_id TEXT NOT NULL,
          finding_type TEXT NOT NULL,
          severity TEXT NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
          entity_type TEXT,
          entity_id TEXT,
          relative_path TEXT,
          message TEXT NOT NULL,
          details_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (integrity_check_run_id) REFERENCES integrity_check_runs(id)
        );
        CREATE INDEX IF NOT EXISTS idx_integrity_findings_run_id ON integrity_check_findings(integrity_check_run_id);
        CREATE INDEX IF NOT EXISTS idx_integrity_findings_type ON integrity_check_findings(finding_type);
        CREATE INDEX IF NOT EXISTS idx_integrity_findings_severity ON integrity_check_findings(severity);
        CREATE INDEX IF NOT EXISTS idx_integrity_findings_entity ON integrity_check_findings(entity_type, entity_id);

        INSERT OR IGNORE INTO backup_settings (id, installation_id, automatic_backup_enabled, frequency, preferred_hour, backup_type, destination_type, destination_path_stored_securely, encrypted, retention_max_count, retention_max_days, last_backup_at, next_backup_at, run_once_per_period, created_at, updated_at)
        VALUES ('backup-settings-default', NULL, 0, 'DISABLED', 8, 'FULL', 'INTERNAL', NULL, 0, 7, NULL, NULL, NULL, 1, datetime('now'), datetime('now'));

        INSERT OR IGNORE INTO permissions (id, code, name, description, module, risk_level, is_active) VALUES
          ('perm-backups-view', 'backups.view', 'Ver backups', 'Permite consultar historico de backups.', 'backups', 'LOW', 1),
          ('perm-backups-create', 'backups.create', 'Criar backups', 'Permite criar backups manuais e automaticos.', 'backups', 'MEDIUM', 1),
          ('perm-backups-configure', 'backups.configure', 'Configurar backups', 'Permite alterar configuracao de backup automatico.', 'backups', 'HIGH', 1),
          ('perm-backups-verify', 'backups.verify', 'Verificar backups', 'Permite validar integridade de pacotes de backup.', 'backups', 'MEDIUM', 1),
          ('perm-backups-restore', 'backups.restore', 'Restaurar backups', 'Permite substituir a instalacao por um backup validado.', 'backups', 'CRITICAL', 1),
          ('perm-backups-delete', 'backups.delete', 'Apagar backups', 'Permite remover backups nao protegidos.', 'backups', 'HIGH', 1),
          ('perm-backups-protect', 'backups.protect', 'Proteger backups', 'Permite proteger e desproteger backups contra retencao.', 'backups', 'HIGH', 1),
          ('perm-integrity-view', 'integrity.view', 'Ver integridade', 'Permite consultar integridade de banco, documentos e backups.', 'integrity', 'LOW', 1),
          ('perm-integrity-run', 'integrity.run', 'Executar integridade', 'Permite executar verificacoes de integridade.', 'integrity', 'MEDIUM', 1),
          ('perm-integrity-export', 'integrity.export', 'Exportar integridade', 'Permite gerar relatorios de integridade.', 'integrity', 'MEDIUM', 1),
          ('perm-retention-manage', 'retention.manage', 'Gerenciar retencao', 'Permite aplicar politicas de retencao de backups e temporarios.', 'backups', 'HIGH', 1),
          ('perm-temporary-files-cleanup', 'temporary_files.cleanup', 'Limpar temporarios', 'Permite limpar somente arquivos temporarios seguros.', 'integrity', 'HIGH', 1);

        INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at)
        SELECT 'rp-admin-' || permissions.id, 'role-system-admin', permissions.id, datetime('now') FROM permissions
        WHERE code IN ('backups.view','backups.create','backups.configure','backups.verify','backups.restore','backups.delete','backups.protect','integrity.view','integrity.run','integrity.export','retention.manage','temporary_files.cleanup');

        INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at)
        SELECT 'rp-fin-' || permissions.id, 'role-finance-manager', permissions.id, datetime('now') FROM permissions
        WHERE code IN ('backups.view','backups.create','backups.verify','integrity.view','integrity.run','integrity.export');
      `);
    }
  },
  {
    name: "014_organization_description",
    up: (db) => {
      const columns = (table: string): string[] =>
        (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
      const organizationColumns = columns("organizations");
      if (!organizationColumns.includes("description")) {
        db.exec("ALTER TABLE organizations ADD COLUMN description TEXT");
      }
    }
  },
  {
    name: "015_deal_confirmation_brokerage_bank",
    up: (db) => {
      const columns = (table: string): string[] =>
        (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
      const dealConfirmationColumns = columns("deal_confirmations");
      const additions: Array<[string, string]> = [
        ["brokerage_percentage_basis_points", "INTEGER"],
        ["bank_name", "TEXT"],
        ["bank_code", "TEXT"],
        ["bank_agency", "TEXT"],
        ["bank_account", "TEXT"],
        ["pix_key", "TEXT"]
      ];
      additions.forEach(([column, type]) => {
        if (!dealConfirmationColumns.includes(column)) {
          db.exec(`ALTER TABLE deal_confirmations ADD COLUMN ${column} ${type}`);
        }
      });
    }
  },
  {
    name: "016_unified_company_context",
    up: (db) => {
      const now = new Date().toISOString();
      db.exec(`
        UPDATE installation_profiles
           SET app_variant = 'multiempresa',
               allow_organization_switch = 1,
               allow_legal_entity_switch = 1,
               updated_at = '${now}';

        UPDATE organizations
           SET display_name = 'Villa Coffee',
               app_display_name = 'Villa Coffee Operacoes',
               primary_color = '#0F0D0A',
               secondary_color = '#D4A875',
               accent_color = '#16B86A',
               theme_mode = 'dark',
               updated_at = '${now}'
         WHERE slug = 'villa-coffee';

        UPDATE organizations
           SET display_name = 'Grao & Grao',
               app_display_name = 'Grao & Grao Operacoes',
               primary_color = '#073F28',
               secondary_color = '#9A7449',
               accent_color = '#05B866',
               theme_mode = 'light',
               updated_at = '${now}'
         WHERE slug = 'grao-e-grao';

        UPDATE legal_entities
           SET legal_name = 'Villa Coffee Comercio Exp. Ltda - Minas Gerais',
               trade_name = 'Villa Coffee Minas Gerais',
               city = CASE WHEN city = 'Pendente' THEN 'Minas Gerais' ELSE city END,
               state = 'MG',
               is_active = 1,
               updated_at = '${now}'
         WHERE id = '33333333-3333-4333-8333-333333333331';

        UPDATE legal_entities
           SET legal_name = 'Villa Coffee Comercio Exp. Ltda - Espirito Santo',
               trade_name = 'Villa Coffee Espirito Santo',
               city = CASE WHEN city = 'Pendente' THEN 'Espirito Santo' ELSE city END,
               state = 'ES',
               is_active = 1,
               updated_at = '${now}'
         WHERE id = '33333333-3333-4333-8333-333333333332';

        UPDATE legal_entities
           SET legal_name = 'Grao & Grao Comercio Exp. Ltda - Minas Gerais',
               trade_name = 'Grao & Grao Minas Gerais',
               city = CASE WHEN city = 'Pendente' THEN 'Minas Gerais' ELSE city END,
               state = 'MG',
               is_active = 1,
               updated_at = '${now}'
         WHERE id = '44444444-4444-4444-8444-444444444441';

        UPDATE legal_entities
           SET legal_name = 'Grao & Grao Comercio Exp. Ltda - Sao Paulo',
               trade_name = 'Grao & Grao Sao Paulo',
               city = CASE WHEN city = 'Pendente' THEN 'Sao Paulo' ELSE city END,
               state = 'SP',
               is_active = 1,
               updated_at = '${now}'
         WHERE id = '44444444-4444-4444-8444-444444444442';

        UPDATE legal_entities
           SET is_active = 0,
               updated_at = '${now}'
         WHERE id = '44444444-4444-4444-8444-444444444443';
      `);
    }
  },
  {
    name: "017_real_company_legal_entities",
    up: (db) => {
      const now = new Date().toISOString();
      const update = db.prepare(`
        UPDATE legal_entities
           SET legal_name = @legalName,
               trade_name = @tradeName,
               cnpj = @cnpj,
               state_registration = @stateRegistration,
               municipal_registration = @municipalRegistration,
               email = @email,
               phone = @phone,
               address_line = @addressLine,
               address_number = @addressNumber,
               address_complement = @addressComplement,
               district = @district,
               city = @city,
               state = @state,
               postal_code = @postalCode,
               is_draft = 0,
               is_active = 1,
               updated_at = @updatedAt
         WHERE id = @id
      `);

      [
        {
          id: "33333333-3333-4333-8333-333333333331",
          legalName: "VILLA COFFEE COMERCIO E EXP. LTDA",
          tradeName: "Villa Coffee Minas Gerais",
          cnpj: "44963370000523",
          stateRegistration: "0053761240090",
          municipalRegistration: null,
          email: "villacoffeefiscal@gmail.com",
          phone: "3599479528",
          addressLine: "AVENIDA VITAL PAULINO DA COSTA",
          addressNumber: "466",
          addressComplement: null,
          district: "CENTRO",
          city: "MONTE SANTO DE MINAS",
          state: "MG",
          postalCode: "37968000"
        },
        {
          id: "33333333-3333-4333-8333-333333333332",
          legalName: "VILLA COFFEE COMERCIO E EXP. LTDA",
          tradeName: "Villa Coffee Espirito Santo",
          cnpj: "44963370000280",
          stateRegistration: "084.359.68-4",
          municipalRegistration: null,
          email: "villacoffeefiscal@gmail.com",
          phone: "3599479528",
          addressLine: "AVENIDA AMINTAS OZORIO DE MATOS",
          addressNumber: "111",
          addressComplement: "LOJA 01",
          district: "NITEROI",
          city: "IUNA",
          state: "ES",
          postalCode: "29390000"
        },
        {
          id: "44444444-4444-4444-8444-444444444441",
          legalName: "GRAO & GRAO COMERCIO EXP LTDA",
          tradeName: "Grao & Grao Minas Gerais",
          cnpj: "16594876000224",
          stateRegistration: "46505230009",
          municipalRegistration: null,
          email: "graograofiscal@gmail.com",
          phone: "3599479528",
          addressLine: "AREA ROD. MG 455 KM 40",
          addressNumber: "SN",
          addressComplement: null,
          district: "AREA RURAL DE ANDRADAS",
          city: "ANDRADAS",
          state: "MG",
          postalCode: "37842899"
        },
        {
          id: "44444444-4444-4444-8444-444444444442",
          legalName: "GRAO & GRAO COMERCIO EXP LTDA",
          tradeName: "Grao & Grao Sao Paulo",
          cnpj: "16594876000496",
          stateRegistration: null,
          municipalRegistration: null,
          email: "graograofiscal@gmail.com",
          phone: "35999479528",
          addressLine: "SITIO SANTA MARIA",
          addressNumber: "0",
          addressComplement: null,
          district: "ARROZAL",
          city: "SANTO ANTONIO DO JARDIM",
          state: "SP",
          postalCode: "13995000"
        }
      ].forEach((entity) => update.run({ ...entity, updatedAt: now }));

      db.prepare("UPDATE legal_entities SET is_active = 0, updated_at = ? WHERE id = ?").run(now, "44444444-4444-4444-8444-444444444443");
    }
  },
  {
    name: "018_legal_entity_confirmation_defaults",
    up: (db) => {
      const columns = (table: string): string[] =>
        (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
      const legalEntityColumns = columns("legal_entities");
      const additions: Array<[string, string]> = [
        ["default_bank_name", "TEXT"],
        ["default_bank_code", "TEXT"],
        ["default_bank_agency", "TEXT"],
        ["default_bank_account", "TEXT"],
        ["default_pix_key", "TEXT"]
      ];
      additions.forEach(([column, type]) => {
        if (!legalEntityColumns.includes(column)) {
          db.exec(`ALTER TABLE legal_entities ADD COLUMN ${column} ${type}`);
        }
      });

      const now = new Date().toISOString();
      const updateDefaults = db.prepare(`
        UPDATE legal_entities
           SET state_registration = @stateRegistration,
               default_bank_name = @defaultBankName,
               default_bank_code = @defaultBankCode,
               default_bank_agency = @defaultBankAgency,
               default_bank_account = @defaultBankAccount,
               default_pix_key = @defaultPixKey,
               updated_at = @updatedAt
         WHERE cnpj = @cnpj
      `);

      [
        {
          cnpj: "44963370000523",
          stateRegistration: "0053761240090",
          defaultBankName: "Santander",
          defaultBankCode: "033",
          defaultBankAgency: "3318",
          defaultBankAccount: "13.0021347",
          defaultPixKey: "44.963.370/0005-23"
        },
        {
          cnpj: "44963370000280",
          stateRegistration: "084.359.68-4",
          defaultBankName: "Santander",
          defaultBankCode: "033",
          defaultBankAgency: "3318",
          defaultBankAccount: "13.0021347",
          defaultPixKey: "44.963.370/0002-80"
        },
        {
          cnpj: "16594876000224",
          stateRegistration: "46505230009",
          defaultBankName: null,
          defaultBankCode: null,
          defaultBankAgency: null,
          defaultBankAccount: null,
          defaultPixKey: "16.594.876/0002-24"
        },
        {
          cnpj: "16594876000496",
          stateRegistration: null,
          defaultBankName: null,
          defaultBankCode: null,
          defaultBankAgency: null,
          defaultBankAccount: null,
          defaultPixKey: null
        }
      ].forEach((entity) => updateDefaults.run({ ...entity, updatedAt: now }));
    }
  },
  {
    name: "019_business_partner_credit_limit",
    up: (db) => {
      const columns = (db.prepare("PRAGMA table_info(business_partners)").all() as Array<{ name: string }>).map((column) => column.name);
      if (!columns.includes("credit_limit_cents")) {
        db.exec("ALTER TABLE business_partners ADD COLUMN credit_limit_cents INTEGER");
      }
    }
  },
  {
    name: "020_business_partner_client_profile",
    up: (db) => {
      const columns = (db.prepare("PRAGMA table_info(business_partners)").all() as Array<{ name: string }>).map((column) => column.name);
      const additions: Array<[string, string]> = [
        ["document_number", "TEXT"],
        ["email", "TEXT"],
        ["phone", "TEXT"],
        ["mobile", "TEXT"],
        ["postal_code", "TEXT"],
        ["address_line", "TEXT"],
        ["address_number", "TEXT"],
        ["address_complement", "TEXT"],
        ["district", "TEXT"],
        ["city", "TEXT"],
        ["state", "TEXT"]
      ];
      additions.forEach(([column, type]) => {
        if (!columns.includes(column)) {
          db.exec(`ALTER TABLE business_partners ADD COLUMN ${column} ${type}`);
        }
      });
    }
  },
  {
    name: "021_service_rate_rule_counterparty_scope",
    up: (db) => {
      const columns = (db.prepare("PRAGMA table_info(service_rate_rules)").all() as Array<{ name: string }>).map((column) => column.name);
      if (!columns.includes("counterparty_partner_legal_entity_id")) {
        db.exec("ALTER TABLE service_rate_rules ADD COLUMN counterparty_partner_legal_entity_id TEXT");
      }
      db.exec("CREATE INDEX IF NOT EXISTS idx_service_rate_rules_counterparty_partner_legal_entity_id ON service_rate_rules(counterparty_partner_legal_entity_id)");
    }
  },
  {
    name: "022_client_charge_operation_company_snapshot",
    up: (db) => {
      const columns = (db.prepare("PRAGMA table_info(client_charge_operations)").all() as Array<{ name: string }>).map((column) => column.name);
      if (!columns.includes("own_legal_entity_id_snapshot")) {
        db.exec("ALTER TABLE client_charge_operations ADD COLUMN own_legal_entity_id_snapshot TEXT");
      }
      if (!columns.includes("own_legal_entity_name_snapshot")) {
        db.exec("ALTER TABLE client_charge_operations ADD COLUMN own_legal_entity_name_snapshot TEXT");
      }
      db.exec("CREATE INDEX IF NOT EXISTS idx_client_charge_operations_own_legal_entity_snapshot ON client_charge_operations(own_legal_entity_id_snapshot)");
    }
  },
  {
    name: "023_xml_import_job_items_without_operation",
    up: (db) => {
      const columns = (db.prepare("PRAGMA table_info(xml_import_jobs)").all() as Array<{ name: string }>).map((column) => column.name);
      if (!columns.includes("items_without_operation")) {
        db.exec("ALTER TABLE xml_import_jobs ADD COLUMN items_without_operation INTEGER NOT NULL DEFAULT 0");
      }
    }
  },
  {
    name: "024_operation_rate_history",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS operation_rate_history (
          id TEXT PRIMARY KEY,
          operation_id TEXT NOT NULL,
          previous_service_rate_rule_id TEXT,
          previous_rate_value_cents INTEGER,
          previous_service_amount_cents INTEGER,
          new_service_rate_rule_id TEXT,
          new_rate_value_cents INTEGER,
          new_service_amount_cents INTEGER,
          reason TEXT,
          changed_at TEXT NOT NULL,
          FOREIGN KEY (operation_id) REFERENCES operations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_operation_rate_history_operation_id ON operation_rate_history(operation_id);
      `);
    }
  },
  {
    name: "025_service_rate_rule_conflict_warning",
    up: (db) => {
      const columns = (db.prepare("PRAGMA table_info(service_rate_rules)").all() as Array<{ name: string }>).map((column) => column.name);
      if (!columns.includes("conflict_warning")) {
        db.exec("ALTER TABLE service_rate_rules ADD COLUMN conflict_warning TEXT");
      }
    }
  },
  {
    // Espelha a migration 0008 do Supabase: sem updated_at, o sync poll-based
    // (SharedRepository.pullChangesSince) so' enxergaria um job de importacao
    // de XML no momento da criacao, nunca as atualizacoes de status/progresso
    // que vem depois (processando -> concluido).
    name: "026_xml_import_job_updated_at",
    up: (db) => {
      const columns = (db.prepare("PRAGMA table_info(xml_import_jobs)").all() as Array<{ name: string }>).map((column) => column.name);
      if (!columns.includes("updated_at")) {
        db.exec("ALTER TABLE xml_import_jobs ADD COLUMN updated_at TEXT");
        db.exec("UPDATE xml_import_jobs SET updated_at = created_at WHERE updated_at IS NULL");
      }
    }
  },
  {
    // Notas de entrada (compras) por saca: espelha service_rate_rules (preco
    // que COBRAMOS do cliente) com uma tabela irma' pro preco que PAGAMOS ao
    // fornecedor, e um ciclo de vida de "acerto" em operations/accounts_payable
    // espelhando billing_status/client_charge_id do lado de cobranca.
    name: "027_purchase_rate_rules_payables",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_rate_rules (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          business_partner_id TEXT NOT NULL,
          own_legal_entity_id TEXT,
          counterparty_partner_legal_entity_id TEXT,
          product_id TEXT,
          operation_scope TEXT NOT NULL CHECK (operation_scope IN ('INTERNAL','EXTERNAL','ALL')),
          rate_type TEXT NOT NULL CHECK (rate_type IN ('PER_SACK')),
          rate_value_cents INTEGER NOT NULL,
          effective_from TEXT NOT NULL,
          effective_to TEXT,
          priority INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          conflict_warning TEXT,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (business_partner_id) REFERENCES business_partners(id),
          FOREIGN KEY (own_legal_entity_id) REFERENCES legal_entities(id),
          FOREIGN KEY (counterparty_partner_legal_entity_id) REFERENCES partner_legal_entities(id),
          FOREIGN KEY (product_id) REFERENCES products(id)
        );
        CREATE INDEX IF NOT EXISTS idx_purchase_rate_rules_business_partner_id ON purchase_rate_rules(business_partner_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_rate_rules_organization_id ON purchase_rate_rules(organization_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_rate_rules_own_legal_entity_id ON purchase_rate_rules(own_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_rate_rules_counterparty_partner_legal_entity_id ON purchase_rate_rules(counterparty_partner_legal_entity_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_rate_rules_product_id ON purchase_rate_rules(product_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_rate_rules_effective_from ON purchase_rate_rules(effective_from);
        CREATE INDEX IF NOT EXISTS idx_purchase_rate_rules_effective_to ON purchase_rate_rules(effective_to);
        CREATE INDEX IF NOT EXISTS idx_purchase_rate_rules_is_active ON purchase_rate_rules(is_active);

        CREATE TABLE IF NOT EXISTS account_payable_operations (
          id TEXT PRIMARY KEY,
          account_payable_id TEXT NOT NULL,
          operation_id TEXT NOT NULL,
          own_legal_entity_id_snapshot TEXT,
          own_legal_entity_name_snapshot TEXT,
          supplier_partner_id_snapshot TEXT,
          operation_date_snapshot TEXT NOT NULL,
          fiscal_document_number_snapshot TEXT,
          fiscal_document_series_snapshot TEXT,
          product_name_snapshot TEXT,
          operation_scope_snapshot TEXT NOT NULL CHECK (operation_scope_snapshot IN ('INTERNAL','EXTERNAL')),
          quantity_sacks_decimal_snapshot TEXT NOT NULL,
          purchase_rate_cents_snapshot INTEGER NOT NULL,
          purchase_amount_cents_snapshot INTEGER NOT NULL,
          released_at TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (account_payable_id) REFERENCES accounts_payable(id),
          FOREIGN KEY (operation_id) REFERENCES operations(id)
        );
        CREATE INDEX IF NOT EXISTS idx_account_payable_operations_payable_id ON account_payable_operations(account_payable_id);
        CREATE INDEX IF NOT EXISTS idx_account_payable_operations_operation_id ON account_payable_operations(operation_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_account_payable_operations_active_unique ON account_payable_operations(operation_id) WHERE released_at IS NULL;
      `);
      const operationColumns = (db.prepare("PRAGMA table_info(operations)").all() as Array<{ name: string }>).map((column) => column.name);
      if (!operationColumns.includes("purchase_settlement_status")) {
        db.exec("ALTER TABLE operations ADD COLUMN purchase_settlement_status TEXT NOT NULL DEFAULT 'UNSETTLED' CHECK (purchase_settlement_status IN ('UNSETTLED','RESERVED','SETTLED'))");
      }
      if (!operationColumns.includes("account_payable_id")) {
        db.exec("ALTER TABLE operations ADD COLUMN account_payable_id TEXT");
      }
      // Coluna propria (nao reaproveita service_rate_rule_id): essa tem FK de
      // verdade pra service_rate_rules, gravar o id de uma purchase_rate_rule
      // la' violaria a constraint. applied_rate_value_cents/service_amount_cents
      // continuam genericos (sem FK), servem pros dois sentidos sem problema.
      if (!operationColumns.includes("purchase_rate_rule_id")) {
        db.exec("ALTER TABLE operations ADD COLUMN purchase_rate_rule_id TEXT");
      }
      db.exec("CREATE INDEX IF NOT EXISTS idx_operations_purchase_settlement_status ON operations(purchase_settlement_status)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_operations_account_payable_id ON operations(account_payable_id)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_operations_purchase_rate_rule_id ON operations(purchase_rate_rule_id)");
    }
  },
  {
    // Registro auditavel de fusoes de cadastros de parceiro duplicados (mesmo
    // CNPJ, ids diferentes -- sobra de quando cada PC gerava seu proprio id
    // aleatorio antes da sincronizacao entre PCs existir). Sincroniza como
    // qualquer outra tabela: quando um PC baixa uma linha nova aqui, aplica a
    // mesma fusao localmente (ver applyBusinessPartnerMerge), o que faz os
    // outros PCs se autocorrigirem sozinhos na proxima sincronizacao, sem
    // precisar rodar nada manual em cada um.
    name: "029_business_partner_merges",
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS business_partner_merges (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          duplicate_partner_id TEXT NOT NULL,
          canonical_partner_id TEXT NOT NULL,
          matched_cnpj TEXT,
          reason TEXT,
          applied_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_business_partner_merges_duplicate_unique ON business_partner_merges(duplicate_partner_id);
        CREATE INDEX IF NOT EXISTS idx_business_partner_merges_canonical_id ON business_partner_merges(canonical_partner_id);
        CREATE INDEX IF NOT EXISTS idx_business_partner_merges_organization_id ON business_partner_merges(organization_id);
      `);
    }
  },
  {
    // Reset pedido pelo dono pra testar o sistema do zero: mantem so' cadastro
    // das empresas proprias (organizations/legal_entities/locations), usuarios
    // e permissoes (senao ninguem conseguiria logar depois), catalogo de
    // produtos e categorias/centros de custo/contas financeiras (config
    // reutilizavel, nao especifica de cliente/nota). Zera clientes, fornecedores
    // e tudo que foi lancado em cima deles (notas, operacoes, cobrancas, contas
    // a pagar, confirmacoes de negocio, importacoes). Roda uma unica vez (como
    // toda migration): PCs que ja atualizaram nao repetem o reset ao sincronizar
    // de novo depois. Ordem das DELETEs respeita as FKs (filho antes do pai);
    // se algo estiver fora de ordem a transacao da migration inteira desfaz
    // sozinha (ver runMigrations em database.ts), sem deixar o banco pela metade.
    name: "030_reset_partners_and_documents",
    up: (db) => {
      db.exec(`
        DELETE FROM business_partner_merges;
        DELETE FROM financial_report_generations;

        DELETE FROM charge_status_history;
        DELETE FROM charge_document_versions;
        DELETE FROM client_payment_allocations;
        DELETE FROM client_credit_allocations;
        DELETE FROM client_charge_adjustments;
        DELETE FROM client_charge_operations;

        DELETE FROM payable_document_attachments;
        DELETE FROM payable_status_history;
        DELETE FROM payable_payment_allocations;
        DELETE FROM account_payable_operations;
        DELETE FROM account_payable_allocations;

        DELETE FROM deal_confirmation_document_versions;
        DELETE FROM deal_confirmation_status_history;
        DELETE FROM deal_payment_terms;
        DELETE FROM deal_confirmation_signers;
        DELETE FROM deal_confirmation_fiscal_documents;
        DELETE FROM deal_confirmation_operations;
        DELETE FROM deal_confirmation_clauses;
        DELETE FROM deal_confirmation_items;
        DELETE FROM deal_confirmation_parties;

        DELETE FROM operation_rate_history;
        DELETE FROM operation_classification_rules;
        DELETE FROM fiscal_document_merge_history;
        DELETE FROM fiscal_document_events;

        DELETE FROM xml_import_files;
        DELETE FROM spreadsheet_import_rows;

        DELETE FROM operations;
        DELETE FROM fiscal_document_items;
        DELETE FROM client_payments;
        DELETE FROM client_ledger_entries;
        DELETE FROM client_charges;
        DELETE FROM payable_payments;
        DELETE FROM payable_recurring_templates;
        DELETE FROM payable_installment_groups;
        DELETE FROM accounts_payable;
        DELETE FROM deal_confirmations;
        DELETE FROM fiscal_documents;
        DELETE FROM xml_import_jobs;
        DELETE FROM spreadsheet_import_jobs;

        DELETE FROM product_aliases;
        DELETE FROM partner_aliases;
        DELETE FROM client_billing_profiles;
        DELETE FROM service_rate_rules;
        DELETE FROM purchase_rate_rules;
        DELETE FROM partner_contacts;
        DELETE FROM partner_legal_entities;
        DELETE FROM business_partner_roles;

        DELETE FROM business_partners;

        UPDATE document_sequences SET current_number = 0;
      `);
    }
  },
  {
    // Empresa/CNPJ (partner_legal_entities) deixa de exigir um cliente/corretor
    // dono desde a criacao -- agora e' possivel cadastrar so' a empresa (ex:
    // via "Buscar CNPJ") e vincular a um cliente/corretor depois, quando a
    // relacao comercial de fato comecar (ver linkPartnerLegalEntityToPartner).
    // organization_id precisa existir na propria linha porque antes ela so'
    // sabia sua organizacao atraves do cliente/corretor dono -- sem dono, nao
    // ha' mais como derivar isso. SQLite nao suporta "ALTER COLUMN ... DROP NOT
    // NULL" nem adicionar coluna NOT NULL sem default numa tabela com linhas,
    // entao reconstroi a tabela inteira (mesmo padrao da migration 007).
    name: "031_partner_legal_entities_standalone",
    up: (db) => {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE partner_legal_entities_031 (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          business_partner_id TEXT,
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
          FOREIGN KEY (organization_id) REFERENCES organizations(id),
          FOREIGN KEY (business_partner_id) REFERENCES business_partners(id)
        );
        INSERT INTO partner_legal_entities_031 (
          id, organization_id, business_partner_id, legal_name, trade_name, cnpj, state_registration, municipal_registration,
          email, phone, address_line, address_number, address_complement, district, city, state, postal_code,
          is_primary, is_active, is_draft, created_at, updated_at
        )
        SELECT ple.id, bp.organization_id, ple.business_partner_id, ple.legal_name, ple.trade_name, ple.cnpj, ple.state_registration,
          ple.municipal_registration, ple.email, ple.phone, ple.address_line, ple.address_number, ple.address_complement,
          ple.district, ple.city, ple.state, ple.postal_code, ple.is_primary, ple.is_active, ple.is_draft, ple.created_at, ple.updated_at
        FROM partner_legal_entities ple
        JOIN business_partners bp ON bp.id = ple.business_partner_id;
        DROP TABLE partner_legal_entities;
        ALTER TABLE partner_legal_entities_031 RENAME TO partner_legal_entities;
        CREATE INDEX IF NOT EXISTS idx_partner_legal_entities_business_partner_id ON partner_legal_entities(business_partner_id);
        CREATE INDEX IF NOT EXISTS idx_partner_legal_entities_organization_id ON partner_legal_entities(organization_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_legal_entities_cnpj_unique ON partner_legal_entities(cnpj) WHERE cnpj IS NOT NULL;
        PRAGMA foreign_keys = ON;
      `);
    }
  },
  {
    // Limpeza pontual: a importacao de 490 cadastros do sistema legado
    // (Villa MG + Villa ES) criou um cliente/corretor descartavel pra cada
    // empresa, so' pra poder anexar o CNPJ (antes da migration 031, toda
    // empresa precisava de um dono). Depois da 031 esses CNPJs viraram
    // empresas soltas de verdade (ver script de conversao rodado manualmente
    // num PC), mas os 490 clientes-descarte ainda existiam em PCs que ja
    // tinham sincronizado antes da limpeza. Roda uma vez por PC (como toda
    // migration): so' apaga quem nao tem NENHUM registro vinculado (nota,
    // operacao, cobranca, conta a pagar) -- se por acaso algum desses
    // cadastros passou a ser usado de verdade em algum PC, ele fica intacto.
    name: "032_delete_legacy_import_client_shells",
    up: (db) => {
      const candidates = db.prepare(
        "SELECT id FROM business_partners WHERE notes LIKE 'Importado do sistema legado%'"
      ).all() as Array<{ id: string }>;
      const hasLink = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM fiscal_documents WHERE responsible_partner_id = ?) +
          (SELECT COUNT(*) FROM operations WHERE responsible_partner_id = ?) +
          (SELECT COUNT(*) FROM client_charges WHERE client_partner_id = ?) +
          (SELECT COUNT(*) FROM accounts_payable WHERE supplier_partner_id = ?) AS c
      `);
      const unlinkEntities = db.prepare("UPDATE partner_legal_entities SET business_partner_id = NULL, is_primary = 0, updated_at = ? WHERE business_partner_id = ?");
      const deleteRoles = db.prepare("DELETE FROM business_partner_roles WHERE business_partner_id = ?");
      const deletePartner = db.prepare("DELETE FROM business_partners WHERE id = ?");
      const now = new Date().toISOString();
      for (const { id } of candidates) {
        const linked = hasLink.get(id, id, id, id) as { c: number };
        if (linked.c > 0) continue;
        unlinkEntities.run(now, id);
        deleteRoles.run(id);
        deletePartner.run(id);
      }
    }
  },
  {
    // Nota triangulada: uma nota de XML onde nem o emitente nem o
    // destinatario e' CNPJ proprio pode representar uma compra de um
    // fornecedor revendida a um corretor/cliente na mesma remessa (ex: Leo
    // ES emite direto pro CNPJ da Primavera, e a Grao & Grao e' o
    // intermediario). Essas duas colunas guardam o SEGUNDO parceiro/tipo de
    // operacao da nota -- o primeiro continua em responsible_partner_id/
    // (operation_type e' por operacao, nao por documento). Quando
    // preenchidas, o import de XML gera uma segunda operacao (tipo oposto)
    // pro mesmo item, alem da operacao "principal" que ja era criada hoje.
    name: "033_fiscal_document_secondary_partner",
    up: (db) => {
      const fiscalColumns = (db.prepare("PRAGMA table_info(fiscal_documents)").all() as Array<{ name: string }>).map((column) => column.name);
      if (!fiscalColumns.includes("secondary_responsible_partner_id")) db.exec("ALTER TABLE fiscal_documents ADD COLUMN secondary_responsible_partner_id TEXT REFERENCES business_partners(id)");
      if (!fiscalColumns.includes("secondary_operation_type")) db.exec("ALTER TABLE fiscal_documents ADD COLUMN secondary_operation_type TEXT CHECK (secondary_operation_type IN ('PURCHASE','SALE'))");
    }
  },
  {
    // Repete a limpeza da migration 032: um seed estatico legado
    // (electron/main/services/clientSeed.ts, desativado nesta mesma versao)
    // recriava um cliente/corretor fantasma pra cada empresa importada toda
    // vez que rodava numa instalacao nova -- e' o mesmo padrao de "casca sem
    // uso real" que a 032 ja cobria (notes LIKE 'Importado do sistema
    // legado%'), so' que a 032 e' uma migration one-shot: ja rodou nesse PC
    // antes do seed recriar mais fantasmas depois, entao nao roda de novo
    // sozinha. Push e' upsert-only (nunca propaga delete), entao mesmo depois
    // de limpar o Supabase diretamente, qualquer PC que ja tinha baixado
    // esses fantasmas antes da limpeza continua com eles localmente ate rodar
    // essa migration.
    name: "034_delete_legacy_import_client_shells_again",
    up: (db) => {
      const candidates = db.prepare(
        "SELECT id FROM business_partners WHERE notes LIKE 'Importado do sistema legado%'"
      ).all() as Array<{ id: string }>;
      const hasLink = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM fiscal_documents WHERE responsible_partner_id = ?) +
          (SELECT COUNT(*) FROM operations WHERE responsible_partner_id = ?) +
          (SELECT COUNT(*) FROM client_charges WHERE client_partner_id = ?) +
          (SELECT COUNT(*) FROM accounts_payable WHERE supplier_partner_id = ?) AS c
      `);
      const unlinkEntities = db.prepare("UPDATE partner_legal_entities SET business_partner_id = NULL, is_primary = 0, updated_at = ? WHERE business_partner_id = ?");
      const deleteRoles = db.prepare("DELETE FROM business_partner_roles WHERE business_partner_id = ?");
      const deletePartner = db.prepare("DELETE FROM business_partners WHERE id = ?");
      const now = new Date().toISOString();
      for (const { id } of candidates) {
        const linked = hasLink.get(id, id, id, id) as { c: number };
        if (linked.c > 0) continue;
        unlinkEntities.run(now, id);
        deleteRoles.run(id);
        deletePartner.run(id);
      }
    }
  },
  {
    // Role pra funcionario com acesso operacional completo (lanca notas,
    // confirma negocio, cobranca e contas a pagar) mas SEM nada de
    // administracao (usuarios, roles, configuracoes, auditoria) -- nenhum dos
    // roles ja seedados cobre exatamente isso: OPERATIONS_MANAGER nao tem
    // finance.manage (nao da pra criar/pagar/dar baixa em contas a pagar) e
    // FINANCE_MANAGER nao tem operations.manage/imports.manage/
    // confirmations.manage (nao da pra lancar nota nem confirmar negocio).
    name: "035_employee_operational_role",
    up: (db) => {
      db.exec(`
        INSERT OR IGNORE INTO roles (id, code, name, description, scope_type, is_system, is_active, created_at, updated_at) VALUES
          ('role-employee-operacional', 'EMPLOYEE_OPERACIONAL', 'Funcionario operacional', 'Lanca notas, confirma negocios, gerencia cobrancas e contas a pagar. Sem acesso a usuarios, roles, configuracoes ou auditoria.', 'ORGANIZATION', 1, 1, datetime('now'), datetime('now'));

        INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at)
        SELECT 'rp-empop-' || permissions.id, 'role-employee-operacional', permissions.id, datetime('now') FROM permissions
        WHERE code IN ('system.view','operations.view','operations.manage','imports.manage','commercial.view','commercial.manage','billing.manage','confirmations.manage','finance.view','finance.manage');
      `);
    }
  },
  {
    // Release estavel 1.0: limpa tudo que foi lancado durante os testes beta
    // sem apagar cadastros comerciais, empresas/CNPJs, fornecedores,
    // produtos, regras por saca e usuarios. Tambem reseta numeradores para a
    // operacao real comecar do zero.
    name: "036_stable_release_operational_reset",
    up: (db) => {
      db.exec(`
        UPDATE client_charges SET replaced_by_charge_id = NULL;
        UPDATE deal_confirmations SET replaced_by_confirmation_id = NULL;

        DELETE FROM business_partner_merges;
        DELETE FROM financial_report_generations;

        DELETE FROM charge_status_history;
        DELETE FROM charge_document_versions;
        DELETE FROM client_payment_allocations;
        DELETE FROM client_credit_allocations;
        DELETE FROM client_charge_adjustments;
        DELETE FROM client_charge_operations;

        DELETE FROM payable_document_attachments;
        DELETE FROM payable_status_history;
        DELETE FROM payable_payment_allocations;
        DELETE FROM account_payable_operations;
        DELETE FROM account_payable_allocations;

        DELETE FROM deal_confirmation_document_versions;
        DELETE FROM deal_confirmation_status_history;
        DELETE FROM deal_payment_terms;
        DELETE FROM deal_confirmation_signers;
        DELETE FROM deal_confirmation_fiscal_documents;
        DELETE FROM deal_confirmation_operations;
        DELETE FROM deal_confirmation_clauses;
        DELETE FROM deal_confirmation_items;
        DELETE FROM deal_confirmation_parties;

        DELETE FROM operation_rate_history;
        DELETE FROM fiscal_document_merge_history;
        DELETE FROM fiscal_document_events;

        DELETE FROM xml_import_files;
        DELETE FROM spreadsheet_import_rows;

        DELETE FROM operations;
        DELETE FROM fiscal_document_items;
        DELETE FROM client_payments;
        DELETE FROM client_ledger_entries;
        DELETE FROM client_charges;
        DELETE FROM payable_payments;
        DELETE FROM accounts_payable;
        DELETE FROM payable_installment_groups;
        DELETE FROM payable_recurring_templates;
        DELETE FROM deal_confirmations;
        DELETE FROM fiscal_documents;
        DELETE FROM xml_import_jobs;
        DELETE FROM spreadsheet_import_jobs;

        UPDATE document_sequences SET current_number = 0, updated_at = datetime('now');
        UPDATE app_settings SET value = '1970-01-01T00:00:00.000Z', updated_at = datetime('now') WHERE key LIKE 'sync_cursor_%';
      `);
    }
  },
  {
    name: "037_app_users_soft_delete",
    up: (db) => {
      // Espelha a coluna deleted_at adicionada no Postgres (migration
      // 0016_app_users_soft_delete.sql) -- sem essa coluna aqui, TODO pull de
      // app_users falha ("table app_users has no column named deleted_at"),
      // ja que upsertLocalRow em appRepository.ts grava todas as colunas que
      // vierem da linha compartilhada. So' e' usada localmente pra detectar a
      // marca e replicar a exclusao em cascata (ver upsertLocalRow) -- nunca
      // fica preenchida de verdade aqui, ja que exclusao local e' sempre
      // imediata (DELETE de verdade, nao soft-delete).
      db.exec(`ALTER TABLE app_users ADD COLUMN deleted_at TEXT;`);
    }
  },
  {
    name: "038_shared_push_outbox",
    up: (db) => {
      // Fila local de reenvio pro Supabase. Ate' aqui, todo push que falhava
      // (rede instavel, PC offline por um instante, etc.) so' logava um aviso
      // e desistia pra sempre -- a gravacao local funcionava, mas o dado
      // ficava preso so' naquele PC, sem ninguem perceber ("dados nao
      // aparecem nos outros PCs"). Essa tabela guarda o que falhou; o proximo
      // ciclo de sincronizacao (poll de 20s ou "Sincronizar agora") tenta de
      // novo ate' conseguir. Dedup por (push_kind, entity_id): a mesma
      // entidade falhando de novo antes do reenvio funcionar so' atualiza a
      // mesma linha, nao acumula.
      db.exec(`
        CREATE TABLE shared_push_outbox (
          id TEXT PRIMARY KEY,
          push_kind TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 1,
          last_error TEXT,
          created_at TEXT NOT NULL,
          last_attempted_at TEXT,
          UNIQUE(push_kind, entity_id)
        );
      `);
    }
  },
  {
    name: "039_operational_reset_2026_08_02",
    up: (db) => {
      // Mesma logica de 036_stable_release_operational_reset (que ja e' o
      // espelho local de scripts/supabase/reset-test-data.mjs), pro reset
      // operacional que rodou direto no Postgres na madrugada de 02/08/2026
      // (~03:57 UTC). Precisa de uma migracao NOVA (nao reaproveitar a 036)
      // porque um PC que ja tinha atualizado antes desse reset ja rodou a
      // 036 faz tempo -- migracao so' roda uma vez por PC. Sem isso, um PC
      // que sincronizou dados antes do reset (ex: ficou desligado durante a
      // madrugada) nunca fica sabendo que aquelas linhas sumiram do
      // Supabase: o pull so' traz linha nova/alterada, nunca detecta uma
      // linha que deixou de existir la'.
      //
      // DIFERENCA importante em relacao a' 036: aqui o wipe e' filtrado por
      // data (< CUTOFF, um pouco depois do horario real do reset). A 036
      // rodou numa fase de testes sem uso real; agora o sistema tem PCs
      // ativos o dia todo, entao um wipe cego apagaria localmente qualquer
      // nota/cobranca/confirmacao lancada DEPOIS do reset por um PC que so'
      // atualiza mais tarde -- exatamente o tipo de perda de dados que a
      // fila de reenvio (038) foi criada pra evitar do lado do push. Cadastros
      // (empresas, clientes/corretores, fornecedores, produtos, regras de
      // tarifa) ficam de fora, igual no reset original.
      const CUTOFF = "2026-08-02T04:00:00.000Z";
      db.exec(`
        UPDATE client_charges SET replaced_by_charge_id = NULL WHERE updated_at < '${CUTOFF}';
        UPDATE deal_confirmations SET replaced_by_confirmation_id = NULL WHERE updated_at < '${CUTOFF}';

        DELETE FROM business_partner_merges WHERE created_at < '${CUTOFF}';
        DELETE FROM financial_report_generations WHERE created_at < '${CUTOFF}';

        DELETE FROM charge_status_history WHERE created_at < '${CUTOFF}';
        DELETE FROM charge_document_versions WHERE created_at < '${CUTOFF}';
        DELETE FROM client_payment_allocations WHERE allocated_at < '${CUTOFF}';
        DELETE FROM client_credit_allocations WHERE allocated_at < '${CUTOFF}';
        DELETE FROM client_charge_adjustments WHERE updated_at < '${CUTOFF}';
        DELETE FROM client_charge_operations WHERE created_at < '${CUTOFF}';

        DELETE FROM payable_document_attachments WHERE created_at < '${CUTOFF}';
        DELETE FROM payable_status_history WHERE changed_at < '${CUTOFF}';
        DELETE FROM payable_payment_allocations WHERE allocated_at < '${CUTOFF}';
        DELETE FROM account_payable_operations WHERE created_at < '${CUTOFF}';
        DELETE FROM account_payable_allocations WHERE updated_at < '${CUTOFF}';

        DELETE FROM deal_confirmation_document_versions WHERE created_at < '${CUTOFF}';
        DELETE FROM deal_confirmation_status_history WHERE changed_at < '${CUTOFF}';
        DELETE FROM deal_payment_terms WHERE updated_at < '${CUTOFF}';
        DELETE FROM deal_confirmation_signers WHERE updated_at < '${CUTOFF}';
        DELETE FROM deal_confirmation_fiscal_documents WHERE created_at < '${CUTOFF}';
        DELETE FROM deal_confirmation_operations WHERE created_at < '${CUTOFF}';
        DELETE FROM deal_confirmation_clauses WHERE updated_at < '${CUTOFF}';
        DELETE FROM deal_confirmation_items WHERE updated_at < '${CUTOFF}';
        DELETE FROM deal_confirmation_parties WHERE updated_at < '${CUTOFF}';

        DELETE FROM operation_rate_history WHERE changed_at < '${CUTOFF}';
        DELETE FROM fiscal_document_merge_history WHERE created_at < '${CUTOFF}';
        DELETE FROM fiscal_document_events WHERE created_at < '${CUTOFF}';

        DELETE FROM xml_import_files WHERE updated_at < '${CUTOFF}';
        DELETE FROM spreadsheet_import_rows WHERE created_at < '${CUTOFF}';

        DELETE FROM operations WHERE updated_at < '${CUTOFF}';
        DELETE FROM fiscal_document_items WHERE updated_at < '${CUTOFF}';
        DELETE FROM client_payments WHERE updated_at < '${CUTOFF}';
        DELETE FROM client_ledger_entries WHERE updated_at < '${CUTOFF}';
        DELETE FROM client_charges WHERE updated_at < '${CUTOFF}';
        DELETE FROM payable_payments WHERE updated_at < '${CUTOFF}';
        DELETE FROM accounts_payable WHERE updated_at < '${CUTOFF}';
        DELETE FROM payable_installment_groups WHERE updated_at < '${CUTOFF}';
        DELETE FROM payable_recurring_templates WHERE updated_at < '${CUTOFF}';
        DELETE FROM deal_confirmations WHERE updated_at < '${CUTOFF}';
        DELETE FROM fiscal_documents WHERE updated_at < '${CUTOFF}';
        DELETE FROM xml_import_jobs WHERE updated_at < '${CUTOFF}';
        DELETE FROM spreadsheet_import_jobs WHERE created_at < '${CUTOFF}';

        UPDATE document_sequences SET current_number = 0, updated_at = datetime('now');
        UPDATE app_settings SET value = '1970-01-01T00:00:00.000Z', updated_at = datetime('now') WHERE key LIKE 'sync_cursor_%';
      `);
    }
  },
  {
    name: "040_sync_tombstones",
    up: (db) => {
      // Espelho local de supabase/migrations/0017_sync_tombstones.sql --
      // registro permanente de "essa linha foi apagada de proposito" pra
      // qualquer tabela compartilhada. Sem isso, pushAllLocalReferenceDataToShared
      // (upsert de tudo que existe localmente, chamado a cada "Sincronizar
      // agora"/reconexao) ressuscita pro Postgres qualquer linha que este PC
      // ainda nao sabia que tinha sido apagada em outro lugar -- ver
      // appRepository.ts (pushTombstone/applyTombstone) e a migracao 039
      // (o mesmo problema, resolvido so' pra uma data especifica; esta aqui
      // e' a versao permanente, vale pra qualquer exclusao futura tambem).
      db.exec(`
        CREATE TABLE sync_tombstones (
          table_name TEXT NOT NULL,
          row_id TEXT NOT NULL,
          deleted_at TEXT NOT NULL,
          PRIMARY KEY (table_name, row_id)
        );
      `);
    }
  }
  ,{
    name: "041_confirmation_company_defaults",
    up: (db) => {
      const legalEntityColumns = [
        ["default_bank_account_type", "TEXT"],
        ["default_bank_holder_name", "TEXT"],
        ["default_bank_holder_document", "TEXT"],
        ["default_pix_key_type", "TEXT"],
        ["default_payment_terms", "TEXT"],
        ["default_delivery_terms", "TEXT"],
        ["default_confirmation_notes", "TEXT"]
      ] as const;
      const confirmationColumns = [
        ["bank_account_type", "TEXT"],
        ["bank_holder_name", "TEXT"],
        ["bank_holder_document", "TEXT"],
        ["pix_key_type", "TEXT"]
      ] as const;
      const hasColumn = (table: string, column: string): boolean =>
        (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((item) => item.name === column);
      for (const [column, type] of legalEntityColumns) if (!hasColumn("legal_entities", column)) db.exec(`ALTER TABLE legal_entities ADD COLUMN ${column} ${type}`);
      for (const [column, type] of confirmationColumns) if (!hasColumn("deal_confirmations", column)) db.exec(`ALTER TABLE deal_confirmations ADD COLUMN ${column} ${type}`);
    }
  }

];
