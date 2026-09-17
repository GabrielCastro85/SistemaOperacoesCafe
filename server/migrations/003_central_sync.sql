CREATE TABLE IF NOT EXISTS central_sync_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision bigint NOT NULL DEFAULT 0,
  promoted_import_run_id uuid REFERENCES sqlite_import_runs(id),
  promoted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO central_sync_state(singleton) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS central_records (
  table_name text NOT NULL,
  row_key text NOT NULL,
  row_data jsonb,
  row_sha256 text,
  revision bigint NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  updated_by_user_id uuid REFERENCES app_users(id),
  updated_by_device_id uuid REFERENCES registered_devices(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, row_key)
);
CREATE INDEX IF NOT EXISTS idx_central_records_revision ON central_records(revision);

CREATE TABLE IF NOT EXISTS central_change_log (
  revision bigint NOT NULL,
  sequence integer NOT NULL,
  table_name text NOT NULL,
  row_key text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('UPSERT', 'DELETE')),
  row_data jsonb,
  row_sha256 text,
  user_id uuid REFERENCES app_users(id),
  device_id uuid REFERENCES registered_devices(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (revision, sequence)
);
CREATE INDEX IF NOT EXISTS idx_central_change_log_record ON central_change_log(table_name, row_key, revision DESC);

CREATE TABLE IF NOT EXISTS central_sync_batches (
  idempotency_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id),
  device_id uuid REFERENCES registered_devices(id),
  base_revision bigint NOT NULL,
  committed_revision bigint NOT NULL,
  change_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
