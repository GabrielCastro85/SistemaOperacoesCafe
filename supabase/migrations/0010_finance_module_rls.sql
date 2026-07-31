-- ============================================================================
-- RLS do modulo financeiro (migration 0009). Leitura exige so' pertencer a
-- organizacao/CNPJ (user_has_org_access), escrita exige finance.manage --
-- permissao que ja existe no seed de roles (migration 0005) mas nunca tinha
-- sido referenciada em nenhuma policy ate agora. purchase_rate_rules segue o
-- padrao de service_rate_rules (commercial.manage), nao finance.manage --
-- e' cadastro de preco por fornecedor, mesma natureza de service_rate_rules.
-- ============================================================================

alter table purchase_rate_rules enable row level security;
create policy purchase_rate_rules_select on purchase_rate_rules for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy purchase_rate_rules_write on purchase_rate_rules for all
  using (user_has_permission('commercial.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('commercial.manage', organization_id, own_legal_entity_id));

alter table expense_categories enable row level security;
create policy expense_categories_select on expense_categories for select
  using (user_has_org_access(organization_id));
create policy expense_categories_write on expense_categories for all
  using (user_has_permission('finance.manage', organization_id))
  with check (user_has_permission('finance.manage', organization_id));

alter table accounts_payable enable row level security;
create policy accounts_payable_select on accounts_payable for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy accounts_payable_write on accounts_payable for all
  using (user_has_permission('finance.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('finance.manage', organization_id, own_legal_entity_id));

alter table account_payable_operations enable row level security;
create policy account_payable_operations_select on account_payable_operations for select
  using (exists (select 1 from accounts_payable ap where ap.id = account_payable_id and user_has_org_access(ap.organization_id, ap.own_legal_entity_id)));
create policy account_payable_operations_write on account_payable_operations for all
  using (exists (select 1 from accounts_payable ap where ap.id = account_payable_id and user_has_permission('finance.manage', ap.organization_id, ap.own_legal_entity_id)))
  with check (exists (select 1 from accounts_payable ap where ap.id = account_payable_id and user_has_permission('finance.manage', ap.organization_id, ap.own_legal_entity_id)));

alter table payable_payments enable row level security;
create policy payable_payments_select on payable_payments for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy payable_payments_write on payable_payments for all
  using (user_has_permission('finance.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('finance.manage', organization_id, own_legal_entity_id));

alter table payable_payment_allocations enable row level security;
create policy payable_payment_allocations_select on payable_payment_allocations for select
  using (exists (select 1 from accounts_payable ap where ap.id = account_payable_id and user_has_org_access(ap.organization_id, ap.own_legal_entity_id)));
create policy payable_payment_allocations_write on payable_payment_allocations for all
  using (exists (select 1 from accounts_payable ap where ap.id = account_payable_id and user_has_permission('finance.manage', ap.organization_id, ap.own_legal_entity_id)))
  with check (exists (select 1 from accounts_payable ap where ap.id = account_payable_id and user_has_permission('finance.manage', ap.organization_id, ap.own_legal_entity_id)));

alter table payable_status_history enable row level security;
create policy payable_status_history_select on payable_status_history for select
  using (exists (select 1 from accounts_payable ap where ap.id = account_payable_id and user_has_org_access(ap.organization_id, ap.own_legal_entity_id)));
create policy payable_status_history_insert on payable_status_history for insert
  with check (exists (select 1 from accounts_payable ap where ap.id = account_payable_id and user_has_permission('finance.manage', ap.organization_id, ap.own_legal_entity_id)));
-- sem policy de update/delete: historico de status e' append-only (mesmo padrao de charge_status_history).

alter table payable_document_attachments enable row level security;
create policy payable_document_attachments_select on payable_document_attachments for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy payable_document_attachments_write on payable_document_attachments for all
  using (user_has_permission('finance.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('finance.manage', organization_id, own_legal_entity_id));
