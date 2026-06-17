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

## testctl — status / nuke / health / inspect (scripts/testctl.py)

One control surface for everyone who pokes at tests (humans, Claude Code, shell
scripts, the qa runner itself). Python 3, stdlib only. Add `--json` to any
subcommand for machine-readable output.

```bash
npm run qa:status     # python3 scripts/testctl.py status
npm run qa:health     # python3 scripts/testctl.py health
npm run qa:nuke       # python3 scripts/testctl.py nuke --nuke=them-all
npm run qa:inspect    # python3 scripts/testctl.py inspect (interactive)

python3 scripts/testctl.py nuke --nuke=mcp,xcodebuild   # targeted stop
python3 scripts/testctl.py nuke all                     # positional form works too
```

- **status** — reads `tests/output/current-run.json` (a live heartbeat the qa
  runner maintains: state, active test/role/tags, jobs done/total) and the
  newest maestro log (`maestro.log` while a flow is live, `internal-maestro-log.log`
  after the post-run flatten) for the current step, then lists every test-related
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
- **inspect** — interactive failure inspector over a run's artifacts.
  `inspect [TEST] [RUN_DIR]`: RUN_DIR defaults to the live run (heartbeat) or
  the newest `tests/output/run-*`; a file path means its directory; an artifact
  subdir is climbed to the run root. With no TEST it menus the failing tests
  (same lines as the qa summary, minus run time). TEST parsing is forgiving:
  `auth-0100 [role-site-admin]`, `auth 100, site admin`, a whole pasted summary
  line, or `uc-182` (use-case alias, when unambiguous). Ambiguous specs are
  rejected with the candidate roles. Once a (test, role) run is selected, a
  typed/numbered command menu offers: **failure** (just the failing step from
  the runner log), **code** (the flow + subflows / headless source), **use case**
  (row from docs/use-cases-and-tests.tsv), **images** (screenshots → Preview),
  **run cmd** / **movie** (single-test re-run command, movie variant wraps it in
  `simctl recordVideo`; auto-copied to the clipboard), **params**, **dir**
  (Finder), **prompt** / **trello** (fill `scripts/testctl_prompt_template.md` /
  `_trello_template.md`; trello drafts land in `tmp/trello-cards/` for review,
  never auto-filed), **internal log**, and **configure** (per-type viewer
  commands, stored in `~/.config/testctl/viewers.json`; default is macOS
  `open`). Non-interactive: `--cmd <name>` runs one command and exits;
  `--json` lists the failing tests. Old artifact names (`run.log`,
  `vitest.json`, `newman.json`) are still understood.

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
| `runner/` | `qa.ts` CLI, `gating.ts`, `select.ts`, `report.ts`, `panic.ts`, `artifacts.ts` (naming/flatten), `run-flow.ts` (manual wrapper) |
| `output/` | Run artifacts (gitignored): `run-<UTC>-<nonce>/`, `run-manual-<flow>-<UTC>/` |
| `plan/` | Test-expansion planning + work assignment (`backlog.tsv`, area docs, prompts). See `plan/README.md`; drive with `npm run qa:plan` / `scripts/testplan.py` |
| `TAXONOMY.md` | Tag vocabulary + test-ID registry (source of truth) |

## Output naming (standing rule)

Every file or directory the test platform creates must be **easy to type at a shell**.
`runner/artifacts.ts:sanitizeFileName()` enforces it at creation time:

- Unix special characters are removed: `/ ( ) & ; " ' < > { } [ ] @ | ? * \`
- whitespace and control characters are removed
- Latin-1 accents (U+00A0–U+00FF) become their HTML entity name wrapped in colons
  (`déme` → `d:eacute:me`); U+0080–U+009F → `:U+8X:`; anything above U+00FF (emoji,
  CJK) is dropped
- anything new that writes test output must route names through `sanitizeFileName()`

Per-test artifact dirs are `<layer>/<test-id>-<role>/` (single dash, not `__`). Maestro's
`--debug-output` debris (`.maestro/tests/<timestamp>/…`) is flattened into the test's
artifact dir right after the flow exits, renamed by function:

| Maestro writes | Becomes |
|----------------|---------|
| `maestro.log` | `internal-maestro-log.log` (verbose trace — rarely worth reading) |
| `ai-(<flow>).json` | `detailed-log--<test-id>-<role>.json` (double dash = very detailed) |
| `ai-report-<flow>.html` | `WIP-report-<test-id>-<role>.html` (report gen not working yet) |
| `commands-(<flow>.yaml).json` | `maestro-flow-details-<test-id>-<role>.json` |
| `screenshot-⚠️-<epoch-ms>-(…).png` | `screenshot-WARNING-time-<HHMMSS.s>-<test-id>-<role>.png` (local time) |
| `screenshot-❌-<epoch-ms>-(…).png` | `screenshot-FAIL-time-<HHMMSS.s>-<test-id>-<role>.png` |
| anything else | `sanitizeFileName(original)` |

Name collisions across multiple `.maestro/tests/<timestamp>` dirs get a `.2`/`.3` suffix
(newest dir wins the canonical name). Maestro's captured CLI output is
`high-level-maestro-output.log` (its trailing "Debug output" pointer is rewritten to the
artifact dir, since the `.maestro/tests/<ts>` dir it names is flattened away). The flow
yaml that ran — plus every subflow it references — is copied into `<artifact-dir>/flow/`.
Headless tests get their source file copied next to `vitest-results--<leaf>.json` /
`detailed-log--<leaf>.json` (newman). Captured CLI output is
`high-level-vitest-output.log` / `high-level-newman-output.log`; the vitest one appears
only when the output carried information beyond a pointer to the results file
(vitest's quiet pass does not).

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
- Direct runs: prefer `npm run qa:flow -- <flow.yaml> [--role role-user] [-e K=V …]` —
  it injects the env vars above, gives the run its own
  `tests/output/run-manual-<flow>-<UTC>/` dir, and applies the output-naming flatten.
  Bare `maestro test` (only if you must): `-e METRO_HOST=localhost -e METRO_PORT=8081 \
  -e SHOT_PREFIX=tmp/maestro/ [-e EMAIL=… -e PASSWORD=…]` (see `config/roles.json`),
  with `--debug-output tmp/maestro` so debris stays out of the repo root.

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
