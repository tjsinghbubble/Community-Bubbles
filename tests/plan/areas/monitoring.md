# Site Monitoring (tag: monitoring)

- source: docs/use-cases-and-tests.tsv rows 127–135
- default layer: **headless** for the stat reads (deterministic, cheap); e2e only for the
  dashboard-renders smoke and the auto-refresh behavior (UC 106).
- mocks in play: none for the numeric reads. Integration-status UCs (103/104) depend on
  CometChat/object-storage being reachable — locally they may report degraded; that's a
  tolerated state, not a mock requirement.

Super-admin-only dashboards. Most positives are "the endpoint returns the stat and it
matches reality"; most negatives are "a non-super-admin is denied."

## UC 98 — View platform stats (users, bubbles, events, memberships)   [todo · headless]
- positive: GET stats → counts are present and consistent with the seeded data (e.g. user
  count == seeded roles + fixtures). Assert against known seed quantities, not hardcoded
  numbers that drift — derive from the seed or assert "> 0 and == counted".
- negative: non-super-admin denied.

## UC 99 — View growth metrics (new users/bubbles over 7 and 30 days)   [todo · headless]
- positive: GET growth → 7d and 30d buckets present, numeric, non-negative.
- negative: non-super-admin denied.

## UC 100 — View content health (orphan bubbles, avg members, rejected count)   [todo · headless]
- positive: GET content-health → fields present and sane (avg members ≥ 0; counts integers).
- negative: non-super-admin denied.

## UC 101 — View campus stats (campuses, verified users, campus bubbles)   [todo · headless]
- positive: GET campus stats → fields present (likely zeros locally — fine).
- negative: non-super-admin denied.

## UC 102 — View server memory usage and environment   [todo · headless]
- positive: GET → memory + env fields present; env reads as the test environment.
- negative: non-super-admin denied. (Sensitive — confirm the gate is tight.)

## UC 103 — Check CometChat integration status and latency   [todo · headless]
- positive: GET integration status → a status field + latency number is returned (value may
  be "degraded"/null locally — assert the SHAPE, tolerate the value).
- negative: non-super-admin denied.

## UC 104 — Check object storage status and latency   [todo · headless]
- positive/negative: as UC 103 for storage.

## UC 105 — View count of pending items awaiting review   [todo · headless]
- positive: GET pending count → matches the number of pending bubbles/events/reports (seed
  one pending bubble to make it non-zero and assert it counts).
- negative: non-super-admin denied.

## UC 106 — Auto-refresh stats every 30 seconds   [todo · e2e]
- roles: role-site-admin.
- positive: open the dashboard, change underlying data (or wait), assert the figure updates
  without a manual reload within the refresh window. **Timing-sensitive** — per Travis's
  caution on hard timeouts, assert "updated within a generous window", not exactly 30s.
- negative: low value; consider `review`/skip, or assert the dashboard doesn't error across
  a refresh cycle.

## Sequencing / dependencies
- Each stat read is independent and idempotent (no writes). UC 105 wants a pending item —
  reuse a disposable pending bubble. UC 106 is the only stateful/timing one.

## Future work (knowingly deferred)
- Stat *correctness* under churn (create/delete then re-read deltas) — future positives.
- Latency-threshold alerting, degraded-integration handling — future. The auto-refresh
  cadence is a good network-condition subject (see wander-site-admin).
