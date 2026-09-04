-- Numeração atômica e proteção de confirmações emitidas.
begin;

create table if not exists deal_confirmation_number_sequences (
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  year integer not null,
  prefix text not null,
  current_number bigint not null default 0,
  padding integer not null default 4 check (padding between 1 and 12),
  updated_at timestamptz not null default now(),
  primary key (organization_id, own_legal_entity_id, year, prefix)
);

create table if not exists deal_confirmation_number_reservations (
  confirmation_id uuid primary key references deal_confirmations(id) on delete restrict,
  organization_id uuid not null references organizations(id),
  own_legal_entity_id uuid not null references legal_entities(id),
  year integer not null,
  prefix text not null,
  sequence_number bigint not null,
  confirmation_number text not null,
  reserved_at timestamptz not null default now(),
  issued_at timestamptz,
  cancelled_at timestamptz,
  unique (organization_id, own_legal_entity_id, year, prefix, sequence_number),
  unique (organization_id, own_legal_entity_id, confirmation_number)
);

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

  insert into deal_confirmation_number_sequences (
    organization_id, own_legal_entity_id, year, prefix, current_number, padding
  ) values (
    p_organization_id, p_own_legal_entity_id, p_year, p_prefix, 0, p_padding
  ) on conflict (organization_id, own_legal_entity_id, year, prefix) do nothing;

  update deal_confirmation_number_sequences
  set current_number = current_number + 1,
      padding = p_padding,
      updated_at = now()
  where organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and year = p_year
    and prefix = p_prefix
  returning current_number into v_next;

  v_number := p_prefix || lpad(v_next::text, p_padding, '0');

  insert into deal_confirmation_number_reservations (
    confirmation_id, organization_id, own_legal_entity_id, year, prefix,
    sequence_number, confirmation_number
  ) values (
    p_confirmation_id, p_organization_id, p_own_legal_entity_id, p_year,
    p_prefix, v_next, v_number
  );

  update deal_confirmations
  set confirmation_number = v_number,
      updated_at = now()
  where id = p_confirmation_id
    and organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and status in ('DRAFT','PENDING_REVIEW');

  if not found then
    raise exception 'Confirmation % is missing, belongs to another company, or is no longer editable', p_confirmation_id;
  end if;

  return query select v_number, v_next;
end;
$$;

create or replace function protect_issued_deal_confirmation()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('ISSUED','SENT_FOR_SIGNATURE','SIGNED','CANCELLED','REPLACED') then
    if new.confirmation_number is distinct from old.confirmation_number then
      raise exception 'Issued confirmation number is immutable';
    end if;
    if new.organization_id is distinct from old.organization_id
       or new.own_legal_entity_id is distinct from old.own_legal_entity_id then
      raise exception 'Issued confirmation company is immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_issued_deal_confirmation on deal_confirmations;
create trigger trg_protect_issued_deal_confirmation
before update on deal_confirmations
for each row execute function protect_issued_deal_confirmation();

create or replace function prevent_numbered_deal_confirmation_delete()
returns trigger
language plpgsql
as $$
begin
  if old.confirmation_number is not null or old.status <> 'DRAFT' then
    raise exception 'Numbered confirmations cannot be deleted; cancel them instead';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_prevent_numbered_deal_confirmation_delete on deal_confirmations;
create trigger trg_prevent_numbered_deal_confirmation_delete
before delete on deal_confirmations
for each row execute function prevent_numbered_deal_confirmation_delete();

insert into deal_confirmation_number_reservations (
  confirmation_id, organization_id, own_legal_entity_id, year, prefix,
  sequence_number, confirmation_number, reserved_at, issued_at, cancelled_at
)
select
  dc.id,
  dc.organization_id,
  dc.own_legal_entity_id,
  coalesce(nullif(substring(dc.confirmation_date from 1 for 4), '')::integer, extract(year from dc.created_at)::integer),
  regexp_replace(dc.confirmation_number, '[0-9]+[[:space:]]*$', ''),
  (regexp_match(dc.confirmation_number, '([0-9]+)[[:space:]]*$'))[1]::bigint,
  dc.confirmation_number,
  dc.created_at,
  case when dc.issued_at is not null then dc.issued_at::timestamptz else null end,
  case when dc.cancelled_at is not null then dc.cancelled_at::timestamptz else null end
from deal_confirmations dc
where dc.confirmation_number is not null
  and dc.confirmation_number ~ '[0-9]+[[:space:]]*$'
on conflict do nothing;

insert into deal_confirmation_number_sequences (
  organization_id, own_legal_entity_id, year, prefix, current_number, padding
)
select organization_id, own_legal_entity_id, year, prefix, max(sequence_number), 4
from deal_confirmation_number_reservations
group by organization_id, own_legal_entity_id, year, prefix
on conflict (organization_id, own_legal_entity_id, year, prefix)
do update set current_number = greatest(deal_confirmation_number_sequences.current_number, excluded.current_number), updated_at = now();

commit;

revoke all on function reserve_deal_confirmation_number(uuid, uuid, uuid, integer, text, integer) from public;
grant execute on function reserve_deal_confirmation_number(uuid, uuid, uuid, integer, text, integer) to authenticated;
