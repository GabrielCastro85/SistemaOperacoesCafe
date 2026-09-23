-- Jobs e arquivos de importacao pertencem ao computador que executou a leitura.
-- Caminhos locais, progresso e mensagens de validacao nao sao dados comerciais
-- compartilhados. As notas, eventos e operacoes resultantes continuam centrais.
DELETE FROM central_change_log
WHERE table_name IN ('xml_import_jobs', 'xml_import_files');

DELETE FROM central_records
WHERE table_name IN ('xml_import_jobs', 'xml_import_files');
