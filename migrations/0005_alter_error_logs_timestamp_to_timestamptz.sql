-- Migrate error_logs.timestamp from text to timestamptz for efficient range queries.
-- Existing text values are expected to be valid ISO 8601 strings; any that fail
-- to parse will fall back to the current time via the COALESCE.
ALTER TABLE error_logs
  ALTER COLUMN "timestamp" TYPE timestamptz
    USING COALESCE(
      CASE WHEN "timestamp" ~ '^\d{4}-\d{2}-\d{2}' THEN "timestamp"::timestamptz END,
      NOW()
    ),
  ALTER COLUMN "timestamp" SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS error_logs_timestamp_idx ON error_logs ("timestamp");
