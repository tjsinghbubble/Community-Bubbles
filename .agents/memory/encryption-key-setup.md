---
name: ENCRYPTION_KEY setup (Bubble repo)
description: Where ENCRYPTION_KEY must live for both the server workflow and the seed scripts, plus the seed/login email quirk.
---

# ENCRYPTION_KEY must be set in TWO places

The server reads `process.env.ENCRYPTION_KEY` (AES-256-GCM, 64 hex chars / 32 bytes) and the boot
fails hard at startup if it's missing.

- **Server workflow** (`npm run dev` → `tsx server/index.ts`): reads it from the Replit
  **development** env var (set via the environment-secrets tooling, NOT from `.replit`).
- **Seed / reset scripts** (`db:seed-test:local`, `db:reset-full:local`): run with
  `--env-file=.env`, so they read it from a **gitignored `.env`** at repo root. If `.env` is
  absent, seeding runs without the key.

The SAME key value must be in both, or encrypted fields written by one side won't decrypt on the other.

**Why:** During migration the key was only exported in a shell once, so it vanished on workflow
restart and `npm run dev` crashed with "ENCRYPTION_KEY ... required for email encryption".

# Seed inserts plaintext emails — login works via a fallback

`scripts/seed-test-data.ts` inserts users directly via Drizzle with plaintext `email` and no
`email_hash`, bypassing `storage.createUser` (which would encrypt + hash). Login still works because
`storage.getUserByEmail` looks up by `email_hash` first, then falls back to plaintext `users.email`.
So seeded test accounts depend on that fallback, not the encrypted-email path. This is existing
intentional design — don't "fix" it unless asked.

# Pre-existing security note

`.replit` is git-tracked and stores `JWT_SECRET` and `SEED_SECRET` as plaintext under `[userenv]`.
Moving these to Replit Secrets / rotating them is a known pending decision awaiting the user — do not
do it (or rewrite git history) without explicit sign-off.
