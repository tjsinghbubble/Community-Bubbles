---
name: mobile API URL after repl migration
description: Why TestFlight/mobile shows no data after a Replit project move, and the fix
---

# Mobile app shows no data after repl migration

When a Bubble repl is moved/migrated, Replit reassigns the deployment's `.replit.app` subdomain (e.g. `community-bubbles.replit.app` → `community-bubbles-1.replit.app`). The old subdomain goes dead ("This app isn't live yet", HTTP 404). The custom domain `trybubble.io` stays stable and points at the new deployment.

`mobile/eas.json` bakes `EXPO_PUBLIC_API_URL` into each build profile at **build time**. If a profile still references the old subdomain, that compiled binary (already on TestFlight) calls a dead backend and shows no data — even though the production DB is full and the new endpoints work.

**Diagnosis pattern:** "data not showing in TestFlight" after a move is almost always an endpoint/config issue, NOT a DB or seed issue. Verify by curling `<url>/api/bubbles` for old vs new URLs; the prod DB will have the data.

**Fix:** point every `eas.json` profile's `EXPO_PUBLIC_API_URL` at the stable custom domain `https://trybubble.io` (never the `.replit.app` subdomain, which can change again on the next move). Then the user MUST run a new EAS build and re-submit to TestFlight — editing `eas.json` alone does not change an already-shipped binary.
