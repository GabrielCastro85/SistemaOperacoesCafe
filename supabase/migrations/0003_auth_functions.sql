-- ============================================================================
-- Ligacao com Supabase Auth: espelho de auth.users em app_users, e a funcao
-- central de checagem de permissao usada pelas policies de RLS (migration
-- 0004). auth.uid() so' retorna algo quando a chamada vem autenticada (JWT
-- de um usuario real, via anon key + sessao) -- chamadas com a service role
-- key ignoram RLS inteiramente (uso reservado a scripts administrativos/
-- bootstrap, nunca ao app rodando no dia a dia).
-- ============================================================================

-- Quando alguem se cadastra via Supabase Auth, espelha os dados basicos em
-- app_users (que guarda display_name/username/status -- coisas que auth.users
-- nao tem e o app precisa).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (id, display_name, username, normalized_username, email, status, must_change_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    new.email,
    'ACTIVE',
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Checa se o usuario autenticado (auth.uid()) tem a permissao pedida, dentro
-- do escopo de organizacao/CNPJ informado. Correcao consciente do bug achado
-- em security.ts (requireSession so' validava de fato a permissao literal
-- "users.manage", outras eram ignoradas) -- aqui TODA permissao passada e'
-- checada de verdade, sem excecao.
--
-- Regra de escopo: um vinculo (user_role_assignments) com role GLOBAL, ou sem
-- organization_id definido, vale em qualquer organizacao/CNPJ. Um vinculo com
-- organization_id definido so' vale para essa organizacao (e, se tambem tiver
-- legal_entity_id definido, so' para aquele CNPJ especifico).
create or replace function public.user_has_permission(
  permission_code text,
  p_organization_id uuid default null,
  p_legal_entity_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_role_assignments ura
    join roles r on r.id = ura.role_id and r.is_active = true
    join role_permissions rp on rp.role_id = ura.role_id
    join permissions p on p.id = rp.permission_id and p.is_active = true
    where ura.user_id = auth.uid()
      and ura.is_active = true
      and (ura.expires_at is null or ura.expires_at::timestamptz > now())
      and p.code = permission_code
      and (
        r.scope_type = 'GLOBAL'
        or ura.organization_id is null
        or (
          ura.organization_id = p_organization_id
          and (ura.legal_entity_id is null or p_legal_entity_id is null or ura.legal_entity_id = p_legal_entity_id)
        )
      )
  );
$$;

-- Checagem mais simples: o usuario autenticado tem QUALQUER vinculo ativo
-- (de qualquer role) dentro da organizacao/CNPJ informado. E' a base do
-- controle de leitura/escrita nas tabelas de negocio nesta fase (ver
-- migration 0004) -- fronteira real entre organizacoes/CNPJs diferentes,
-- que hoje (SQLite local) nao existe nenhuma, ja que cada instalacao so'
-- enxerga o proprio banco.
create or replace function public.user_has_org_access(
  p_organization_id uuid,
  p_legal_entity_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_role_assignments ura
    join roles r on r.id = ura.role_id and r.is_active = true
    where ura.user_id = auth.uid()
      and ura.is_active = true
      and (ura.expires_at is null or ura.expires_at::timestamptz > now())
      and (
        r.scope_type = 'GLOBAL'
        or ura.organization_id is null
        or (
          ura.organization_id = p_organization_id
          and (ura.legal_entity_id is null or p_legal_entity_id is null or ura.legal_entity_id = p_legal_entity_id)
        )
      )
  );
$$;
