# Plan — Use-Case ↔ Test management (coverage, history, flakiness)

Status: **DESIGN LOCKED, not yet implemented.** 2026-06-24.
Author: design session (Travis + Opus). Implementation pending (separate effort).

---

## Context

`docs/use-cases-and-tests.tsv` (read-only) seeded the first generation of e2e +
headless tests. That bootstrap goal is met. The process is stabilizing, so the
focus shifts to **expanding** use cases and tests while keeping the framework
resilient and future-proof.

The failure mode today: three things are tracked in three incompatible ways —
use-case **definitions** (read-only TSV), test→UC **links** (a free-text
`(UC 180)` comment in a flow header), and **results** (scattered
`tests/output/run-*/summary.json`). They drift.

## Goals (verbatim intent)

Track: coverage of every use case; failure rates per test; automatically for
"official" runs (`npm run qa`, `npm run qa:flow`); testing context as it
happened; parallel (headless) testing.

Let users see: a use case's definition; its related test scripts; historical
coverage on these parameters; coverage gaps by use case; failures/flakiness.

Let users add: new use cases (incl. for unbuilt features); new tests (esp.
variants).

## Out of scope (deferred — confirmed)

- File/line **code coverage** (related; may fold in later).
- **GitHub check-in hooks** / per-run CI reports.
- A **formal process** for adding UCs + seed tests — ad hoc is fine for now.

---

## Locked decisions

| Fork | Decision |
|---|---|
| UC↔test mapping authority | **Catalog defines UCs; links live in tests; a lint reconciles** (flags drift/gaps). |
| History substrate | **Append-only JSONL ledger** (durable truth) + **rebuilt SQLite index** (cache). |
| History scope | **Local-first**; schema portable so it can centralize later. Not git-committed. |
| First slice | **Both at once** — catalog+links AND ledger+index in one effort. |
| Catalog format | **Markdown file per UC** (`tests/catalog/UC-####.md`), `---` key:value header + body. Stdlib parse (no YAML lib). |
| History location | **`tests/history/`**, gitignored. |
| UC id scheme | `UC-####` (zero-padded, sortable; e.g. `UC-0180`). |
| Execution granularity | One row per **(test × role × platform × run)**. |
| testctl | Keep emitting `docs/use-cases-and-tests.tsv` as a **generated view** so `testctl inspect` is untouched; migrate it to the catalog later. |
| Tool shape | One stdlib tool `scripts/uc.py` (not spread across testplan/testctl). |

Rationale ties to existing house philosophy: **definitions in git, a rebuildable
derived index that is never the source of truth** — same split as
`manage_devices.py` (derived from live toolchain) and `testplan.py` (atomic
claim). Stdlib-only, like the other `scripts/*.py` controllers.

---

## Architecture: 3 layers + a derived index

1. **Use-case catalog** (git-tracked, writable, PR-reviewed) — source of truth
   for UC *definitions*. One markdown file per UC.
2. **Test→UC links** (decentralized, in the test files) — each test declares the
   UC(s) it exercises. Adding a test/variant updates coverage with no central edit.
3. **Results ledger** (local, append-only JSONL) — one row per test execution
   with outcome + run context.
4. **Derived index** (local SQLite WAL, rebuildable from 1+2+3) — answers
   coverage / gaps / flakiness / history. A cache, never truth.

---

## File layout

```
tests/catalog/UC-0180.md          # git-tracked, one file per use case (TRUTH)
tests/e2e/**/*.yaml               # + `# qa-uc: UC-0180,UC-0181` header
tests/headless/**/*.test.ts       # + `// qa-uc: UC-0180`
tests/history/executions.jsonl    # gitignored, append-only ledger (TRUTH for results)
tests/history/index.db            # gitignored, SQLite WAL (rebuildable cache)
scripts/uc.py                     # stdlib: parse catalog, lint, build index, query views
docs/use-cases-and-tests.tsv      # GENERATED view (legacy testctl reader)
```

`.gitignore`: add `tests/history/`.

---

## Catalog format — `tests/catalog/UC-0180.md`

Header is a `---`-fenced block parsed as plain `key: value` lines (NOT YAML — a
~5-line stdlib splitter, same visual style as `MEMORY.md`). Body is the human
definition.

```markdown
---
id: UC-0180
area: auth
feature_status: built          # planned | built | deprecated
title: New-user signup through onboarding to an authed session
owner:
---

Sign up with name, gender, DOB, email, password → authenticated Explore session.

## Acceptance
- Success signal is the Explore FAB (button-create-fab).
```

- "See a use case" = read the file.
- "Add one (incl. unbuilt)" = drop `UC-####.md` with `feature_status: planned`
  and no tests → it surfaces as a tracked gap, not an omission.

---

## Test→UC link convention

Extend the existing header parser (the one that reads `# qa-id`, tags):

- e2e YAML flows: `# qa-uc: UC-0180,UC-0181`
- headless `.test.ts`: `// qa-uc: UC-0180`

A test may cover several UCs; a UC may be covered by several tests/variants.

---

## Reconcile lint (`qa:lint:uc`) — the "both" enforcer

Loads the catalog (valid IDs), scans link headers, and flags:

- link → unknown UC id
- UC with **no** covering test (gap)
- `built` UC covered **only** by `unverified` tests (untrusted coverage)
- `planned` UC that already has passing tests (status drift → promote to `built`)

`--json` output; **nonzero exit on broken links** so it can gate later. Not
wired to CI now (out of scope).

---

## Results ledger — `tests/history/executions.jsonl`

Append one line per **(test × role × platform × run)**:

```json
{"ts":"2026-06-24T19:31:51Z","run_id":"run-...","provenance":"qa",
 "test_id":"auth-0200","qa_uc":["UC-0180"],"role":"role-user","platform":"android",
 "layer":"e2e","device":"emulator-5556","app_build":"<id>","commit":"<sha>[+dirty]",
 "outcome":"pass","duration_ms":123456,"host_load":9.73,"metro":true,
 "env":"local","artifact_dir":"tests/output/run-.../"}
```

Concurrency: the **testctl run-lock already serializes official runs**, and
within a run the writer is single-threaded JS (the parallel headless batch
resolves in one process). So appends are uncontended; a one-line `O_APPEND` +
`flock` is only needed if an ad-hoc writer bypasses the lock.

`provenance`: `qa` | `qa:flow` | `adhoc`. Automatic capture is for the two
official entrypoints.

---

## Derived index — `tests/history/index.db` (SQLite WAL, rebuildable)

Tables: `use_cases`, `tests`, `test_uc` (links), `executions` (imported from
JSONL). Views for coverage / gaps / flakiness. Rebuild anytime from
catalog + link-scan + ledger (`uc.py reindex`).

**Coverage is an enum** (not boolean): `uncovered` / `planned` /
`unverified-only` / `covered` / `blocked`. ("Has a test" ≠ "covered".)

**Flakiness keys on the commit SHA**: flaky = **both** pass and fail outcomes at
the **same `commit`** over the recent window; a `+dirty` working tree is
**excluded** from flakiness math. This separates *nondeterministic* (flaky) from
*consistently failing* (a real, trustworthy failure) — the suite's core goal.

---

## CLI / npm scripts (testplan/testctl house style)

| npm | uc.py | shows |
|---|---|---|
| `qa:uc <id>` | `uc show <id>` | UC definition + linked tests + recent coverage/flakiness |
| `qa:coverage` | `uc coverage` | per-UC status enum matrix |
| `qa:gaps` | `uc gaps` | uncovered / unverified-only / built-with-no-trusted-test |
| `qa:flaky` | `uc flaky` | tests with both outcomes at same commit in window |
| `qa:history <test>` | `uc history <test>` | execution history for one test |
| `qa:lint:uc` | `uc lint` | reconcile catalog ↔ links (nonzero on broken) |
| (build) | `uc reindex` | rebuild index.db from catalog + links + ledger |

---

## Integration points

- `tests/runner/qa.ts` and `tests/runner/run-flow.ts`: after each test finishes
  (where they already write `summary.json` / `current-run.json`), append a
  ledger row. Most context is already in `run-params.json`; **add**
  `git rev-parse --short HEAD` + dirty check, and reuse the host-load sample.
- Header parser / `tests/runner/select.*`: teach it `qa-uc`.
- On catalog change (or in `reindex`): regenerate `docs/use-cases-and-tests.tsv`
  with a `# GENERATED — edit tests/catalog/, not this file` banner so
  `testctl inspect`'s use-case lookup keeps working unchanged.

---

## Migration (the bridge)

The old TSV already maps UC↔test (it generated the suite). One-time:

1. Parse `docs/use-cases-and-tests.tsv` → seed `tests/catalog/UC-####.md`
   (title/area/description from the rows; `feature_status` inferred or defaulted).
2. Backfill `# qa-uc:` / `// qa-uc:` headers into existing tests from the TSV's
   existing UC↔test associations.
3. Retire the TSV as truth; keep it as the generated view (step above).

---

## Build order (one effort, both slices)

1. `uc.py` catalog parser + `tests/catalog/` + TSV→catalog migration.
2. Backfill `qa-uc` headers into existing e2e + headless tests.
3. `qa-uc` parsing in the runner's header reader / select.
4. `uc lint` + `uc coverage` / `uc gaps` (work with zero history).
5. Ledger append in `qa.ts` + `run-flow.ts` + context capture (commit, dirty, load).
6. `uc reindex` (JSONL + catalog + links → SQLite) + `uc flaky` / `uc history`.
7. npm wrappers (`qa:uc`, `qa:coverage`, `qa:gaps`, `qa:flaky`, `qa:lint:uc`,
   `qa:history`), `.gitignore tests/history/`, regenerate the legacy TSV view.

---

## Deferred / open (revisit when implementing)

- Whether `feature_status` can be auto-promoted by the lint or stays manual.
- Retention/rotation of `executions.jsonl` (size over time); compaction into the
  index then truncation is an option.
- Centralization path (push local ledger to a shared store / CI) — schema is
  designed to allow it; not built.
- File/line code coverage join — out of scope for now.

## Cross-references (Claude memory)

- `project_test_architecture.md` — the `tests/` tree + qa runner.
- `project_testctl.md`, `project_test_runner_lock.md` — run lock that serializes writers.
- `project_test_expansion_orchestration.md` — `tests/plan/` backlog + `testplan.py`.
- `ref_rules_api_shapes.md` / `project_test_request_tagging.md` — context fields.
- `project_device_manager.md` — the "log + rebuildable derived index" precedent.
- `project_script_documentation_system.md` — stdlib-tool + git-truth/derived-cache house style.
