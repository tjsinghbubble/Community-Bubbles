---
name: Production staging seed (Seinfeld demo data)
description: Why production is full of Seinfeld demo data, and that the seed is non-destructive despite a misleading "one-time" comment.
---

# Production staging seed

> **SUPERSEDED:** production no longer auto-seeds demo data. The prod boot path now
> runs the real-data import instead (see `prod-real-data-import.md`) and fails
> closed (no demo seed). `seedStaging()` is no longer called from `server/index.ts`.
> The history below explains why old prod databases were full of Seinfeld demo data.

`seedStaging()` (server/seed-staging.ts) used to be invoked from server startup
whenever `NODE_ENV === "production"`. The inline comment called it "one-time," but
there was no guard flag — it ran on **every** production boot/deploy.

It populates ~10 Seinfeld users (jerry@/george@/kramer@…seinfeld.com, password
`Bubble123!`), ~20 demo bubbles created by SysAdmin, memberships, events, and RSVPs.
This is why production shows demo data ("Testing", "foo ar", "Larry Bubble",
"Corgi Farm", Seinfeld members) with all rows sharing one created_at batch.

**It is idempotent and non-destructive to user content:**
- Users: create-if-missing-by-email, else update password/isSuperAdmin. No deletes.
- Bubbles: skip-if-exists-by-title. No deletes.
- Memberships / Events / RSVPs: skip existing. No deletes.

The only destructive seed deletes are scoped to category tables
(`db.delete(categories)` in seed-categories.ts, `db.delete(categoryPlaceholders)`
in seed-category-placeholders.ts) — they do NOT touch users/bubbles/events.

**Why this matters:** if real user data goes missing from prod, the staging seed
is NOT the cause — it never wipes user content. Missing pre-upgrade data is because
a repl move/upgrade provisions a fresh DB; the old repl's database is not migrated
over. Recovery means finding the old repl/database, not rolling back the new one.
