CREATE TABLE IF NOT EXISTS "api_latency_samples" (
  "id" serial PRIMARY KEY NOT NULL,
  "method" text NOT NULL,
  "endpoint" text NOT NULL,
  "count" integer NOT NULL,
  "p50_ms" integer NOT NULL,
  "p95_ms" integer NOT NULL,
  "p99_ms" integer NOT NULL,
  "avg_ms" integer NOT NULL,
  "max_ms" integer NOT NULL,
  "error_rate" integer NOT NULL,
  "recorded_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "api_latency_samples_recorded_at_idx"
  ON "api_latency_samples" ("recorded_at");

CREATE INDEX IF NOT EXISTS "api_latency_samples_method_endpoint_idx"
  ON "api_latency_samples" ("method", "endpoint");
