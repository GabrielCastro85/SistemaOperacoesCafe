ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS desktop_profile jsonb;

ALTER TABLE app_users
ADD COLUMN IF NOT EXISTS is_central_admin boolean NOT NULL DEFAULT false;

UPDATE app_users
SET is_central_admin = true
WHERE id = (SELECT id FROM app_users ORDER BY created_at LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM app_users WHERE is_central_admin = true);
