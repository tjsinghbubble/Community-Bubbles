# Handoff — API security hardening from the OWASP ASTF scan (2026-06-26)

Branch: `create_test_platform`. This covers the **two remaining buckets** from the OWASP API
Security Testing Framework (ASTF v1.0.0) scan. The auth + method-escalation buckets are already
fixed and committed; what's left is **security response headers** and **rate limiting / 429**.

Trello: umbrella card **mf1vaYsM** ("Fix security holes in API identified by OWASP ASTF", High).
Companion DoS card **OXamtwL8** (Vite dev-logger `process.exit`). ASTF HTML report is attached to
mf1vaYsM (`astf-scan.t=18:29:20.html`).

---

## TL;DR

The 48 ASTF findings split into four OWASP buckets. Two are **done** (committed `ebcaff4`),
two **remain**:

| Bucket | OWASP | Count | Status |
|--------|-------|------:|--------|
| Missing Authentication Controls | API2 | 8 (High) | ✅ done — `ebcaff4` |
| HTTP Method Escalation (PUT/DELETE/PATCH) | API5 | 24 (High) | ✅ done — `ebcaff4` |
| Missing Security Response Headers | API8 | 8 (Medium) | ⬜ **remaining** |
| Missing Rate Limiting / no 429 | API4 | 8 (Medium) | ⬜ **remaining** |

The 32 High findings were **all artifacts of one bug**: the SPA catch-all returned `200` +
index.html for every unmatched path and every HTTP method, so the scanner read non-existent
endpoints (`/rest`, `/v1`, `/v2`, `/services`, `/service`, `/api`, `/api/v1`, `/api/v2`) as live,
unauthenticated, and accepting `PUT`/`DELETE`/`PATCH`. The routing-contract fix in `ebcaff4`
collapses all 32. The two remaining buckets (16 Medium) are real, independent work.

---

## What's already done (commit `ebcaff4`)

- `server/index.ts`: terminal `/api` handler — unmatched `/api/*` → `404` JSON; modifying verbs
  from an unauthenticated caller → `401` (signature-only JWT check, **no DB lookup** so junk
  traffic can't amplify into DB load); logs `unmatched-api <method> <path> -> <status> ip= uid=`.
  Plus `unhandledRejection`/`uncaughtException` guards and a fail-closed assertion that the Vite
  dev middleware never runs on a deployed host (`REPLIT_DEPLOYMENT`/`BUBBLE_DEPLOYED`).
- `server/vite.ts`: removed the `process.exit(1)` DoS in the custom logger; SPA shell served only
  for GET/HEAD HTML navigations.
- `server/static.ts`: `isSpaDocumentRequest()` (shared gate); non-HTML clients get a JSON 404.
- Tests: `tests/headless/infra/infra-0500` (no Vite on a deployed host), `infra-0510` (malformed-
  request DoS survival), `infra-0520` (routing contract). Suite green: 5 passed / 2 skipped
  (0500 skips on loopback by design).

**Re-scan expectation after `ebcaff4`:** High 32 → ~0. The Medium 16 may *shift* rather than
vanish, because those findings were reported on the now-404 endpoints — the header + rate-limit
fixes below must therefore apply to **all** responses including 404s, not just matched routes.

---

## Remaining bucket 1 — Security response headers (ASTF-API8, 8 Medium)

**Finding:** responses missing `X-Content-Type-Options`, `X-Frame-Options`,
`Strict-Transport-Security`, `Content-Security-Policy`, `X-XSS-Protection`.

**Recommended fix:** `helmet` (already a common dep; `npm i helmet` at repo root if absent),
mounted **early** in `server/index.ts` — before routes and before the CORS block so every
response (including the `/api` 404/401 and the SPA shell) carries the headers.

```ts
import helmet from "helmet";
app.use(helmet({
  // CSP is the one that breaks things — see caveats. Start with it OFF, add a tuned policy later.
  contentSecurityPolicy: false,
  // HSTS only does anything over HTTPS; harmless locally, wanted in prod behind the proxy.
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

**Caveats — do NOT blind-apply a strict CSP:**
1. **CSP + the Vite dev server** — a strict `default-src 'self'` will block Vite HMR
   (`/@vite/client`, inline module preamble, websocket) and the SPA's inline bootstrap. Either
   leave `contentSecurityPolicy: false` in development, or compute a dev-vs-prod policy. The SPA
   itself (built bundle) may also need `'unsafe-inline'`/specific sources — verify the web app
   still loads before committing a CSP. The `X-XSS-Protection` header is deprecated; helmet sets
   it to `0` by default, which is correct (don't force the legacy `1; mode=block`).
2. **`X-Frame-Options: DENY`** — fine for the API; confirm no legitimate iframe embedding of the
   web app exists first.
3. **HSTS** — only meaningful on HTTPS. The deployed host terminates TLS at the proxy; make sure
   `app.set('trust proxy', …)` is correct so HSTS/`req.secure` behave. No effect on localhost
   (http), so it won't break local dev.

**Test to add (`tests/headless/infra/infra-0530-security-headers.headless.test.ts`):** GET a real
route (`/api/v1/health`) AND an unmatched one (to cover 404s); assert
`x-content-type-options: nosniff` and `x-frame-options` present. Keep CSP out of the assertion
until a real policy is chosen (so the test doesn't lock in `false`).

---

## Remaining bucket 2 — Rate limiting / HTTP 429 (ASTF-API4, 8 Medium)

**Finding:** endpoints accepted 20 consecutive requests with no `429`. ASTF hit the unmatched
paths (now 404), but the gap is real: there is **no global/per-IP limiter** — only targeted auth
limits exist (`RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_SEND_MAX`, surfaced in the `qa:server` script).

**Recommended fix:** `express-rate-limit` (+ a store; in-memory is fine for a single instance,
use a shared store like Redis if the deploy is multi-instance). Apply a broad limiter mounted
early enough to also cover the `/api` 404/401 path.

```ts
import rateLimit from "express-rate-limit";
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_API_MAX ?? 120),  // per IP per minute
  standardHeaders: true,   // RateLimit-* headers
  legacyHeaders: false,
  // 429 with Retry-After (express-rate-limit sets Retry-After automatically)
});
app.use("/api", apiLimiter);
```

**Caveats:**
1. **The test suite intentionally raises limits.** `qa:server` already sets
   `RATE_LIMIT_AUTH_MAX=100000 RATE_LIMIT_SEND_MAX=100000` so the headless suite doesn't trip
   lockout. The new `RATE_LIMIT_API_MAX` MUST follow the same pattern — give it a high value in
   `qa:server` (and/or recognize the `X-Bubble-Test` header) or the whole headless suite will
   start getting 429s. Coordinate with `tests/headless/lib/http.ts` which stamps `X-Bubble-Test`.
2. **`trust proxy`** must be set correctly or every request looks like it comes from the proxy IP
   and the per-IP limiter becomes a global limiter (one noisy client locks out everyone).
   Check `req.ip` resolves to the real client behind the deploy proxy.
3. **Per-IP vs per-user** — the new `unmatched-api … ip= uid=` log line (from `ebcaff4`) is the
   seed signal: it already records both the source IP and any presented (possibly bad) user-id on
   unmatched `/api` hits. Decide whether abuse keys on IP, user, or both. For anonymous
   forced-browse (what ASTF did), per-IP is the relevant axis.
4. **Don't double-limit auth.** The existing auth/send limiters stay; the new broad `/api`
   limiter should have a higher ceiling than those so it's a backstop, not a replacement.

**Test to add (`tests/headless/infra/infra-0540-rate-limit.headless.test.ts`):** fire N+1 rapid
requests at a cheap real endpoint (or the 404 path) with a *test-scoped low* limit, assert a
`429` with a `Retry-After`/`RateLimit-*` header appears. Gate it so it only runs when the limit
is set low (otherwise it'd need 100k+ requests under `qa:server` defaults) — e.g. a dedicated
env like `RATE_LIMIT_API_MAX=5` for just this test file, or skip when the limit is high.

---

## Verification loop

1. Make the change, restart `qa:server` (no watch — manual restart needed each time).
2. Run the infra suite:
   `QA_BASE_URL=http://localhost:3000 npx vitest run --config tests/headless/vitest.headless.config.ts tests/headless/infra/`
3. Re-run the ASTF scan against `http://localhost:3000/` and confirm the relevant counts drop.
   Save the new HTML under `tmp/` (gitignored) and attach to card mf1vaYsM.
4. Commit per-bucket (`fix(server,security): add security headers (ASTF-API8)` etc.), stage ONLY
   the changed server/test files — leave the unrelated `attached_assets` deletions in the working
   tree untouched (as `ebcaff4` did).

## Cross-references (Claude memory)

- `[[project_test_request_tagging]]` — `X-Bubble-Test` header; relevant to exempting the test
  suite from the new rate limiter.
- `[[project_qa_server]]` / `[[project_testctl]]` — how `qa:server` is run and the env knobs
  (`RATE_LIMIT_*`) live there.
- `[[project_test_architecture]]` — the `tests/headless/` black-box suite the new infra-053x/054x
  tests belong to.
- `[[ref_rules_api_shapes]]` — existing open server bug drafts in `tmp/trello-cards`.
- Convention: handoffs live in `docs/TC` and cross-reference the memory files
  (`[[feedback_handoff_doc_references_memory]]`).
