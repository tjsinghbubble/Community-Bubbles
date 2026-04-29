ALTER TABLE "event_task_signups" ADD COLUMN IF NOT EXISTS "reminder_sent" boolean NOT NULL DEFAULT false;
