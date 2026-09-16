CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  username text NOT NULL,
  normalized_username text NOT NULL UNIQUE,
  email text,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED')),
  must_change_password boolean NOT NULL DEFAULT false,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_credentials (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
  credential_format text NOT NULL DEFAULT 'bcrypt',
  password_hash text NOT NULL,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registered_devices (
  id uuid PRIMARY KEY,
  installation_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  platform text,
  app_version text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BLOCKED')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES registered_devices(id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_sessions_user ON api_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_api_sessions_expiry ON api_sessions(expires_at);

CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id),
  route text NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON api_idempotency_keys(expires_at);

CREATE TABLE IF NOT EXISTS server_audit_events (
  id uuid PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES app_users(id),
  device_id uuid REFERENCES registered_devices(id),
  action text NOT NULL,
  entity_type text,
  entity_id text,
  result text NOT NULL CHECK (result IN ('SUCCESS', 'DENIED', 'FAILED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_server_audit_occurred ON server_audit_events(occurred_at DESC);

CREATE TABLE IF NOT EXISTS stored_objects (
  id uuid PRIMARY KEY,
  object_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  content_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  sha256 text NOT NULL,
  storage_provider text NOT NULL,
  created_by_user_id uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

