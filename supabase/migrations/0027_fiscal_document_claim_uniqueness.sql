-- Corrige uma corrida entre PCs: createDealConfirmationFromFiscalDocuments
-- (e linkDealFiscalDocument) decidem se reaproveitam uma confirmacao
-- existente pra uma nota fiscal com um SELECT-then-INSERT inteiramente
-- local, rodado ANTES de qualquer sincronizacao (ver
-- findActiveDealConfirmationForFiscalDocuments em appRepository.ts). Se dois
-- PCs geram uma confirmacao a partir da MESMA nota dentro da janela de sync
-- de ~20s, os dois fazem esse SELECT sem ver o rascunho um do outro ainda, e
-- os dois criam uma confirmacao nova -- nada no Postgres ate' hoje impedia
-- que duas confirmacoes distintas linkassem a mesma nota (o unico indice
-- unico em deal_confirmation_fiscal_documents e' composto por
-- (deal_confirmation_id, fiscal_document_id), que so' impede duplicar o
-- MESMO vinculo, nao um vinculo concorrente de outra confirmacao).
--
-- A correcao usa o mesmo principio ja usado pra numeracao atomica
-- (0020_confirmation_atomic_numbering.sql): deixa o proprio banco ser a
-- autoridade, via constraint, em vez de confiar num check local que roda
-- fora de qualquer transacao compartilhada entre PCs. is_active existe
-- porque uma nota SO' fica livre de novo quando a confirmacao dona e'
-- CANCELLED/REPLACED (ver findActiveDealConfirmationForFiscalDocuments) --
-- nunca so' por status, que e' de deal_confirmations, uma tabela diferente
-- (indice parcial nao pode referenciar outra tabela na condicao).
begin;

alter table deal_confirmation_fiscal_documents add column if not exists is_active boolean not null default true;

update deal_confirmation_fiscal_documents dcfd
set is_active = false
from deal_confirmations dc
where dc.id = dcfd.deal_confirmation_id
  and dc.status in ('CANCELLED', 'REPLACED')
  and dcfd.is_active;

-- Decisao do dono do sistema (17/08/2026): os 12 casos legados abaixo (uma
-- nota com mais de uma confirmacao emitida ao mesmo tempo, todos do dia
-- 05/08/2026 -- a janela em que a numeracao de confirmacao tinha o bug de
-- falha silenciosa) ficam como estao, sem correcao retroativa -- exigiria
-- decidir qual confirmacao e' a "certa" caso a caso, algo que so' quem
-- negociou sabe. A regra passa a valer so' PRA FRENTE: essas 12 notas ficam
-- de fora do indice unico (nunca vao travar nada nelas de novo, pra melhor
-- ou pra pior), qualquer nota nova -- e qualquer nota fora desta lista --
-- ja fica protegida a partir desta migration.
create unique index if not exists deal_confirmation_fiscal_documents_active_claim_uq
  on deal_confirmation_fiscal_documents (fiscal_document_id)
  where is_active and fiscal_document_id not in (
    'f256822c-8250-452b-9780-1aaeb2d97a9d', -- NF 800
    '635c3c9c-b1cc-4a23-8112-dfc82db65ea8', -- NF 801
    '9f70dbec-c888-4f10-9250-ca29f9f10351', -- NF 821
    '032621d5-bd0b-4e60-86ea-8eff72bd65e6', -- NF 823
    'a4d786d7-0615-43f2-80fa-9492f41a06e2', -- NF 827
    'fbfd8358-1d30-436f-93f1-033e80e78f5a', -- NF 833
    'c3cbf26f-c72c-4457-9616-b842f6acb5c6', -- NF 834
    '0ff8b53c-00f0-4af7-be4e-8edc7908734b', -- NF 839
    '0c76fa45-7a79-4983-a1c2-35089c8d2008', -- NF 840
    'ec47fedb-965b-4796-91b0-c8f075026aab', -- NF 842
    '5dae016b-8e97-4954-83a2-98f04d884a8c', -- NF 843
    '5a14dab1-5071-480f-873d-2a89e7fbe09a'  -- NF 844
  );

-- Mantem is_active sincronizado quando a confirmacao dona vira
-- CANCELLED/REPLACED -- so' cobre a transicao PRA esses status; nenhum dos
-- dois tem caminho de volta (cancelDealConfirmation recusa reabrir, e
-- replaceDealConfirmation so' avanca DRAFT/ISSUED/SENT/SIGNED -> REPLACED),
-- entao nao precisa reativar em nenhum outro caso.
create or replace function release_deal_confirmation_fiscal_document_claims()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('CANCELLED', 'REPLACED') and old.status not in ('CANCELLED', 'REPLACED') then
    update deal_confirmation_fiscal_documents
    set is_active = false
    where deal_confirmation_id = new.id
      and is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_release_deal_confirmation_fiscal_document_claims on deal_confirmations;
create trigger trg_release_deal_confirmation_fiscal_document_claims
after update of status on deal_confirmations
for each row execute function release_deal_confirmation_fiscal_document_claims();

commit;
