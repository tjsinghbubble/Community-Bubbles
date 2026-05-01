import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Runs idempotent schema migrations on every server startup.
 * All statements use IF NOT EXISTS / IF NOT EXIST guards so they are
 * safe to run repeatedly — they become no-ops once the schema is current.
 *
 * Add new migrations here whenever a task introduces schema changes so
 * both dev and production databases are kept in sync automatically.
 */
export async function autoMigrate(): Promise<void> {
  console.log("[autoMigrate] Checking schema...");

  try {
    await db.execute(sql`
      -- crash_reports (Task: crash report persistence)
      CREATE TABLE IF NOT EXISTS crash_reports (
        id SERIAL PRIMARY KEY,
        message TEXT NOT NULL,
        stack TEXT,
        context TEXT,
        platform TEXT,
        app_version TEXT,
        is_fatal BOOLEAN NOT NULL DEFAULT false,
        user_id TEXT,
        username TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS crash_reports_user_id_idx    ON crash_reports(user_id);
      CREATE INDEX IF NOT EXISTS crash_reports_created_at_idx ON crash_reports(created_at);
      CREATE INDEX IF NOT EXISTS crash_reports_is_fatal_idx   ON crash_reports(is_fatal);

      -- slow_calls (Task: slow API call alerts)
      CREATE TABLE IF NOT EXISTS slow_calls (
        id SERIAL PRIMARY KEY,
        endpoint TEXT NOT NULL,
        method   TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- api_latency_samples (Task: latency dashboard)
      CREATE TABLE IF NOT EXISTS api_latency_samples (
        id SERIAL PRIMARY KEY,
        method   TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        count    INTEGER NOT NULL,
        avg_ms   DOUBLE PRECISION NOT NULL,
        p50_ms   DOUBLE PRECISION NOT NULL,
        p95_ms   DOUBLE PRECISION NOT NULL,
        p99_ms   DOUBLE PRECISION NOT NULL,
        sampled_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- notification_preferences (Task #335: per-user push notification opt-outs)
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id          VARCHAR PRIMARY KEY REFERENCES users(id),
        bubble_activity  BOOLEAN NOT NULL DEFAULT true,
        event_activity   BOOLEAN NOT NULL DEFAULT true,
        event_reminders  BOOLEAN NOT NULL DEFAULT true,
        task_reminders   BOOLEAN NOT NULL DEFAULT true,
        waitlist_updates BOOLEAN NOT NULL DEFAULT true,
        announcements    BOOLEAN NOT NULL DEFAULT true,
        updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- push_paused master toggle (Task #353: pause all push notifications at once)
      ALTER TABLE notification_preferences
        ADD COLUMN IF NOT EXISTS push_paused BOOLEAN NOT NULL DEFAULT false;

      -- event_attendees reminder-sent flags (Task: per-attendee reminder flags)
      ALTER TABLE event_attendees
        ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS reminder_1h_sent  BOOLEAN NOT NULL DEFAULT false;
    `);

    console.log("[autoMigrate] Schema is up to date.");
  } catch (err) {
    console.error("[autoMigrate] Migration failed:", err);
    throw err;
  }
}
