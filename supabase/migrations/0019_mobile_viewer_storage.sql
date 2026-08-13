-- ============================================================================
-- App de visualizacao pelo celular (somente leitura): o PC continua sendo o
-- unico que escreve dado (nenhuma mudanca no fluxo local nem na numeracao de
-- confirmacao/cobranca -- ver document_sequences, migration 0004). O que essa
-- migration prepara e' so' um DESTINO pro PC empurrar copias dos PDFs/planilhas
-- ja gerados, pra que o app web consiga oferecer o download.
--
-- Papel de leitura: ja existe (role VIEWER, migration 0005, escopo por CNPJ,
-- so' permissoes *.view) -- user_has_org_access ja libera SELECT em
-- client_charges/charge_document_versions/deal_confirmations/... pra qualquer
-- vinculo ativo, incluindo VIEWER (migration 0004/0015). Nao precisa de
-- nenhuma policy nova nessas tabelas; so' as colunas novas abaixo e o bucket.
-- ============================================================================

-- Bucket privado (nunca publico) -- acesso controlado por policy em
-- storage.objects abaixo, nao pela URL do arquivo.
insert into storage.buckets (id, name, public)
values ('confirmation-files', 'confirmation-files', false)
on conflict (id) do nothing;

-- Convencao do nome do objeto: {organization_id}/{own_legal_entity_id}/{kind}/{arquivo}
-- kind = 'confirmations' | 'charges'. storage.foldername(name) retorna os
-- segmentos de pasta como text[] (sem o nome do arquivo) -- [1]=org, [2]=CNPJ.

create policy confirmation_files_select on storage.objects for select
  using (
    bucket_id = 'confirmation-files'
    and user_has_org_access((storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
  );

-- Escrita exige a mesma permissao ja usada pra escrever a linha correspondente
-- (confirmations.manage ou billing.manage) -- o bucket guarda os dois tipos de
-- arquivo, entao aceita qualquer uma das duas.
create policy confirmation_files_insert on storage.objects for insert
  with check (
    bucket_id = 'confirmation-files'
    and (
      user_has_permission('confirmations.manage', (storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
      or user_has_permission('billing.manage', (storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
    )
  );

create policy confirmation_files_update on storage.objects for update
  using (
    bucket_id = 'confirmation-files'
    and (
      user_has_permission('confirmations.manage', (storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
      or user_has_permission('billing.manage', (storage.foldername(name))[1]::uuid, (storage.foldername(name))[2]::uuid)
    )
  );

-- Caminho do objeto no Storage -- nulo ate' o PC subir a copia (ver Fase 2).
-- stored_file_path/pdf_file_path/excel_file_path continuam sendo o caminho
-- LOCAL no HD do PC, sem sentido nenhum fora dele; estas colunas novas sao a
-- referencia que o app web usa pra montar o link de download.
alter table deal_confirmation_document_versions add column if not exists storage_object_path text;
alter table charge_document_versions add column if not exists pdf_storage_object_path text;
alter table charge_document_versions add column if not exists excel_storage_object_path text;
