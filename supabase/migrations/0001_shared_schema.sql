-- ============================================================================
-- Sistema Operacoes Cafe -- schema compartilhado (Supabase/Postgres)
--
-- Traducao mecanica do schema SQLite atual (electron/main/database/migrations.ts)
-- para as tabelas que precisam ser vistas pelos 4 PCs (fiscal x2, financeiro,
-- fechamento). Gerado a partir do schema FINAL real (introspectado de um banco
-- com todas as migrations SQLite aplicadas), nao de leitura manual das migrations
-- uma a uma -- reduz risco de esquecer uma coluna adicionada por ALTER TABLE.
--
-- Regras de traducao aplicadas (ver plano em .claude/plans, aprovado):
--   - Colunas TEXT PRIMARY KEY / *_id (armazenam UUID gerado por randomUUID() em
--     JS) -> UUID nativo, DEFAULT gen_random_uuid() como fallback (o app sempre
--     manda o id explicito hoje, o default e' so seguranca).
--   - INTEGER ... CHECK (col IN (0,1))  -> BOOLEAN.
--   - TEXT ... CHECK (col IN ('A','B',...)) -> mantém CHECK (mais simples de
--     evoluir que ENUM nomeado do Postgres).
--   - Colunas *_cents (dinheiro) -> BIGINT (SQLite usava INTEGER; BIGINT evita
--     risco de overflow em somas agregadas ao longo do tempo).
--   - Datas/quantidades decimais/JSON continuam TEXT, igual hoje -- o app faz
--     parsing manual (JSON.parse, comparacao lexicografica de data ISO,
--     matematica decimal em string). Mudar isso e' uma melhoria futura
--     separada, fora do escopo desta migracao (evita mudanca de comportamento
--     nao planejada).
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- organizations / legal_entities / locations
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  display_name text not null,
  app_display_name text not null,
  logo_path text,
  icon_path text,
  compact_logo_path text,
  description text,
  primary_color text not null,
  secondary_color text not null,
  accent_color text not null,
  theme_mode text not null check (theme_mode in ('light', 'dark')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_organizations_is_active on organizations(is_active);
create index idx_organizations_name_search on organizations(name, display_name);

create table legal_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  legal_name text not null,
  trade_name text not null,
  cnpj text,
  state_registration text,
  municipal_registration text,
  email text,
  phone text,
  address_line text not null,
  address_number text not null,
  address_complement text,
  district text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  document_prefix text,
  is_active boolean not null default true,
  is_draft boolean not null default true,
  default_bank_name text,
  default_bank_code text,
  default_bank_agency text,
  default_bank_account text,
  default_pix_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_legal_entities_organization_id on legal_entities(organization_id);
create unique index idx_legal_entities_cnpj_unique on legal_entities(cnpj) where cnpj is not null;
create index idx_legal_entities_is_active on legal_entities(is_active);
create index idx_legal_entities_state on legal_entities(state);
create index idx_legal_entities_trade_name_search on legal_entities(trade_name, legal_name);

create table locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  legal_entity_id uuid references legal_entities(id),
  name text not null,
  type text not null check (type in ('OFFICE', 'BRANCH', 'WAREHOUSE', 'PROPERTY', 'STORAGE', 'OTHER')),
  description text,
  address_line text,
  address_number text,
  address_complement text,
  district text,
  city text,
  state text,
  postal_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_locations_organization_id on locations(organization_id);
create index idx_locations_legal_entity_id on locations(legal_entity_id);
create index idx_locations_is_active on locations(is_active);
create index idx_locations_type on locations(type);
create index idx_locations_name_search on locations(name);

-- ---------------------------------------------------------------------------
-- business_partners (clientes/corretores/fornecedores) e derivadas
-- ---------------------------------------------------------------------------

create table business_partners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  display_name text not null,
  notes text,
  credit_limit_cents bigint,
  document_number text,
  email text,
  phone text,
  mobile text,
  postal_code text,
  address_line text,
  address_number text,
  address_complement text,
  district text,
  city text,
  state text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_business_partners_organization_id on business_partners(organization_id);
create index idx_business_partners_display_name on business_partners(display_name);
create index idx_business_partners_is_active on business_partners(is_active);

create table business_partner_roles (
  id uuid primary key default gen_random_uuid(),
  business_partner_id uuid not null references business_partners(id),
  role text not null check (role in ('CLIENT','SUPPLIER','SELLER','BUYER','DESTINATION','CARRIER','SERVICE_PROVIDER','OTHER')),
  created_at timestamptz not null default now(),
  unique (business_partner_id, role)
);
create index idx_business_partner_roles_business_partner_id on business_partner_roles(business_partner_id);

create table partner_legal_entities (
  id uuid primary key default gen_random_uuid(),
  business_partner_id uuid not null references business_partners(id),
  legal_name text not null,
  trade_name text not null,
  cnpj text,
  state_registration text,
  municipal_registration text,
  email text,
  phone text,
  address_line text,
  address_number text,
  address_complement text,
  district text,
  city text,
  state text,
  postal_code text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  is_draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_partner_legal_entities_business_partner_id on partner_legal_entities(business_partner_id);
create unique index idx_partner_legal_entities_cnpj_unique on partner_legal_entities(cnpj) where cnpj is not null;
create unique index idx_partner_legal_entities_one_primary on partner_legal_entities(business_partner_id) where is_primary = true and is_active = true;

create table partner_contacts (
  id uuid primary key default gen_random_uuid(),
  business_partner_id uuid not null references business_partners(id),
  partner_legal_entity_id uuid references partner_legal_entities(id),
  name text not null,
  department text,
  email text,
  phone text,
  mobile text,
  preferred_contact_method text not null check (preferred_contact_method in ('PHONE','MOBILE','EMAIL','WHATSAPP','OTHER')),
  is_primary boolean not null default false,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_partner_contacts_business_partner_id on partner_contacts(business_partner_id);
create unique index idx_partner_contacts_one_primary on partner_contacts(business_partner_id) where is_primary = true and is_active = true;

-- ---------------------------------------------------------------------------
-- products / service_rate_rules
-- ---------------------------------------------------------------------------

create table products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  code text,
  category text not null check (category in ('COFFEE_ARABICA','COFFEE_CONILON','COFFEE_OTHER','OTHER')),
  default_unit text not null check (default_unit in ('SACK','KG','TON','UNIT')),
  default_sack_weight_kg numeric,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_products_organization_id on products(organization_id);
create unique index idx_products_code_org_unique on products(organization_id, code) where code is not null;
create index idx_products_is_active on products(is_active);

create table client_billing_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  business_partner_id uuid not null unique references business_partners(id),
  own_legal_entity_id uuid references legal_entities(id),
  periodicity text not null check (periodicity in ('WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY','CUSTOM')),
  closing_weekday integer,
  closing_day_of_month integer,
  due_days_after_closing integer not null,
  auto_include_unbilled_operations boolean not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_client_billing_profiles_business_partner_id on client_billing_profiles(business_partner_id);

create table service_rate_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  business_partner_id uuid not null references business_partners(id),
  own_legal_entity_id uuid references legal_entities(id),
  counterparty_partner_legal_entity_id uuid references partner_legal_entities(id),
  product_id uuid references products(id),
  operation_scope text not null check (operation_scope in ('INTERNAL','EXTERNAL','ALL')),
  rate_type text not null check (rate_type in ('PER_SACK')),
  rate_value_cents bigint not null,
  effective_from text not null,
  effective_to text,
  priority integer not null default 0,
  notes text,
  conflict_warning text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_service_rate_rules_business_partner_id on service_rate_rules(business_partner_id);
create index idx_service_rate_rules_organization_id on service_rate_rules(organization_id);
create index idx_service_rate_rules_own_legal_entity_id on service_rate_rules(own_legal_entity_id);
create index idx_service_rate_rules_product_id on service_rate_rules(product_id);
create index idx_service_rate_rules_effective_from on service_rate_rules(effective_from);
create index idx_service_rate_rules_effective_to on service_rate_rules(effective_to);
create index idx_service_rate_rules_is_active on service_rate_rules(is_active);
create index idx_service_rate_rules_counterparty_partner_legal_entity_id on service_rate_rules(counterparty_partner_legal_entity_id);

-- ---------------------------------------------------------------------------
-- fiscal_documents (notas) / operations -- o dado central compartilhado
-- ---------------------------------------------------------------------------

create table fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  responsible_partner_id uuid not null references business_partners(id),
  partner_legal_entity_id uuid references partner_legal_entities(id),
  document_type text not null check (document_type in ('MANUAL_INVOICE')),
  access_key text,
  document_number text not null,
  series text,
  issue_date text not null,
  total_amount_cents bigint not null,
  status text not null check (status in ('DRAFT','PENDING','CONFIRMED','CANCELED')),
  has_pending_issues boolean not null default false,
  pending_notes text,
  duplicate_warning text,
  notes text,
  confirmed_at text,
  canceled_at text,
  cancel_reason text,
  source text not null default 'MANUAL' check (source in ('MANUAL','SPREADSHEET','XML')),
  import_job_id uuid,
  import_row_id uuid,
  xml_file_path text,
  xml_file_hash text,
  protocol_number text,
  protocol_date text,
  authorization_status_code text,
  authorization_status_message text,
  xml_import_job_id uuid,
  merged_from_source text check (merged_from_source in ('MANUAL','SPREADSHEET','XML')),
  merged_at text,
  direction text not null default 'UNKNOWN' check (direction in ('INBOUND','OUTBOUND','UNKNOWN')),
  fiscal_snapshot_json text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_fiscal_documents_access_key_unique on fiscal_documents(access_key) where access_key is not null;
create index idx_fiscal_documents_organization_id on fiscal_documents(organization_id);
create index idx_fiscal_documents_own_legal_entity_id on fiscal_documents(own_legal_entity_id);
create index idx_fiscal_documents_responsible_partner_id on fiscal_documents(responsible_partner_id);
create index idx_fiscal_documents_status on fiscal_documents(status);
create index idx_fiscal_documents_issue_date on fiscal_documents(issue_date);
create index idx_fiscal_documents_possible_duplicate on fiscal_documents(organization_id, responsible_partner_id, document_number, series, issue_date, total_amount_cents);
create index idx_fiscal_documents_import_job_id on fiscal_documents(import_job_id);
create index idx_fiscal_documents_xml_import_job_id on fiscal_documents(xml_import_job_id);
create index idx_fiscal_documents_xml_file_hash on fiscal_documents(xml_file_hash);
create index idx_fiscal_documents_source on fiscal_documents(source);

create table fiscal_document_items (
  id uuid primary key default gen_random_uuid(),
  fiscal_document_id uuid not null references fiscal_documents(id),
  product_id uuid references products(id),
  description text not null,
  quantity_decimal text not null,
  unit text not null check (unit in ('SACK','KG','TON','UNIT')),
  unit_price_decimal text not null,
  total_amount_cents bigint not null,
  sacks_quantity_decimal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_fiscal_document_items_document_id on fiscal_document_items(fiscal_document_id);
create index idx_fiscal_document_items_product_id on fiscal_document_items(product_id);

create table fiscal_document_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  fiscal_document_id uuid references fiscal_documents(id),
  access_key text not null,
  event_type text not null check (event_type in ('CANCELLATION','CORRECTION_LETTER','OTHER')),
  sequence_number text not null,
  event_date text,
  protocol_number text,
  status_code text,
  status_message text,
  correction_text text,
  xml_file_path text,
  file_hash text not null,
  created_at timestamptz not null default now()
);
create index idx_fiscal_document_events_organization_id on fiscal_document_events(organization_id);
create index idx_fiscal_document_events_document_id on fiscal_document_events(fiscal_document_id);
create index idx_fiscal_document_events_access_key on fiscal_document_events(access_key);
create index idx_fiscal_document_events_event_type on fiscal_document_events(event_type);
create unique index idx_fiscal_document_events_unique on fiscal_document_events(access_key, event_type, sequence_number, coalesce(protocol_number, ''));

create table fiscal_document_merge_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  fiscal_document_id uuid not null references fiscal_documents(id),
  xml_import_job_id uuid,
  previous_source text check (previous_source in ('MANUAL','SPREADSHEET','XML')),
  decision text not null,
  differences_json text not null,
  created_at timestamptz not null default now()
);
create index idx_fiscal_document_merge_history_document_id on fiscal_document_merge_history(fiscal_document_id);
create index idx_fiscal_document_merge_history_xml_job_id on fiscal_document_merge_history(xml_import_job_id);
-- FK pra xml_import_jobs adicionada via ALTER no fim do arquivo, depois que a tabela existe
-- (xml_import_jobs so' e' criada mais abaixo, na secao de importacao de XML).

create table operations (
  id uuid primary key default gen_random_uuid(),
  fiscal_document_id uuid not null references fiscal_documents(id),
  fiscal_document_item_id uuid references fiscal_document_items(id),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  responsible_partner_id uuid not null references business_partners(id),
  product_id uuid references products(id),
  operation_type text not null check (operation_type in ('PURCHASE','SALE')),
  operation_scope text not null check (operation_scope in ('INTERNAL','EXTERNAL')),
  operation_date text not null,
  quantity_sacks_decimal text not null,
  service_rate_rule_id uuid references service_rate_rules(id),
  applied_rate_value_cents bigint not null,
  service_amount_cents bigint not null,
  rate_was_manually_overridden boolean not null default false,
  manual_rate_value_cents bigint,
  manual_override_reason text,
  notes text,
  status text not null check (status in ('DRAFT','PENDING','CONFIRMED','CANCELED')),
  source text not null default 'MANUAL' check (source in ('MANUAL','SPREADSHEET','XML')),
  import_job_id uuid,
  import_row_id uuid,
  xml_import_job_id uuid,
  classification_rule_id uuid,
  billing_status text not null default 'UNBILLED' check (billing_status in ('UNBILLED','RESERVED','BILLED')),
  client_charge_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_operations_fiscal_document_id on operations(fiscal_document_id);
create index idx_operations_organization_id on operations(organization_id);
create index idx_operations_responsible_partner_id on operations(responsible_partner_id);
create index idx_operations_operation_date on operations(operation_date);
create index idx_operations_status on operations(status);
create index idx_operations_import_job_id on operations(import_job_id);
create index idx_operations_xml_import_job_id on operations(xml_import_job_id);
create index idx_operations_classification_rule_id on operations(classification_rule_id);
create index idx_operations_billing_status on operations(billing_status);
create index idx_operations_client_charge_id on operations(client_charge_id);

-- ---------------------------------------------------------------------------
-- Importacao de XML -- compartilhar entre os 2 PCs do fiscal permite dedup
-- real por access_key/hash (hoje cada PC teria fila isolada)
-- ---------------------------------------------------------------------------

create table xml_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  status text not null check (status in ('DRAFT','INSPECTING','VALIDATED','PROCESSING','COMPLETED','COMPLETED_WITH_ERRORS','CANCELLED','FAILED','REVERTED')),
  source_type text not null check (source_type in ('FILE','MULTIPLE_FILES','FOLDER','DRAG_DROP')),
  selected_folder text,
  include_subfolders boolean not null,
  total_files integer not null default 0,
  valid_files integer not null default 0,
  warning_files integer not null default 0,
  duplicate_files integer not null default 0,
  error_files integer not null default 0,
  imported_notes integer not null default 0,
  imported_events integer not null default 0,
  created_operations integer not null default 0,
  items_without_operation integer not null default 0,
  settings_json text not null,
  created_at timestamptz not null default now(),
  started_at text,
  completed_at text,
  cancelled_at text,
  reverted_at text
);
create index idx_xml_import_jobs_organization_id on xml_import_jobs(organization_id);
create index idx_xml_import_jobs_status on xml_import_jobs(status);
create index idx_xml_import_jobs_created_at on xml_import_jobs(created_at);

create table xml_import_files (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references xml_import_jobs(id),
  original_file_name text not null,
  stored_file_path text,
  file_hash text not null,
  file_size bigint not null,
  xml_type text not null check (xml_type in ('NFE_PROC','NFE','EVENT_CANCELLATION','EVENT_CORRECTION_LETTER','EVENT_OTHER','UNKNOWN')),
  access_key text,
  status text not null check (status in ('PENDING','VALID','WARNING','PENDING_REVIEW','DUPLICATE','ERROR','IMPORTED','SKIPPED','REVERTED')),
  fiscal_document_id uuid references fiscal_documents(id),
  fiscal_document_event_id uuid references fiscal_document_events(id),
  error_code text,
  error_message text,
  warning_codes_json text,
  extracted_data_json text,
  resolution_data_json text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_xml_import_files_import_job_id on xml_import_files(import_job_id);
create index idx_xml_import_files_file_hash on xml_import_files(file_hash);
create index idx_xml_import_files_access_key on xml_import_files(access_key);
create index idx_xml_import_files_xml_type on xml_import_files(xml_type);
create index idx_xml_import_files_status on xml_import_files(status);
create index idx_xml_import_files_fiscal_document_id on xml_import_files(fiscal_document_id);

-- ---------------------------------------------------------------------------
-- Cobrancas existentes (valor de servico por saca, PC de fechamento)
-- ---------------------------------------------------------------------------

create table client_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  client_partner_id uuid not null references business_partners(id),
  billing_profile_id uuid references client_billing_profiles(id),
  charge_number text,
  reference_code text,
  periodicity text not null check (periodicity in ('WEEKLY','BIWEEKLY','MONTHLY','QUARTERLY','CUSTOM')),
  period_start text not null,
  period_end text not null,
  issue_date text,
  due_date text,
  status text not null check (status in ('DRAFT','PENDING_REVIEW','ISSUED','PARTIALLY_PAID','PAID','OVERDUE','CANCELLED','REPLACED')),
  subtotal_services_cents bigint not null default 0,
  additions_cents bigint not null default 0,
  deductions_cents bigint not null default 0,
  final_amount_cents bigint not null default 0,
  paid_amount_cents bigint not null default 0,
  open_amount_cents bigint not null default 0,
  notes text,
  internal_notes text,
  pdf_file_path text,
  pdf_file_hash text,
  excel_file_path text,
  image_file_path text,
  snapshot_json text,
  issued_at text,
  cancelled_at text,
  cancellation_reason text,
  replaced_by_charge_id uuid references client_charges(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_client_charges_number_unique on client_charges(organization_id, own_legal_entity_id, charge_number) where charge_number is not null;
create index idx_client_charges_organization_id on client_charges(organization_id);
create index idx_client_charges_own_legal_entity_id on client_charges(own_legal_entity_id);
create index idx_client_charges_client_partner_id on client_charges(client_partner_id);
create index idx_client_charges_period on client_charges(period_start, period_end);
create index idx_client_charges_issue_date on client_charges(issue_date);
create index idx_client_charges_due_date on client_charges(due_date);
create index idx_client_charges_status on client_charges(status);

create table client_charge_operations (
  id uuid primary key default gen_random_uuid(),
  client_charge_id uuid not null references client_charges(id),
  operation_id uuid not null references operations(id),
  operation_date_snapshot text not null,
  fiscal_document_number_snapshot text,
  fiscal_document_series_snapshot text,
  issuer_name_snapshot text,
  destination_name_snapshot text,
  product_name_snapshot text,
  operation_scope_snapshot text not null check (operation_scope_snapshot in ('INTERNAL','EXTERNAL')),
  quantity_sacks_decimal_snapshot text not null,
  service_rate_cents_snapshot bigint not null,
  service_amount_cents_snapshot bigint not null,
  own_legal_entity_id_snapshot uuid,
  own_legal_entity_name_snapshot text,
  released_at text,
  created_at timestamptz not null default now()
);
create index idx_client_charge_operations_charge_id on client_charge_operations(client_charge_id);
create index idx_client_charge_operations_operation_id on client_charge_operations(operation_id);
create unique index idx_client_charge_operations_active_unique on client_charge_operations(operation_id) where released_at is null;
create index idx_client_charge_operations_own_legal_entity_snapshot on client_charge_operations(own_legal_entity_id_snapshot);

create table client_charge_adjustments (
  id uuid primary key default gen_random_uuid(),
  client_charge_id uuid not null references client_charges(id),
  ledger_entry_id uuid,
  adjustment_type text not null check (adjustment_type in ('ADVANCE','CREDIT','DISCOUNT','SURCHARGE','REIMBURSEMENT','PREVIOUS_BALANCE','MANUAL_ADJUSTMENT','OTHER')),
  effect text not null check (effect in ('INCREASE_RECEIVABLE','REDUCE_RECEIVABLE')),
  description text not null,
  amount_cents bigint not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_client_charge_adjustments_charge_id on client_charge_adjustments(client_charge_id);
create index idx_client_charge_adjustments_ledger_entry_id on client_charge_adjustments(ledger_entry_id);

create table client_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  client_partner_id uuid not null references business_partners(id),
  client_charge_id uuid references client_charges(id),
  entry_type text not null check (entry_type in ('SERVICE_CHARGE','ADVANCE_RECEIVED','PAYMENT_RECEIVED','DISCOUNT','CREDIT','SURCHARGE','REIMBURSEMENT','PREVIOUS_BALANCE','MANUAL_ADJUSTMENT','REVERSAL','OTHER')),
  effect text not null check (effect in ('INCREASE_RECEIVABLE','REDUCE_RECEIVABLE')),
  amount_cents bigint not null,
  entry_date text not null,
  description text not null,
  reference_number text,
  notes text,
  attachment_path text,
  status text not null check (status in ('DRAFT','CONFIRMED','CANCELLED')),
  available_amount_cents bigint,
  cancelled_at text,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_client_ledger_entries_organization_id on client_ledger_entries(organization_id);
create index idx_client_ledger_entries_own_legal_entity_id on client_ledger_entries(own_legal_entity_id);
create index idx_client_ledger_entries_client_partner_id on client_ledger_entries(client_partner_id);
create index idx_client_ledger_entries_charge_id on client_ledger_entries(client_charge_id);
create index idx_client_ledger_entries_type on client_ledger_entries(entry_type);
create index idx_client_ledger_entries_date on client_ledger_entries(entry_date);
create index idx_client_ledger_entries_status on client_ledger_entries(status);

create table client_credit_allocations (
  id uuid primary key default gen_random_uuid(),
  ledger_entry_id uuid not null references client_ledger_entries(id),
  client_charge_id uuid not null references client_charges(id),
  amount_cents bigint not null,
  allocated_at timestamptz not null default now(),
  cancelled_at text,
  cancellation_reason text
);
create index idx_client_credit_allocations_ledger_entry_id on client_credit_allocations(ledger_entry_id);
create index idx_client_credit_allocations_charge_id on client_credit_allocations(client_charge_id);

create table client_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  client_partner_id uuid not null references business_partners(id),
  payment_date text not null,
  amount_cents bigint not null,
  payment_method text not null check (payment_method in ('PIX','BANK_TRANSFER','CASH','CHECK','OFFSET','OTHER')),
  bank_account_description text,
  transaction_reference text,
  notes text,
  attachment_path text,
  status text not null check (status in ('CONFIRMED','CANCELLED')),
  cancelled_at text,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_client_payments_client_partner_id on client_payments(client_partner_id);
create index idx_client_payments_payment_date on client_payments(payment_date);
create index idx_client_payments_status on client_payments(status);

create table client_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  client_payment_id uuid not null references client_payments(id),
  client_charge_id uuid not null references client_charges(id),
  amount_cents bigint not null,
  allocated_at timestamptz not null default now(),
  cancelled_at text,
  cancellation_reason text
);
create index idx_client_payment_allocations_payment_id on client_payment_allocations(client_payment_id);
create index idx_client_payment_allocations_charge_id on client_payment_allocations(client_charge_id);

create table document_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  document_type text not null check (document_type in ('CLIENT_CHARGE','DEAL_CONFIRMATION','CLIENT_RECEIVABLE')),
  year integer,
  prefix text,
  current_number integer not null,
  padding integer not null,
  is_active boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_document_sequences_unique on document_sequences(organization_id, own_legal_entity_id, document_type, coalesce(year, 0), coalesce(prefix, '')) where is_active = true;

create table charge_document_versions (
  id uuid primary key default gen_random_uuid(),
  client_charge_id uuid not null references client_charges(id),
  version integer not null,
  pdf_file_path text,
  pdf_file_hash text,
  excel_file_path text,
  excel_file_hash text,
  image_file_path text,
  image_file_hash text,
  created_at timestamptz not null default now()
);
create unique index idx_charge_document_versions_unique on charge_document_versions(client_charge_id, version);
create index idx_charge_document_versions_charge_id on charge_document_versions(client_charge_id);

create table charge_status_history (
  id uuid primary key default gen_random_uuid(),
  client_charge_id uuid not null references client_charges(id),
  previous_status text,
  next_status text not null,
  reason text,
  created_at timestamptz not null default now()
);
create index idx_charge_status_history_charge_id on charge_status_history(client_charge_id);

-- ---------------------------------------------------------------------------
-- Usuarios / RBAC / auditoria
--
-- app_users e' espelho de auth.users (Supabase Auth) -- ver migration de auth
-- e RLS (0002_auth_and_rls.sql) para a trigger que popula isso e para a
-- correcao do bug de enforcement de permissao encontrado em security.ts.
-- ---------------------------------------------------------------------------

create table app_users (
  id uuid primary key,  -- mesmo id de auth.users(id), sem default proprio
  display_name text not null,
  username text not null,
  normalized_username text not null unique,
  email text,
  status text not null check (status in ('ACTIVE','INACTIVE','LOCKED')),
  must_change_password boolean not null default false,
  failed_login_attempts integer not null default 0,
  locked_at text,
  last_login_at text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_app_users_status on app_users(status);
create index idx_app_users_email on app_users(email);

create table local_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id),
  status text not null check (status in ('ACTIVE','LOCKED','LOGGED_OUT','EXPIRED')),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  locked_at text,
  logout_at text,
  expires_at text,
  machine_name text
);
create index idx_local_sessions_user_id on local_sessions(user_id);
create index idx_local_sessions_status on local_sessions(status);

create table roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  scope_type text not null check (scope_type in ('GLOBAL','ORGANIZATION','LEGAL_ENTITY')),
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  module text not null,
  risk_level text not null check (risk_level in ('LOW','MEDIUM','HIGH','CRITICAL')),
  is_active boolean not null default true
);
create index idx_permissions_module on permissions(module);

create table role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references roles(id),
  permission_id uuid not null references permissions(id),
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create table user_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id),
  role_id uuid not null references roles(id),
  organization_id uuid references organizations(id),
  legal_entity_id uuid references legal_entities(id),
  assigned_at timestamptz not null default now(),
  expires_at text,
  is_active boolean not null default true
);
create index idx_user_role_assignments_user_id on user_role_assignments(user_id);
create index idx_user_role_assignments_scope on user_role_assignments(organization_id, legal_entity_id);

create table user_role_legal_entity_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id),
  organization_id uuid not null references organizations(id),
  legal_entity_id uuid references legal_entities(id),
  access_mode text not null check (access_mode in ('ALL','SPECIFIC')),
  created_at timestamptz not null default now()
);
create index idx_user_legal_entity_access_user_id on user_role_legal_entity_access(user_id);

-- user_active_context: substitui installation_profiles (por PC) como fonte de
-- verdade do contexto ativo -- agora e' por usuario (ver plano, secao Auth).
create table user_active_context (
  user_id uuid primary key references app_users(id),
  active_organization_id uuid references organizations(id),
  active_legal_entity_id uuid references legal_entities(id),
  updated_at timestamptz not null default now()
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references app_users(id),
  actor_username text,
  session_id uuid references local_sessions(id),
  action text not null,
  entity_type text,
  entity_id text,
  organization_id uuid references organizations(id),
  legal_entity_id uuid references legal_entities(id),
  result text not null check (result in ('SUCCESS','DENIED','FAILED')),
  severity text not null check (severity in ('INFO','WARNING','CRITICAL')),
  reason text,
  metadata_json text not null,
  previous_hash text,
  event_hash text not null
);
create index idx_audit_events_occurred_at on audit_events(occurred_at);
create index idx_audit_events_actor_user_id on audit_events(actor_user_id);
create index idx_audit_events_action on audit_events(action);

-- ---------------------------------------------------------------------------
-- FKs adiadas (coluna criada antes da tabela referenciada existir)
-- ---------------------------------------------------------------------------
alter table fiscal_document_merge_history
  add constraint fiscal_document_merge_history_xml_import_job_id_fkey
  foreign key (xml_import_job_id) references xml_import_jobs(id);
