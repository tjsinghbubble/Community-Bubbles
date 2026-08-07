---
name: Replit migration quirks (Bubble monorepo)
description: Non-obvious environment gotchas hit when getting this Express + Vite + Expo monorepo to install/run on Replit.
---

- **shell-quote firewall block.** `npm install` fails with a 403 "Blocked by Security Policy / Critical CVE" on `shell-quote@1.8.3` (a transitive dep via `react-devtools-core` / Expo). Fix: pin `shell-quote` to `1.8.4` under `overrides` in BOTH root `package.json` and `mobile/package.json`. **Why:** the firewall blocks the exact version, not the package; the next patch is allowed.
- **npm cache EEXIST.** After a failed install, a retry can die with `EEXIST: .../.npm/_cacache/tmp/...`. Fix: `rm -rf /home/runner/.npm/_cacache/tmp/*` then reinstall.
- **ENCRYPTION_KEY required at startup.** `server/encryption.ts` throws if `ENCRYPTION_KEY` is unset; needs 64 hex chars (32 bytes). Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- **Expo workflow + ngrok.** `expo start --tunnel` fails in this sandbox (ngrok outage + DevTools needs `libglib-2.0.so.0`). Use `--lan` instead; Metro then serves fine on port 8080.
- **Jest stale cache lies.** mobile-crash-reporter jest can report "Could not locate module @react-native/assets-registry/registry" even after deps are installed; clear with `jest --clearCache` (cache at `/tmp/jest_rs`). Real result: 179 tests pass.
- **Secrets live in `.replit` (git-tracked).** `JWT_SECRET`, `SEED_SECRET`, `ENCRYPTION_KEY` are stored as plaintext `[userenv]` env vars in `.replit`, which IS tracked by git. Proper Replit Secrets (DATABASE_URL, SESSION_SECRET, PG*) are separate. Moving these to Secrets / rotating them is destructive (needs user consent) — flag, don't auto-do.
