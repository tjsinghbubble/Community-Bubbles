-- ====================================================
-- BATCH 3: Audit Trail — Remaining Tables
-- Entirely additive — no column renames.
-- Tables: notification_preferences, device_push_tokens (trigger only),
--         admin_member_chats, feedback, reports, app_config,
--         campuses, rules, app_rules, bulletin_post_types (trigger only),
--         bulletin_boards (trigger only), category_placeholders, user_sessions.
-- ====================================================

-- ============================================================
-- STEP 1: Add new audit columns (all idempotent)
-- ============================================================

-- notification_preferences: created_at, created_by, updated_by
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS created_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS updated_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;

-- admin_member_chats: created_by, updated_at, updated_by
ALTER TABLE admin_member_chats ADD COLUMN IF NOT EXISTS created_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE admin_member_chats ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE admin_member_chats ADD COLUMN IF NOT EXISTS updated_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;

-- feedback: created_by, updated_at, updated_by
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS created_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS updated_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;

-- reports: updated_at, updated_by
ALTER TABLE reports ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE reports ADD COLUMN IF NOT EXISTS updated_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;

-- app_config: created_at, created_by, updated_by
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS created_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS updated_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;

-- campuses: created_by, updated_at, updated_by
ALTER TABLE campuses ADD COLUMN IF NOT EXISTS created_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE campuses ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE campuses ADD COLUMN IF NOT EXISTS updated_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;

-- rules: created_by, updated_at, updated_by
ALTER TABLE rules ADD COLUMN IF NOT EXISTS created_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE rules ADD COLUMN IF NOT EXISTS updated_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;

-- app_rules: all four audit columns
ALTER TABLE app_rules ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE app_rules ADD COLUMN IF NOT EXISTS created_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE app_rules ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE app_rules ADD COLUMN IF NOT EXISTS updated_by  VARCHAR REFERENCES users(id) ON DELETE SET NULL;

-- category_placeholders: created_at, updated_at (reference data — no actor needed)
ALTER TABLE category_placeholders ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE category_placeholders ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- user_sessions: created_at (system table — timestamp only)
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- STEP 2: Backfill feedback.created_by from user_id
-- ============================================================
UPDATE feedback SET created_by = user_id WHERE created_by IS NULL AND user_id IS NOT NULL;

-- ============================================================
-- STEP 3: Install BEFORE UPDATE triggers
-- ============================================================
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_device_push_tokens_updated_at ON device_push_tokens;
CREATE TRIGGER update_device_push_tokens_updated_at
  BEFORE UPDATE ON device_push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_member_chats_updated_at ON admin_member_chats;
CREATE TRIGGER update_admin_member_chats_updated_at
  BEFORE UPDATE ON admin_member_chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_config_updated_at ON app_config;
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campuses_updated_at ON campuses;
CREATE TRIGGER update_campuses_updated_at
  BEFORE UPDATE ON campuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rules_updated_at ON rules;
CREATE TRIGGER update_rules_updated_at
  BEFORE UPDATE ON rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_rules_updated_at ON app_rules;
CREATE TRIGGER update_app_rules_updated_at
  BEFORE UPDATE ON app_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bulletin_post_types_updated_at ON bulletin_post_types;
CREATE TRIGGER update_bulletin_post_types_updated_at
  BEFORE UPDATE ON bulletin_post_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bulletin_boards_updated_at ON bulletin_boards;
CREATE TRIGGER update_bulletin_boards_updated_at
  BEFORE UPDATE ON bulletin_boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_category_placeholders_updated_at ON category_placeholders;
CREATE TRIGGER update_category_placeholders_updated_at
  BEFORE UPDATE ON category_placeholders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
