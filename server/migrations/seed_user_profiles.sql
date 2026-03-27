-- One-time migration: seed user_profiles from existing users data.
-- Run this ONCE after deploying the schema change that adds the user_profiles table,
-- BEFORE removing profile columns from the users table.
INSERT INTO user_profiles (
  user_id, name, interests, campus_id, campus_email,
  campus_verified, dismissed_campus_prompt, profile_photo, about_me
)
SELECT
  id, name, interests, campus_id, campus_email,
  campus_verified, dismissed_campus_prompt, profile_photo, about_me
FROM users
ON CONFLICT (user_id) DO NOTHING;
