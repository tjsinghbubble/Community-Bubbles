# Bubble Test Architecture (Phase 1)

A unified runner for end-to-end (Maestro) and headless (TypeScript + newman) tests, with
tag-based selection, two-phase gating, a DB-safety guard, and run-scoped output.

This tree is **additive** — it does not touch the status-quo `maestro/`, `server/__tests__/`,
or Playwright suites. See `../CLAUDE.md` for app-level constraints.

## Quick start

```bash
# 1. One-time: provision the dedicated test DB (never your dev DB)
createdb bubble_test
export TEST_DATABASE_URL=postgresql://localhost:5432/bubble_test
npm run db:push:local        # (with DATABASE_URL pointed at bubble_test — see qa:seed)

# 2. Reset + deterministically seed the test DB (writes a meta.testing_journal entry)
npm run qa:seed

# 3. Run the default smoke suite (smoke tag, all 3 roles, ios)
npm run qa

# Headless only (no simulator needed):
npm run qa -- --layer headless
npm run qa -- --area security        # sec-0100 (expect PASS), sec-0110 (expect FAIL = finding)

# Panic button — stop everything:
npm run qa:panic
```

## Layout

| Path | What |
|------|------|
| `config/` | `environments.json` (hosts/ports), `roles.json` (test-DB creds) |
| `fixtures/` | `meta-schema.sql`, `journal.ts`, `seed.ts`, `bulk-users.ts` |
| `e2e/` | Maestro flows: `common/` subflows + per-area tagged flows |
| `headless/` | `security/` TS tests, `contract/` newman collection, vitest config |
| `runner/` | `qa.ts` CLI, `gating.ts`, `select.ts`, `report.ts`, `panic.ts` |
| `output/` | Run artifacts (gitignored): `run-<UTC>-<nonce>/` |
| `TAXONOMY.md` | Tag vocabulary + test-ID registry (source of truth) |

## Selection & tags

See `TAXONOMY.md`. Tags live next to each test (Maestro `tags:`; TS `// qa-tags:`). Common
flags: `--tag smoke`, `--area auth`, `--role role-user`, `--layer e2e|headless`,
`--platform ios`, `--env local`, `--no-gate`, `--no-seed`, `--list` (dry run).

## Gating (two phases)

1. **Critical gates** — must pass or the suite is canceled: API health (`/api/v1/health`,
   fallback `/api/v1/ping`), DB reachable; for e2e also simulator booted + Metro up. A gate
   either FAILS (cancels) or WAITS with a clear message.
2. **Production guard** — before any destructive seed/reset, `journal.classify()` reads the
   latest `env:*` entry from `meta.testing_journal`. Proceeds only if classification is
   `test`; on `production`/`unknown` it fails closed.

Then the selected tests run to completion, collecting all results regardless of failures.

## DB safety

The `meta` schema (and `meta.testing_journal`) lives outside `public`, so resets — which drop
only `public` — never erase the journal. A DB carrying a `data-class:production-copy` /
`env:production-like` journal entry will refuse destructive operations until a later entry
overturns it (latest-entry-wins).
