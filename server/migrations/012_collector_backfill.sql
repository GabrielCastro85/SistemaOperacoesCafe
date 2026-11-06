-- Permite pedir ao coletor o envio de notas de um periodo antigo. O coletor
-- normal so olha os arquivos modificados no ultimo mes.
ALTER TABLE collector_commands ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE collector_commands DROP CONSTRAINT IF EXISTS collector_commands_command_check;
ALTER TABLE collector_commands ADD CONSTRAINT collector_commands_command_check
  CHECK (command IN ('SCAN_NOW', 'UPDATE_NOW', 'RESTART', 'BACKFILL'));

CREATE INDEX IF NOT EXISTS idx_collector_inbox_pending_period
  ON collector_inbox_files(source_code, substring(access_key from 3 for 4))
  WHERE status = 'PENDING';
