-- Corrige a sequência para considerar sempre os números reais já existentes
-- e torna a reserva do Supabase a única fonte da numeração de confirmações.
begin;

create or replace function reserve_deal_confirmation_number(
  p_confirmation_id uuid,
  p_organization_id uuid,
  p_own_legal_entity_id uuid,
  p_year integer,
  p_prefix text,
  p_padding integer default 4
)
returns table (confirmation_number text, sequence_number bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing deal_confirmation_number_reservations%rowtype;
  v_current bigint;
  v_highest_confirmation bigint := 0;
  v_highest_reservation bigint := 0;
  v_next bigint;
  v_number text;
begin
  if not public.user_has_org_access(p_organization_id) then
    raise exception 'Access denied for organization %', p_organization_id;
  end if;

  select * into v_existing
  from deal_confirmation_number_reservations
  where confirmation_id = p_confirmation_id;

  if found then
    return query select v_existing.confirmation_number, v_existing.sequence_number;
    return;
  end if;

  -- Garante que o rascunho existe e pertence exatamente à empresa informada.
  perform 1
  from deal_confirmations
  where id = p_confirmation_id
    and organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and status in ('DRAFT', 'PENDING_REVIEW')
  for update;

  if not found then
    raise exception 'Confirmation % is missing, belongs to another company, or is no longer editable', p_confirmation_id;
  end if;

  insert into deal_confirmation_number_sequences (
    organization_id, own_legal_entity_id, year, prefix, current_number, padding
  ) values (
    p_organization_id, p_own_legal_entity_id, p_year, p_prefix, 0, p_padding
  ) on conflict (organization_id, own_legal_entity_id, year, prefix) do nothing;

  -- Bloqueia a sequência desta empresa/prefixo durante toda a reserva.
  select current_number into v_current
  from deal_confirmation_number_sequences
  where organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and year = p_year
    and prefix = p_prefix
  for update;

  -- Reconcilia com confirmações reais, inclusive números criados depois da
  -- migration anterior ou trazidos por sincronização de versões antigas.
  select coalesce(max((regexp_match(confirmation_number, '([0-9]+)[[:space:]]*$'))[1]::bigint), 0)
    into v_highest_confirmation
  from deal_confirmations
  where organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and confirmation_number is not null
    and confirmation_number like p_prefix || '%'
    and confirmation_number ~ '[0-9]+[[:space:]]*$'
    and coalesce(nullif(substring(confirmation_date from 1 for 4), '')::integer,
                 extract(year from created_at)::integer) = p_year;

  select coalesce(max(sequence_number), 0)
    into v_highest_reservation
  from deal_confirmation_number_reservations
  where organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and year = p_year
    and prefix = p_prefix;

  v_next := greatest(coalesce(v_current, 0), v_highest_confirmation, v_highest_reservation) + 1;
  v_number := p_prefix || lpad(v_next::text, p_padding, '0');

  update deal_confirmation_number_sequences
  set current_number = v_next,
      padding = p_padding,
      updated_at = now()
  where organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and year = p_year
    and prefix = p_prefix;

  insert into deal_confirmation_number_reservations (
    confirmation_id, organization_id, own_legal_entity_id, year, prefix,
    sequence_number, confirmation_number
  ) values (
    p_confirmation_id, p_organization_id, p_own_legal_entity_id, p_year,
    p_prefix, v_next, v_number
  );

  update deal_confirmations
  set confirmation_number = v_number,
      temporary_reference = v_number,
      updated_at = now()
  where id = p_confirmation_id
    and organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and status in ('DRAFT','PENDING_REVIEW');

  return query select v_number, v_next;
end;
$$;

revoke all on function reserve_deal_confirmation_number(uuid, uuid, uuid, integer, text, integer) from public;
grant execute on function reserve_deal_confirmation_number(uuid, uuid, uuid, integer, text, integer) to authenticated;

-- Atualiza as sequências atuais com base no maior número realmente existente.
with actual_numbers as (
  select
    organization_id,
    own_legal_entity_id,
    coalesce(nullif(substring(confirmation_date from 1 for 4), '')::integer,
             extract(year from created_at)::integer) as year,
    regexp_replace(confirmation_number, '[0-9]+[[:space:]]*$', '') as prefix,
    max((regexp_match(confirmation_number, '([0-9]+)[[:space:]]*$'))[1]::bigint) as highest
  from deal_confirmations
  where confirmation_number is not null
    and confirmation_number ~ '[0-9]+[[:space:]]*$'
  group by organization_id, own_legal_entity_id,
           coalesce(nullif(substring(confirmation_date from 1 for 4), '')::integer,
                    extract(year from created_at)::integer),
           regexp_replace(confirmation_number, '[0-9]+[[:space:]]*$', '')
)
insert into deal_confirmation_number_sequences (
  organization_id, own_legal_entity_id, year, prefix, current_number, padding
)
select organization_id, own_legal_entity_id, year, prefix, highest, 4
from actual_numbers
on conflict (organization_id, own_legal_entity_id, year, prefix)
do update set
  current_number = greatest(deal_confirmation_number_sequences.current_number, excluded.current_number),
  updated_at = now();

commit;
