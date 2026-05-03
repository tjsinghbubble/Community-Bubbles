-- ====================================================
-- BATCH 1: Audit Trail Foundation
-- Trigger function, TIMESTAMPTZ conversion for ALL tables,
-- rename creator_id→created_by (bubbles) and joined_at→created_at (memberships),
-- add audit columns to 8 core tables, install triggers.
-- ====================================================

-- ============================================================
-- STEP 1: Shared trigger function (used by all three batches)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STEP 2: Column renames
-- ============================================================
ALTER TABLE bubbles RENAME COLUMN creator_id TO created_by;
ALTER TABLE memberships RENAME COLUMN joined_at TO created_at;

-- ============================================================
-- STEP 3: Convert ALL TIMESTAMP columns to TIMESTAMPTZ
-- (error_logs.timestamp is already TIMESTAMPTZ — skip it)
-- ============================================================

-- campuses
ALTER TABLE campuses ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- users
ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE users ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- bubbles (joined_at already renamed to created_at above)
ALTER TABLE bubbles ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE bubbles ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';

-- memberships (joined_at already renamed to created_at above)
ALTER TABLE memberships ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- verification_codes
ALTER TABLE verification_codes ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC';
ALTER TABLE verification_codes ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- events
ALTER TABLE events ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- event_attendees (joined_at kept as-is; renamed in Batch 2)
ALTER TABLE event_attendees ALTER COLUMN joined_at TYPE TIMESTAMPTZ USING joined_at AT TIME ZONE 'UTC';

-- user_sessions
ALTER TABLE user_sessions ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at AT TIME ZONE 'UTC';
ALTER TABLE user_sessions ALTER COLUMN ended_at TYPE TIMESTAMPTZ USING ended_at AT TIME ZONE 'UTC';

-- bubble_visits
ALTER TABLE bubble_visits ALTER COLUMN visited_at TYPE TIMESTAMPTZ USING visited_at AT TIME ZONE 'UTC';

-- reports
ALTER TABLE reports ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- bubble_chats
ALTER TABLE bubble_chats ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- admin_member_chats
ALTER TABLE admin_member_chats ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- notifications
ALTER TABLE notifications ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- device_push_tokens
ALTER TABLE device_push_tokens ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE device_push_tokens ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- notification_preferences
ALTER TABLE notification_preferences ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- bulletin_boards
ALTER TABLE bulletin_boards ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE bulletin_boards ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- bulletin_post_types
ALTER TABLE bulletin_post_types ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE bulletin_post_types ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- bulletin_posts
ALTER TABLE bulletin_posts ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE bulletin_posts ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- bulletin_replies
ALTER TABLE bulletin_replies ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE bulletin_replies ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- bulletin_post_reactions
ALTER TABLE bulletin_post_reactions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- app_config
ALTER TABLE app_config ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- rules
ALTER TABLE rules ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- audit_logs
ALTER TABLE audit_logs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- event_signup_tasks
ALTER TABLE event_signup_tasks ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- event_task_signups
ALTER TABLE event_task_signups ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- crash_reports
ALTER TABLE crash_reports ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- latency_buckets
ALTER TABLE latency_buckets ALTER COLUMN bucket_ts TYPE TIMESTAMPTZ USING bucket_ts AT TIME ZONE 'UTC';

-- slow_calls
ALTER TABLE slow_calls ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- api_latency_samples
ALTER TABLE api_latency_samples ALTER COLUMN recorded_at TYPE TIMESTAMPTZ USING recorded_at AT TIME ZONE 'UTC';

-- feedback
ALTER TABLE feedback ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- ============================================================
-- STEP 4: Add new audit columns to Batch 1 tables
-- ============================================================

-- users: add created_by (nullable — users self-register)
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);

-- user_profiles: add created_at, updated_at, updated_by
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

-- bubbles: add updated_at and updated_by (created_by already present from rename)
ALTER TABLE bubbles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE bubbles ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

-- memberships: add created_by, updated_at, updated_by
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

-- bubble_visits: add created_by (nullable — visits can be anonymous)
ALTER TABLE bubble_visits ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);

-- bubble_chats: add created_by, updated_at, updated_by
ALTER TABLE bubble_chats ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
ALTER TABLE bubble_chats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE bubble_chats ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

-- bubble_rules: add all four audit columns
ALTER TABLE bubble_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE bubble_rules ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
ALTER TABLE bubble_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE bubble_rules ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

-- bubble_rule_overrides: add all four audit columns
ALTER TABLE bubble_rule_overrides ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE bubble_rule_overrides ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
ALTER TABLE bubble_rule_overrides ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE bubble_rule_overrides ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

-- ============================================================
-- STEP 5: Backfill memberships.created_by from user_id
-- ============================================================
UPDATE memberships SET created_by = user_id WHERE created_by IS NULL;
ALTER TABLE memberships ALTER COLUMN created_by SET NOT NULL;

-- ============================================================
-- STEP 6: Install BEFORE UPDATE triggers
-- ============================================================
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
