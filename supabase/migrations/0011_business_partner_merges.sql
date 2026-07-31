-- ============================================================================
-- Registro auditavel de fusoes de cadastros de parceiro duplicados (mesmo
-- CNPJ, ids diferentes). Espelha a migration SQLite 029. Sincroniza como
-- qualquer outra tabela de referencia -- ao baixar uma linha nova aqui, cada
-- PC aplica a mesma fusao localmente (redireciona FKs pro id canonico e
-- remove o duplicado), o que autocorrige os PCs que ainda nao rodaram a
-- limpeza manual, sem precisar de intervencao em cada maquina.
-- ============================================================================

create table business_partner_merges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  duplicate_partner_id uuid not null,
  canonical_partner_id uuid not null,
  matched_cnpj text,
  reason text,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index idx_business_partner_merges_duplicate_unique on business_partner_merges(duplicate_partner_id);
create index idx_business_partner_merges_canonical_id on business_partner_merges(canonical_partner_id);
create index idx_business_partner_merges_organization_id on business_partner_merges(organization_id);

alter table business_partner_merges enable row level security;
create policy business_partner_merges_select on business_partner_merges for select
  using (user_has_org_access(organization_id));
create policy business_partner_merges_write on business_partner_merges for all
  using (user_has_permission('commercial.manage', organization_id))
  with check (user_has_permission('commercial.manage', organization_id));
