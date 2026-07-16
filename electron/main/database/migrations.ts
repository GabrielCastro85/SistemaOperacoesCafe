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
  }
];
