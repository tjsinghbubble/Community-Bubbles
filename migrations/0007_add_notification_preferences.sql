CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "user_id" varchar PRIMARY KEY REFERENCES "users"("id"),
  "bubble_activity" boolean NOT NULL DEFAULT true,
  "event_activity" boolean NOT NULL DEFAULT true,
  "event_reminders" boolean NOT NULL DEFAULT true,
  "task_reminders" boolean NOT NULL DEFAULT true,
  "waitlist_updates" boolean NOT NULL DEFAULT true,
  "announcements" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
