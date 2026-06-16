---
name: ENCRYPTION_KEY setup (Bubble repo)
description: Where ENCRYPTION_KEY must live for both the server workflow and the seed scripts, plus the seed/login email quirk.
---

# ENCRYPTION_KEY must be set in TWO places

The server reads `process.env.ENCRYPTION_KEY` (AES-256-GCM, 64 hex chars / 32 bytes) and the boot
fails hard at startup if it's missing.

- **Server workflow** (`npm run dev` → `tsx server/index.ts`): reads it from the Replit
  **ENCRYPTION_KEY secret** (global). The real/legacy production data is encrypted with the OLD
  legacy key (NOT the defunct dev key) — the correct value already lives in the ENCRYPTION_KEY
  secret; if real emails won't decrypt or `email_hash` login lookups don't match, the secret holds
  the wrong key. Never paste the key value into memory or any tracked file.
- **Seed / reset scripts** (`db:seed-test:local`, `db:reset-full:local`): run with
  `--env-file=.env`, so they read it from a **gitignored `.env`** at repo root. If `.env` is
  absent, seeding runs without the key.

The SAME key value must be in both, or encrypted fields written by one side won't decrypt on the other.

# A `.replit` dev env-var override MASKS the secret

`[userenv.development] ENCRYPTION_KEY` in `.replit` takes precedence over the global ENCRYPTION_KEY
**secret** in the dev environment. A stale wrong value there (a defunct dev key) silently
masked the correct secret, so decryption kept failing even after the user "added the key."

**Fix:** delete the dev env-var override (`deleteEnvVars development ENCRYPTION_KEY`) so the secret
applies; you cannot `setEnvVars` a key that already exists as a secret (it errors on conflict).
**How to apply:** if decryption fails despite the secret being correct, check `viewEnvVars` for a
development `ENCRYPTION_KEY` and remove it.

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
