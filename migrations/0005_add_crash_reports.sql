CREATE TABLE IF NOT EXISTS "crash_reports" (
  "id" serial PRIMARY KEY NOT NULL,
  "message" text NOT NULL,
  "stack" text,
  "context" text,
  "platform" text,
  "app_version" text,
  "is_fatal" boolean DEFAULT false NOT NULL,
  "user_id" text,
  "username" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "crash_reports_user_id_idx" ON "crash_reports" ("user_id");
CREATE INDEX IF NOT EXISTS "crash_reports_created_at_idx" ON "crash_reports" ("created_at");
CREATE INDEX IF NOT EXISTS "crash_reports_is_fatal_idx" ON "crash_reports" ("is_fatal");
