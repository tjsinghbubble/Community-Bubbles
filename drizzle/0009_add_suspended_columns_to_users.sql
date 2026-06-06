ALTER TABLE users
  ADD COLUMN IF NOT EXISTS suspended_at timestamp,
  ADD COLUMN IF NOT EXISTS suspended_reason text;
