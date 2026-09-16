CREATE TABLE IF NOT EXISTS sqlite_import_runs (
  id uuid PRIMARY KEY,
  source_installation_id text NOT NULL,
  source_database_sha256 text NOT NULL,
  source_database_bytes bigint NOT NULL CHECK (source_database_bytes >= 0),
  source_migration text,
  expected_table_counts jsonb NOT NULL,
  imported_table_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('IMPORTING', 'VERIFIED', 'FAILED')),
  created_by_user_id uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sqlite_import_source_hash
  ON sqlite_import_runs(source_installation_id, source_database_sha256);

CREATE TABLE IF NOT EXISTS sqlite_import_rows (
  run_id uuid NOT NULL REFERENCES sqlite_import_runs(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  row_key text NOT NULL,
  row_data jsonb NOT NULL,
  row_sha256 text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, table_name, row_key)
);
CREATE INDEX IF NOT EXISTS idx_sqlite_import_rows_table ON sqlite_import_rows(run_id, table_name);
