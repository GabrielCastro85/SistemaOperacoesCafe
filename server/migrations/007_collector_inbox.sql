CREATE TABLE IF NOT EXISTS collector_inbox_files (
  id uuid PRIMARY KEY,
  source_code text NOT NULL,
  source_label text NOT NULL,
  machine_id text NOT NULL,
  original_file_name text NOT NULL,
  file_hash text NOT NULL CHECK (file_hash ~ '^[a-f0-9]{64}$'),
  file_size integer NOT NULL CHECK (file_size > 0),
  access_key text,
  xml_type text NOT NULL,
  xml_content bytea NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','IMPORTED','IGNORED')),
  received_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid REFERENCES app_users(id),
  resolution_note text,
  UNIQUE (source_code, file_hash)
);

CREATE INDEX IF NOT EXISTS idx_collector_inbox_status ON collector_inbox_files(source_code, status, received_at);
CREATE INDEX IF NOT EXISTS idx_collector_inbox_access_key ON collector_inbox_files(access_key);
