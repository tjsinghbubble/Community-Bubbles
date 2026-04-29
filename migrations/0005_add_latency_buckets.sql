CREATE TABLE IF NOT EXISTS "latency_buckets" (
  "id" serial PRIMARY KEY NOT NULL,
  "method" text NOT NULL,
  "endpoint" text NOT NULL,
  "bucket_ts" timestamp NOT NULL,
  "p50_ms" integer NOT NULL,
  "p95_ms" integer NOT NULL,
  "p99_ms" integer NOT NULL,
  "avg_ms" integer NOT NULL,
  "max_ms" integer NOT NULL,
  "count" integer NOT NULL,
  "error_count" integer NOT NULL DEFAULT 0,
  CONSTRAINT "latency_buckets_endpoint_method_ts_unique" UNIQUE("method", "endpoint", "bucket_ts")
);

CREATE INDEX IF NOT EXISTS "latency_buckets_bucket_ts_idx"
  ON "latency_buckets" ("bucket_ts");

CREATE INDEX IF NOT EXISTS "latency_buckets_endpoint_method_idx"
  ON "latency_buckets" ("method", "endpoint");
