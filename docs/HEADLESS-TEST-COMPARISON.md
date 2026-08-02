# Headless Test Comparison — local platform vs. GitHub CI

Status: DRAFT v1 (2026-07-02). All sections populated. Run statistics from the
GitHub Actions API; test inventories from a full repo scan — see the Method note at
the end.

---

## last-minute notes, omgwtfbbq

                                                                                                                                  
⏺ Section A.1 now contains the concrete diff, and the environment findings are recorded in B. Direct answers to your two          
  questions:                                                                                                                      
                                                                                                                                  

Question:    Seeded or just-created accounts? Just-created, every run. global-setup.ts signs up a fresh e2e-user-${Date.now()}@e2e.test, and 
  the auth/rate-limit tests mint their own e2e-auth-*/rate-limit-* throwaways. Nothing is cleaned up — global-teardown only       
  deletes a local JSON file — so each staging run permanently deposits several accounts plus an approved public "E2E Test Bubble" 
  and "E2E Test Event". The one non-created account it uses is worse than seeded: it logs in as george@seinfeld.com / Bubble123!, 
  a super-admin the server's startup seed creates on every non-development deployment — a hardcoded, committed password on a      
  super-admin account that exists on staging and, by the same logic, production.   
  
FIXME - manage super-admin accounts differently

Question:    How does it determine staging vs production? It doesn't — there is no environment detection or write-guard anywhere in the        Playwright suite. The distinction is purely workflow wiring: staging-e2e.yml passes secrets.STAGING_URL as E2E_BASE_URL and runs
  everything; pre-release.yml passes secrets.PRODUCTION_URL and relies on --grep @prod-safe — which matches zero tests. So the    
  pre-release job's "read-only production health check" is doubly wrong: today it runs nothing, and if the grep were fixed,       
  global-setup would still sign up a user and super-admin-create/approve a bubble + event on production before the first          
  "read-only" test executed. (The headless platform is the contrast case: gateProductionGuard plus the fail-closed                
  assertDestructiveAllowed DB classification check.)                                                                              
                                                                                                                                  
  The diff (A.1) — two files, verified against the actual runner mechanics:                                                       
  1. package.json: "postinstall": "command -v zsh >/dev/null 2>&1 && scripts/flag-temp-files.zsh || true" — unbreaks npm ci on    
  Linux; reconcile with develop's bash script at merge.                                                                           
  2. ci.yml: an additive headless job — same postgres:16 service as the e2e job, npm ci, global newman install (it's spawned as a 
  bare binary and isn't a dependency), a CI-only .env (the runner and seeder use tsx --env-file=.env; port 3000 to match          
  environments.json's local apiBaseUrl), drizzle-kit push, background qa:server with a ping wait, then npm run qa -- --layer      
  headless — the qa runner rather than raw test:headless, because bare vitest is tag-blind (it would run the unverified           
  expected-failure sec-0110 and skip the newman contract). Runner exit codes (0/1/2/3) are CI-ready, and it seeds the DB itself.  
  Artifacts upload on failure.                                                                                                    
                                                                                                                                  
  Worth a decision soon (outside this PR): rotate or gate the george@seinfeld.com seed on production — that's a live security     
  exposure regardless of what happens with CI.  


## A. Intro

This document proposes widening the current PR (test platform: e2e/headless suite +
consolidated environment health tooling) from local-machine testing only to also
repairing and extending the GitHub CI checks so they use the same testing framework.

The proposal, in one paragraph: the CI `e2e` job already builds exactly the
infrastructure the headless test layer needs (ephemeral Postgres service container +
schema push + a live API server started from the PR's code), but today it runs only a
small Playwright API suite. The headless layer (`tests/headless/**`, black-box HTTP
tests) is CI-viable as-is — no simulator, sequential-safe, 30s timeouts — and covers
far more functional area. Separately, the CI workflow is currently red on this PR's
branches for a reason unrelated to any test: a zsh-only `postinstall` script that
cannot run on GitHub's Linux runners. That must be fixed in this PR regardless,
because merging as-is would break CI on `develop`.

Impact if adopted:

- CI goes green on this PR (portable postinstall fix).
- PR checks gain the headless layer's coverage (security lockout/rate-limit,
  contract, monitoring, reports, rules, admin surfaces) that the current Playwright
  suite does not touch.
- One test technology/runner story across local dev and CI, reducing the
  double-maintenance between `server/__tests__/e2e` (Playwright) and
  `tests/headless` (vitest black-box), which overlap in kind (both are HTTP tests
  against a live server).
- Out of scope: the Maestro (simulator) e2e layer stays local — it needs an iOS
  simulator and an app build that ubuntu runners cannot provide.

### A.1 The concrete diff

Two files change. Verified assumptions: qa runner `--env local` resolves
`apiBaseUrl` to `http://localhost:3000` and the DB from `TEST_DATABASE_URL`
(`tests/config/environments.json`); the server binds `API_WEB_SERVER_PORT`
(default 5000, local convention 3000 per `.env.example`); the runner re-seeds via
`npx tsx --env-file=.env tests/fixtures/seed.ts` unless `--no-seed`, so `.env` must
exist (Node's `--env-file` never overrides values already in the environment);
`newman` is spawned as a bare binary and is not in `package.json`, so CI must
install it; seeding needs `ENCRYPTION_KEY` (uses `server/encryption.ts`); runner
exit codes are CI-ready (0 ok incl. expected findings / 1 real failure / 2 gate
cancel / 3 crash).

**1. `package.json` — unbreak `npm ci` on Linux runners (required first):**

```diff
-    "postinstall": "scripts/flag-temp-files.zsh",
+    "postinstall": "command -v zsh >/dev/null 2>&1 && scripts/flag-temp-files.zsh || true",
```

(The script is macOS backup/indexing hygiene; a no-op elsewhere is correct. On
merge, reconcile with `develop`'s `bash scripts/exclude-dev-tools-from-cloud.sh` —
one portable postinstall, not two.)

**2. `.github/workflows/ci.yml` — append a third job:**

```yaml
  # ── Headless API smoke suite (qa runner: vitest black-box + newman contract) ──
  headless:
    name: Headless API tests (qa smoke)
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: bubble_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install newman (contract-0100 runs via bare `newman`)
        run: npm install -g newman

      # qa runner + seed use `tsx --env-file=.env`; Node's --env-file is the
      # single source here (nothing else sets these), values are CI-only fakes.
      - name: Write CI .env
        run: |
          cat > .env <<'EOF'
          API_WEB_SERVER_PORT=3000
          TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bubble_test
          DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bubble_test
          JWT_SECRET=headless-ci-jwt-secret-not-for-production
          ENCRYPTION_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
          RESEND_API_KEY=test-no-emails-sent
          SHARE_BASE_URL=http://localhost:3000
          EXPO_PUBLIC_COMETCHAT_APP_ID=test
          COMETCHAT_API_KEY=test
          EOF

      - name: Push database schema
        run: npx drizzle-kit push --force
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/bubble_test

      - name: Start QA server
        run: |
          mkdir -p tmp
          npm run qa:server > tmp/qa-server-ci.log 2>&1 &
          for i in $(seq 1 40); do
            curl -fsS http://localhost:3000/api/v1/ping && exit 0
            sleep 1
          done
          echo "QA server never answered ping" >&2
          tail -50 tmp/qa-server-ci.log >&2
          exit 1

      # Smoke set (167 tests incl. newman contract). Runner seeds the DB itself.
      # If a pre-flight gate misfires on hosted runners (e.g. load average),
      # fall back to: npm run qa -- --layer headless --no-gate
      - name: Run headless smoke suite
        run: npm run qa -- --layer headless

      - name: Upload qa artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: headless-report-${{ github.run_id }}
          path: |
            tests/output/
            tmp/qa-server-ci.log
          retention-days: 7
```

Deliberate choices: the qa runner (not `npm run test:headless`) is the entry point,
because bare vitest is tag-blind — it would run `unverified` expected-failure tests
(`sec-0110`) and would skip the newman contract check. Smoke (167) is the PR gate;
a full-set (`--all`) job can be added later on merge-to-develop if wanted (ci.yml
currently triggers only on `pull_request`). The job is additive — the existing
`unit` and `e2e` jobs are untouched.

## B. Proposed changes and impact

### B.1 Why CI is failing today (three distinct causes, all at `npm ci`)

1. **This PR's branches (June 30 → July 2, 9 failed runs).** `package.json` on
   `create_test_platform_2` / `reconcile/test-platform-into-develop` has
   `"postinstall": "scripts/flag-temp-files.zsh"` (added 2026-06-10, commit
   `14571a4`). GitHub ubuntu runners have no zsh →
   `/usr/bin/env: 'zsh': No such file or directory` → exit 127 → both CI jobs die at
   "Install dependencies". Commit `584df1a` (non-fatal `debug()`) does not help — the
   interpreter itself is missing. `develop` carries a portable equivalent:
   `"postinstall": "bash scripts/exclude-dev-tools-from-cloud.sh"`. The divergence is
   the whole failure.
2. **June 22–28 wave (~28 failures on develop/main/replit-sync branches).** Replit's
   package proxy leaked into `package-lock.json` — `resolved` URLs pointing at
   `http://package-firewall.replit.local/npm/...`, unresolvable from GitHub →
   `EAI_AGAIN`. Fixed incrementally (`fix/ci-replit-registry-urls`, June 26; fully
   clean in develop merge #93, June 30).
3. **May 15 (7 failures).** Initial CI setup shakeout (`fix/ci-branch-names`) plus
   scattered genuine test failures on feature branches.

Latent, not yet fatal: CI pins Node 20 while commitlint 21 / lint-staged 17 declare
`engines: node >= 22` (`EBADENGINE` warnings), and GitHub is deprecating Node 20
runner actions.

Additional defect found during inventory: **the `@prod-safe` selection is broken.**
The tag exists only as file-top *comments* in `health.e2e.ts` and `deep-links.e2e.ts`,
never in test titles, so `npx playwright test --grep "@prod-safe"` matches **zero
tests**. `pre-release.yml` (production health gate) and `npm run test:e2e:prod`
currently select nothing — and Playwright exits non-zero on "no tests found".
Related: `staging-e2e.yml` runs the **full** 32-test suite against live staging,
including write tests (signups, rate-limit lockouts), not a safe subset.

How the Playwright suite handles environments (verified in
`server/__tests__/e2e/global-setup.ts`):

- **Staging vs production is decided by workflow wiring alone** — whichever secret
  lands in `E2E_BASE_URL` (`STAGING_URL` in staging-e2e.yml, `PRODUCTION_URL` in
  pre-release.yml) plus the broken `@prod-safe` grep. The test code contains **no
  environment detection and no write guard** (contrast: the headless platform has
  `gateProductionGuard` and the fail-closed `assertDestructiveAllowed` DB check).
- **Write tests use just-created accounts, not seeded ones**: unique
  `e2e-*-${Date.now()}@e2e.test` addresses per run. Nothing cleans them up
  (global-teardown deletes only a local context file), so every staging run
  permanently adds a user, throwaway auth/rate-limit accounts, and a
  super-admin-approved public "E2E Test Bubble"/"E2E Test Event".
- **Hardcoded super-admin credential**: global-setup logs in as
  `george@seinfeld.com` / `Bubble123!`, an account the server's startup seed
  creates whenever `NODE_ENV !== "development"` — which includes staging and
  production. A publicly known password on a super-admin account in non-dev
  environments is a standing security exposure independent of CI.
- Consequently `pre-release.yml`'s "read-only production health check" label is
  wrong twice over: its grep selects nothing today, and if fixed, global-setup
  would still sign up a user and create/approve a bubble + event **on production**
  before any "read-only" test runs.

### B.2 What a PR check actually launches (timing / ephemerality)

The CI `e2e` job builds a fully ephemeral stack containing the PR's code, per run:

1. `postgres:16` service container starts before any step (fresh empty `bubble_test`
   DB, health-gated on `pg_isready`); lives only for the job.
2. `actions/checkout` on a `pull_request` event checks out the **merge ref** (PR
   merged into `develop`) — tests what would land, not the branch in isolation.
3. `npm ci` (where all current failures occur).
4. `npx drizzle-kit push --force` applies the PR's schema to the empty DB.
5. The API server is launched by Playwright itself (no `E2E_BASE_URL` set in ci.yml →
   the `webServer` block in `playwright.config.ts` spawns `npx tsx server/index.ts`
   with test env, polls `/api/v1/ping` up to 40s, runs tests with `workers: 1`, kills
   the server). Everything is torn down when the job ends.

Note on naming: the "Playwright e2e" suite is functionally **API-level HTTP testing**
(JSON headers, no browser-page interaction in the harness) — the same species as
`tests/headless`. `staging-e2e.yml` and `pre-release.yml` run the same suite against
live staging/production by setting `E2E_BASE_URL`, which disables the local server
spawn.

### B.3 Gap between the headless platform and current CI

- CI has, the headless platform job would lack: `tsc` type check, root vitest unit
  tests, mobile Jest, the existing Playwright API e2e suite.
- The headless platform has, CI lacks: real-socket black-box coverage across ~13
  functional areas (auth, security lockout/rate-limit, contract, monitoring, reports,
  rules, site-admin, …), deterministic seeded DB + `qa:sig` fingerprint/schema-drift
  checks, tag/role-based selection, two-phase gating, run-scoped artifacts, testing
  journal.
- Overlap: the Playwright API e2e suite is a small subset of headless-style API
  coverage — a long-term consolidation candidate.

### B.4 Permissions (who can change the checks)

Account `tidal-wall`: `push` ✅, `maintain` ❌, `admin` ❌; token scopes include
`repo` + `workflow`.

- Modify an existing check: **yes** — `pull_request` runs use the PR branch's
  workflow file, so a `ci.yml` fix inside this PR takes effect on this PR
  immediately.
- Add a new check (new workflow file): **yes**.
- Disable/enable a workflow: **yes** (write access suffices).
- Change required status checks / branch protection: **no** (admin only). `main`
  requires the two lint checks via `setup-branch-protection.yml` (runs with an
  `ADMIN_PAT` secret); `develop` is protected but its config is unreadable without
  admin.

### B.5 Proposed change list

1. **Portable postinstall (required, unblocks everything).** Either keep `develop`'s
   bash script, or guard:
   `"postinstall": "command -v zsh >/dev/null && scripts/flag-temp-files.zsh || true"`
   (the script is a macOS-only backup/indexing concern; a no-op in CI is correct).
2. **Add a headless job (or step) to `ci.yml`** reusing the existing Postgres service
   pattern: `drizzle-kit push` → seed (`qa:seed`) → start `qa:server` → run
   `npm run test:headless` (or `qa -- --layer headless --tags smoke` for a faster
   PR-gate subset, full set on merge to develop).
3. **Keep Maestro/simulator layers out of CI.**
4. Later/optional: consolidate `server/__tests__/e2e` into the headless layer;
   bump CI Node to 22 to clear `EBADENGINE`.

## C. CI check outcomes since creation (the observed failures)

CI workflow created 2026-05-10. 136 runs: **80 success / 55 failure / 1 cancelled**
(59% success). Companion checks for reference: Staging E2E 39/42 success,
Commitlint 75 success / 68 failure, PR Title Lint 166/170 success.

Weekly outcomes (ISO weeks; W24–W25 had no runs):

| Week | Dates | Success | Failure | Dominant cause of failures |
|---|---|---:|---:|---|
| 2026-W20 | May 11–17 | 8 | 8 (+1 cancelled) | initial CI setup shakeout (`fix/ci-branch-names`) |
| 2026-W21 | May 18–24 | 37 | 7 | genuine test failures on feature branches |
| 2026-W22 | May 25–31 | 28 | 1 | (healthy) |
| 2026-W23 | Jun 1–7 | 1 | 1 | genuine test failure (`sync/main-to-develop-june`) |
| 2026-W26 | Jun 22–28 | 4 | 29 | Replit `package-firewall.replit.local` URLs in lockfile |
| 2026-W27 | Jun 29–Jul 5 | 2 | 9 | zsh `postinstall` on this PR's branches |

```mermaid
xychart-beta
    title "CI runs per ISO week — success vs failure"
    x-axis ["W20", "W21", "W22", "W23", "W24", "W25", "W26", "W27"]
    y-axis "runs" 0 --> 40
    bar "success" [8, 37, 28, 1, 0, 0, 4, 2]
    bar "failure" [8, 7, 1, 1, 0, 0, 29, 9]
```

```mermaid
timeline
    title CI failure eras
    May 10-15 : CI created : branch-name config shakeout (7 fails in one day)
    May 19 - Jun 6 : healthy era : 66 success / 9 fail, failures = real test findings
    Jun 22-28 : Replit lockfile era : package-firewall.replit.local in package-lock.json : fixed by fix/ci-replit-registry-urls + merge PR 93
    Jun 30 - Jul 2 : zsh postinstall era : test-platform branches only : fix proposed in this PR
```

Key reading: **not one of the 55 failures since June 22 was a test catching a
regression** — they are all environment/portability failures at `npm ci`. The checks
have been signal-free for the exact period this PR was under development.

## D. Matrix: test counts by context

> Contexts. The three requested, plus four this repo already exercises that belong in
> the comparison:
>
> - **headless+smoke** — `npm run qa` default: headless layer, `smoke` tag
> - **headless+all** — `npm run test:headless` / `qa --layer headless` (full set)
> - **CI headless (proposed)** — the headless set proposed to run in `ci.yml`
> - **CI unit (current)** — `tsc` + root vitest + mobile Jest in `ci.yml`
> - **CI e2e (current)** — Playwright API suite in `ci.yml`
> - **staging-e2e (current)** — same Playwright suite vs. live staging on merge to develop
> - **pre-release @prod-safe (current)** — Playwright `@prod-safe` subset vs. production, manual

How selection actually works (verified in `tests/runner/select.ts`): tags live
in-file as `// qa-tags:` comments, per file not per `it`; `npm run qa` selects the
`smoke` tag; `--all`/`--area` widens; `npm run test:headless` runs **all** headless
vitest files ignoring tags and does **not** run the newman contract collection
(which is a synthetic descriptor `contract-0100`, hardcoded in select.ts, run only
by the qa runner). Tests tagged `unverified` are excluded from smoke and reported as
"expected findings".

| Context | What runs | Files/suites | Individual tests |
|---|---|---|---:|
| headless+smoke | headless files tagged `smoke` + newman contract | 21 vitest files + 1 newman collection | 165 `it` + 2 requests = **167** |
| headless+all | every registered headless test (`qa --all`) | 113 vitest files + 1 newman | 321 `it` + 2 requests = **323** |
| (variant) `npm run test:headless` | all headless vitest, tag-blind, no newman | 113 files | 321 |
| CI headless (proposed) | smoke set as PR gate; full set on merge to develop | as above | **167** / 323 |
| CI unit (current) | `tsc` + root vitest + mobile Jest | 19 + 2 files | 356 + 179 = **535** |
| CI e2e (current) | Playwright API suite | 5 files | **32** |
| staging-e2e (current) | same Playwright suite vs live staging | 5 files | 32 selected (~28 effective — 4 deep-link tests self-skip without seeded data) |
| pre-release @prod-safe (current) | Playwright `--grep @prod-safe` vs production | intended 2 files | intended 14, **actual 0 — selection broken** |

Notes: mobile Jest's 179 is dominated by one file (`crashReporter.test.ts`, 174
fine-grained truncation cases). `sec-0200` alone contributes 117 parameterized
route-authorization probes to the headless counts. Raw `it`-block counts therefore
overstate breadth in both directions; section E is the better shape comparison.

## E. Matrix: counts by functional area × context

Counts are individual tests (`it` blocks / Playwright `test` blocks / newman
requests). Functional areas from `tests/TAXONOMY.md`; CI-only suites mapped to the
nearest area (mapping noted). Areas marked *(unknown)* have no headless taxonomy
entry.

| Functional area | headless+smoke | headless+all | CI unit (current) | CI e2e (current) | staging-e2e | pre-release (intended) |
|---|---:|---:|---:|---:|---:|---:|
| auth | 4 | 11 | 74 ¹ | 8 | 8 | — |
| bubble-admin | 3 | 23 | 19 ² | — | — | — |
| campus | — | — | 22 | — | — | — |
| categories | — | 14 | — | — | — | — |
| contract | 2 | 2 | — | — | — | — |
| events | 19 | 24 | 81 | — | — | — |
| infra (incl. share/deep-links) | 9 | 9 | — | 11 | 11 ³ | 11 |
| joining | 6 | 19 | 46 ⁴ | — | — | — |
| monitoring | — | 18 | 219 ⁵ | 3 | 3 | 3 |
| notifications *(unknown)* | — | — | 13 | — | — | — |
| profile *(unknown)* | — | — | 4 | — | — | — |
| reports | — | 7 | 21 | — | — | — |
| rules | — | 51 | — | — | — | — |
| security | 119 ⁶ | 120 | — | 6 | 6 | — |
| site-admin | 5 | 25 | 36 | 4 | 4 | — |
| **Total** | **167** | **323** | **535** | **32** | **32** | **14 (actual 0)** |

¹ auth.test.ts 28 + password-reset 17 + send-verification 10 + verify-code 14 + mobile AuthContext 5.
² bubbles.test.ts (create/read bubble).
³ 10 of the 11 self-skip against staging/prod (no seeded bubble/event).
⁴ bubble-membership.test.ts (join/leave/roles/waitlist at mock level).
⁵ crash-report 19 + sentry 14 + slowCallConfig 12 + mobile crashReporter 174.
⁶ sec-0200's 117-probe role-authorization matrix + sec-0100 + sec-0120.

Shape reading: current CI is deep on **mock-level unit coverage** (auth, events,
joining) and thin everywhere live; the headless layer is the only coverage at all
for **categories, rules, reports (live), monitoring (live), contract** — and its
security matrix (120) dwarfs CI's 6. Conversely nothing in the headless layer covers
**deep-links/share pages, campus, notifications, mobile client code**, which only CI
has.

## F. Matrix: test comparisons by functional area and context

Y axis: named tests/use-cases, grouped by functional area; positive/negative
variants of one use case share a row (e.g. `auth-1100/1110`). Adjacent rows marked
`≈` are near-equivalents across suites — they don't align 1:1, so each suite keeps
its own row. X axis contexts: **HS** headless+smoke, **HA** headless+all,
**CIU** CI unit (current), **CIE** CI e2e (current), **STG** staging-e2e,
**PRE** pre-release @prod-safe.

Legend: ✓ runs · — not present · S selected but self-skips at runtime ·
F `it.fails` tripwire (passes while known divergence exists) · ✗ selected but
selection broken (matches zero tests) · (m) mock-level, not black-box.

| Area | Test / use case | HS | HA | CIU | CIE | STG | PRE |
|---|---|---|---|---|---|---|---|
| auth | auth-0140 login issues JWT; token authenticates /me | ✓ | ✓ | — | — | — | — |
| auth | ≈ e2e: full lifecycle signup→me→logout; wrong-password 401; unknown-user 401 | — | — | — | ✓ | ✓ | — |
| auth | auth-0210 signup negatives (dup email, short password) | ✓ | ✓ | — | — | — | — |
| auth | ≈ e2e: signup validation ×5 (valid, dup, missing pw, short pw, bad email) | — | — | — | ✓ | ✓ | — |
| auth | ≈ unit: auth.test.ts login/signup validation (28) | — | — | ✓ (m) | — | — | — |
| auth | auth-1000/1010 export personal data (+401 gate) | — | ✓ | — | — | — | — |
| auth | auth-1100/1110 delete account (+401 gate, survives failed delete) | — | ✓ | — | — | — | — |
| auth | unit only: password-reset (17), send-verification (10), verify-code (14) | — | — | ✓ (m) | — | — | — |
| bubble-admin | bubble-admin-0700 edit own bubble details (persist + restore) | ✓ | ✓ | — | — | — | — |
| bubble-admin | bubble-admin-1900/1910 delete own bubble / non-owner 403 | — | ✓ | — | — | — | — |
| bubble-admin | bubble-admin-2300/2310 approve join request / non-admin 403 | — | ✓ | — | — | — | — |
| bubble-admin | bubble-admin-2400/2410 remove member / non-admin 403 | — | ✓ | — | — | — | — |
| bubble-admin | bubble-admin-2800/2810 set member limit / non-owner 403 | — | ✓ | — | — | — | — |
| bubble-admin | bubble-admin-3400/3410 set location / non-owner 403 | — | ✓ | — | — | — | — |
| bubble-admin | ≈ unit: bubbles.test.ts create/read bubble (19) | — | — | ✓ (m) | — | — | — |
| campus | unit only: campus send/verify/dismiss (22) | — | — | ✓ (m) | — | — | — |
| categories | categories-0100/0110 view hierarchy; deleted absent from flat | — | ✓ | — | — | — | — |
| categories | categories-0200/0210 create parent / 403 + 400 | — | ✓ | — | — | — | — |
| categories | categories-0300/0310 create subcategory / 403 | — | ✓ | — | — | — | — |
| categories | categories-0400/0410 edit name+icon / 403 + 404 | — | ✓ | — | — | — | — |
| categories | categories-0500/0510 delete / 403 | — | ✓ | — | — | — | — |
| categories | categories-0600/0610 reorder / 403 | — | ✓ | — | — | — | — |
| contract | contract-0100 newman: liveness + login contract | ✓ | ✓ | — | — | — | — |
| events | events-0600/0610 RSVP + duplicate-RSVP guard | ✓ | ✓ | — | — | — | — |
| events | events-0700/0710 edit event / empty-title 400 | ✓ | ✓ | — | — | — | — |
| events | events-0800 delete event (gone everywhere) | ✓ | ✓ | — | — | — | — |
| events | events-0910 create with empty title 400 | ✓ | ✓ | — | — | — | — |
| events | events-1110 non-owner delete 403 | ✓ | ✓ | — | — | — | — |
| events | events-1120 admin create/edit/delete lifecycle | ✓ | ✓ | — | — | — | — |
| events | events-1130 cross-bubble event CRUD denied ×4 | — | ✓ | — | — | — | — |
| events | events-1140 non-admin create should be denied (tripwire) | — | F | — | — | — | — |
| events | ≈ unit: events (40) + events-management (41) | — | — | ✓ (m) | — | — | — |
| infra | infra-0100/0110 IPv4 + IPv6 loopback reachability | ✓ | ✓ | — | — | — | — |
| infra | infra-0500 no Vite dev server exposed (deploy-only) | S | S | — | — | — | — |
| infra | infra-0510 survives malformed SPA request | ✓ | ✓ | — | — | — | — |
| infra | infra-0520 routing contract (JSON 404 / 401 / SPA shell) ×4 | ✓ | ✓ | — | — | — | — |
| infra | ≈ e2e: unknown API route returns 404 not 500 | — | — | — | ✓ | ✓ | ✗ |
| infra | e2e only: deep-links/share ×10 (AASA, assetlinks, /b/, /e/, OG tags, 404s) | — | — | — | ✓ | S | ✗ |
| joining | joining-0500/0510 request-to-join pending + duplicate guard | ✓ | ✓ | — | — | — | — |
| joining | joining-0800/0810 leave bubble / non-member 400 | — | ✓ | — | — | — | — |
| joining | joining-1000/1010 report a concern / empty-reason 400 | — | ✓ | — | — | — | — |
| joining | joining-1900/1910 waitlist when full / approve when not | — | ✓ | — | — | — | — |
| joining | ≈ unit: bubble-membership.test.ts (46) | — | — | ✓ (m) | — | — | — |
| monitoring | monitoring-0100…0910 platform/growth/campus/memory/integration stats + 403 gates (18) | — | ✓ | — | — | — | — |
| monitoring | ≈ e2e: ping / status / health-db | — | — | — | ✓ | ✓ | ✗ |
| monitoring | unit only: crash-report (19), sentry (14), slowCallConfig (12), mobile crashReporter (174) | — | — | ✓ (m) | — | — | — |
| notifications | unit only: notifications.test.ts (13) | — | — | ✓ (m) | — | — | — |
| profile | unit only: users-me.test.ts (4) | — | — | ✓ (m) | — | — | — |
| reports | reports-0100/0110 view waitlist / 403 | — | ✓ | — | — | — | — |
| reports | reports-0200/0210 report lifecycle submit→review→resolve / gates | — | ✓ | — | — | — | — |
| reports | ≈ unit: reports.test.ts (21) | — | — | ✓ (m) | — | — | — |
| rules | rules-0100…0510 app-wide rules CRUD + reorder + gates (12 files) | — | ✓ | — | — | — | — |
| rules | rules-0600…0710 category-level rules assign/edit/remove + gates | — | ✓ | — | — | — | — |
| rules | rules-0800…0910 inheritance, no cross-bubble leak, hide/override | — | ✓ | — | — | — | — |
| rules | rules-1000…1410 bubble-level rules CRUD + reorder + member view | — | ✓ | — | — | — | — |
| security | sec-0100 login lockout via 429 | ✓ | ✓ | — | — | — | — |
| security | ≈ e2e: rate-limit ×4 (lockout after 5, locked despite correct pw, per-email scope, 413 oversize) | — | — | — | ✓ | ✓ | — |
| security | sec-0110 signup enumeration (unverified — documents known leak) | — | ✓ | — | — | — | — |
| security | sec-0120 password-reset enumeration | ✓ | ✓ | — | — | — | — |
| security | sec-0200 role-authz matrix: 42 super-only ×2 roles + 24 bubble-admin-only + 5 cross-user + coverage guard (117) | ✓ | ✓ | — | — | — | — |
| security | ≈ e2e: tampered JWT 401; isSuperAdmin not exposed | — | — | — | ✓ | ✓ | — |
| site-admin | site-admin-0100 approve bubble → public (5 steps) | ✓ | ✓ | — | — | — | — |
| site-admin | site-admin-0200/0210 reject bubble / non-super 403 (unverified) | — | ✓ | — | — | — | — |
| site-admin | site-admin-0300/0310 reject event / non-admin 403 | — | ✓ | — | — | — | — |
| site-admin | site-admin-0400 super-reach delete any bubble (unverified) | — | ✓ | — | — | — | — |
| site-admin | site-admin-1200 all 7 admin endpoints reachable | — | ✓ | — | — | — | — |
| site-admin | ≈ e2e: admin-access ×4 (401 all endpoints, 403 super-only, stats 200, pending counts) | — | — | — | ✓ | ✓ | — |
| site-admin | ≈ unit: admin.test.ts (17), suspend-user (19) | — | — | ✓ (m) | — | — | — |
| unknown | integration: atomic-storage concurrent claim (1) — **no context runs it** | — | — | — | — | — | — |
| unknown | mobile Jest excluded files: navigation ×3, LocationPickerModal (10) | — | — | — | — | — | — |

Headline gaps this table makes visible:
1. `sec-0200`'s 117-probe authorization matrix and the entire rules/categories/
   monitoring/reports areas have **zero CI presence** today.
2. The deep-links/share suite (14 tests incl. health) is the only thing the
   production gate was ever meant to run — and its selection is broken (✗).
3. Only rate-limit/lockout and a handful of auth/admin cases exist in **both**
   worlds; consolidation cost is low.

## G. Evaluation matrix — full detail

### G.1 CI-context suites (current GitHub checks)

Suite totals (verified by running Playwright `--list` and counting `it`/`test`
blocks):

| Suite | Tests | Infrastructure | Invoker |
|---|---:|---|---|
| Playwright API e2e (`server/__tests__/e2e/*.e2e.ts`) | 32 / 5 files | Postgres + auto-spawned Express (`webServer`) | `ci.yml` e2e job; `staging-e2e.yml` (vs staging); `pre-release.yml` (`--grep @prod-safe`, currently selects 0) |
| Root vitest unit (`server/__tests__/**/*.test.ts`, excl. integration) | 356 / 19 files | none (mocked storage) | `ci.yml` unit job; `npm test` |
| Vitest integration (`server/__tests__/integration/**`) | 1 / 1 file | real Postgres (self-skips without it) | `npm run test:integration` only — **no workflow runs it** |
| Mobile Jest (`mobile/`) | 179 running / 2 files (4 more files disabled via `testPathIgnorePatterns`) | none (jest-expo mocks) | `ci.yml` unit job; mobile `npm test` |

#### G.1.a Playwright API e2e — per test

| Test File | Functional Area | Test Name | @prod-safe | Goal | Program |
|---|---|---|---|---|---|
| server/__tests__/e2e/health.e2e.ts | monitoring | GET /api/v1/ping returns pong | Yes* | Liveness endpoint responds with pong | Playwright |
| server/__tests__/e2e/health.e2e.ts | monitoring | GET /api/v1/status returns server status | Yes* | Status endpoint exposes version and uptime | Playwright |
| server/__tests__/e2e/health.e2e.ts | monitoring | GET /api/v1/health returns healthy db | Yes* | Health check reports database service up | Playwright |
| server/__tests__/e2e/health.e2e.ts | infra | unknown API route returns 404 not 500 | Yes* | Unknown routes fail gracefully, never 500 | Playwright |
| server/__tests__/e2e/deep-links.e2e.ts | infra (share/deep-links) | GET /.well-known/apple-app-site-association is valid JSON with bundle ID | Yes* | iOS universal-link file valid, contains io.bubble.app | Playwright |
| server/__tests__/e2e/deep-links.e2e.ts | infra (share/deep-links) | GET /.well-known/assetlinks.json is valid JSON with package name | Yes* | Android app-links file valid, contains com.bubble.mobile | Playwright |
| server/__tests__/e2e/deep-links.e2e.ts | infra (share/deep-links) | GET /api/bubbles/short/:shortId returns bubble JSON | Yes* | Bubble short-link API returns shortId and title | Playwright |
| server/__tests__/e2e/deep-links.e2e.ts | infra (share/deep-links) | GET /b/:shortId returns HTML with OG tags and deep link | Yes* | Bubble share page serves OG tags plus bubble:// link | Playwright |
| server/__tests__/e2e/deep-links.e2e.ts | infra (share/deep-links) | GET /b/doesnotexist returns 404 | Yes* | Missing bubble share page 404s | Playwright |
| server/__tests__/e2e/deep-links.e2e.ts | infra (share/deep-links) | GET /api/bubbles/short/doesnotexist returns 404 | Yes* | Missing bubble short-link API 404s | Playwright |
| server/__tests__/e2e/deep-links.e2e.ts | infra (share/deep-links) | GET /api/events/short/:shortId returns event JSON with bubble | Yes* | Event short-link API returns event with bubble | Playwright |
| server/__tests__/e2e/deep-links.e2e.ts | infra (share/deep-links) | GET /e/:shortId returns HTML with OG tags and deep link | Yes* | Event share page serves OG tags plus bubble:// link | Playwright |
| server/__tests__/e2e/deep-links.e2e.ts | infra (share/deep-links) | GET /e/doesnotexist returns 404 | Yes* | Missing event share page 404s | Playwright |
| server/__tests__/e2e/deep-links.e2e.ts | infra (share/deep-links) | GET /api/events/short/doesnotexist returns 404 | Yes* | Missing event short-link API 404s | Playwright |
| server/__tests__/e2e/auth.e2e.ts | auth | valid signup returns 200 with token and user | No | Signup succeeds; returns token, omits password | Playwright |
| server/__tests__/e2e/auth.e2e.ts | auth | duplicate email returns 400 | No | Re-signup with same email rejected | Playwright |
| server/__tests__/e2e/auth.e2e.ts | auth | missing password returns 400 | No | Signup without password rejected | Playwright |
| server/__tests__/e2e/auth.e2e.ts | auth | password under 8 chars returns 400 | No | Short password rejected at signup | Playwright |
| server/__tests__/e2e/auth.e2e.ts | auth | invalid email format returns 400 | No | Malformed email rejected at signup | Playwright |
| server/__tests__/e2e/auth.e2e.ts | auth | full lifecycle works end-to-end | No | Signup → me → logout → token invalidated flow | Playwright |
| server/__tests__/e2e/auth.e2e.ts | auth | login with wrong password returns 401 | No | Wrong password yields 401 invalid error | Playwright |
| server/__tests__/e2e/auth.e2e.ts | auth | login for non-existent user returns 401 | No | Unknown user login yields 401 | Playwright |
| server/__tests__/e2e/auth.e2e.ts | security | tampered token returns 401 on protected route | No | Invalid JWT rejected on /api/auth/me | Playwright |
| server/__tests__/e2e/admin-access.e2e.ts | site-admin | unauthenticated requests get 401 on all admin endpoints | No | All 8 admin endpoints require auth | Playwright |
| server/__tests__/e2e/admin-access.e2e.ts | site-admin | regular user gets 403 on super-admin-only endpoints | No | Regular user forbidden from 6 super-admin endpoints | Playwright |
| server/__tests__/e2e/admin-access.e2e.ts | site-admin | super admin gets 200 on admin stats | No | Super admin reads stats with users field | Playwright |
| server/__tests__/e2e/admin-access.e2e.ts | site-admin | super admin can see pending counts | No | Super admin reads numeric pending count | Playwright |
| server/__tests__/e2e/admin-access.e2e.ts | security | super admin flag is not exposed to regular users via /api/auth/me | No | isSuperAdmin false for regular user | Playwright |
| server/__tests__/e2e/rate-limit.e2e.ts | security | account locks after 5 consecutive wrong passwords | No | Sixth login attempt returns 429 locked | Playwright |
| server/__tests__/e2e/rate-limit.e2e.ts | security | correct password also fails while account is locked | No | Lockout blocks even correct credentials | Playwright |
| server/__tests__/e2e/rate-limit.e2e.ts | security | rate limit is per email — a different account is not affected | No | Lockout scoped per email, others unaffected | Playwright |
| server/__tests__/e2e/rate-limit.e2e.ts | security | oversized login payload returns 413 | No | 12KB login body rejected with 413 | Playwright |

\* "@prod-safe" per file-comment intent only — the grep-based selection matches zero
tests (see B.1 addendum). 4 deep-links tests also self-skip against staging/prod
because no seeded bubble/event exists there.

#### G.1.b Root vitest unit — per file (356 tests / 19 files)

| Test File | #Tests | Purpose |
|---|---:|---|
| server/__tests__/admin.test.ts | 17 | Admin bubble approve/reject endpoints, auth and side effects |
| server/__tests__/auth.test.ts | 28 | Login/signup validation, tokens, errors |
| server/__tests__/bubble-membership.test.ts | 46 | Join/leave/members/roles/join-requests/waitlist endpoints |
| server/__tests__/bubbles.test.ts | 19 | GET bubble by id, POST create bubble |
| server/__tests__/campus-dismiss-prompt.test.ts | 3 | POST /api/campus/dismiss-prompt behavior |
| server/__tests__/campus-send-verification.test.ts | 9 | Campus email verification codes (send) |
| server/__tests__/campus-verify-code.test.ts | 10 | Campus verification code validation |
| server/__tests__/crash-report.test.ts | 19 | Crash-report payload handling and storage |
| server/__tests__/events-management.test.ts | 41 | PUT event, schema/timezone, signup-tasks CRUD |
| server/__tests__/events.test.ts | 40 | Event GET/POST/DELETE and RSVP endpoints |
| server/__tests__/notifications.test.ts | 13 | Notification counts/read, push token register/delete |
| server/__tests__/password-reset.test.ts | 17 | Forgot/reset password flows |
| server/__tests__/reports.test.ts | 21 | POST /api/reports types, visibility, notifications |
| server/__tests__/send-verification.test.ts | 10 | Email verification codes (send) |
| server/__tests__/sentry.test.ts | 14 | Sentry init gating, slow-response reporting |
| server/__tests__/slowCallConfig.test.ts | 12 | Slow-call config env parsing |
| server/__tests__/suspend-user.test.ts | 19 | Admin suspend/unsuspend, admin user search |
| server/__tests__/users-me.test.ts | 4 | PATCH /api/users/me profile updates |
| server/__tests__/verify-code.test.ts | 14 | Auth verify-code validation |

#### G.1.c Vitest integration + Mobile Jest

| Test File | #Tests | Purpose |
|---|---:|---|
| server/__tests__/integration/atomic-storage.test.ts | 1 | markCodeAsUsedAtomic: 10 concurrent claims, one wins (real Postgres; self-skips without it; **not run by any workflow**) |
| mobile/src/utils/__tests__/crashReporter.test.ts | 174 | buildReport truncation boundaries, isFatal flag — runs in CI |
| mobile/src/context/__tests__/AuthContext.test.tsx | 5 | AuthContext Sentry user-role propagation — runs in CI |
| mobile/src/screens/main/__tests__/UpcomingScreen.navigation.test.tsx | 2 | Navigation to EventDetails — **excluded** (RN 0.83 env) |
| mobile/src/screens/main/__tests__/EventDetailsScreen.navigation.test.tsx | 2 | Back navigation — **excluded** (RN 0.83 env) |
| mobile/src/screens/main/__tests__/MyBubblesScreen.navigation.test.tsx | 2 | Bubble-card navigation — **excluded** (RN 0.83 env) |
| mobile/src/components/__tests__/LocationPickerModal.errors.test.tsx | 4 | Google-failure handling (spec for unshipped fix) — **excluded** |

### G.2 Headless platform suites

Totals: **113 `.headless.test.ts` files (321 `it` blocks) + 1 newman collection
(2 requests / 5 assertions)**. Per area (`it` blocks): auth 11, bubble-admin 23,
categories 14, events 24, infra 9, joining 19, monitoring 18, reports 7, rules 51,
security 120, site-admin 25.

Mechanics (from `tests/runner/select.ts` and `tests/TAXONOMY.md`):

- Tags are per-file `// qa-tags:` comments (with `// qa-id:`, `// qa-reason:`);
  the runner scans files to build descriptors. The newman collection is a synthetic
  descriptor `contract-0100` (`contract, smoke, headless`) hardcoded in select.ts —
  run by the qa runner only, **not** by `npm run test:headless`.
- Tag vocabulary: area tags; selection `smoke`/`slow`/`alpha-high`/`alpha-low`/`beta`;
  status `unverified` (excluded from smoke, reported as expected findings),
  `wip`, `bug-filed`/`bug-deferred` (failures counted as known bugs, not suite
  failures); layer `e2e`/`headless`; roles `role-any`/`role-user`/
  `role-bubble-admin`/`role-site-admin`.
- Environment-conditional: infra-0100/0110 run only against loopback;
  infra-0500 only against non-loopback (deploy); events-1140 is `it.fails`
  (tag `known-divergence`).

Invoker key: **S** = `npm run qa` (smoke default); **A** = `qa --all`/`--area`/
`--tag`; **H** = `npm run test:headless` (tag-blind vitest, no newman). All need the
QA server (`npm run qa:server`) + seeded test DB.

| Test File (tests/headless/…) | Area | Test Name (its) | Tags | Goal | Inv. | Program |
|---|---|---|---|---|---|---|
| auth/auth-0140-login-show-jwt | auth | auth-0140: login shows raw+decoded token; token authenticates /me (2) | auth, smoke, role-user | Login issues JWT; token authenticates /api/auth/me | S,A,H | vitest |
| auth/auth-0210-signup-negative | auth | auth-0210: dup email → 400 no token; 7-char password → 400 (2) | auth, smoke, role-user | Duplicate email and short password rejected without session | S,A,H | vitest |
| auth/auth-1000-export-their-personal-data | auth | auth-1000: authed export returns personal data (1) | auth, role-user, security | Authed export returns profile and exportedAt | A,H | vitest |
| auth/auth-1010-export-their-personal-data | auth | auth-1010: export without token → 401 (1) | auth, role-user, security | Unauthenticated export rejected 401 | A,H | vitest |
| auth/auth-1100-delete-account | auth | auth-1100: create disposable acct; delete; not loginable (3) | auth, role-user, security | Account deletion succeeds; deleted account cannot log in | A,H | vitest |
| auth/auth-1110-delete-account | auth | auth-1110: delete without token → 401; account survives (2) | auth, role-user, security | Unauthenticated delete rejected; account survives | A,H | vitest |
| bubble-admin/bubble-admin-0700-edit-bubble-details | bubble-admin | 0700: PUT as owner → 200; persists; restore (3) | bubble-admin, smoke, role-bubble-admin | Owner edits own bubble details; change persists | S,A,H | vitest |
| bubble-admin/bubble-admin-1900-delete-their-bubble | bubble-admin | 1900: owner delete → 200; 404 on GET (2) | bubble-admin, role-bubble-admin | Owner can delete own bubble | A,H | vitest |
| bubble-admin/bubble-admin-1910-delete-their-bubble | bubble-admin | 1910: non-owner delete → 403; unchanged (2) | bubble-admin, role-bubble-admin | Non-owner cannot delete another's bubble | A,H | vitest |
| bubble-admin/bubble-admin-2300-approve-or-reject-membership-requests | bubble-admin | 2300: owner approves join request; reads approved (2) | bubble-admin, role-bubble-admin | Admin approves pending join request | A,H | vitest |
| bubble-admin/bubble-admin-2310-approve-or-reject-membership-requests | bubble-admin | 2310: non-admin approve → 403; stays pending (2) | bubble-admin, role-bubble-admin | Non-admin cannot approve membership requests | A,H | vitest |
| bubble-admin/bubble-admin-2400-remove-members-from-their-bubble | bubble-admin | 2400: owner removes member → 200; non-member after (2) | bubble-admin, role-bubble-admin | Admin removes approved member | A,H | vitest |
| bubble-admin/bubble-admin-2410-remove-members-from-their-bubble | bubble-admin | 2410: non-admin remove → 403; owner still member (2) | bubble-admin, role-bubble-admin | Non-admin cannot remove members | A,H | vitest |
| bubble-admin/bubble-admin-2800-set-a-member-limit-for-their | bubble-admin | 2800: owner sets memberLimit=5; reads back (2) | bubble-admin, role-bubble-admin | Owner sets member limit | A,H | vitest |
| bubble-admin/bubble-admin-2810-set-a-member-limit-for-their | bubble-admin | 2810: non-owner set limit → 403; unchanged (2) | bubble-admin, role-bubble-admin | Non-owner cannot set another bubble's limit | A,H | vitest |
| bubble-admin/bubble-admin-3400-set-bubble-location | bubble-admin | 3400: owner sets location fields; reads back (2) | bubble-admin, role-bubble-admin | Owner sets bubble location | A,H | vitest |
| bubble-admin/bubble-admin-3410-set-bubble-location | bubble-admin | 3410: non-owner set location → 403; unchanged (2) | bubble-admin, role-bubble-admin | Non-owner cannot set another bubble's location | A,H | vitest |
| categories/categories-0100-view-the-full-category-hierarchy | categories | 0100: GET /api/categories returns nested structure (1) | categories, role-site-admin | Nested parent/child category hierarchy | A,H | vitest |
| categories/categories-0110-view-the-full-category-hierarchy | categories | 0110: deleted category absent from /flat (1) | categories, role-site-admin | Deleted category absent from flat listing | A,H | vitest |
| categories/categories-0200-create-a-new-parent-category | categories | 0200: site-admin POST creates parent (1) | categories, role-site-admin | Site admin creates parent category | A,H | vitest |
| categories/categories-0210-create-a-new-parent-category | categories | 0210: role-user POST → 403; empty body → 400 (2) | categories, role-site-admin, role-user | Non-super and empty-name creation rejected | A,H | vitest |
| categories/categories-0300-create-a-subcategory-under-a-parent | categories | 0300: POST {name,parentId} nests child (1) | categories, role-site-admin | Creates subcategory under parent | A,H | vitest |
| categories/categories-0310-create-a-subcategory-under-a-parent | categories | 0310: role-user POST with parentId → 403 (1) | categories, role-site-admin, role-user | Non-super subcategory creation rejected | A,H | vitest |
| categories/categories-0400-edit-a-category-name-or-icon | categories | 0400: PUT changes name+icon; GET confirms (1) | categories, role-site-admin | Site admin edits category name/icon | A,H | vitest |
| categories/categories-0410-edit-a-category-name-or-icon | categories | 0410: role-user PUT → 403; missing id → 404 (2) | categories, role-site-admin | Edit denied for non-super; 404 for missing | A,H | vitest |
| categories/categories-0500-delete-a-category | categories | 0500: site-admin DELETE removes it (1) | categories, role-site-admin | Site admin deletes category | A,H | vitest |
| categories/categories-0510-delete-a-category | categories | 0510: role-user DELETE → 403; remains (1) | categories, role-site-admin | Non-super delete rejected | A,H | vitest |
| categories/categories-0600-reorder-categories | categories | 0600: swap displayOrder; GET confirms (1) | categories, role-site-admin | Site admin reorders categories | A,H | vitest |
| categories/categories-0610-reorder-categories | categories | 0610: role-user reorder → 403; unchanged (1) | categories, role-site-admin | Non-super reorder rejected | A,H | vitest |
| events/events-0600-rsvp | events | 0600: RSVP → going; in attendees; in /my (3) | events, smoke, role-user | Member RSVP recorded everywhere | S,A,H | vitest |
| events/events-0610-duplicate-rsvp | events | 0610: second RSVP → 400; ONE attendee row (2) | events, smoke, role-user | Duplicate RSVP rejected, not duplicated | S,A,H | vitest |
| events/events-0700-edit-event | events | 0700: PUT as creator → 200; persists (2) | events, smoke, role-bubble-admin | Creator edits event; persists | S,A,H | vitest |
| events/events-0710-edit-event-invalid | events | 0710: empty title → 400; unchanged (2) | events, smoke, role-bubble-admin | Empty-title edit rejected | S,A,H | vitest |
| events/events-0800-delete-event | events | 0800: DELETE → 200; 404 direct; gone from list (3) | events, smoke, role-bubble-admin | Creator deletes event; gone everywhere | S,A,H | vitest |
| events/events-0910-create-an-event-title-date-time | events | 0910: POST empty title → 400; none created (2) | events, smoke, role-bubble-admin | Empty title rejected on creation | S,A,H | vitest |
| events/events-1110-delete-an-event | events | 1110: non-owner DELETE → 403; survives (2) | events, smoke, role-user | Non-owner cannot delete event | S,A,H | vitest |
| events/events-1120-bubble-admin-event-lifecycle | events | 1120: POST/PUT/DELETE in own bubble all 200 (3) | events, smoke, role-bubble-admin | Admin event lifecycle in own bubble | S,A,H | vitest |
| events/events-1130-cross-bubble-event-authz | events | 1130: foreign-bubble POST/PUT/DELETE → 403 ×4 (4) | events, security, role-bubble-admin | Admin denied event CRUD on foreign bubbles | A,H | vitest |
| events/events-1140-non-admin-member-create-authz | events | 1140: it.fails INTENDED non-admin POST → 403 (1) | events, security, role-user, known-divergence | Tripwire: non-admin event creation should be denied | A,H | vitest |
| infra/infra-0100-loopback-ipv4 | infra | 0100: health on 127.0.0.1 answers (1; skip unless loopback) | infra, smoke, role-any | API reachable over IPv4 loopback | S,A,H | vitest |
| infra/infra-0110-loopback-ipv6 | infra | 0110: health on [::1] answers (1; skip unless loopback) | infra, smoke, role-any | API reachable over IPv6 loopback (dual-stack) | S,A,H | vitest |
| infra/infra-0500-no-vite-dev-server-exposed | infra | 0500: /@vite/client 404; built bundle referenced (2; skip on loopback) | infra, smoke, security, deploy, role-any | Deployed host serves static bundle, no Vite | S,A,H | vitest |
| infra/infra-0510-survives-malformed-spa-request | infra | 0510: junk SPA paths don't crash server (1) | infra, smoke, security, deploy, role-any | Malformed SPA request survives | S,A,H | vitest |
| infra/infra-0520-routing-contract | infra | 0520: JSON 404 /api/*; 401 modify; SPA shell; JSON 404 (4) | infra, smoke, security, deploy, role-any | Unmatched routes return correct status/shape | S,A,H | vitest |
| joining/joining-0500-request-to-join | joining | 0500: join pending; reads pending; in admin queue (3) | joining, smoke, role-user | Request-to-join lands pending, reaches queue | S,A,H | vitest |
| joining/joining-0510-duplicate-join-request | joining | 0510: second join → 400; ONE queue row (3) | joining, smoke, role-user | Duplicate join request rejected | S,A,H | vitest |
| joining/joining-0800-leave-a-bubble | joining | 0800: join public; member; leave 200; non-member (4) | joining, role-user | Member leaves bubble | A,H | vitest |
| joining/joining-0810-leave-a-bubble | joining | 0810: non-member leave → 400 (3) | joining, role-user | Non-member leave rejected | A,H | vitest |
| joining/joining-1000-report-a-concern-about-a-bubble | joining | 1000: valid bubble report → 201 (1) | joining, role-user, security | Member reports bubble concern | A,H | vitest |
| joining/joining-1010-report-a-concern-about-a-bubble | joining | 1010: empty reason → 400, none created (1) | joining, role-user, security | Empty-reason report rejected | A,H | vitest |
| joining/joining-1900-be-added-to-a-waitlist-if | joining | 1900: full bubble join → waitlisted (2) | joining, role-user | Full bubble waitlists the user | A,H | vitest |
| joining/joining-1910-be-added-to-a-waitlist-if | joining | 1910: non-full join → approved member (2) | joining, role-user | Non-full bubble approves, not waitlists | A,H | vitest |
| monitoring/monitoring-0100/0110-platform-stats | monitoring | 0100: stats totals; 0110: role-user → 403 (2 files, 2) | monitoring, role-site-admin/-user | Platform totals; gated | A,H | vitest |
| monitoring/monitoring-0200/0210-growth-metrics | monitoring | 0200: 7d/30d growth; 0210: 403 (2 files, 2) | monitoring, role-site-admin/-user | Growth metrics; gated | A,H | vitest |
| monitoring/monitoring-0300/0310-content-health | monitoring | 0300: orphan/avgMembers/rejected; 0310: 403 (2 files, 2) | monitoring, role-site-admin/-user | Content-health metrics; gated | A,H | vitest |
| monitoring/monitoring-0400/0410-campus-stats | monitoring | 0400: campus stats fields; 0410: 403 (2 files, 2) | monitoring, role-site-admin/-user | Campus stats; gated | A,H | vitest |
| monitoring/monitoring-0500/0510-server-memory | monitoring | 0500: memory/env fields; 0510: 403 (2 files, 2) | monitoring, role-site-admin/-user | Server memory/env info; gated | A,H | vitest |
| monitoring/monitoring-0600/0610-cometchat-status | monitoring | 0600: integrations.cometChat shape; 0610: 403 (2 files, 2) | monitoring, role-site-admin/-user | CometChat status/latency; gated | A,H | vitest |
| monitoring/monitoring-0700/0710-object-storage-status | monitoring | 0700: integrations.objectStorage shape; 0710: 403 (2 files, 2) | monitoring, role-site-admin/-user | Object-storage status/latency; gated | A,H | vitest |
| monitoring/monitoring-0800/0810-pending-count | monitoring | 0800: pending bubble increments count; 0810: 403 (2 files, 2) | monitoring, role-site-admin/-user | Pending counts live; gated | A,H | vitest |
| monitoring/monitoring-0900/0910-autorefresh | monitoring | 0900: fresh fetchedAt per poll; 0910: 3 rapid GETs 200 (2 files, 2) | monitoring, role-site-admin | Stats pollable and stable under polling | A,H | vitest |
| reports/reports-0100-view-users-on-the-waitlist | reports | 0100: site admin sees waitlisted member (1) | reports, role-site-admin | Site admin views waitlist | A,H | vitest |
| reports/reports-0110-view-users-on-the-waitlist | reports | 0110: non-admin per-bubble waitlist → 403 (1) | reports, role-site-admin | Non-admin denied waitlist | A,H | vitest |
| reports/reports-0200-review-reported-concerns | reports | 0200: submit → queue → resolve (3) | reports, role-site-admin | Report lifecycle submit/review/resolve | A,H | vitest |
| reports/reports-0210-review-reported-concerns | reports | 0210: non-super queue → 403; missing id → 404 (2) | reports, role-site-admin | Queue gated; invalid id 404s | A,H | vitest |
| rules/rules-0100…0510 (12 files) | rules | app-wide rules: view (+401), create (+403/400), edit (+403), delete (+403/404), reorder (+403/400) (17) | rules, role-site-admin/-user | App-wide rule CRUD + reorder, all authz-gated | A,H | vitest |
| rules/rules-0600…0710 (4 files) | rules | category rules: assign (+gates ×3), edit/remove (+gates ×4) (13) | rules, role-site-admin | Category-level rule assign/edit/remove, gated | A,H | vitest |
| rules/rules-0800…0910 (4 files) | rules | inheritance: effective rules include app rules; no cross-bubble leak; hide/override (+403) (11) | rules, role-bubble-admin | Rule inheritance and override semantics | A,H | vitest |
| rules/rules-1000…1410 (8 files) | rules | bubble-level rules: CRUD + reorder (+gates), member view, empty state (10) | rules, role-bubble-admin/-user | Custom bubble-rule lifecycle and visibility | A,H | vitest |
| security/sec-0100-login-lockout | security | sec-0100: 429 within few attempts, never a token (1) | security, smoke, role-any | Repeated bad logins trigger lockout | S,A,H | vitest |
| security/sec-0110-signup-enumeration | security | sec-0110: identical status for registered vs fresh email (1) | security, unverified, role-any | Signup must not leak registered emails (known leak) | A,H | vitest |
| security/sec-0120-password-reset-enumeration | security | sec-0120: identical status+body registered vs fresh (1) | security, smoke, role-any | No email enumeration via forgot-password | S,A,H | vitest |
| security/sec-0200-role-authz-matrix | security | sec-0200: 42 super-only ×2 roles + 24 bubble-admin-only + 5 cross-user + 3 scoped-empty + coverage guard (117) | security, smoke, role-user, role-bubble-admin | Every role-gated route denies lower-privilege tokens | S,A,H | vitest |
| site-admin/site-admin-0100-approve-bubble | site-admin | 0100: pending → not public → queue → approve → public (5) | site-admin, smoke, role-site-admin | Approved bubble becomes public | S,A,H | vitest |
| site-admin/site-admin-0200-reject-bubble | site-admin | 0200: reject with reason; stays non-public (3) | site-admin, unverified | Site admin rejects bubble | A,H | vitest |
| site-admin/site-admin-0210-reject-bubble-authz | site-admin | 0210: non-super reject → 403; stays pending (3) | site-admin, unverified | Non-super cannot reject | A,H | vitest |
| site-admin/site-admin-0300-approve-or-reject-events | site-admin | 0300: reject event with reason → persisted (2) | site-admin, role-site-admin | Site admin rejects pending event | A,H | vitest |
| site-admin/site-admin-0310-approve-or-reject-events | site-admin | 0310: non-admin approve → 403; unchanged (2) | site-admin, role-site-admin | Non-admin denied event approval | A,H | vitest |
| site-admin/site-admin-0400-super-reach-delete-bubble | site-admin | 0400: site admin (not owner) deletes bubble (3) | site-admin, unverified | Super-reach delete beyond ownership | A,H | vitest |
| site-admin/site-admin-1200-access-all-admin-pages | site-admin | 1200: GET ×7 admin endpoints → 200 (7) | site-admin, role-site-admin | All admin endpoints reachable as site admin | A,H | vitest |
| contract/contract-smoke.postman_collection.json | contract | contract-0100: Liveness ping (2 asserts) + Login returns token (3 asserts) | contract, smoke (synthetic) | API liveness and login contract | S,A (qa only — not test:headless) | newman |

Rows for monitoring and rules group positive/negative sibling files to keep the
table readable; `(N)` keeps `it` counts auditable and consistent with the area
totals above.

---

**Method note.** Run statistics come from the GitHub Actions API
(`actions/workflows/<id>/runs`, all pages, 2026-07-02). Failure causes verified
against run logs (runs 28434726387, 28211659504, 28623602279). Test inventories in
D–G are generated by scanning `tests/headless/**`, `server/__tests__/e2e/**`, vitest
configs, and `mobile/` test trees.
