---
name: Index tracking with Drizzle push
description: Why all DB indexes must be declared in shared/schema.ts and named consistently with auto-migrate raw SQL
---

**Rule:** Every index must be declared in `shared/schema.ts`. `drizzle-kit push` DROPS any index that exists in the DB but isn't in the schema (it silently removed crash_reports/latency_buckets indexes that had been created only by raw SQL in `server/auto-migrate.ts`).

**Why:** July 2026 — old prod DB had ~30 hand-tuned indexes that were never in code; they vanished on repl move and would be dropped by any push. Syncing them into the schema made them permanent.

**How to apply:**
- New index → add `index()`/`uniqueIndex()` in schema table config, then `npm run db:push`. Never create indexes only via raw SQL.
- If auto-migrate raw SQL must create an index (for old prod DBs), use the exact same name Drizzle generates (e.g. `bubbles_short_id_unique`, not `bubbles_short_id_idx`), or push/startup will oscillate.
- `users.google_id`/`apple_id` uniqueness is via PARTIAL unique indexes (`WHERE ... IS NOT NULL`), modeled with `uniqueIndex(...).where(...)` — plain `.unique()` causes a push TTY prompt/drift.
- Before pushing unique indexes to a DB with real data, preflight for duplicates on (memberships user_id+bubble_id) and (event_attendees event_id+user_id).
- The Neon URL `ep-withered-fire-aed2roo4` is the OLD database (same as OLD_DATABASE_URL secret, frozen ~June 5 2026, pre social-auth columns) — not current prod.
