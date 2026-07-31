-- ============================================================================
-- RLS -- autoridade real de acesso, nao so' checagem no processo main (ver
-- justificativa no plano: com 4 processos Electron independentes falando com
-- o Postgres, um unico processo main confiavel deixa de ser suficiente).
--
-- Catalogo de permissoes usado aqui e' o REAL, extraido do banco SQLite atual
-- (roles/permissions/role_permissions ja seedados la), nao inventado: 5 roles
-- (SYSTEM_ADMIN global, FINANCE_MANAGER/OPERATIONS_MANAGER por organizacao,
-- OPERATOR/VIEWER por CNPJ) e 29 permissoes reais (billing.manage,
-- commercial.manage/view, operations.manage/view, imports.manage, users.*,
-- roles.*, audit.view, etc). A seed desses dados em si vai na migration 0005.
--
-- Leitura das tabelas de negocio: exige so' pertencer a organizacao (ver
-- user_has_org_access, migration 0003) -- ninguem de fora da empresa nunca
-- teria vinculo nenhum de qualquer forma, entao isso ja e' seguro. Escrita
-- exige a permissao especifica do modulo (user_has_permission).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- organizations / legal_entities / locations
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
create policy organizations_select on organizations for select
  using (user_has_org_access(id));
create policy organizations_write on organizations for all
  using (user_has_permission('settings.manage', id))
  with check (user_has_permission('settings.manage', id));

alter table legal_entities enable row level security;
create policy legal_entities_select on legal_entities for select
  using (user_has_org_access(organization_id, id));
create policy legal_entities_write on legal_entities for all
  using (user_has_permission('settings.manage', organization_id, id))
  with check (user_has_permission('settings.manage', organization_id, id));

alter table locations enable row level security;
create policy locations_select on locations for select
  using (user_has_org_access(organization_id, legal_entity_id));
create policy locations_write on locations for all
  using (user_has_permission('settings.manage', organization_id, legal_entity_id))
  with check (user_has_permission('settings.manage', organization_id, legal_entity_id));

-- ---------------------------------------------------------------------------
-- business_partners e derivadas / products / service_rate_rules
-- ---------------------------------------------------------------------------

alter table business_partners enable row level security;
create policy business_partners_select on business_partners for select
  using (user_has_org_access(organization_id));
create policy business_partners_write on business_partners for all
  using (user_has_permission('commercial.manage', organization_id))
  with check (user_has_permission('commercial.manage', organization_id));

alter table business_partner_roles enable row level security;
create policy business_partner_roles_select on business_partner_roles for select
  using (exists (select 1 from business_partners bp where bp.id = business_partner_id and user_has_org_access(bp.organization_id)));
create policy business_partner_roles_write on business_partner_roles for all
  using (exists (select 1 from business_partners bp where bp.id = business_partner_id and user_has_permission('commercial.manage', bp.organization_id)))
  with check (exists (select 1 from business_partners bp where bp.id = business_partner_id and user_has_permission('commercial.manage', bp.organization_id)));

alter table partner_legal_entities enable row level security;
create policy partner_legal_entities_select on partner_legal_entities for select
  using (exists (select 1 from business_partners bp where bp.id = business_partner_id and user_has_org_access(bp.organization_id)));
create policy partner_legal_entities_write on partner_legal_entities for all
  using (exists (select 1 from business_partners bp where bp.id = business_partner_id and user_has_permission('commercial.manage', bp.organization_id)))
  with check (exists (select 1 from business_partners bp where bp.id = business_partner_id and user_has_permission('commercial.manage', bp.organization_id)));

alter table partner_contacts enable row level security;
create policy partner_contacts_select on partner_contacts for select
  using (exists (select 1 from business_partners bp where bp.id = business_partner_id and user_has_org_access(bp.organization_id)));
create policy partner_contacts_write on partner_contacts for all
  using (exists (select 1 from business_partners bp where bp.id = business_partner_id and user_has_permission('commercial.manage', bp.organization_id)))
  with check (exists (select 1 from business_partners bp where bp.id = business_partner_id and user_has_permission('commercial.manage', bp.organization_id)));

alter table products enable row level security;
create policy products_select on products for select
  using (user_has_org_access(organization_id));
create policy products_write on products for all
  using (user_has_permission('commercial.manage', organization_id))
  with check (user_has_permission('commercial.manage', organization_id));

alter table client_billing_profiles enable row level security;
create policy client_billing_profiles_select on client_billing_profiles for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy client_billing_profiles_write on client_billing_profiles for all
  using (user_has_permission('billing.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('billing.manage', organization_id, own_legal_entity_id));

alter table service_rate_rules enable row level security;
create policy service_rate_rules_select on service_rate_rules for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy service_rate_rules_write on service_rate_rules for all
  using (user_has_permission('commercial.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('commercial.manage', organization_id, own_legal_entity_id));

-- ---------------------------------------------------------------------------
-- fiscal_documents / operations / importacao de XML
-- ---------------------------------------------------------------------------

alter table fiscal_documents enable row level security;
create policy fiscal_documents_select on fiscal_documents for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy fiscal_documents_write on fiscal_documents for all
  using (user_has_permission('operations.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('operations.manage', organization_id, own_legal_entity_id));

alter table fiscal_document_items enable row level security;
create policy fiscal_document_items_select on fiscal_document_items for select
  using (exists (select 1 from fiscal_documents fd where fd.id = fiscal_document_id and user_has_org_access(fd.organization_id, fd.own_legal_entity_id)));
create policy fiscal_document_items_write on fiscal_document_items for all
  using (exists (select 1 from fiscal_documents fd where fd.id = fiscal_document_id and user_has_permission('operations.manage', fd.organization_id, fd.own_legal_entity_id)))
  with check (exists (select 1 from fiscal_documents fd where fd.id = fiscal_document_id and user_has_permission('operations.manage', fd.organization_id, fd.own_legal_entity_id)));

alter table fiscal_document_events enable row level security;
create policy fiscal_document_events_select on fiscal_document_events for select
  using (user_has_org_access(organization_id));
create policy fiscal_document_events_write on fiscal_document_events for all
  using (user_has_permission('imports.manage', organization_id))
  with check (user_has_permission('imports.manage', organization_id));

alter table fiscal_document_merge_history enable row level security;
create policy fiscal_document_merge_history_select on fiscal_document_merge_history for select
  using (user_has_org_access(organization_id));
create policy fiscal_document_merge_history_write on fiscal_document_merge_history for all
  using (user_has_permission('imports.manage', organization_id))
  with check (user_has_permission('imports.manage', organization_id));

alter table operations enable row level security;
create policy operations_select on operations for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy operations_write on operations for all
  using (user_has_permission('operations.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('operations.manage', organization_id, own_legal_entity_id));

alter table xml_import_jobs enable row level security;
create policy xml_import_jobs_select on xml_import_jobs for select
  using (user_has_org_access(organization_id));
create policy xml_import_jobs_write on xml_import_jobs for all
  using (user_has_permission('imports.manage', organization_id))
  with check (user_has_permission('imports.manage', organization_id));

alter table xml_import_files enable row level security;
create policy xml_import_files_select on xml_import_files for select
  using (exists (select 1 from xml_import_jobs j where j.id = import_job_id and user_has_org_access(j.organization_id)));
create policy xml_import_files_write on xml_import_files for all
  using (exists (select 1 from xml_import_jobs j where j.id = import_job_id and user_has_permission('imports.manage', j.organization_id)))
  with check (exists (select 1 from xml_import_jobs j where j.id = import_job_id and user_has_permission('imports.manage', j.organization_id)));

-- ---------------------------------------------------------------------------
-- Cobrancas existentes (client_charges e derivadas)
-- ---------------------------------------------------------------------------

alter table client_charges enable row level security;
create policy client_charges_select on client_charges for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy client_charges_write on client_charges for all
  using (user_has_permission('billing.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('billing.manage', organization_id, own_legal_entity_id));

alter table client_charge_operations enable row level security;
create policy client_charge_operations_select on client_charge_operations for select
  using (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_org_access(cc.organization_id, cc.own_legal_entity_id)));
create policy client_charge_operations_write on client_charge_operations for all
  using (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_permission('billing.manage', cc.organization_id, cc.own_legal_entity_id)))
  with check (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_permission('billing.manage', cc.organization_id, cc.own_legal_entity_id)));

alter table client_charge_adjustments enable row level security;
create policy client_charge_adjustments_select on client_charge_adjustments for select
  using (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_org_access(cc.organization_id, cc.own_legal_entity_id)));
create policy client_charge_adjustments_write on client_charge_adjustments for all
  using (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_permission('billing.manage', cc.organization_id, cc.own_legal_entity_id)))
  with check (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_permission('billing.manage', cc.organization_id, cc.own_legal_entity_id)));

alter table client_ledger_entries enable row level security;
create policy client_ledger_entries_select on client_ledger_entries for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy client_ledger_entries_write on client_ledger_entries for all
  using (user_has_permission('billing.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('billing.manage', organization_id, own_legal_entity_id));

alter table client_credit_allocations enable row level security;
create policy client_credit_allocations_select on client_credit_allocations for select
  using (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_org_access(cc.organization_id, cc.own_legal_entity_id)));
create policy client_credit_allocations_write on client_credit_allocations for all
  using (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_permission('billing.manage', cc.organization_id, cc.own_legal_entity_id)))
  with check (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_permission('billing.manage', cc.organization_id, cc.own_legal_entity_id)));

alter table client_payments enable row level security;
create policy client_payments_select on client_payments for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy client_payments_write on client_payments for all
  using (user_has_permission('billing.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('billing.manage', organization_id, own_legal_entity_id));

alter table client_payment_allocations enable row level security;
create policy client_payment_allocations_select on client_payment_allocations for select
  using (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_org_access(cc.organization_id, cc.own_legal_entity_id)));
create policy client_payment_allocations_write on client_payment_allocations for all
  using (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_permission('billing.manage', cc.organization_id, cc.own_legal_entity_id)))
  with check (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_permission('billing.manage', cc.organization_id, cc.own_legal_entity_id)));

alter table charge_document_versions enable row level security;
create policy charge_document_versions_select on charge_document_versions for select
  using (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_org_access(cc.organization_id, cc.own_legal_entity_id)));
create policy charge_document_versions_write on charge_document_versions for all
  using (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_permission('billing.manage', cc.organization_id, cc.own_legal_entity_id)))
  with check (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_permission('billing.manage', cc.organization_id, cc.own_legal_entity_id)));

alter table charge_status_history enable row level security;
create policy charge_status_history_select on charge_status_history for select
  using (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_org_access(cc.organization_id, cc.own_legal_entity_id)));
create policy charge_status_history_insert on charge_status_history for insert
  with check (exists (select 1 from client_charges cc where cc.id = client_charge_id and user_has_permission('billing.manage', cc.organization_id, cc.own_legal_entity_id)));
-- sem policy de update/delete: historico de status e' append-only.

alter table document_sequences enable row level security;
create policy document_sequences_select on document_sequences for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
-- sem policy de insert/update/delete: numero sequencial so' e' reservado via
-- RPC SECURITY DEFINER (migration 0005), nunca por escrita direta do cliente
-- (evita corrida entre PCs pulando/repetindo numero).

-- ---------------------------------------------------------------------------
-- Modulo novo: contas a receber por nota fiscal
-- ---------------------------------------------------------------------------

alter table client_receivable_installment_groups enable row level security;
create policy client_receivable_installment_groups_select on client_receivable_installment_groups for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy client_receivable_installment_groups_write on client_receivable_installment_groups for all
  using (user_has_permission('billing.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('billing.manage', organization_id, own_legal_entity_id));

alter table client_receivables enable row level security;
create policy client_receivables_select on client_receivables for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy client_receivables_write on client_receivables for all
  using (user_has_permission('billing.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('billing.manage', organization_id, own_legal_entity_id));

alter table client_receivable_payments enable row level security;
create policy client_receivable_payments_select on client_receivable_payments for select
  using (user_has_org_access(organization_id, own_legal_entity_id));
create policy client_receivable_payments_write on client_receivable_payments for all
  using (user_has_permission('billing.manage', organization_id, own_legal_entity_id))
  with check (user_has_permission('billing.manage', organization_id, own_legal_entity_id));

alter table client_receivable_payment_allocations enable row level security;
create policy client_receivable_payment_allocations_select on client_receivable_payment_allocations for select
  using (exists (select 1 from client_receivables cr where cr.id = client_receivable_id and user_has_org_access(cr.organization_id, cr.own_legal_entity_id)));
create policy client_receivable_payment_allocations_write on client_receivable_payment_allocations for all
  using (exists (select 1 from client_receivables cr where cr.id = client_receivable_id and user_has_permission('billing.manage', cr.organization_id, cr.own_legal_entity_id)))
  with check (exists (select 1 from client_receivables cr where cr.id = client_receivable_id and user_has_permission('billing.manage', cr.organization_id, cr.own_legal_entity_id)));

alter table client_receivable_status_history enable row level security;
create policy client_receivable_status_history_select on client_receivable_status_history for select
  using (exists (select 1 from client_receivables cr where cr.id = client_receivable_id and user_has_org_access(cr.organization_id, cr.own_legal_entity_id)));
create policy client_receivable_status_history_insert on client_receivable_status_history for insert
  with check (exists (select 1 from client_receivables cr where cr.id = client_receivable_id and user_has_permission('billing.manage', cr.organization_id, cr.own_legal_entity_id)));

-- ---------------------------------------------------------------------------
-- Usuarios / RBAC / auditoria / contexto ativo
-- ---------------------------------------------------------------------------

alter table app_users enable row level security;
create policy app_users_select_self on app_users for select
  using (id = auth.uid() or user_has_permission('users.view'));
create policy app_users_update_self on app_users for update
  using (id = auth.uid())
  with check (id = auth.uid());
create policy app_users_write_admin on app_users for all
  using (user_has_permission('users.manage'))
  with check (user_has_permission('users.manage'));

alter table local_sessions enable row level security;
create policy local_sessions_select on local_sessions for select
  using (user_id = auth.uid() or user_has_permission('users.view'));
create policy local_sessions_write on local_sessions for all
  using (user_id = auth.uid() or user_has_permission('users.manage'))
  with check (user_id = auth.uid() or user_has_permission('users.manage'));

-- roles/permissions/role_permissions: catalogo de referencia, baixa
-- sensibilidade individual (so' o VINCULO usuario<->role em
-- user_role_assignments e' sensivel de verdade) -- leitura liberada pra
-- qualquer autenticado (a tela de permissoes precisa listar tudo), escrita
-- exige roles.manage.
alter table roles enable row level security;
create policy roles_select on roles for select using (auth.uid() is not null);
create policy roles_write on roles for all
  using (user_has_permission('roles.manage'))
  with check (user_has_permission('roles.manage'));

alter table permissions enable row level security;
create policy permissions_select on permissions for select using (auth.uid() is not null);
create policy permissions_write on permissions for all
  using (user_has_permission('roles.manage'))
  with check (user_has_permission('roles.manage'));

alter table role_permissions enable row level security;
create policy role_permissions_select on role_permissions for select using (auth.uid() is not null);
create policy role_permissions_write on role_permissions for all
  using (user_has_permission('roles.manage'))
  with check (user_has_permission('roles.manage'));

alter table user_role_assignments enable row level security;
create policy user_role_assignments_select on user_role_assignments for select
  using (user_id = auth.uid() or user_has_permission('users.view') or user_has_permission('roles.view'));
create policy user_role_assignments_write on user_role_assignments for all
  using (user_has_permission('users.manage') or user_has_permission('roles.manage'))
  with check (user_has_permission('users.manage') or user_has_permission('roles.manage'));

alter table user_role_legal_entity_access enable row level security;
create policy user_role_legal_entity_access_select on user_role_legal_entity_access for select
  using (user_id = auth.uid() or user_has_permission('users.view') or user_has_permission('roles.view'));
create policy user_role_legal_entity_access_write on user_role_legal_entity_access for all
  using (user_has_permission('users.manage') or user_has_permission('roles.manage'))
  with check (user_has_permission('users.manage') or user_has_permission('roles.manage'));

alter table user_active_context enable row level security;
create policy user_active_context_self on user_active_context for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- audit_events: log imutavel -- sem policy de update/delete (ninguem altera/
-- apaga, nem admin, por design). Insert liberado a qualquer autenticado
-- (registra a propria acao); o encadeamento de hash correto e' feito por uma
-- RPC dedicada mais adiante, nao por INSERT direto do cliente.
alter table audit_events enable row level security;
create policy audit_events_select on audit_events for select
  using (user_has_permission('audit.view'));
create policy audit_events_insert on audit_events for insert
  with check (auth.uid() is not null);
