-- ====================================================
-- BATCH 1: Database Indexes — Critical Paths
-- ====================================================
-- Adds email_lower column to users for case-insensitive login
-- uniqueness enforcement, unique composite indexes on memberships
-- and event_attendees to prevent duplicates, and performance
-- indexes on events, notifications, and bubble_visits.
-- All statements are fully idempotent.
-- ====================================================

BEGIN;

-- ============================================================
-- STEP 1: Add email_lower column to users
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_lower TEXT;

-- Backfill existing rows that have plaintext email (encrypted values start with 'enc:')
UPDATE users
SET email_lower = lower(email)
WHERE email_lower IS NULL
  AND email NOT LIKE 'enc:%';

-- ============================================================
-- STEP 2: Indexes on users
-- ============================================================

-- Unique partial index on email_lower; NULLs excluded so encrypted-email
-- rows (not yet backfilled) do not conflict with each other.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
  ON users (email_lower)
  WHERE email_lower IS NOT NULL;

-- Supporting index on the email column (used in hash-fallback lookups)
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email);

-- ============================================================
-- STEP 3: Unique composite index on memberships(user_id, bubble_id)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_user_bubble
  ON memberships (user_id, bubble_id);

-- ============================================================
-- STEP 4: Events indexes
-- ============================================================

-- Events by bubble_id (listing a bubble's events)
CREATE INDEX IF NOT EXISTS idx_events_bubble_id
  ON events (bubble_id);

-- Events by bubble_id + start_time for chronological listing.
-- Note: start_time is stored as TEXT; DESC ordering is lexicographic.
-- A future migration will convert this column to TIMESTAMPTZ.
CREATE INDEX IF NOT EXISTS idx_events_bubble_start
  ON events (bubble_id, start_time DESC);

-- Events ordered by creation time (admin / recent-activity feeds)
CREATE INDEX IF NOT EXISTS idx_events_created_at
  ON events (created_at DESC);

-- ============================================================
-- STEP 5: Unique composite index on event_attendees(event_id, user_id)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attendees_event_user
  ON event_attendees (event_id, user_id);

-- ============================================================
-- STEP 6: Notifications inbox index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications (recipient_id, created_at DESC);

-- ============================================================
-- STEP 7: Bubble visits history index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bubble_visits_user_bubble
  ON bubble_visits (user_id, bubble_id);

COMMIT;
