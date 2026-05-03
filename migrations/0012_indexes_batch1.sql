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

-- Backfill existing rows that have plaintext email.
-- Encrypted values start with 'enc:' and are skipped; those rows
-- keep email_lower = NULL (acceptable — PostgreSQL UNIQUE indexes
-- treat NULLs as distinct, so no conflicts arise).
UPDATE users
SET email_lower = lower(email)
WHERE email_lower IS NULL
  AND email NOT LIKE 'enc:%';

-- ============================================================
-- STEP 2: Indexes on users
-- ============================================================

-- Plain unique index on email_lower.
-- NULLs (encrypted-email rows) are naturally distinct and never conflict.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
  ON users (email_lower);

-- Supporting index on the email column (used in hash-fallback lookups)
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email);

-- ============================================================
-- STEP 3: Dedup memberships, then unique composite index
-- ============================================================

-- Guard: remove duplicate (user_id, bubble_id) pairs — keep earliest row.
DELETE FROM memberships
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, bubble_id) id
  FROM memberships
  ORDER BY user_id, bubble_id, created_at ASC
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_user_bubble
  ON memberships (user_id, bubble_id);

-- ============================================================
-- STEP 4: Events indexes
-- ============================================================

-- Events by bubble_id (listing a bubble's events)
CREATE INDEX IF NOT EXISTS idx_events_bubble_id
  ON events (bubble_id);

-- Events by bubble_id + start_time for chronological listing.
-- Note: start_time is stored as TEXT; ordering is lexicographic.
-- A future migration will convert this column to TIMESTAMPTZ.
CREATE INDEX IF NOT EXISTS idx_events_bubble_start
  ON events (bubble_id, start_time);

-- Events ordered by creation time (admin / recent-activity feeds)
CREATE INDEX IF NOT EXISTS idx_events_created_at
  ON events (created_at);

-- ============================================================
-- STEP 5: Dedup event_attendees, then unique composite index
-- ============================================================

-- Guard: remove duplicate (event_id, user_id) pairs — keep earliest row.
DELETE FROM event_attendees
WHERE id NOT IN (
  SELECT DISTINCT ON (event_id, user_id) id
  FROM event_attendees
  ORDER BY event_id, user_id, created_at ASC
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_attendees_event_user
  ON event_attendees (event_id, user_id);

-- ============================================================
-- STEP 6: Notifications inbox index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications (recipient_id, created_at);

-- ============================================================
-- STEP 7: Bubble visits history index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bubble_visits_user_bubble
  ON bubble_visits (user_id, bubble_id);

COMMIT;
