---
title: Verify Vite dev-logger DoS fix (ebcaff4) shipped + confirm Replit run path
list: Feature/Functionality Defects
request_type: Defect
priority: Medium
platform: Web
menu_item: Deployment, Monitoring, Logs
status: To do
reviewed: false
---
## Status: code fix already landed (ebcaff4, 2026-06-26). Remaining work is release/ops verification.

Original defect: `server/vite.ts` had a custom Vite logger whose `error` handler called `process.exit(1)`. Because the Vite dev middleware serves the SPA in the same Node process as the API, any single request that made Vite throw an internal error killed the whole server — a single-packet, unauthenticated DoS whenever the server ran in non-production mode (`NODE_ENV` unset or `=development`).

Discovered via an OWASP ZAP scan whose spider requested junk paths (`/.DS_Store`, `/src/.DS_Store`); those fell through to the Vite catch-all, `import-analysis` tried to parse the non-JS file as a module and threw, the custom logger called `process.exit(1)`, and every subsequent request returned `Connection refused`.

## What the fix (commit ebcaff4) changed

1. **`server/vite.ts:25`** — removed the `process.exit()`; the logger now logs and continues (`// Do NOT process.exit() here`). A failed module transform is at most a 500 for one request.
2. **`server/index.ts:249-260`** — fail-closed guard: if the Vite branch is reached on a deployed host (`REPLIT_DEPLOYMENT` or `BUBBLE_DEPLOYED` set), the server throws at boot rather than serve Vite.
3. Combined with `scripts/build.ts` inlining `NODE_ENV="production"` into `dist/index.cjs` at esbuild time, the deploy artifact always takes the `serveStatic()` path regardless of runtime env.

## Remaining verification (why this card is still open)

- **(a) Confirm the fix shipped.** Cherry-picked releases can drop commits. Verify the deployed build actually contains `ebcaff4` (`server/vite.ts` has no `process.exit`; `server/index.ts` has the deployed-host guard).
- **(b) Confirm Replit's user-facing run path.** `.replit` has two: the `[deployment]` block (`node ./dist/index.cjs` → production/static, safe) and the workspace Run button (`.replit:2` `run = "npm run dev"` → `NODE_ENV=development` → Vite). If trybubble.io is ever served by an always-on workspace repl rather than a Deployment, and the build predates `ebcaff4`, the DoS is live.

## Safe verification probes (never crash live prod)

- `GET /api/v1/version` — liveness, touches no Vite code.
- Fetch `/` and inspect HTML: dev = `/@vite/client` + `/@react-refresh` + unhashed `/src/main.tsx`; prod = hashed `/assets/index-<hash>.js`.
- `GET /@vite/client` — returns JS on a dev server, 404/SPA-fallback on prod; does NOT route through import-analysis, so it won't crash even an unpatched dev instance.
- `GET /.DS_Store` — **disposable instances only.** On an unpatched dev server this triggers the crash being tested. Don't run against live prod.

## Follow-through

- Keep the `server/index.ts` fail-closed guard in the containerization plan (docs/research/dockerization-plan.md §6/§8): the deployed container must run the production/static path, never Vite.
- Clean up stray `.DS_Store` files and ensure the SPA catch-all 404s non-asset junk instead of feeding it to Vite.
