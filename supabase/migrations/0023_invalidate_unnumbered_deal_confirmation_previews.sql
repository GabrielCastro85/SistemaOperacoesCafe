-- Espelho da migracao local 042_invalidate_unnumbered_deal_confirmation_previews.
-- Qualquer previa (GENERATED_DRAFT) marcada como atual num rascunho sem numero
-- reservado nao representa mais o numero oficial e precisa deixar de ser
-- tratada como valida (ver Req 4 da correcao de numeracao de confirmacoes).
begin;

update public.deal_confirmation_document_versions
set is_current = false
where document_type = 'GENERATED_DRAFT'
  and is_current = true
  and deal_confirmation_id in (
    select id from public.deal_confirmations
    where status in ('DRAFT', 'PENDING_REVIEW')
      and confirmation_number is null
  );

commit;
