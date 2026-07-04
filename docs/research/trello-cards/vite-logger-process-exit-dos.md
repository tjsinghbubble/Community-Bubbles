---
title: Vite dev-logger process.exit(1) lets any request crash the whole server (unauth DoS if shipped in non-prod mode)
list: Feature/Functionality Defects
request_type: Defect
priority: High
platform: Web
menu_item: Deployment, Monitoring, Logs
status: To do
reviewed: false
---
## Summary

`server/vite.ts` installs a custom Vite logger whose `error` handler calls
`process.exit(1)`. Because the Vite dev middleware serves the SPA in the same
Node process as the API, **any single request that makes Vite throw an internal
error kills the entire server** — API and web together. This is a
single-packet, unauthenticated denial-of-service whenever the server is running
in non-production mode.

```js
// server/vite.ts
customLogger: {
  ...viteLogger,
  error: (msg, options) => {
    viteLogger.error(msg, options);
    process.exit(1);          // <-- crashes the whole process on ANY vite error
  },
},
```

## How it was discovered

An OWASP ZAP scan (authenticated, member@bubble.test JWT) crashed the local
`npm run qa:server` twice. Root cause was not the scanner — ZAP's
spider/forced-browse just requested junk paths from its wordlist (e.g.
`/.DS_Store`, `/src/.DS_Store`). Those fall through to the Vite catch-all,
Vite's `import-analysis` tries to parse the non-JS file as a module, throws
"Failed to parse source for import analysis", which routes to the custom logger
→ `process.exit(1)` → server dead. Every subsequent request returns
`Connection refused`.

Server log at crash:
```
[vite] Internal server error: Failed to parse source for import analysis
  ... content contains invalid JS syntax ...
  File: /…/client/.DS_Store
```

## Reproduction (any non-prod / Vite-mode server)

```
curl -s http://<host>/.DS_Store          # or /src/.DS_Store, any junk under SPA route
curl -s http://<host>/api/v1/ping        # now: connection refused — process is gone
```

A one-shot demo script is at `tmp/crash-vite-server-demo.zsh`.

## Scope / severity caveat (needs confirmation)

The `process.exit` path is gated to **non-production**: `server/index.ts:185`
uses `serveStatic()` when `NODE_ENV === "production"` and the Vite middleware
otherwise. So the DoS is reachable only when the deployed server runs with
`NODE_ENV` unset or `=development`.

- If alpha/release runs `NODE_ENV=production` (the `.replit` deploy target runs
  `node ./dist/index.cjs` via `npm start`, which sets `NODE_ENV=production`) →
  **not exploitable**, but the footgun is still latent and one missing env var
  away from a production outage.
- If any release/staging instance runs in dev mode (Replit "run" button =
  `npm run dev` = `NODE_ENV=development`) → **remote unauthenticated DoS**.

We cannot inspect the exact release artifacts, so the deployed `NODE_ENV` must
be verified out-of-band (see "How to check safely" below). Priority set to High
pending that confirmation; raise to Highest if any internet-facing instance is
in dev mode.

## Suggested fix

1. **Remove the `process.exit(1)`** from the custom logger in `server/vite.ts`
   — log the error and continue. A failed module transform should be a 500 for
   one request, never a process kill. This is a Replit/Vite-template default,
   not something we need.
2. Add a top-level `process.on('uncaughtException')` / `unhandledRejection`
   guard that logs (Sentry) instead of letting stray throws take the process
   down.
3. **Never run Vite middleware in any deployed environment.** Assert at boot
   that production/staging serve the prebuilt static bundle, and fail closed if
   `NODE_ENV` is not explicitly `production` on a deployed host.
4. Clean up the stray `.DS_Store` files and add `**/.DS_Store` handling so the
   SPA catch-all returns 404 for non-asset junk instead of feeding it to Vite.

## How to check safely (no crash)

`GET /api/v1/version` or the health endpoint, and inspect response
headers/error formatting; a production static build will 404 `/.DS_Store` as
plain static-miss (no Vite import-analysis stack), whereas a dev/Vite server
returns a Vite-flavored 500 and then dies. Probe with the harmless
`/api/.../version` first; only test the `.DS_Store` path against a disposable
instance.
