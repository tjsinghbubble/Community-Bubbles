# Test Expansion — Planning & Orchestration

**Goal:** go broad. Get at least one positive and one negative test sketched for every
known use case in `docs/use-cases-and-tests.tsv`, plus three role-based "wandering path"
tests. Tests may fail and code may have bugs — that is fine; trustworthy breadth is the
point of this phase.

This directory is the **planning and work-assignment layer**. It does not contain tests.
It contains: the complete enumeration of work, the rumination behind each unit, the
reusable prompt that turns a unit into test code, and the bookkeeping that lets many cheap
LLM agents do that work in sequence (or in parallel) **without colliding or duplicating**.

---

## The three roles in this pipeline

| Who | Model | Does | Output |
|---|---|---|---|
| **Architect** | expensive (Fable/Opus) | rumination + judgment | area planning docs, the prompt template, the backlog |
| **Writer** | cheapest available | mechanical: one prompt → one test | a test file + a handback note |
| **Orchestrator** | you / `testplan.py` | hand out units, track state, ratify | updated backlog + TAXONOMY rows |

The split exists because writing a good *plan* needs judgment and writing the *test* from
a good plan mostly does not. Keep the expensive model on the left column.

## Lifecycle of one unit

```
  docs/use-cases-and-tests.tsv
        │  gen_test_backlog.py   (enumerate: 1 positive + 1 negative per use case)
        ▼
  tests/plan/backlog.tsv         (296 units; each owns a reserved id + output path)
        │  testplan.py next/claim (atomic: create units/<id>.md with O_EXCL)
        ▼
  tests/plan/units/<id>.md       (the prompt, handed to a Writer agent)
        │  Writer agent          (reads CONTEXT.md + areas/<area>.md, writes ONE test)
        ▼
  tests/<layer>/<area>/<id>-…    (the test) + handback note
        │  testplan.py done      + human ratifies the TAXONOMY.md registry row
        ▼
  npm run qa                     (someday — out of scope this phase)
```

## How collisions are prevented (the important part)

Three independent guarantees, so two agents working at once cannot step on each other:

1. **Output is reserved up front.** Every unit in `backlog.tsv` already owns a unique
   `unit_id` and a unique `output_path`. Two units can never target the same file, so two
   Writers can never overwrite each other — even if they run simultaneously.
2. **Claiming is atomic.** A unit is "claimed" by the *existence* of its prompt file
   `units/<id>.md`. `testplan.py` creates that file with `open(path, "x")` (O_EXCL). If two
   orchestrators race on the same unit, exactly one create succeeds; the loser
   automatically advances to the next candidate. No lock files, no shared-file writes.
3. **State is single-writer per file.** `done`/`block`/`release` each touch exactly one
   small file (the unit's prompt). The shared `backlog.tsv` is read-mostly — regenerated
   only when the use-case list changes — so there is no shared mutable ledger to corrupt.

This is why we do NOT use one big status spreadsheet that every agent edits: concurrent
edits to a shared file are exactly the collision we are avoiding. A database would also
work, but a directory of one-file-per-unit is git-diffable, needs no daemon, and matches
how `testctl.py` already operates.

## Driving the Writer agents

**Writer = Haiku, run as a Claude Code subagent** (decided 2026-06-13). The subagent has
repo + tool access, so prompts stay lean: it reads `CONTEXT.md`, greps `server/routes.ts`,
and copies the named sibling test itself. If you later switch to batch API calls (no live
repo), the prompts must inline sibling bodies and exact endpoints.

`units/<id>.md` (the claimed prompts) are **gitignored** — transient local work-state. The
durable record is `backlog.tsv` plus the produced test files. Claim coordination is
therefore single-machine; for multi-machine, move `units/` to a shared location or commit
it deliberately.

Sequential (the default — cheapest, simplest to supervise):

```bash
python3 scripts/testplan.py status                 # where things stand
python3 scripts/testplan.py next --area events     # claim the next events unit
#   → prints tests/plan/units/events-1200.md ; hand that file to a Writer agent
python3 scripts/testplan.py done events-1200        # after the test lands + is reviewed
```

To target the breadth quickly, claim by priority within an area, or filter
`--kind pos` first (get every happy path sketched before any negative), `--layer headless`
(the cheaper, simulator-free engine first), etc.

Parallel is safe (see guarantees above): run several `next` calls; each returns a
different unit. Give each Writer its own git worktree if they will commit.

## Files here

| Path | What |
|---|---|
| `backlog.tsv` | **generated** complete enumeration; the work universe + collision ledger |
| `CONTEXT.md` | shared ground truth every prompt references (accounts, fixtures, rules) |
| `PROMPT_TEMPLATE.md` | the Writer prompt; `testplan.py` fills its `$placeholders` |
| `units/<id>.md` | a materialized (claimed) prompt + its live status frontmatter |
| `areas/<area>.md` | per-area planning doc — the rumination; **Architect-written** |
| `wander/*.md` | the three role-based wandering-path plans |

`scripts/gen_test_backlog.py` (re)builds `backlog.tsv`. `scripts/testplan.py` is the
control surface (`status`, `list`, `next`, `claim`, `show`, `done`, `block`, `release`,
`gen`).

## backlog.tsv columns

`unit_id, area, layer, roles, kind, uc, uc_summary, priority, tags, needs_mock, status,
existing_test, output_path, notes`

- **status** — `todo` (ready), `blocked` (needs a mock; see `needs_mock`), `done` (already
  covered by an existing test), `review` (a `**` meta-row from the TSV — a human should
  decide if it's even a test). The live status of an in-progress unit is read from its
  `units/<id>.md` frontmatter and overrides the static column.
- **needs_mock** — the missing test double from `docs/Testing_Mocks.md` (`mock1-email`,
  `mock2-cometchat`, `mock3-media`, `mock5-push`, `mock6-share`). These units are parked,
  not lost; standing up the mock unblocks a batch at once.
- For **done** rows, `layer`/`output_path` are nominal (the real test's path is whatever
  the existing file is); only `existing_test` matters.

## Scope notes (deliberately incomplete — breadth first)

- One positive + one negative per use case is the *floor*. Richer matrices (multiple
  negative paths, value-range variants, more roles) are **future work** — note them in the
  area doc, don't block on them.
- **Role duplication is mechanical.** A unit names the primary role; where a use case
  applies to several roles, the area doc says "replicate across roles" and a Writer can
  emit the variants from one positive template. We do not enumerate a separate unit per
  role in the backlog (it would triple the ledger for little planning value).
- **Two-actor flows** (`notes: 2-actor`, e.g. admin approves a member's request) need two
  sessions acting in sequence; the headless pattern is in
  `tests/headless/joining/joining-0500` and `site-admin/site-admin-0100`.
- **65 units are mock-blocked.** That is expected and recorded, not a failure of planning.
- The **wandering-path** tests (`wander/`) are not per-use-case; they exist to feed two
  later, out-of-scope efforts: Product/Design device review, and network-condition
  testing (offline / slow / lossy).
