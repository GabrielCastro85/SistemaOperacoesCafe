-- ============================================================================
-- business_partners + business_partner_roles precisam ser gravados de forma
-- atomica (mesmo padrao de hoje: createBusinessPartner/updateBusinessPartner
-- em appRepository.ts:556-629 usam this.db.transaction pra isso). O client
-- Supabase (REST/PostgREST) nao consegue abranger 2 tabelas numa unica
-- transacao do lado do app, entao isso vira RPC -- unico jeito de manter a
-- mesma garantia atomica que o SQLite local ja da hoje.
-- ============================================================================

create or replace function create_business_partner(p_row jsonb, p_roles text[])
returns business_partners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner business_partners%rowtype;
  v_role text;
begin
  if not user_has_permission('commercial.manage', (p_row->>'organization_id')::uuid) then
    raise exception 'Sem permissao para cadastrar parceiro.';
  end if;
  if array_length(p_roles, 1) is null then
    raise exception 'Parceiro deve possuir pelo menos um papel.';
  end if;

  insert into business_partners (
    id, organization_id, display_name, notes, is_active, credit_limit_cents, document_number, email, phone, mobile,
    postal_code, address_line, address_number, address_complement, district, city, state, created_at, updated_at
  ) values (
    (p_row->>'id')::uuid, (p_row->>'organization_id')::uuid, p_row->>'display_name', p_row->>'notes', (p_row->>'is_active')::boolean,
    (p_row->>'credit_limit_cents')::bigint, p_row->>'document_number', p_row->>'email', p_row->>'phone', p_row->>'mobile',
    p_row->>'postal_code', p_row->>'address_line', p_row->>'address_number', p_row->>'address_complement',
    p_row->>'district', p_row->>'city', p_row->>'state', (p_row->>'created_at')::timestamptz, (p_row->>'updated_at')::timestamptz
  )
  returning * into v_partner;

  foreach v_role in array p_roles loop
    insert into business_partner_roles (business_partner_id, role) values (v_partner.id, v_role);
  end loop;

  return v_partner;
end;
$$;

create or replace function update_business_partner(p_id uuid, p_row jsonb, p_roles text[])
returns business_partners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner business_partners%rowtype;
  v_role text;
begin
  if not user_has_permission('commercial.manage', (p_row->>'organization_id')::uuid) then
    raise exception 'Sem permissao para editar parceiro.';
  end if;
  if array_length(p_roles, 1) is null then
    raise exception 'Parceiro deve possuir pelo menos um papel.';
  end if;

  update business_partners set
    organization_id = (p_row->>'organization_id')::uuid,
    display_name = p_row->>'display_name',
    notes = p_row->>'notes',
    is_active = (p_row->>'is_active')::boolean,
    credit_limit_cents = (p_row->>'credit_limit_cents')::bigint,
    document_number = p_row->>'document_number',
    email = p_row->>'email',
    phone = p_row->>'phone',
    mobile = p_row->>'mobile',
    postal_code = p_row->>'postal_code',
    address_line = p_row->>'address_line',
    address_number = p_row->>'address_number',
    address_complement = p_row->>'address_complement',
    district = p_row->>'district',
    city = p_row->>'city',
    state = p_row->>'state',
    updated_at = (p_row->>'updated_at')::timestamptz
  where id = p_id
  returning * into v_partner;

  if not found then
    raise exception 'Parceiro nao encontrado.';
  end if;

  delete from business_partner_roles where business_partner_id = p_id;
  foreach v_role in array p_roles loop
    insert into business_partner_roles (business_partner_id, role) values (p_id, v_role);
  end loop;

  return v_partner;
end;
$$;
