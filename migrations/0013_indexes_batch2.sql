-- ====================================================
-- BATCH 2: Database Indexes — Secondary Paths
-- ====================================================
-- Adds performance indexes to bulletin feeds, reply threads,
-- admin messaging, user sessions, feedback, and reports.
-- All statements are fully idempotent (CREATE INDEX IF NOT EXISTS).
-- ====================================================

BEGIN;

-- ============================================================
-- STEP 1: user_sessions — look up sessions by user
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON user_sessions (user_id);

-- ============================================================
-- STEP 2: bulletin_posts — board feed queries
-- ============================================================

-- Posts belonging to a board
CREATE INDEX IF NOT EXISTS idx_bulletin_posts_board_id
  ON bulletin_posts (board_id);

-- Posts for a board ordered by creation time (sorted feed)
CREATE INDEX IF NOT EXISTS idx_bulletin_posts_board_created
  ON bulletin_posts (board_id, created_at);

-- Posts authored by a specific user (profile / moderation)
CREATE INDEX IF NOT EXISTS idx_bulletin_posts_author_id
  ON bulletin_posts (author_id);

-- ============================================================
-- STEP 3: bulletin_replies — reply thread queries
-- ============================================================

-- Replies belonging to a post
CREATE INDEX IF NOT EXISTS idx_bulletin_replies_post_id
  ON bulletin_replies (post_id);

-- Replies for a post ordered by creation time (thread feed)
CREATE INDEX IF NOT EXISTS idx_bulletin_replies_post_created
  ON bulletin_replies (post_id, created_at);

-- Replies authored by a specific user
CREATE INDEX IF NOT EXISTS idx_bulletin_replies_author_id
  ON bulletin_replies (author_id);

-- ============================================================
-- STEP 4: admin_member_chats — admin messaging queries
-- (bubble_id, member_id) unique constraint already backed by a DB index — skip
-- ============================================================

-- Recent admin chat threads (admin dashboard listing)
CREATE INDEX IF NOT EXISTS idx_admin_chats_created
  ON admin_member_chats (created_at);

-- Chats initiated by a specific admin actor
CREATE INDEX IF NOT EXISTS idx_admin_chats_created_by
  ON admin_member_chats (created_by);

-- Chats involving a specific member
CREATE INDEX IF NOT EXISTS idx_admin_chats_member_id
  ON admin_member_chats (member_id);

-- ============================================================
-- STEP 5: feedback — listing and filtering submissions
-- ============================================================

-- Recent feedback submissions (admin list, newest first)
CREATE INDEX IF NOT EXISTS idx_feedback_created_at
  ON feedback (created_at);

-- Feedback from a specific user
CREATE INDEX IF NOT EXISTS idx_feedback_user_id
  ON feedback (user_id);

-- ============================================================
-- STEP 6: reports — moderation queue queries
-- ============================================================

-- Reports by status (pending / resolved / dismissed)
CREATE INDEX IF NOT EXISTS idx_reports_status
  ON reports (status);

-- Reports ordered by creation time (admin queue)
CREATE INDEX IF NOT EXISTS idx_reports_created_at
  ON reports (created_at);

-- Reports filed by a specific user
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id
  ON reports (reporter_user_id);

-- Reports targeting a specific user
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id
  ON reports (reported_user_id);

COMMIT;
