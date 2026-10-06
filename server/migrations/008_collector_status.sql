CREATE TABLE IF NOT EXISTS collector_status (
  source_code text NOT NULL,
  machine_id text NOT NULL,
  source_label text NOT NULL,
  emitter_cnpjs jsonb NOT NULL DEFAULT '[]'::jsonb,
  collector_version text,
  scan_interval_seconds integer NOT NULL DEFAULT 60 CHECK (scan_interval_seconds >= 15),
  status text NOT NULL CHECK (status IN ('OK','PENDING_RETRY','ERROR')),
  inspected integer NOT NULL DEFAULT 0 CHECK (inspected >= 0),
  eligible integer NOT NULL DEFAULT 0 CHECK (eligible >= 0),
  uploaded integer NOT NULL DEFAULT 0 CHECK (uploaded >= 0),
  pending_upload integer NOT NULL DEFAULT 0 CHECK (pending_upload >= 0),
  last_scan_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  last_upload_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_code, machine_id)
);

CREATE INDEX IF NOT EXISTS idx_collector_status_updated_at ON collector_status(updated_at DESC);
