ALTER TABLE "notification_preferences"
  ADD COLUMN IF NOT EXISTS "push_paused" boolean NOT NULL DEFAULT false;
