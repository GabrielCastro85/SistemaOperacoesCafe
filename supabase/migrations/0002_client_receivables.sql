-- ============================================================================
-- Modulo "Contas a receber por nota fiscal" -- valor TOTAL da nota (nao valor
-- de servico por saca), pagamento parcial ou a vista, agrupado por empresa/
-- CNPJ emissor. Espelha o padrao ja maduro de accounts_payable/
-- payable_installment_groups/payable_payments/payable_payment_allocations
-- (SQLite local, electron/main/database/migrations.ts:1289-1433) -- ver
-- justificativa no plano (parcelamento com vencimento por parcela precisa do
-- modelo de installment groups, nao do modelo de agregacao por periodo que
-- client_charges usa).
-- ============================================================================

create table client_receivable_installment_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  fiscal_document_id uuid not null references fiscal_documents(id),
  customer_partner_id uuid not null references business_partners(id),
  total_amount_cents bigint not null,
  installment_count integer not null,
  first_due_date text not null,
  interval_type text not null check (interval_type in ('MONTHLY','DAYS_30','CUSTOM')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at text,
  cancellation_reason text
);
create index idx_client_receivable_installment_groups_organization_id on client_receivable_installment_groups(organization_id);
create index idx_client_receivable_installment_groups_own_legal_entity_id on client_receivable_installment_groups(own_legal_entity_id);
create index idx_client_receivable_installment_groups_fiscal_document_id on client_receivable_installment_groups(fiscal_document_id);
create index idx_client_receivable_installment_groups_customer_partner_id on client_receivable_installment_groups(customer_partner_id);

-- 1 linha = 1 parcela (ou 1 linha unica se for "a vista", installment_count=1).
create table client_receivables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  fiscal_document_id uuid not null references fiscal_documents(id),
  customer_partner_id uuid not null references business_partners(id),
  customer_legal_entity_id uuid references partner_legal_entities(id),
  installment_group_id uuid references client_receivable_installment_groups(id),
  installment_number integer not null default 1,
  installment_count integer not null default 1,
  -- snapshot do valor no momento da criacao (nao vaza se a nota for editada depois)
  original_amount_cents bigint not null,
  discount_cents bigint not null default 0,
  interest_cents bigint not null default 0,
  penalty_cents bigint not null default 0,
  other_additions_cents bigint not null default 0,
  final_amount_cents bigint not null default 0,
  paid_amount_cents bigint not null default 0,
  open_amount_cents bigint not null default 0,
  issue_date text not null,
  due_date text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','OPEN','PARTIALLY_PAID','PAID','OVERDUE','CONTESTED','CANCELLED')),
  notes text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at text,
  cancellation_reason text,
  contested_at text,
  contest_reason text,
  unique (fiscal_document_id, installment_number)
);
create index idx_client_receivables_organization_id on client_receivables(organization_id);
create index idx_client_receivables_own_legal_entity_id on client_receivables(own_legal_entity_id);
create index idx_client_receivables_fiscal_document_id on client_receivables(fiscal_document_id);
create index idx_client_receivables_customer_partner_id on client_receivables(customer_partner_id);
create index idx_client_receivables_installment_group_id on client_receivables(installment_group_id);
create index idx_client_receivables_status on client_receivables(status);
create index idx_client_receivables_due_date on client_receivables(due_date);

-- Pagamento avulso, desvinculado de um recebivel especifico no momento do
-- registro -- mesmo padrao de client_payments/payable_payments. A alocacao
-- (tabela abaixo) e' quem liga pagamento a recebivel, com validacao dupla de
-- saldo (feita na RPC allocateReceivablePayment, migration 0004).
create table client_receivable_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  customer_partner_id uuid not null references business_partners(id),
  payment_date text not null,
  amount_cents bigint not null,
  payment_method text not null check (payment_method in ('PIX','BANK_TRANSFER','BOLETO','CASH','CHECK','CARD','OFFSET','OTHER')),
  bank_account_description text,
  transaction_reference text,
  payer_name_snapshot text,
  notes text,
  attachment_path text,
  attachment_hash text,
  status text not null default 'CONFIRMED' check (status in ('CONFIRMED','CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at text,
  cancellation_reason text
);
create index idx_client_receivable_payments_organization_id on client_receivable_payments(organization_id);
create index idx_client_receivable_payments_own_legal_entity_id on client_receivable_payments(own_legal_entity_id);
create index idx_client_receivable_payments_customer_partner_id on client_receivable_payments(customer_partner_id);
create index idx_client_receivable_payments_payment_date on client_receivable_payments(payment_date);
create index idx_client_receivable_payments_status on client_receivable_payments(status);

create table client_receivable_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  client_receivable_payment_id uuid not null references client_receivable_payments(id),
  client_receivable_id uuid not null references client_receivables(id),
  amount_cents bigint not null,
  allocated_at timestamptz not null default now(),
  cancelled_at text,
  cancellation_reason text
);
create index idx_client_receivable_payment_allocations_payment_id on client_receivable_payment_allocations(client_receivable_payment_id);
create index idx_client_receivable_payment_allocations_receivable_id on client_receivable_payment_allocations(client_receivable_id);

create table client_receivable_status_history (
  id uuid primary key default gen_random_uuid(),
  client_receivable_id uuid not null references client_receivables(id),
  previous_status text,
  new_status text not null,
  reason text,
  changed_by_user_id uuid references app_users(id),
  changed_at timestamptz not null default now()
);
create index idx_client_receivable_status_history_receivable_id on client_receivable_status_history(client_receivable_id);
