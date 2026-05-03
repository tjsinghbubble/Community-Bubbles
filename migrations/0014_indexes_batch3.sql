-- ====================================================
-- BATCH 3: Database Indexes — Audit Actor Queries
-- ====================================================
-- Indexes the most useful created_by columns and time-series
-- created_at columns for admin reporting and audit tooling.
-- All statements are fully idempotent (CREATE INDEX IF NOT EXISTS).
-- ====================================================

BEGIN;

-- ============================================================
-- STEP 1: events.created_by — look up all events by a user
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_events_created_by
  ON events (created_by);

-- ============================================================
-- STEP 2: bubbles.created_by — look up all bubbles by a user
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bubbles_created_by
  ON bubbles (created_by);

-- ============================================================
-- STEP 3: bulletin_posts.created_by — audit post creation by actor
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bulletin_posts_created_by
  ON bulletin_posts (created_by);

-- ============================================================
-- STEP 4: memberships.created_at — time-series membership activity
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_memberships_created_at
  ON memberships (created_at);

-- ============================================================
-- STEP 5: event_attendees.created_at — time-series RSVP activity
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_event_attendees_created_at
  ON event_attendees (created_at);

-- ============================================================
-- STEP 6: users.created_by — audit admin-created accounts
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_created_by
  ON users (created_by);

COMMIT;
