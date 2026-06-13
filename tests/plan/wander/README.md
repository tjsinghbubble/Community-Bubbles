# Wandering-Path Tests

Three e2e flows — one per role — that mimic a few minutes of real, multi-screen use. They
are **not** per-use-case and they are not strict pass/fail correctness tests. Their job is
*traversal*: log in, move through many screens the way a person would, do a few real
actions, take a screenshot at each stop, and not crash.

They exist to feed two later efforts (both out of scope this phase):

1. **Product/Design device review** — run the same wander across many devices / OS
   versions / text sizes and collect the screenshots, so design can see the app in real
   contexts without driving it by hand.
2. **Network-condition testing** — run the same wander under offline / slow / lossy
   network (Network Link Conditioner, or a proxy fault-injector) to watch how each screen
   degrades.

Because of (1) and (2), the wanders must be **tolerant**: prefer `assertVisible` on
landmarks and screenshots over tight equality asserts; an empty list or a slow load is
information, not a failure. Keep them on **seeded fixtures** so they are deterministic
across devices. Any create actions must be idempotent-friendly (unique titles per run) and
need no teardown beyond the qa reseed.

| Unit | Role | Plan |
|---|---|---|
| `wander-0100` | role-user | `wander-user.md` |
| `wander-0200` | role-bubble-admin | `wander-bubble-admin.md` |
| `wander-0300` | role-site-admin | `wander-site-admin.md` |

They are in the backlog like any other unit — `python3 scripts/testplan.py next --area
wander`. Screenshots use `${SHOT_PREFIX}` so every stop is captured for the device-review
use. Tag them `wander, e2e, ios, role-*` and `slow` (NOT `smoke` — they are long and not
gating).
