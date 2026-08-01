-- O SQLite local usa ids fixos e legiveis pra roles/permissions
-- (ex: 'role-system-admin', 'perm-users-manage' -- ver migration
-- 012_access_control em electron/main/database/migrations.ts). O Postgres
-- tinha as mesmas linhas (mesmo `code`) com uuid aleatorio como id e coluna
-- tipada `uuid`. Isso bloqueia sincronizar essas tabelas direto (mesmo tipo
-- de erro de UNIQUE/tipo ja visto nesta sessao com CNPJ duplicado). Aqui a
-- coluna vira `text` e os ids existentes sao reescritos pra bater
-- exatamente com o esquema local, casando por `code` (nunca por posicao).

begin;

-- 1. Solta os FKs que apontam pra roles.id / permissions.id -- nomes variam
-- por instalacao, entao acha e derruba dinamicamente em vez de chutar nome.
do $$
declare
  r record;
begin
  for r in
    select conname, conrelid::regclass as tbl
    from pg_constraint
    where contype = 'f'
      and confrelid in ('public.roles'::regclass, 'public.permissions'::regclass)
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- 2. Muda o TIPO das colunas (valor continua igual por enquanto, so' vira
-- texto do proprio uuid antigo) -- assim a integridade entre as tabelas se
-- mantem intacta ate' o proximo passo remapear os valores de uma vez so'.
alter table roles alter column id drop default;
alter table permissions alter column id drop default;
alter table roles alter column id type text using id::text;
alter table permissions alter column id type text using id::text;
alter table role_permissions alter column role_id type text using role_id::text;
alter table role_permissions alter column permission_id type text using permission_id::text;
alter table user_role_assignments alter column role_id type text using role_id::text;

-- 3. Mapeamento antigo uuid -> novo id fixo, por `code` (mesmos ids do seed
-- local em electron/main/database/migrations.ts, migrations 012 e 013).
create temporary table role_id_map as
select id as old_id,
  case code
    when 'SYSTEM_ADMIN' then 'role-system-admin'
    when 'OPERATIONS_MANAGER' then 'role-ops-manager'
    when 'FINANCE_MANAGER' then 'role-finance-manager'
    when 'OPERATOR' then 'role-operator'
    when 'VIEWER' then 'role-viewer'
  end as new_id
from roles;

create temporary table permission_id_map as
select id as old_id,
  case code
    when 'system.bootstrap' then 'perm-system-bootstrap'
    when 'system.view' then 'perm-system-view'
    when 'settings.manage' then 'perm-settings-manage'
    when 'users.view' then 'perm-users-view'
    when 'users.manage' then 'perm-users-manage'
    when 'roles.view' then 'perm-roles-view'
    when 'roles.manage' then 'perm-roles-manage'
    when 'audit.view' then 'perm-audit-view'
    when 'operations.view' then 'perm-operations-view'
    when 'operations.manage' then 'perm-operations-manage'
    when 'imports.manage' then 'perm-imports-manage'
    when 'commercial.view' then 'perm-commercial-view'
    when 'commercial.manage' then 'perm-commercial-manage'
    when 'billing.manage' then 'perm-billing-manage'
    when 'finance.view' then 'perm-finance-view'
    when 'finance.manage' then 'perm-finance-manage'
    when 'confirmations.manage' then 'perm-confirmations-manage'
    when 'backups.view' then 'perm-backups-view'
    when 'backups.create' then 'perm-backups-create'
    when 'backups.configure' then 'perm-backups-configure'
    when 'backups.verify' then 'perm-backups-verify'
    when 'backups.restore' then 'perm-backups-restore'
    when 'backups.delete' then 'perm-backups-delete'
    when 'backups.protect' then 'perm-backups-protect'
    when 'integrity.view' then 'perm-integrity-view'
    when 'integrity.run' then 'perm-integrity-run'
    when 'integrity.export' then 'perm-integrity-export'
    when 'retention.manage' then 'perm-retention-manage'
    when 'temporary_files.cleanup' then 'perm-temporary-files-cleanup'
  end as new_id
from permissions;

-- Trava de seguranca: se algum `code` do Postgres nao bateu com o mapeamento
-- acima (ex: permissao nova que ainda nao entrou nessa lista), aborta a
-- migracao inteira em vez de deixar um id nulo/quebrado.
do $$
begin
  if exists (select 1 from role_id_map where new_id is null) then
    raise exception 'role_id_map tem code sem mapeamento -- atualize a migracao antes de rodar';
  end if;
  if exists (select 1 from permission_id_map where new_id is null) then
    raise exception 'permission_id_map tem code sem mapeamento -- atualize a migracao antes de rodar';
  end if;
end $$;

-- 4. Remapeia FKs primeiro (ainda apontam pro uuid antigo), so' depois as
-- tabelas-mae -- ordem importa pra nao perder o vinculo no meio do caminho.
update role_permissions rp set role_id = m.new_id from role_id_map m where rp.role_id = m.old_id;
update role_permissions rp set permission_id = m.new_id from permission_id_map m where rp.permission_id = m.old_id;
update user_role_assignments ura set role_id = m.new_id from role_id_map m where ura.role_id = m.old_id;
update roles set id = m.new_id from role_id_map m where roles.id = m.old_id;
update permissions set id = m.new_id from permission_id_map m where permissions.id = m.old_id;

-- 5. Recria os FKs que foram derrubados no passo 1.
alter table role_permissions add constraint role_permissions_role_id_fkey foreign key (role_id) references roles(id);
alter table role_permissions add constraint role_permissions_permission_id_fkey foreign key (permission_id) references permissions(id);
alter table user_role_assignments add constraint user_role_assignments_role_id_fkey foreign key (role_id) references roles(id);

-- 6. Tabela nova (nao existia no Postgres) -- espelha
-- electron/main/database/migrations.ts (migration 012_access_control).
create table if not exists user_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references app_users(id) on delete cascade,
  credential_format text not null,
  password_hash text not null,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table user_credentials enable row level security;

create policy user_credentials_select_self on user_credentials
  for select using (user_id = auth.uid() or user_has_permission('users.manage'));

create policy user_credentials_write_admin on user_credentials
  for all using (user_has_permission('users.manage'))
  with check (user_has_permission('users.manage'));

-- 7. Mirror da role nova (electron/main/database/migrations.ts,
-- migration 035_employee_operational_role) -- mesmo id fixo do lado local.
insert into roles (id, code, name, description, scope_type, is_system, is_active, created_at, updated_at)
values ('role-employee-operacional', 'EMPLOYEE_OPERACIONAL', 'Funcionario operacional', 'Lanca notas, confirma negocios, gerencia cobrancas e contas a pagar. Sem acesso a usuarios, roles, configuracoes ou auditoria.', 'ORGANIZATION', true, true, now(), now())
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id, created_at)
select 'role-employee-operacional', permissions.id, now()
from permissions
where code in ('system.view','operations.view','operations.manage','imports.manage','commercial.view','commercial.manage','billing.manage','confirmations.manage','finance.view','finance.manage')
on conflict do nothing;

commit;
