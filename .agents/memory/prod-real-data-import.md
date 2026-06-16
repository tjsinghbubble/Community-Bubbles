---
name: Production real-data import (one-time, in-app)
description: How production gets the user's REAL data — a guarded one-time in-app import on prod boot, because the managed prod DB isn't agent-writable.
---

# Production real-data import

**Decision:** Production serves the user's REAL data, copied once from the old
external source DB into Replit's managed production DB. The agent CANNOT write to
the managed prod DB directly (executeSql against production is a read replica), so
the deployed app performs the load itself on its first production boot.

**Why in-app, not point-at-Neon:** the user explicitly chose to copy everything
into Replit's own prod DB rather than keep pointing prod at the old Neon account —
to avoid a long-term dependency on that old account.

## How it works
- `server/prod-import.ts` `importProdData()` runs from `server/index.ts` only when
  `NODE_ENV === "production"`. Source = `OLD_DATABASE_URL` (Neon, SSL), target =
  the app's own pool (`DATABASE_URL`).
- Idempotent via an `app_config` flag (`prod_real_data_imported='true'`) written
  inside the same transaction — it never re-runs once successful.
- Shared-column intersection per table (treats timestamptz≡timestamp, text≡varchar);
  skips operational/incompatible tables (app_config, latency/error/feedback/
  slow_calls/crash_reports, sessions, `_`-prefixed).
- One transaction: `SET LOCAL session_replication_role = replica` (this DOES work on
  the Replit-managed DB — verified), scoped `DELETE` of only the planned tables (NOT
  `TRUNCATE CASCADE`, so unrelated FK-children like `feedback` are left intact),
  chunked param inserts (json/jsonb re-stringified), `setval` sequences, write flag,
  COMMIT. On ANY error: ROLLBACK + return false, never crashes the app.

## Two safety gates (don't remove without thinking)
1. **Overwrite gate:** if the target already has users, the import REFUSES unless
   `PROD_IMPORT_OVERWRITE=true`. This env var is set in the **production** scope so
   the first deploy can replace the existing demo seed. Once the flag is set the
   override is inert; it can be deleted after a confirmed successful import.
2. **Fail closed:** production NEVER seeds demo/staging data anymore. If the import
   doesn't run (e.g. source unreachable) the DB is left unchanged rather than
   polluted with demo content.

**How to apply:** any future change to the prod data path must preserve both gates.
If the user ever wants a fresh prod re-import, clear the `prod_real_data_imported`
app_config row AND ensure `PROD_IMPORT_OVERWRITE=true` — both are required.

## How to verify it actually ran in prod (after a publish)
- Source (real) counts vs prod read-replica counts must MATCH. Real data ≈ users 37,
  bubbles 43, events 199, memberships 169, event_attendees 637. Demo seed ≈ users 17,
  bubbles 21, events 152. If prod shows the demo numbers, the import did NOT take effect.
- Read source counts from `/home/runner/workspace` (env has `OLD_DATABASE_URL`; the
  code_execution sandbox does NOT expose it). pg only resolves when run from the
  workspace dir, and `tsx` is CJS so wrap in `async main()` (no top-level await).
- Read prod counts via `executeSql({environment:"production"})` (read-only replica).
- Authoritative check: prod `app_config` must contain `prod_real_data_imported='true'`
  AND boot logs must show `[prod-import]` lines. If both are absent, the running
  deployment was built BEFORE the import code — **the fix is to publish again** so the
  server reboots with the new bundle and runs the import on startup.

**Test util:** `scripts/run-prod-import.ts` (`npx tsx`) exercises the real code
against helium (the managed dev DB, which already holds the real data); a
truncate+reload there must reproduce source counts exactly (~32 tables / 7133 rows).
It sets the override and clears the flag so dev is unaffected.
