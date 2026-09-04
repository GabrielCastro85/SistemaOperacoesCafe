-- Valida a propriedade numero + UUID e recupera rascunhos antigos que
-- carregavam localmente um numero já pertencente a outra confirmação.
begin;

create or replace function ensure_deal_confirmation_number(
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
  v_target public.deal_confirmations%rowtype;
  v_existing public.deal_confirmation_number_reservations%rowtype;
  v_conflicting_id uuid;
  v_current bigint := 0;
  v_highest_confirmation bigint := 0;
  v_highest_reservation bigint := 0;
  v_next bigint;
  v_number text;
begin
  if not public.user_has_org_access(p_organization_id) then
    raise exception 'Access denied for organization %', p_organization_id;
  end if;

  -- Trava o rascunho. O número só pode ser reservado para o UUID exato.
  select * into v_target
  from public.deal_confirmations
  where id = p_confirmation_id
    and organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and status in ('DRAFT', 'PENDING_REVIEW')
  for update;

  if not found then
    raise exception 'Confirmation % is missing, belongs to another company, or is no longer editable', p_confirmation_id;
  end if;

  -- Rascunhos de versões antigas podem conter um número que já pertence a
  -- outro UUID. Nunca reaproveita esse valor: limpa somente o rascunho atual.
  if v_target.confirmation_number is not null then
    select dc.id into v_conflicting_id
    from public.deal_confirmations dc
    where dc.organization_id = p_organization_id
      and dc.own_legal_entity_id = p_own_legal_entity_id
      and upper(trim(dc.confirmation_number)) = upper(trim(v_target.confirmation_number))
      and dc.id <> p_confirmation_id
    limit 1;

    if v_conflicting_id is not null then
      update public.deal_confirmations
      set confirmation_number = null,
          temporary_reference = 'RASCUNHO-' || upper(substr(p_confirmation_id::text, 1, 8)),
          updated_at = now()
      where id = p_confirmation_id;
      v_target.confirmation_number := null;
    end if;
  end if;

  -- Uma reserva anterior só é reutilizada quando o número continua livre para
  -- este mesmo UUID. Reserva inconsistente de rascunho é descartada e refeita.
  select * into v_existing
  from public.deal_confirmation_number_reservations
  where confirmation_id = p_confirmation_id
  for update;

  if found then
    select dc.id into v_conflicting_id
    from public.deal_confirmations dc
    where dc.organization_id = p_organization_id
      and dc.own_legal_entity_id = p_own_legal_entity_id
      and upper(trim(dc.confirmation_number)) = upper(trim(v_existing.confirmation_number))
      and dc.id <> p_confirmation_id
    limit 1;

    if v_conflicting_id is null then
      update public.deal_confirmations
      set confirmation_number = v_existing.confirmation_number,
          temporary_reference = v_existing.confirmation_number,
          updated_at = now()
      where id = p_confirmation_id;
      return query select v_existing.confirmation_number, v_existing.sequence_number;
      return;
    end if;

    delete from public.deal_confirmation_number_reservations
    where confirmation_id = p_confirmation_id;
  end if;

  insert into public.deal_confirmation_number_sequences (
    organization_id, own_legal_entity_id, year, prefix, current_number, padding
  ) values (
    p_organization_id, p_own_legal_entity_id, p_year, p_prefix, 0, p_padding
  ) on conflict (organization_id, own_legal_entity_id, year, prefix) do nothing;

  select current_number into v_current
  from public.deal_confirmation_number_sequences
  where organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and year = p_year
    and prefix = p_prefix
  for update;

  select coalesce(max((regexp_match(confirmation_number, '([0-9]+)[[:space:]]*$'))[1]::bigint), 0)
    into v_highest_confirmation
  from public.deal_confirmations
  where organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and confirmation_number is not null
    and confirmation_number like p_prefix || '%'
    and confirmation_number ~ '[0-9]+[[:space:]]*$'
    and coalesce(nullif(substring(confirmation_date from 1 for 4), '')::integer,
                 extract(year from created_at)::integer) = p_year;

  select coalesce(max(sequence_number), 0)
    into v_highest_reservation
  from public.deal_confirmation_number_reservations
  where organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and year = p_year
    and prefix = p_prefix;

  v_next := greatest(coalesce(v_current, 0), v_highest_confirmation, v_highest_reservation) + 1;
  v_number := p_prefix || lpad(v_next::text, p_padding, '0');

  update public.deal_confirmation_number_sequences
  set current_number = v_next,
      padding = p_padding,
      updated_at = now()
  where organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and year = p_year
    and prefix = p_prefix;

  insert into public.deal_confirmation_number_reservations (
    confirmation_id, organization_id, own_legal_entity_id, year, prefix,
    sequence_number, confirmation_number
  ) values (
    p_confirmation_id, p_organization_id, p_own_legal_entity_id, p_year,
    p_prefix, v_next, v_number
  );

  update public.deal_confirmations
  set confirmation_number = v_number,
      temporary_reference = v_number,
      updated_at = now()
  where id = p_confirmation_id;

  -- Verificação final dentro da mesma transação.
  perform 1
  from public.deal_confirmations
  where id = p_confirmation_id
    and organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and confirmation_number = v_number;

  if not found then
    raise exception 'Reserved number % was not assigned to confirmation %', v_number, p_confirmation_id;
  end if;

  return query select v_number, v_next;
end;
$$;

revoke all on function public.ensure_deal_confirmation_number(uuid, uuid, uuid, integer, text, integer) from public;
grant execute on function public.ensure_deal_confirmation_number(uuid, uuid, uuid, integer, text, integer) to authenticated;

commit;
