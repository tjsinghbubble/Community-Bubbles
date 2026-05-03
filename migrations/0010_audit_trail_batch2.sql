-- ====================================================
-- BATCH 2: Audit Trail — Events + Bulletin
-- Rename creator_id→created_by (events), joined_at→created_at (event_attendees),
-- TIMESTAMPTZ conversion for new columns, add audit columns to 6 tables,
-- backfill created_by, install BEFORE UPDATE triggers on 7 tables.
-- ====================================================

-- ============================================================
-- STEP 1: Column renames
-- ============================================================
ALTER TABLE events RENAME COLUMN creator_id TO created_by;
ALTER TABLE event_attendees RENAME COLUMN joined_at TO created_at;

-- ============================================================
-- STEP 2: Convert newly renamed/added TIMESTAMP columns to TIMESTAMPTZ
-- ============================================================
ALTER TABLE events ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE event_attendees ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

-- ============================================================
-- STEP 3: Add new audit columns
-- ============================================================

-- events: updated_at, updated_by (created_by already present from rename)
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

-- event_attendees: created_by, updated_at, updated_by
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

-- event_signup_tasks: updated_at, updated_by
ALTER TABLE event_signup_tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE event_signup_tasks ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

-- event_task_signups: created_by, updated_at, updated_by
ALTER TABLE event_task_signups ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);
ALTER TABLE event_task_signups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE event_task_signups ADD COLUMN IF NOT EXISTS updated_by VARCHAR REFERENCES users(id);

-- bulletin_post_reactions: created_by
ALTER TABLE bulletin_post_reactions ADD COLUMN IF NOT EXISTS created_by VARCHAR REFERENCES users(id);

-- notifications: updated_at
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================
-- STEP 4: Backfill created_by from user_id
-- ============================================================
UPDATE event_attendees   SET created_by = user_id WHERE created_by IS NULL;
UPDATE event_task_signups SET created_by = user_id WHERE created_by IS NULL;
UPDATE bulletin_post_reactions SET created_by = user_id WHERE created_by IS NULL;

-- ============================================================
-- STEP 5: Install BEFORE UPDATE triggers (Batch 2 tables)
-- ============================================================
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_attendees_updated_at ON event_attendees;
CREATE TRIGGER update_event_attendees_updated_at
  BEFORE UPDATE ON event_attendees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_signup_tasks_updated_at ON event_signup_tasks;
CREATE TRIGGER update_event_signup_tasks_updated_at
  BEFORE UPDATE ON event_signup_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_event_task_signups_updated_at ON event_task_signups;
CREATE TRIGGER update_event_task_signups_updated_at
  BEFORE UPDATE ON event_task_signups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bulletin_posts_updated_at ON bulletin_posts;
CREATE TRIGGER update_bulletin_posts_updated_at
  BEFORE UPDATE ON bulletin_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bulletin_replies_updated_at ON bulletin_replies;
CREATE TRIGGER update_bulletin_replies_updated_at
  BEFORE UPDATE ON bulletin_replies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
