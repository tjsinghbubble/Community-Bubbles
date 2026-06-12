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

# Inspect DB fingerprints + schema drift vs baseline:
npm run qa:sig

# Panic button — stop everything:
npm run qa:panic
```

## testctl — status / nuke / health (scripts/testctl.py)

One control surface for everyone who pokes at tests (humans, Claude Code, shell
scripts, the qa runner itself). Python 3, stdlib only. Add `--json` to any
subcommand for machine-readable output.

```bash
npm run qa:status     # python3 scripts/testctl.py status
npm run qa:health     # python3 scripts/testctl.py health
npm run qa:nuke       # python3 scripts/testctl.py nuke --nuke=them-all

python3 scripts/testctl.py nuke --nuke=mcp,xcodebuild   # targeted stop
python3 scripts/testctl.py nuke all                     # positional form works too
```

- **status** — reads `tests/output/current-run.json` (a live heartbeat the qa
  runner maintains: state, active test/role/tags, jobs done/total) and the
  newest `maestro.log` for the current step, then lists every test-related
  process (maestro CLI/MCP, XCUITest drivers, vitest, newman, playwright,
  qa runner) with who invoked it (CC, MCP, npm, user) and elapsed times.
- **nuke** — targets `qa,cli,mcp,xcodebuild,headless,playwright,maestro,all|them-all`,
  given positionally (`nuke all`) or via `--nuke=LIST`.
  Known stop methods are used first (`qa` → PANIC marker so the runner
  finalizes its summary — written only when a live qa-runner exists; an
  ABANDONED heartbeat gets no marker); everything else gets SIGQUIT, 2s, SIGKILL.
  `mcp` also kills XCUITest drivers owned by the MCP server — orphaned
  drivers are what wedge later CLI runs.
- **health** — load average vs `QA_LOAD_CEILING`; API socket per family
  (IPv4/IPv6) then `/api/v1/health` with Down-vs-Hung diagnosis; whether the
  port-3000 listener actually serves `bubble_test` (qa:server) or a dev DB;
  Metro `/status`; installed sim binary (DTSDKName + mtime) vs booted runtime;
  sim boot age (sims booted >500,000s grow crashing processes — warn at 80%,
  restart required at 95%; the qa runner's sim-boot-age gate auto-restarts).
  Exit 0 only when all checks pass.

### MCP Maestro vs CLI Maestro — one simulator, one driver

Measured from the maestro 2.2.0 jars: CLI `maestro test` pins its XCUITest
driver host port to **7001** (randomized in 7001–7128 only when sharding);
MCP-server sessions use the default **22087**. The ports already differ — the
conflicts come from the **simulator-side XCUITest runner being a singleton**:
each new session (re)installs and restarts `maestro-driver-iosUITests-Runner`,
killing whichever session owned it, and a stale orphaned `xcodebuild` runner
holds port 7001 and wedges the next CLI run. Port configuration cannot fix
this; there is no flag or env var for it anyway.

Rules of engagement:
- The qa runner kills `maestro mcp` (and its drivers) before any iOS e2e run.
- Use MCP Maestro in short start-stop bursts (selector checks, hierarchy
  inspection), never interleaved with a CLI run on the same simulator.
- The doc-only MCP tools (`query_docs`, `cheat_sheet`, `check_flow_syntax`)
  never touch the device and are safe at any time.
- True concurrency requires two simulators: CLI `--udid A`, MCP `device_id B`.

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
flags: `--tag smoke`, `--area auth`, `--all` (every registered test; alias `--area all`),
`--role role-user`, `--layer e2e|headless`, `--platform ios`, `--env local`, `--no-gate`,
`--no-seed`, `--list` (dry run). `--tag` is AND over a test's tags; `--area` is OR over the
closed area vocabulary (unknown area names are an error — `smoke` is a tag, `headless` a layer).

## Maestro env rules (hard-won — do not relax without reading this)

Maestro 2.2.0's env precedence is **declaration-site-wins**, both levels, verified live
2026-06-11:

1. A **subflow's** `env:` defaults override whatever the caller passes via `runFlow: env:`
   (this silently ran every role test as `member@bubble.test`).
2. A **top-level flow's** `env:` defaults override the CLI's `-e` flags (this silently
   discarded the runner's `-e EMAIL`/`-e SHOT_PREFIX` — run `ec85e9`).

Therefore, suite-wide:

- **No `env:` defaults in any flow file**, top-level or subflow. Values come only from the
  runner's `-e` flags and explicit `runFlow: env:` forwarding.
- Every flow starts with a **fail-fast `assertTrue` guard**: a missing var is JS-`undefined`,
  and a forwarded-but-unset var arrives as the literal string `${VAR}` (caught by
  `charAt(0) !== '$'`). Either way the flow dies immediately with a label telling you which
  `-e` flags to pass — instead of silently authenticating as the wrong user.
- `e2e/infra/infra-0200-maestro-env-assumptions.yaml` **pins these semantics** in the smoke
  suite (UI-free, evalScript-only — runs in seconds). If a Maestro upgrade or another
  platform (e.g. Windows) changes precedence, infra-0200 fails first and its assert labels
  say what changed. Its `_probe-*.yaml` neighbors are the only files allowed to declare
  `env:` defaults — the defaults are the probes.
- Direct runs: `maestro test <flow> -e METRO_HOST=localhost -e METRO_PORT=8081 \
  -e SHOT_PREFIX=tmp/maestro/ [-e EMAIL=… -e PASSWORD=…]` (see `config/roles.json`).

## Gating (two phases)

1. **Critical gates** — must pass or the suite is canceled: API health (`/api/v1/health`,
   fallback `/api/v1/ping`), DB reachable; for e2e also simulator booted + Metro up. A gate
   either FAILS (cancels) or WAITS with a clear message.
2. **Production guard** — before any destructive seed/reset, `journal.classify()` reads the
   latest `env:*` entry from `meta.testing_journal`. Proceeds only if classification is
   `test`; on `production`/`unknown` it fails closed.
3. **Schema-drift guard** — compares the live schema fingerprint to the baseline captured at
   provision time (`meta.schema_baseline`). On drift it cancels and names the exact column
   (e.g. `users.suspended_at missing`), catching schema/seed mismatches up front instead of
   as a buried runtime error.

## Database fingerprints

`tests/fixtures/signatures.ts` records compact per-DB fingerprints in the journal so state can
be compared in O(tables) rather than diffing rows. `npm run qa:sig` prints the current
**schema-sig** (column layout hash — cheap, no scan) and **rows-sig** (per-table `count(*)`)
and reports drift vs the recorded baseline. The schema baseline is captured by `qa:provision`.

> Future (not built): full per-table **content** signatures — for tests that require specific
> predefined content to pass, and for comparing two servers' data without shipping rows
> (e.g. image-cache-on vs off perf runs). See `TAXONOMY.md` notes.

Then the selected tests run to completion, collecting all results regardless of failures.

## DB safety

The `meta` schema (and `meta.testing_journal`) lives outside `public`, so resets — which drop
only `public` — never erase the journal. A DB carrying a `data-class:production-copy` /
`env:production-like` journal entry will refuse destructive operations until a later entry
overturns it (latest-entry-wins).
