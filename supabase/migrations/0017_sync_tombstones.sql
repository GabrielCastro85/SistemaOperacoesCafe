-- ============================================================================
-- Tabela generica de exclusao (tombstone): quando uma linha e' apagada de
-- qualquer tabela compartilhada, grava aqui em vez de so' sumir -- um pull
-- incremental por timestamp nao tem como detectar "essa linha sumiu" se ela
-- for apagada de verdade (mesmo problema ja resolvido so' pra app_users via
-- deleted_at, migration 0016; aqui generaliza pra qualquer tabela). Sem isso,
-- pushAllLocalReferenceDataToShared (upsert de tudo que existe localmente,
-- chamado a cada "Sincronizar agora"/reconexao) ressuscita pro Postgres
-- qualquer linha que um PC ainda nao sabia que tinha sido apagada em outro
-- lugar -- foi exatamente isso que trouxe de volta os dados de teste zerados
-- no reset de 2026-08-02, mais de uma vez.
-- ============================================================================

create table sync_tombstones (
  table_name text not null,
  row_id text not null,
  deleted_at timestamptz not null default now(),
  primary key (table_name, row_id)
);

alter table sync_tombstones enable row level security;

-- Sem organization_id (a exclusao pode ser de qualquer tabela, nao so' as
-- ligadas a uma organizacao especifica) -- qualquer usuario com vinculo ativo
-- (de qualquer role, em qualquer organizacao) pode ler e gravar tombstones,
-- mesmo criterio de "esta' logado de verdade" usado em user_has_org_access,
-- so' que sem o filtro de organizacao.
create policy sync_tombstones_select on sync_tombstones for select
  using (exists (select 1 from user_role_assignments ura where ura.user_id = auth.uid() and ura.is_active = true));
create policy sync_tombstones_insert on sync_tombstones for insert
  with check (exists (select 1 from user_role_assignments ura where ura.user_id = auth.uid() and ura.is_active = true));
-- sem policy de update/delete: tombstone e' permanente (append-only), igual historico de status.
