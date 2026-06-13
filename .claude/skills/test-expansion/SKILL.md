---
name: test-expansion
description: Drive a Bubble test-area to green using the backlog + Haiku Writer subagents. Use when asked to "drive/orchestrate/write tests for the <area> area", expand test coverage from tests/plan/backlog.tsv, or claim/verify/mark-done backlog units. Wraps scripts/testplan.py (preflight, claim-area, verify-area) so an area is driven with a few calls instead of manual for-loops.
---

# Test-area orchestration

Breadth-first test expansion (see `tests/plan/README.md`). You are the **Orchestrator**:
claim units, dispatch **Haiku Writer subagents** to author tests, then verify centrally.
`scripts/testplan.py` does the batch work — never hand-roll the for-loops/seed/sed again.

## The loop for one area

```bash
python3 scripts/testplan.py preflight                 # load/disk/server OK? (start: npm run qa:server:log)
python3 scripts/testplan.py claim-area <area>         # atomically claims all todo units -> prints units/<id>.md paths
#   (add --include-blocked only if you've confirmed a unit's mock-block is a false positive)
```

Then **dispatch Haiku Writer subagents** (Agent tool, model: haiku), ~6 units each, AUTHOR-ONLY
(they must NOT run vitest — you verify centrally to avoid concurrent-DB races). In each brief:
- point them at `tests/plan/CONTEXT.md`, `tests/plan/areas/<area>.md`, and a sibling test to copy;
- **give them the EXACT verified endpoint shapes** — grep `server/routes.ts`/`storage.ts` with
  `find-within` FIRST and paste the real request/response shapes + authz. (Guessing shapes is what
  caused 6 fixups in the rules round; categories/monitoring were clean once shapes were handed over.)
- tell them each unit prompt has a VERBATIM tag block to copy (fill only `qa-reason`);
- remind: unique names `${Date.now()}`, assert on own data (never whole-list counts), clean up in
  `afterAll`, negatives assert refusal + no-state-change.

Then verify + finalize in ONE call:

```bash
python3 scripts/testplan.py verify-area <area> --seed   # reseed -> run suite serially -> on green: drop `unverified` + mark units done
```

`verify-area` also warns if `#qa-ids < #claimed units` — a sign a Writer **folded** pos+neg into
one file (a known Haiku habit); split them into one-unit-one-file before trusting green. On failure
it lists the failing files; triage (usually a response-shape mismatch — confirm with `find-within`
against routes.ts), then re-run.

Finally commit just that area (the user commits per-area):
```bash
git add tests/headless/<area> && git commit -m "test(<area>): full <area> area via Writer pipeline"
```

## Notes
- All `*-area` ops are idempotent and safe to re-run. `claim` = atomic O_EXCL create of
  `tests/plan/units/<id>.md` (gitignored), so parallel claims never collide.
- Headless suite is serial by config (`fileParallelism:false`); reorder/count tests rely on this.
- Per-test requests carry `X-Bubble-Test: test(<id>,r=<role>,pid=<n>)`; the server logs `ip/ua/test`
  (capture with `npm run qa:server:log`) so a request can be synced to its test.
- Pure-headless unblocked areas (rules, categories, monitoring, reports) are the cheapest to drive.
- Real bugs found during a run → draft to `tmp/trello-cards/` (see the `trello` skill), don't auto-file.
