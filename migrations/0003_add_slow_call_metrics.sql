CREATE TABLE IF NOT EXISTS "slow_call_metrics" (
  "id" serial PRIMARY KEY NOT NULL,
  "endpoint" text NOT NULL,
  "method" text DEFAULT 'GET' NOT NULL,
  "duration_ms" integer NOT NULL,
  "app_version" text,
  "recorded_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "slow_call_metrics_recorded_at_idx"
  ON "slow_call_metrics" ("recorded_at");

CREATE INDEX IF NOT EXISTS "slow_call_metrics_endpoint_method_idx"
  ON "slow_call_metrics" ("endpoint", "method");
