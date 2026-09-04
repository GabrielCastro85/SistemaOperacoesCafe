-- setDealConfirmationSequenceFloor (piso manual de numeracao) so' escrevia em
-- document_sequences, a tabela usada pela previa local -- a reserva atomica de
-- verdade (ensure_deal_confirmation_number) le/escreve em
-- deal_confirmation_number_sequences, uma tabela separada que nunca recebia
-- esse piso. Resultado: definir um piso manual bloqueava so' a previa exibida
-- na tela, a proxima emissao real no servidor continuava usando o proximo
-- numero da sequencia antiga, ignorando o piso. Corrigido passando o piso como
-- parametro da RPC e aplicando greatest(current_number, p_floor) antes de
-- calcular o proximo numero -- mesma logica non-decrescente de
-- setDealConfirmationSequenceFloor (Math.max), agora tambem do lado do
-- servidor.
--
-- p_padding e p_floor NAO tem valor default de proposito (Postgres exige que,
-- apos um parametro sem default, nenhum outro tenha default tambem): overload
-- com todos os parametros defaultaveis e' uma armadilha classica (uma chamada
-- com so' os 6 parametros antigos viraria ambigua entre as duas versoes da
-- funcao, gerando "function is not unique" e quebrando numeracao nos dois
-- lados). Sem default nesses dois, uma chamada de 6 argumentos (app ainda nao
-- atualizado) so' pode casar com a assinatura antiga (0025); uma chamada de 7
-- argumentos (app atualizado, sempre manda p_padding e p_floor) so' pode
-- casar com esta -- nunca ambiguo, PC em uso durante o rollout do instalador
-- continua gerando numero normalmente com a versao antiga do app ate'
-- atualizar.
begin;

create or replace function ensure_deal_confirmation_number(
  p_confirmation_id uuid,
  p_organization_id uuid,
  p_own_legal_entity_id uuid,
  p_year integer,
  p_prefix text,
  p_padding integer,
  p_floor bigint
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
    p_organization_id, p_own_legal_entity_id, p_year, p_prefix, p_floor, p_padding
  ) on conflict (organization_id, own_legal_entity_id, year, prefix)
  do update set current_number = greatest(deal_confirmation_number_sequences.current_number, p_floor);

  select current_number into v_current
  from public.deal_confirmation_number_sequences
  where organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and year = p_year
    and prefix = p_prefix
  for update;

  select coalesce(max((regexp_match(dc.confirmation_number, '([0-9]+)[[:space:]]*$'))[1]::bigint), 0)
    into v_highest_confirmation
  from public.deal_confirmations dc
  where dc.organization_id = p_organization_id
    and dc.own_legal_entity_id = p_own_legal_entity_id
    and dc.confirmation_number is not null
    and dc.confirmation_number like p_prefix || '%'
    and dc.confirmation_number ~ '[0-9]+[[:space:]]*$'
    and coalesce(nullif(substring(dc.confirmation_date from 1 for 4), '')::integer,
                 extract(year from dc.created_at)::integer) = p_year;

  select coalesce(max(dcnr.sequence_number), 0)
    into v_highest_reservation
  from public.deal_confirmation_number_reservations dcnr
  where dcnr.organization_id = p_organization_id
    and dcnr.own_legal_entity_id = p_own_legal_entity_id
    and dcnr.year = p_year
    and dcnr.prefix = p_prefix;

  v_next := greatest(coalesce(v_current, 0), p_floor, v_highest_confirmation, v_highest_reservation) + 1;
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
  from public.deal_confirmations dc
  where dc.id = p_confirmation_id
    and dc.organization_id = p_organization_id
    and dc.own_legal_entity_id = p_own_legal_entity_id
    and dc.confirmation_number = v_number;

  if not found then
    raise exception 'Reserved number % was not assigned to confirmation %', v_number, p_confirmation_id;
  end if;

  return query select v_number, v_next;
end;
$$;

revoke all on function public.ensure_deal_confirmation_number(uuid, uuid, uuid, integer, text, integer, bigint) from public;
grant execute on function public.ensure_deal_confirmation_number(uuid, uuid, uuid, integer, text, integer, bigint) to authenticated;

-- A assinatura antiga (sem p_floor, de 0025) fica intacta de proposito --
-- PCs ainda rodando a versao anterior do app continuam chamando ela sem
-- p_floor e sem quebrar (rollout gradual do instalador, um PC pode estar
-- em uso enquanto os outros ainda nao atualizaram). So' remover a versao
-- antiga numa migration futura, depois que os 4 PCs confirmarem estar na
-- versao nova.

commit;
