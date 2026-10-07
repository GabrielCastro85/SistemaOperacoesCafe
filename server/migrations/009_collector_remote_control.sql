ALTER TABLE collector_status ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE collector_status ADD COLUMN IF NOT EXISTS uptime_seconds integer;
ALTER TABLE collector_status ADD COLUMN IF NOT EXISTS last_update_check_at timestamptz;
ALTER TABLE collector_status ADD COLUMN IF NOT EXISTS recent_logs text;
ALTER TABLE collector_status ADD COLUMN IF NOT EXISTS startup_configured boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS collector_commands (
  id uuid PRIMARY KEY,
  source_code text NOT NULL,
  machine_id text NOT NULL,
  command text NOT NULL CHECK (command IN ('SCAN_NOW', 'UPDATE_NOW', 'RESTART')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  requested_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  result_message text
);

CREATE INDEX IF NOT EXISTS idx_collector_commands_pending
  ON collector_commands(source_code, machine_id, requested_at)
  WHERE status = 'PENDING';
