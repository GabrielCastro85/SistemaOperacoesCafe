-- ============================================================================
-- xml_import_jobs nao tinha updated_at -- so' created_at + colunas de estado
-- pontuais (started_at/completed_at/...). Isso quebra o sync poll-based (ver
-- SharedRepository.pullChangesSince): sem uma coluna que mude a cada
-- atualizacao real (status, contadores de progresso), um job so' seria
-- puxado por outro PC UMA vez, logo apos criado -- toda a evolucao depois
-- disso (processando -> concluido, contagem de notas importadas) ficaria
-- invisivel pros outros PCs ate' o job seguinte.
-- ============================================================================

alter table xml_import_jobs add column updated_at timestamptz not null default now();
