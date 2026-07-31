-- ============================================================================
-- RPCs criticas -- toda transacao que le um saldo agregado (soma de outras
-- linhas) e usa essa leitura pra decidir um INSERT/UPDATE em outra tabela vira
-- funcao aqui, com "select ... for update" travando a linha-chave. Com 4 PCs
-- concorrentes isso deixa de ser opcional (SQLite hoje e' single-writer de
-- fato, Postgres com 4 clientes nao e'). Todas SECURITY DEFINER (bypassam
-- RLS por padrao) -- por isso cada uma comeca com sua PROPRIA checagem de
-- user_has_permission, nunca confiando em RLS pra autorizar o que roda aqui
-- dentro.
--
-- Espelham fielmente a logica hoje em electron/main/services/appRepository.ts
-- (issueClientCharge:1969, allocatePayment:2039, recalculateClientCharge:2753,
-- reserveNextChargeNumber:2775) -- nao reinventam regra de negocio nova.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers de data/valor (mesma logica de electron/main/services/appRepository.ts
-- addMonthsSafe:5170 e splitCents:5198, pra manter parcelamento identico ao
-- que ja existe em Contas a Pagar).
-- ---------------------------------------------------------------------------

create or replace function add_months_safe(p_date date, p_months int)
returns date
language plpgsql
immutable
as $$
declare
  target_month date := (date_trunc('month', p_date) + (p_months || ' months')::interval)::date;
  last_day int := extract(day from (target_month + interval '1 month' - interval '1 day'))::int;
  target_day int := least(extract(day from p_date)::int, last_day);
begin
  return target_month + (target_day - 1) * interval '1 day';
end;
$$;

create or replace function split_cents(p_total bigint, p_count int)
returns bigint[]
language plpgsql
immutable
as $$
declare
  base bigint := p_total / p_count;
  remainder bigint := p_total - base * p_count;
  result bigint[] := array[]::bigint[];
  i int;
begin
  if p_count < 1 then
    raise exception 'installment_count deve ser >= 1';
  end if;
  for i in 1..p_count loop
    result := result || (case when i = p_count then base + remainder else base end);
  end loop;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reserva atomica de numero sequencial. UPDATE ... RETURNING e' atomico no
-- Postgres sem lock explicito -- duas chamadas concorrentes nunca leem o
-- mesmo current_number (a segunda so' ve' a UPDATE da primeira apos ela
-- commitar). Mesma regra de find-or-create de reserveNextChargeNumber:2775
-- (prefixo so' e' usado na criacao da linha, chamadas seguintes so' incrementam).
-- ---------------------------------------------------------------------------

create or replace function reserve_document_number(
  p_organization_id uuid,
  p_own_legal_entity_id uuid,
  p_document_type text,
  p_year int,
  p_prefix text,
  p_padding int default 4
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row document_sequences%rowtype;
  v_next int;
begin
  select * into v_row from document_sequences
  where organization_id = p_organization_id
    and own_legal_entity_id = p_own_legal_entity_id
    and document_type = p_document_type
    and coalesce(year, 0) = coalesce(p_year, 0)
    and is_active = true
  for update;

  if not found then
    insert into document_sequences (organization_id, own_legal_entity_id, document_type, year, prefix, current_number, padding, is_active)
    values (p_organization_id, p_own_legal_entity_id, p_document_type, p_year, p_prefix, 0, p_padding, true)
    returning * into v_row;
  end if;

  update document_sequences set current_number = current_number + 1, updated_at = now()
  where id = v_row.id
  returning current_number into v_next;

  return coalesce(v_row.prefix, '') || lpad(v_next::text, v_row.padding, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Emissao de cobranca (client_charges). Mirror de issueClientCharge:1969 +
-- recalculateClientCharge:2753 (a parte de geracao de PDF/Excel continua no
-- processo main, feita depois via UPDATE simples em charge_document_versions,
-- igual regenerateChargeDocuments:1989 ja faz hoje).
-- ---------------------------------------------------------------------------

create or replace function issue_client_charge(p_charge_id uuid)
returns client_charges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge client_charges%rowtype;
  v_subtotal bigint;
  v_additions bigint;
  v_deductions bigint;
  v_final bigint;
  v_paid bigint;
  v_open bigint;
  v_number text;
  v_now timestamptz := now();
  v_year int := extract(year from v_now)::int;
begin
  select * into v_charge from client_charges where id = p_charge_id for update;
  if not found then
    raise exception 'Cobranca nao encontrada.';
  end if;

  if not user_has_permission('billing.manage', v_charge.organization_id, v_charge.own_legal_entity_id) then
    raise exception 'Sem permissao para emitir cobranca.';
  end if;

  if v_charge.status not in ('DRAFT', 'PENDING_REVIEW') then
    raise exception 'Cobranca ja emitida ou cancelada.';
  end if;

  if not exists (select 1 from client_charge_operations where client_charge_id = p_charge_id and released_at is null) then
    raise exception 'Cobranca sem operacoes.';
  end if;

  select coalesce(sum(service_amount_cents_snapshot), 0) into v_subtotal
    from client_charge_operations where client_charge_id = p_charge_id and released_at is null;
  select coalesce(sum(amount_cents) filter (where effect = 'INCREASE_RECEIVABLE'), 0),
         coalesce(sum(amount_cents) filter (where effect = 'REDUCE_RECEIVABLE'), 0)
    into v_additions, v_deductions
    from client_charge_adjustments where client_charge_id = p_charge_id;
  v_final := greatest(0, v_subtotal + v_additions - v_deductions);
  select coalesce(sum(amount_cents), 0) into v_paid
    from client_payment_allocations where client_charge_id = p_charge_id and cancelled_at is null;
  v_open := greatest(0, v_final - v_paid);

  v_number := reserve_document_number(v_charge.organization_id, v_charge.own_legal_entity_id, 'CLIENT_CHARGE', v_year, 'COB-' || v_year || '-', 4);

  update client_charges set
    charge_number = v_number,
    issue_date = v_now::date::text,
    status = 'ISSUED',
    issued_at = v_now::text,
    subtotal_services_cents = v_subtotal,
    additions_cents = v_additions,
    deductions_cents = v_deductions,
    final_amount_cents = v_final,
    paid_amount_cents = v_paid,
    open_amount_cents = v_open,
    updated_at = v_now
  where id = p_charge_id
  returning * into v_charge;

  update operations set billing_status = 'BILLED', updated_at = v_now where client_charge_id = p_charge_id;

  insert into client_ledger_entries (organization_id, own_legal_entity_id, client_partner_id, client_charge_id, entry_type, effect, amount_cents, entry_date, description, status, available_amount_cents)
  values (v_charge.organization_id, v_charge.own_legal_entity_id, v_charge.client_partner_id, p_charge_id, 'SERVICE_CHARGE', 'INCREASE_RECEIVABLE', v_final, v_now::date::text, 'Cobranca ' || v_number, 'CONFIRMED', null);

  insert into charge_status_history (client_charge_id, previous_status, next_status, reason)
  values (p_charge_id, 'DRAFT', 'ISSUED', 'Cobranca emitida');

  return v_charge;
end;
$$;

-- ---------------------------------------------------------------------------
-- Alocacao de pagamento contra cobranca. Mirror de allocatePayment:2039 --
-- trava pagamento E cobranca (for update) antes de checar saldo, pra duas
-- alocacoes concorrentes contra o mesmo pagamento/cobranca nunca sobre-alocarem.
-- ---------------------------------------------------------------------------

create or replace function allocate_client_payment(
  p_client_payment_id uuid,
  p_client_charge_id uuid,
  p_amount_cents bigint
)
returns client_charges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment client_payments%rowtype;
  v_charge client_charges%rowtype;
  v_allocated bigint;
  v_subtotal bigint;
  v_additions bigint;
  v_deductions bigint;
  v_final bigint;
  v_paid bigint;
  v_open bigint;
  v_status text;
  v_now timestamptz := now();
begin
  if p_amount_cents <= 0 then
    raise exception 'Valor de alocacao deve ser positivo.';
  end if;

  select * into v_payment from client_payments where id = p_client_payment_id for update;
  if not found then raise exception 'Pagamento nao encontrado.'; end if;
  select * into v_charge from client_charges where id = p_client_charge_id for update;
  if not found then raise exception 'Cobranca nao encontrada.'; end if;

  if not user_has_permission('billing.manage', v_charge.organization_id, v_charge.own_legal_entity_id) then
    raise exception 'Sem permissao para alocar pagamento.';
  end if;

  if v_charge.organization_id != v_payment.organization_id
    or v_charge.own_legal_entity_id != v_payment.own_legal_entity_id
    or v_charge.client_partner_id != v_payment.client_partner_id then
    raise exception 'Pagamento fora do escopo da cobranca.';
  end if;

  select coalesce(sum(amount_cents), 0) into v_allocated
    from client_payment_allocations where client_payment_id = p_client_payment_id and cancelled_at is null;
  if v_payment.amount_cents - v_allocated < p_amount_cents then
    raise exception 'Pagamento sem saldo disponivel.';
  end if;
  if v_charge.open_amount_cents < p_amount_cents then
    raise exception 'Valor maior que saldo aberto.';
  end if;

  insert into client_payment_allocations (client_payment_id, client_charge_id, amount_cents)
  values (p_client_payment_id, p_client_charge_id, p_amount_cents);

  insert into client_ledger_entries (organization_id, own_legal_entity_id, client_partner_id, client_charge_id, entry_type, effect, amount_cents, entry_date, description, reference_number, status, available_amount_cents)
  values (v_payment.organization_id, v_payment.own_legal_entity_id, v_payment.client_partner_id, p_client_charge_id, 'PAYMENT_RECEIVED', 'REDUCE_RECEIVABLE', p_amount_cents, v_payment.payment_date, 'Pagamento recebido', v_payment.transaction_reference, 'CONFIRMED', null);

  -- recalculo completo (mesma logica de recalculateClientCharge:2753)
  select coalesce(sum(service_amount_cents_snapshot), 0) into v_subtotal
    from client_charge_operations where client_charge_id = p_client_charge_id and released_at is null;
  select coalesce(sum(amount_cents) filter (where effect = 'INCREASE_RECEIVABLE'), 0),
         coalesce(sum(amount_cents) filter (where effect = 'REDUCE_RECEIVABLE'), 0)
    into v_additions, v_deductions
    from client_charge_adjustments where client_charge_id = p_client_charge_id;
  v_final := greatest(0, v_subtotal + v_additions - v_deductions);
  select coalesce(sum(amount_cents), 0) into v_paid
    from client_payment_allocations where client_charge_id = p_client_charge_id and cancelled_at is null;
  v_open := greatest(0, v_final - v_paid);

  v_status := v_charge.status;
  if v_status not in ('DRAFT', 'PENDING_REVIEW', 'CANCELLED', 'REPLACED') then
    v_status := case when v_open = 0 then 'PAID' when v_paid > 0 then 'PARTIALLY_PAID' else 'ISSUED' end;
    if v_status = 'ISSUED' and v_charge.due_date is not null and v_charge.due_date < v_now::date::text then
      v_status := 'OVERDUE';
    end if;
  end if;

  update client_charges set
    subtotal_services_cents = v_subtotal,
    additions_cents = v_additions,
    deductions_cents = v_deductions,
    final_amount_cents = v_final,
    paid_amount_cents = v_paid,
    open_amount_cents = v_open,
    status = v_status,
    updated_at = v_now
  where id = p_client_charge_id
  returning * into v_charge;

  update client_ledger_entries set amount_cents = v_final, updated_at = v_now
  where client_charge_id = p_client_charge_id and entry_type = 'SERVICE_CHARGE';

  return v_charge;
end;
$$;

-- ---------------------------------------------------------------------------
-- Modulo novo: contas a receber por nota fiscal.
-- ---------------------------------------------------------------------------

-- Recalculo de UM recebivel (1 parcela) a partir das alocacoes nao canceladas
-- contra ele -- mesmo espirito de calculatePayableAmounts/recalculatePayable
-- (appRepository.ts:3601-3620): sempre soma do zero, nunca incrementa direto.
create or replace function recalculate_client_receivable(p_receivable_id uuid)
returns client_receivables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receivable client_receivables%rowtype;
  v_paid bigint;
  v_open bigint;
  v_status text;
  v_now timestamptz := now();
begin
  select * into v_receivable from client_receivables where id = p_receivable_id for update;
  if not found then raise exception 'Recebivel nao encontrado.'; end if;

  select coalesce(sum(amount_cents), 0) into v_paid
    from client_receivable_payment_allocations
    where client_receivable_id = p_receivable_id and cancelled_at is null;
  v_open := greatest(0, v_receivable.final_amount_cents - v_paid);

  v_status := v_receivable.status;
  if v_status not in ('DRAFT', 'CANCELLED', 'CONTESTED') then
    v_status := case when v_open = 0 then 'PAID' when v_paid > 0 then 'PARTIALLY_PAID' else 'OPEN' end;
    if v_status = 'OPEN' and v_receivable.due_date < v_now::date::text then
      v_status := 'OVERDUE';
    end if;
  end if;

  update client_receivables set
    paid_amount_cents = v_paid,
    open_amount_cents = v_open,
    status = v_status,
    updated_at = v_now
  where id = p_receivable_id
  returning * into v_receivable;

  return v_receivable;
end;
$$;

-- Cria o grupo de parcelamento + as N linhas de recebivel de uma vez, atomico
-- (soma das parcelas == valor total da nota e' garantida por construcao via
-- split_cents, nao por CHECK de coluna -- mesmo racional do plano: nao da'
-- pra expressar isso como constraint declarativa). installment_count=1 e'
-- o atalho "a vista" (grupo com 1 parcela unica, ja OPEN).
create or replace function create_client_receivable_group(
  p_organization_id uuid,
  p_own_legal_entity_id uuid,
  p_fiscal_document_id uuid,
  p_customer_partner_id uuid,
  p_customer_legal_entity_id uuid,
  p_total_amount_cents bigint,
  p_installment_count int,
  p_first_due_date date,
  p_interval_type text,
  p_issue_date date,
  p_custom_due_dates date[] default null
)
returns setof client_receivables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_amounts bigint[];
  v_due_date date;
  i int;
begin
  if not user_has_permission('billing.manage', p_organization_id, p_own_legal_entity_id) then
    raise exception 'Sem permissao para lancar recebivel.';
  end if;
  if p_total_amount_cents <= 0 then
    raise exception 'Valor total deve ser positivo.';
  end if;
  if p_interval_type not in ('MONTHLY', 'DAYS_30', 'CUSTOM') then
    raise exception 'interval_type invalido.';
  end if;
  if p_interval_type = 'CUSTOM' and (p_custom_due_dates is null or array_length(p_custom_due_dates, 1) != p_installment_count) then
    raise exception 'CUSTOM exige uma data de vencimento por parcela.';
  end if;

  insert into client_receivable_installment_groups (organization_id, own_legal_entity_id, fiscal_document_id, customer_partner_id, total_amount_cents, installment_count, first_due_date, interval_type)
  values (p_organization_id, p_own_legal_entity_id, p_fiscal_document_id, p_customer_partner_id, p_total_amount_cents, p_installment_count, p_first_due_date::text, p_interval_type)
  returning id into v_group_id;

  v_amounts := split_cents(p_total_amount_cents, p_installment_count);

  for i in 1..p_installment_count loop
    v_due_date := case
      when p_interval_type = 'CUSTOM' then p_custom_due_dates[i]
      when p_interval_type = 'DAYS_30' then p_first_due_date + ((i - 1) * 30)
      else add_months_safe(p_first_due_date, i - 1)
    end;

    insert into client_receivables (
      organization_id, own_legal_entity_id, fiscal_document_id, customer_partner_id, customer_legal_entity_id,
      installment_group_id, installment_number, installment_count,
      original_amount_cents, final_amount_cents, open_amount_cents,
      issue_date, due_date, status
    ) values (
      p_organization_id, p_own_legal_entity_id, p_fiscal_document_id, p_customer_partner_id, p_customer_legal_entity_id,
      v_group_id, i, p_installment_count,
      v_amounts[i], v_amounts[i], v_amounts[i],
      p_issue_date::text, v_due_date::text, 'OPEN'
    );
  end loop;

  insert into client_receivable_status_history (client_receivable_id, previous_status, new_status, reason, changed_by_user_id)
  select id, 'DRAFT', 'OPEN', 'Recebivel lancado', auth.uid() from client_receivables where installment_group_id = v_group_id;

  return query select * from client_receivables where installment_group_id = v_group_id order by installment_number;
end;
$$;

-- Alocacao de pagamento contra recebivel -- mesmo padrao de
-- allocate_client_payment acima, travando pagamento e recebivel antes de
-- checar saldo.
create or replace function allocate_receivable_payment(
  p_client_receivable_payment_id uuid,
  p_client_receivable_id uuid,
  p_amount_cents bigint
)
returns client_receivables
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment client_receivable_payments%rowtype;
  v_receivable client_receivables%rowtype;
  v_allocated bigint;
begin
  if p_amount_cents <= 0 then
    raise exception 'Valor de alocacao deve ser positivo.';
  end if;

  select * into v_payment from client_receivable_payments where id = p_client_receivable_payment_id for update;
  if not found then raise exception 'Pagamento nao encontrado.'; end if;
  select * into v_receivable from client_receivables where id = p_client_receivable_id for update;
  if not found then raise exception 'Recebivel nao encontrado.'; end if;

  if not user_has_permission('billing.manage', v_receivable.organization_id, v_receivable.own_legal_entity_id) then
    raise exception 'Sem permissao para alocar pagamento.';
  end if;

  if v_receivable.organization_id != v_payment.organization_id
    or v_receivable.own_legal_entity_id != v_payment.own_legal_entity_id
    or v_receivable.customer_partner_id != v_payment.customer_partner_id then
    raise exception 'Pagamento fora do escopo do recebivel.';
  end if;

  select coalesce(sum(amount_cents), 0) into v_allocated
    from client_receivable_payment_allocations
    where client_receivable_payment_id = p_client_receivable_payment_id and cancelled_at is null;
  if v_payment.amount_cents - v_allocated < p_amount_cents then
    raise exception 'Pagamento sem saldo disponivel.';
  end if;
  if v_receivable.open_amount_cents < p_amount_cents then
    raise exception 'Valor maior que saldo aberto.';
  end if;

  insert into client_receivable_payment_allocations (client_receivable_payment_id, client_receivable_id, amount_cents)
  values (p_client_receivable_payment_id, p_client_receivable_id, p_amount_cents);

  return recalculate_client_receivable(p_client_receivable_id);
end;
$$;
