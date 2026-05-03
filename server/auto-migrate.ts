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

      -- feedback (user-submitted feedback, feature requests, defect reports, help requests)
      CREATE TABLE IF NOT EXISTS feedback (
        id         SERIAL PRIMARY KEY,
        user_id    VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        type       TEXT NOT NULL,
        message    TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // ================================================================
    // BATCH 1: Audit Trail Foundation
    // ================================================================

    // Step 1: Create the shared updated_at trigger function
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Step 2: Rename creator_id → created_by on bubbles (idempotent)
    await db.execute(sql`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'bubbles' AND column_name = 'creator_id'
        ) THEN
          ALTER TABLE bubbles RENAME COLUMN creator_id TO created_by;
        END IF;
      END $$;
    `);

    // Step 3: Rename joined_at → created_at on memberships (idempotent)
    await db.execute(sql`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'memberships' AND column_name = 'joined_at'
        ) THEN
          ALTER TABLE memberships RENAME COLUMN joined_at TO created_at;
        END IF;
      END $$;
    `);

    // Step 4: Convert all TIMESTAMP columns to TIMESTAMPTZ across every table.
    // The DO loop checks each column and only converts if still plain TIMESTAMP.
    await db.execute(sql`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN
          SELECT tbl, col FROM (VALUES
            ('campuses',                  'created_at'),
            ('users',                     'created_at'),
            ('users',                     'updated_at'),
            ('bubbles',                   'created_at'),
            ('bubbles',                   'deleted_at'),
            ('memberships',               'created_at'),
            ('verification_codes',        'expires_at'),
            ('verification_codes',        'created_at'),
            ('events',                    'created_at'),
            ('event_attendees',           'joined_at'),
            ('user_sessions',             'started_at'),
            ('user_sessions',             'ended_at'),
            ('bubble_visits',             'visited_at'),
            ('reports',                   'created_at'),
            ('bubble_chats',              'created_at'),
            ('admin_member_chats',        'created_at'),
            ('notifications',             'created_at'),
            ('device_push_tokens',        'created_at'),
            ('device_push_tokens',        'updated_at'),
            ('notification_preferences',  'updated_at'),
            ('bulletin_boards',           'created_at'),
            ('bulletin_boards',           'updated_at'),
            ('bulletin_post_types',       'created_at'),
            ('bulletin_post_types',       'updated_at'),
            ('bulletin_posts',            'created_at'),
            ('bulletin_posts',            'updated_at'),
            ('bulletin_replies',          'created_at'),
            ('bulletin_replies',          'updated_at'),
            ('bulletin_post_reactions',   'created_at'),
            ('app_config',                'updated_at'),
            ('rules',                     'created_at'),
            ('audit_logs',                'created_at'),
            ('event_signup_tasks',        'created_at'),
            ('event_task_signups',        'created_at'),
            ('crash_reports',             'created_at'),
            ('latency_buckets',           'bucket_ts'),
            ('slow_calls',                'created_at'),
            ('api_latency_samples',       'recorded_at'),
            ('feedback',                  'created_at')
          ) AS t(tbl, col)
        LOOP
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = r.tbl
              AND column_name = r.col
              AND data_type = 'timestamp without time zone'
          ) THEN
            EXECUTE format(
              'ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',
              r.tbl, r.col, r.col
            );
          END IF;
        END LOOP;
      END $$;
    `);

    // Step 5: Add new audit columns to core tables (all idempotent)
    await db.execute(sql`
      -- users: created_by (nullable — users self-register)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

      -- user_profiles: full audit trail
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

      -- bubbles: updated_at, updated_by (created_by already present from rename)
      ALTER TABLE bubbles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE bubbles ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

      -- memberships: created_by, updated_at, updated_by
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE memberships ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

      -- bubble_visits: created_by (nullable — visits can be anonymous)
      ALTER TABLE bubble_visits ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);

      -- bubble_chats: created_by, updated_at, updated_by
      ALTER TABLE bubble_chats ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
      ALTER TABLE bubble_chats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE bubble_chats ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

      -- bubble_rules: all four audit columns
      ALTER TABLE bubble_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE bubble_rules ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
      ALTER TABLE bubble_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE bubble_rules ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

      -- bubble_rule_overrides: all four audit columns
      ALTER TABLE bubble_rule_overrides ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE bubble_rule_overrides ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
      ALTER TABLE bubble_rule_overrides ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE bubble_rule_overrides ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);
    `);

    // Step 6: Backfill memberships.created_by from user_id, then add NOT NULL
    await db.execute(sql`
      UPDATE memberships SET created_by = user_id WHERE created_by IS NULL;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'memberships'
            AND column_name = 'created_by'
            AND is_nullable = 'YES'
        ) THEN
          ALTER TABLE memberships ALTER COLUMN created_by SET NOT NULL;
        END IF;
      END $$;
    `);

    // Step 7: Install BEFORE UPDATE triggers (idempotent via DROP IF EXISTS)
    await db.execute(sql`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
      CREATE TRIGGER update_user_profiles_updated_at
        BEFORE UPDATE ON user_profiles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_bubbles_updated_at ON bubbles;
      CREATE TRIGGER update_bubbles_updated_at
        BEFORE UPDATE ON bubbles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_memberships_updated_at ON memberships;
      CREATE TRIGGER update_memberships_updated_at
        BEFORE UPDATE ON memberships
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_bubble_chats_updated_at ON bubble_chats;
      CREATE TRIGGER update_bubble_chats_updated_at
        BEFORE UPDATE ON bubble_chats
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_bubble_rules_updated_at ON bubble_rules;
      CREATE TRIGGER update_bubble_rules_updated_at
        BEFORE UPDATE ON bubble_rules
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      DROP TRIGGER IF EXISTS update_bubble_rule_overrides_updated_at ON bubble_rule_overrides;
      CREATE TRIGGER update_bubble_rule_overrides_updated_at
        BEFORE UPDATE ON bubble_rule_overrides
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log("[autoMigrate] Schema is up to date.");
  } catch (err) {
    console.error("[autoMigrate] Migration failed:", err);
    throw err;
  }
}
