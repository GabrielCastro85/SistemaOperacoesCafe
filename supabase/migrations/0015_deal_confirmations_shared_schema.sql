-- Modulo de Confirmacoes de negocio nunca tinha sido ligado a sincronizacao
-- (nenhuma tabela deal_confirmation* existia no Postgres) -- uma confirmacao
-- feita num PC nao aparecia em nenhum outro. Espelha exatamente o schema
-- local (electron/main/database/migrations.ts, migrations 011 e 015),
-- seguindo as mesmas convencoes ja usadas no resto do arquivo: id uuid,
-- INTEGER CHECK(0,1) vira boolean, datas de negocio ficam como text (igual
-- fiscal_documents.issue_date), created_at/updated_at viram timestamptz,
-- valores em centavos viram bigint, campos *_decimal ficam como text.

begin;

create table deal_confirmation_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid references legal_entities(id),
  name text not null,
  description text,
  version integer not null,
  title text not null,
  subtitle text,
  layout_mode text not null check (layout_mode in ('STANDARD','COMPACT','DETAILED')),
  default_payment_terms text,
  default_delivery_terms text,
  default_quality_terms text,
  default_general_terms text,
  show_broker boolean not null,
  show_commercial_values boolean not null,
  show_item_origins boolean not null,
  show_signature_blocks boolean not null,
  signature_block_count integer not null,
  is_default boolean not null,
  is_active boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_deal_confirmation_templates_organization_id on deal_confirmation_templates(organization_id);

create table deal_clause_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  title text,
  clause_text text not null,
  category text not null check (category in ('PAYMENT','DELIVERY','QUALITY','RESPONSIBILITY','CANCELLATION','GENERAL','OTHER')),
  is_active boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_deal_clause_templates_organization_id on deal_clause_templates(organization_id);

create table deal_confirmations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  template_id uuid references deal_confirmation_templates(id),
  confirmation_number text,
  temporary_reference text not null,
  confirmation_date text not null,
  negotiation_date text,
  status text not null check (status in ('DRAFT','PENDING_REVIEW','ISSUED','SENT_FOR_SIGNATURE','SIGNED','CANCELLED','REPLACED')),
  signature_status text not null check (signature_status in ('NOT_APPLICABLE','NOT_SENT','WAITING_SIGNATURE','PARTIALLY_SIGNED','SIGNED','REJECTED')),
  currency_code text not null,
  total_quantity_sacks_decimal text not null,
  total_commercial_amount_cents bigint not null,
  delivery_location_snapshot text,
  delivery_start_date text,
  delivery_end_date text,
  payment_terms_snapshot text,
  quality_terms_snapshot text,
  general_terms_snapshot text,
  public_notes text,
  internal_notes text,
  template_snapshot_json text,
  pending_issues_json text not null default '[]',
  issued_document_version_id uuid,
  signed_document_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at text,
  sent_for_signature_at text,
  signed_at text,
  cancelled_at text,
  cancellation_reason text,
  replaced_by_confirmation_id uuid references deal_confirmations(id),
  brokerage_percentage_basis_points integer,
  bank_name text,
  bank_code text,
  bank_agency text,
  bank_account text,
  pix_key text
);
create index idx_deal_confirmations_organization_id on deal_confirmations(organization_id);
create index idx_deal_confirmations_own_legal_entity_id on deal_confirmations(own_legal_entity_id);
create index idx_deal_confirmations_status on deal_confirmations(status);
create unique index idx_deal_confirmations_number_unique on deal_confirmations(organization_id, own_legal_entity_id, confirmation_number) where confirmation_number is not null;

create table deal_confirmation_parties (
  id uuid primary key default gen_random_uuid(),
  deal_confirmation_id uuid not null references deal_confirmations(id),
  party_role text not null check (party_role in ('ISSUER','BROKER','SELLER','BUYER','DELIVERY_RECIPIENT','OTHER')),
  business_partner_id uuid references business_partners(id),
  partner_legal_entity_id uuid references partner_legal_entities(id),
  own_legal_entity_id uuid references legal_entities(id),
  manual_name text,
  snapshot_json text not null,
  representative_name text,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_deal_confirmation_parties_deal_id on deal_confirmation_parties(deal_confirmation_id);

create table deal_confirmation_items (
  id uuid primary key default gen_random_uuid(),
  deal_confirmation_id uuid not null references deal_confirmations(id),
  sort_order integer not null,
  product_id uuid references products(id),
  product_name_snapshot text not null,
  product_description_snapshot text,
  crop_snapshot text,
  quality_snapshot text,
  packaging_snapshot text,
  origin_snapshot text,
  destination_snapshot text,
  quantity_sacks_decimal text not null,
  sack_weight_kg_decimal text not null,
  total_weight_kg_decimal text,
  unit_price_decimal text not null,
  calculated_total_amount_cents bigint not null,
  total_amount_cents bigint not null,
  total_was_manually_overridden boolean not null,
  total_override_reason text,
  delivery_start_date text,
  delivery_end_date text,
  delivery_location_snapshot text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_deal_confirmation_items_deal_id on deal_confirmation_items(deal_confirmation_id);

create table deal_confirmation_operations (
  id uuid primary key default gen_random_uuid(),
  deal_confirmation_id uuid not null references deal_confirmations(id),
  operation_id uuid not null references operations(id),
  created_at timestamptz not null default now(),
  unique (deal_confirmation_id, operation_id)
);
create index idx_deal_confirmation_operations_deal_id on deal_confirmation_operations(deal_confirmation_id);

create table deal_confirmation_fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  deal_confirmation_id uuid not null references deal_confirmations(id),
  fiscal_document_id uuid not null references fiscal_documents(id),
  created_at timestamptz not null default now(),
  unique (deal_confirmation_id, fiscal_document_id)
);
create index idx_deal_confirmation_fiscal_documents_deal_id on deal_confirmation_fiscal_documents(deal_confirmation_id);

create table deal_confirmation_clauses (
  id uuid primary key default gen_random_uuid(),
  deal_confirmation_id uuid not null references deal_confirmations(id),
  clause_number text,
  title text,
  clause_text text not null,
  sort_order integer not null,
  is_visible boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_deal_confirmation_clauses_deal_id on deal_confirmation_clauses(deal_confirmation_id);

create table deal_payment_terms (
  id uuid primary key default gen_random_uuid(),
  deal_confirmation_id uuid not null references deal_confirmations(id),
  sort_order integer not null,
  description text not null,
  percentage_basis_points integer,
  amount_cents bigint,
  due_date text,
  days_after_event integer,
  event_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_deal_payment_terms_deal_id on deal_payment_terms(deal_confirmation_id);

create table deal_confirmation_signers (
  id uuid primary key default gen_random_uuid(),
  deal_confirmation_id uuid not null references deal_confirmations(id),
  party_role text not null check (party_role in ('ISSUER','BROKER','SELLER','BUYER','WITNESS','OTHER')),
  name text not null,
  document_number text,
  position_title text,
  email text,
  phone text,
  signature_order integer not null,
  signature_status text not null check (signature_status in ('PENDING','SIGNED_EXTERNALLY','REJECTED','NOT_REQUIRED')),
  signed_at text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_deal_confirmation_signers_deal_id on deal_confirmation_signers(deal_confirmation_id);

create table deal_confirmation_document_versions (
  id uuid primary key default gen_random_uuid(),
  deal_confirmation_id uuid not null references deal_confirmations(id),
  version_number integer not null,
  document_type text not null check (document_type in ('GENERATED_DRAFT','ISSUED_ORIGINAL','SIGNED_EXTERNAL','SUPPORTING_DOCUMENT','CANCELLED_COPY','REPLACEMENT_COPY')),
  original_file_name text not null,
  stored_file_path text not null,
  mime_type text not null,
  file_size integer not null,
  file_hash text not null,
  generated_by_system boolean not null,
  is_current boolean not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (deal_confirmation_id, version_number)
);
create index idx_deal_confirmation_documents_deal_id on deal_confirmation_document_versions(deal_confirmation_id);

create table deal_confirmation_status_history (
  id uuid primary key default gen_random_uuid(),
  deal_confirmation_id uuid not null references deal_confirmations(id),
  previous_status text,
  new_status text not null,
  reason text,
  changed_by_user_id uuid,
  changed_at timestamptz not null default now()
);
create index idx_deal_confirmation_status_history_deal_id on deal_confirmation_status_history(deal_confirmation_id);

-- RLS: mesmo padrao ja usado em client_charges/client_charge_operations
-- (supabase/migrations/0004_rls_policies.sql) -- tabela-mae usa
-- user_has_org_access direto, tabelas-filhas resolvem o escopo via EXISTS
-- ate' deal_confirmations. confirmations.manage e' a permissao que ja existe
-- e ja esta' nas roles role-ops-manager e role-employee-operacional.

alter table deal_confirmation_templates enable row level security;
create policy deal_confirmation_templates_select on deal_confirmation_templates for select
  using (user_has_org_access(organization_id));
create policy deal_confirmation_templates_write on deal_confirmation_templates for all
  using (user_has_permission('confirmations.manage', organization_id))
  with check (user_has_permission('confirmations.manage', organization_id));

alter table deal_clause_templates enable row level security;
create policy deal_clause_templates_select on deal_clause_templates for select
  using (user_has_org_access(organization_id));
create policy deal_clause_templates_write on deal_clause_templates for all
  using (user_has_permission('confirmations.manage', organization_id))
  with check (user_has_permission('confirmations.manage', organization_id));

alter table deal_confirmations enable row level security;
create policy deal_confirmations_select on deal_confirmations for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy deal_confirmations_write on deal_confirmations for all
  using (user_has_permission('confirmations.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('confirmations.manage', organization_id, own_legal_entity_id));

create policy deal_confirmation_parties_select on deal_confirmation_parties for select
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_org_access(dc.organization_id, dc.own_legal_entity_id)));
create policy deal_confirmation_parties_write on deal_confirmation_parties for all
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)))
  with check (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)));
alter table deal_confirmation_parties enable row level security;

create policy deal_confirmation_items_select on deal_confirmation_items for select
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_org_access(dc.organization_id, dc.own_legal_entity_id)));
create policy deal_confirmation_items_write on deal_confirmation_items for all
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)))
  with check (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)));
alter table deal_confirmation_items enable row level security;

create policy deal_confirmation_operations_select on deal_confirmation_operations for select
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_org_access(dc.organization_id, dc.own_legal_entity_id)));
create policy deal_confirmation_operations_write on deal_confirmation_operations for all
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)))
  with check (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)));
alter table deal_confirmation_operations enable row level security;

create policy deal_confirmation_fiscal_documents_select on deal_confirmation_fiscal_documents for select
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_org_access(dc.organization_id, dc.own_legal_entity_id)));
create policy deal_confirmation_fiscal_documents_write on deal_confirmation_fiscal_documents for all
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)))
  with check (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)));
alter table deal_confirmation_fiscal_documents enable row level security;

create policy deal_confirmation_clauses_select on deal_confirmation_clauses for select
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_org_access(dc.organization_id, dc.own_legal_entity_id)));
create policy deal_confirmation_clauses_write on deal_confirmation_clauses for all
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)))
  with check (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)));
alter table deal_confirmation_clauses enable row level security;

create policy deal_payment_terms_select on deal_payment_terms for select
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_org_access(dc.organization_id, dc.own_legal_entity_id)));
create policy deal_payment_terms_write on deal_payment_terms for all
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)))
  with check (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)));
alter table deal_payment_terms enable row level security;

create policy deal_confirmation_signers_select on deal_confirmation_signers for select
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_org_access(dc.organization_id, dc.own_legal_entity_id)));
create policy deal_confirmation_signers_write on deal_confirmation_signers for all
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)))
  with check (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)));
alter table deal_confirmation_signers enable row level security;

create policy deal_confirmation_document_versions_select on deal_confirmation_document_versions for select
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_org_access(dc.organization_id, dc.own_legal_entity_id)));
create policy deal_confirmation_document_versions_write on deal_confirmation_document_versions for all
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)))
  with check (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)));
alter table deal_confirmation_document_versions enable row level security;

create policy deal_confirmation_status_history_select on deal_confirmation_status_history for select
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_org_access(dc.organization_id, dc.own_legal_entity_id)));
create policy deal_confirmation_status_history_write on deal_confirmation_status_history for all
  using (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)))
  with check (exists (select 1 from deal_confirmations dc where dc.id = deal_confirmation_id and user_has_permission('confirmations.manage', dc.organization_id, dc.own_legal_entity_id)));
alter table deal_confirmation_status_history enable row level security;

commit;
