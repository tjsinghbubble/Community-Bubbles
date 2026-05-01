CREATE TABLE IF NOT EXISTS "error_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "message" text NOT NULL,
  "timestamp" text NOT NULL,
  "platform" text DEFAULT 'server' NOT NULL,
  "level" text DEFAULT 'error' NOT NULL
);
