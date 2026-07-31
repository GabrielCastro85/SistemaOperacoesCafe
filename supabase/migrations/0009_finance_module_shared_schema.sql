-- ============================================================================
-- Modulo financeiro (Contas a Pagar) -- hoje 100% local por PC, nunca existiu
-- no Postgres. Entra em sincronizacao porque o PC fiscal (que importa XML de
-- compra) e o PC financeiro (que confirma/paga) precisam ver os mesmos dados.
-- Traducao 1:1 do schema SQLite (electron/main/database/migrations.ts,
-- migrations "009_accounts_payable"/"010_financial_attachments_reports"), mas
-- com escopo reduzido: cost_centers, financial_accounts,
-- payable_recurring_templates, payable_installment_groups e
-- account_payable_allocations ficam FORA por enquanto (continuam so' locais).
-- As colunas que referenciam essas tabelas viram uuid solto (sem FK) --
-- resolvem so' no PC que criou o registro, e o fluxo novo de acerto por
-- fornecedor sempre deixa esses campos nulos (ver plano).
--
-- Junto entra purchase_rate_rules (preco por saca que PAGAMOS ao fornecedor,
-- irma de service_rate_rules que ja existe) e as 3 colunas novas em
-- operations que fecham o ciclo de vida do acerto (purchase_settlement_status/
-- account_payable_id/purchase_rate_rule_id), espelhando billing_status/
-- client_charge_id/service_rate_rule_id que ja existem pro lado de cobranca.
-- ============================================================================

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  parent_category_id uuid references expense_categories(id),
  name text not null,
  code text,
  expense_nature text not null check (expense_nature in ('FIXED','VARIABLE','TAX','PERSONNEL','FINANCIAL','INVESTMENT','OTHER')),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_expense_categories_organization_id on expense_categories(organization_id);
create index idx_expense_categories_parent_category_id on expense_categories(parent_category_id);
create index idx_expense_categories_is_active on expense_categories(is_active);
create unique index idx_expense_categories_code_unique on expense_categories(organization_id, code) where code is not null;

create table purchase_rate_rules (
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
create index idx_purchase_rate_rules_business_partner_id on purchase_rate_rules(business_partner_id);
create index idx_purchase_rate_rules_organization_id on purchase_rate_rules(organization_id);
create index idx_purchase_rate_rules_own_legal_entity_id on purchase_rate_rules(own_legal_entity_id);
create index idx_purchase_rate_rules_counterparty_partner_legal_entity_id on purchase_rate_rules(counterparty_partner_legal_entity_id);
create index idx_purchase_rate_rules_product_id on purchase_rate_rules(product_id);
create index idx_purchase_rate_rules_effective_from on purchase_rate_rules(effective_from);
create index idx_purchase_rate_rules_effective_to on purchase_rate_rules(effective_to);
create index idx_purchase_rate_rules_is_active on purchase_rate_rules(is_active);

create table accounts_payable (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  supplier_partner_id uuid references business_partners(id),
  supplier_legal_entity_id uuid references partner_legal_entities(id),
  payee_name_snapshot text not null,
  payee_tax_id_snapshot text,
  category_id uuid not null references expense_categories(id),
  -- cost_centers/locations/payable_recurring_templates/payable_installment_groups
  -- fora do escopo desta leva (locations e' core mas o fluxo novo de acerto
  -- por fornecedor sempre deixa nulo) -- uuid solto, sem FK, ver cabecalho.
  default_cost_center_id uuid,
  default_location_id uuid references locations(id),
  recurring_template_id uuid,
  installment_group_id uuid,
  installment_number integer,
  installment_count integer,
  source text not null check (source in ('MANUAL','RECURRING','INSTALLMENT','IMPORT')),
  description text not null,
  document_type text,
  document_number text,
  competence_date text not null,
  issue_date text,
  due_date text not null,
  original_amount_cents bigint,
  discount_cents bigint not null default 0,
  interest_cents bigint not null default 0,
  penalty_cents bigint not null default 0,
  other_additions_cents bigint not null default 0,
  final_amount_cents bigint,
  paid_amount_cents bigint not null default 0,
  open_amount_cents bigint,
  amount_status text not null check (amount_status in ('PENDING','ESTIMATED','CONFIRMED')),
  status text not null check (status in ('DRAFT','SCHEDULED','OPEN','PARTIALLY_PAID','PAID','OVERDUE','CONTESTED','CANCELLED')),
  notes text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at text,
  cancelled_at text,
  cancellation_reason text,
  contested_at text,
  contest_reason text
);
create index idx_accounts_payable_organization_id on accounts_payable(organization_id);
create index idx_accounts_payable_own_legal_entity_id on accounts_payable(own_legal_entity_id);
create index idx_accounts_payable_supplier_partner_id on accounts_payable(supplier_partner_id);
create index idx_accounts_payable_category_id on accounts_payable(category_id);
create index idx_accounts_payable_default_location_id on accounts_payable(default_location_id);
create index idx_accounts_payable_competence_date on accounts_payable(competence_date);
create index idx_accounts_payable_due_date on accounts_payable(due_date);
create index idx_accounts_payable_status on accounts_payable(status);
create index idx_accounts_payable_source on accounts_payable(source);
create unique index idx_accounts_payable_installment_unique on accounts_payable(installment_group_id, installment_number) where installment_group_id is not null and installment_number is not null;

create table account_payable_operations (
  id uuid primary key default gen_random_uuid(),
  account_payable_id uuid not null references accounts_payable(id),
  operation_id uuid not null references operations(id),
  own_legal_entity_id_snapshot uuid,
  own_legal_entity_name_snapshot text,
  supplier_partner_id_snapshot uuid,
  operation_date_snapshot text not null,
  fiscal_document_number_snapshot text,
  fiscal_document_series_snapshot text,
  product_name_snapshot text,
  operation_scope_snapshot text not null check (operation_scope_snapshot in ('INTERNAL','EXTERNAL')),
  quantity_sacks_decimal_snapshot text not null,
  purchase_rate_cents_snapshot bigint not null,
  purchase_amount_cents_snapshot bigint not null,
  released_at text,
  created_at timestamptz not null default now()
);
create index idx_account_payable_operations_payable_id on account_payable_operations(account_payable_id);
create index idx_account_payable_operations_operation_id on account_payable_operations(operation_id);
create unique index idx_account_payable_operations_active_unique on account_payable_operations(operation_id) where released_at is null;

create table payable_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  -- financial_accounts fora do escopo desta leva -- uuid solto, sem FK.
  financial_account_id uuid,
  payment_date text not null,
  amount_cents bigint not null,
  payment_method text not null check (payment_method in ('PIX','BANK_TRANSFER','BOLETO','CASH','CHECK','CARD','DIRECT_DEBIT','OFFSET','OTHER')),
  transaction_reference text,
  payee_name_snapshot text not null,
  notes text,
  attachment_path text,
  attachment_hash text,
  status text not null check (status in ('CONFIRMED','CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at text,
  cancellation_reason text
);
create index idx_payable_payments_organization_id on payable_payments(organization_id);
create index idx_payable_payments_own_legal_entity_id on payable_payments(own_legal_entity_id);
create index idx_payable_payments_payment_date on payable_payments(payment_date);
create index idx_payable_payments_status on payable_payments(status);

create table payable_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payable_payment_id uuid not null references payable_payments(id),
  account_payable_id uuid not null references accounts_payable(id),
  amount_cents bigint not null,
  allocated_at timestamptz not null default now(),
  cancelled_at text,
  cancellation_reason text
);
create index idx_payable_payment_allocations_payment_id on payable_payment_allocations(payable_payment_id);
create index idx_payable_payment_allocations_payable_id on payable_payment_allocations(account_payable_id);

create table payable_status_history (
  id uuid primary key default gen_random_uuid(),
  account_payable_id uuid not null references accounts_payable(id),
  previous_status text,
  new_status text not null,
  reason text,
  changed_by_user_id uuid references app_users(id),
  changed_at timestamptz not null default now()
);
create index idx_payable_status_history_payable_id on payable_status_history(account_payable_id);

create table payable_document_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  account_payable_id uuid references accounts_payable(id),
  payable_payment_id uuid references payable_payments(id),
  attachment_kind text not null check (attachment_kind in ('PAYABLE_DOCUMENT','PAYMENT_PROOF','OTHER')),
  attachment_type text not null default 'OTHER' check (attachment_type in ('INVOICE','BILL','CONTRACT','RECEIPT','SUPPORTING_DOCUMENT','OTHER')),
  original_file_name text not null,
  stored_file_path text not null,
  file_hash text not null,
  mime_type text not null,
  file_extension text not null default '',
  file_size bigint not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at text,
  removal_reason text
);
create index idx_payable_document_attachments_payable_id on payable_document_attachments(account_payable_id);
create index idx_payable_document_attachments_payment_id on payable_document_attachments(payable_payment_id);
create index idx_payable_document_attachments_organization_id on payable_document_attachments(organization_id);
create index idx_payable_document_attachments_removed_at on payable_document_attachments(removed_at);

-- ---------------------------------------------------------------------------
-- operations: 3 colunas novas que fecham o ciclo de vida do acerto de compra,
-- espelhando billing_status/client_charge_id/service_rate_rule_id que ja
-- existem pro lado de cobranca (client_charges). purchase_rate_rule_id e'
-- coluna propria (nao reaproveita service_rate_rule_id, que tem FK real pra
-- service_rate_rules) -- mesma razao documentada na migration SQLite 027.
-- ---------------------------------------------------------------------------

alter table operations add column purchase_settlement_status text not null default 'UNSETTLED' check (purchase_settlement_status in ('UNSETTLED','RESERVED','SETTLED'));
alter table operations add column account_payable_id uuid references accounts_payable(id);
alter table operations add column purchase_rate_rule_id uuid references purchase_rate_rules(id);
create index idx_operations_purchase_settlement_status on operations(purchase_settlement_status);
create index idx_operations_account_payable_id on operations(account_payable_id);
create index idx_operations_purchase_rate_rule_id on operations(purchase_rate_rule_id);
