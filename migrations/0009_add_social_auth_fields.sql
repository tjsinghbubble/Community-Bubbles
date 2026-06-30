ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "apple_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "social_auth_pending" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "date_of_birth" text;

CREATE UNIQUE INDEX IF NOT EXISTS "users_google_id_unique" ON "users"("google_id") WHERE "google_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_apple_id_unique" ON "users"("apple_id") WHERE "apple_id" IS NOT NULL;
