# Performance testing: how we measured, and what we found

*Part of the [Move-from-Replit](Move-from-Replit.md) research set. Written and executed 2026-07-03.*

## What this document is

To price hosting honestly, we needed measurements, not guesses: how much computing power does Bubble actually use at each usage level, how big are its responses, how large is its database? This document describes the tests we ran to get those numbers and reports the results in full. The companion [usage-scenarios-to-load-model.md](usage-scenarios-to-load-model.md) explains how usage scenarios became target traffic rates; this one shows what happened when we generated that traffic for real.

## The findings, up front

1. **One small server (2 CPUs, 4 GB memory) handles every usage scenario with about four times capacity to spare.** At the most aggressive scenario's peak — about 52 requests per second, corresponding to 1,500 daily / 6,000 weekly users — the application used well under half of one CPU and about 100 MB of memory. Pushed to 200 requests per second (a level no scenario reaches), it still answered everything in under a hundredth of a second with **zero failures**, and even then was not fully saturated. Practical conclusion: buy the smallest sensible always-on server and choose the vendor on backup quality and bandwidth pricing, not computing power.

2. **The application's responses are much smaller than we had assumed** — about 2.8 KB on average versus the 15 KB planning assumption. Real data bandwidth is therefore about a fifth of the earlier estimate, which reinforced the cost finding that **photo traffic, not application data, is what drives the bandwidth bill** as usage grows.

3. **The database barely registers.** It stayed nearly idle through every test, its size is dominated by fixed overhead rather than per-user data, and the application held only 2 database connections even at peak — far below any managed-database limit.

4. **Response speed is not a concern at these volumes.** Worst-case response times stayed around a hundredth of a second at every traffic level tested. (These were same-machine tests; real-world times will add normal internet latency.)

## How the tests worked, in brief

- We packaged the application exactly as it would be deployed (see [dockerization-plan.md](dockerization-plan.md)) and ran it, with its database, on a developer's machine — **never against the live Replit site**.
- An industry-standard load-testing tool (k6) simulated users performing a realistic mix of the app's common actions — browsing bubbles, viewing campus events, checking categories, logging in — at precisely controlled rates: one test per scenario at that scenario's busiest-hour rate, plus a deliberate stress probe at 200 requests/second to find the ceiling.
- While each test ran, a sampler recorded the application's and database's CPU and memory use every five seconds, and the tooling recorded response times, failures, response sizes, and database growth.
- Each scenario ran for a 10-minute steady state; the whole matrix completes in under an hour.

## The measured results (run of 2026-07-03)

| Test | Target requests/sec | Achieved | Slowest 5% of responses | Failures | Avg response size | Peak app CPU (% of one core) | Peak app memory |
|---|---|---|---|---|---|---|---|
| Zero growth | 1 | 1.00 | 11.2 ms | 0 | 2.8 KB | 4.9% | 67 MB |
| Low usage | 1 | 1.00 | 11.4 ms | 0 | 2.9 KB | 5.2% | 69 MB |
| Moderate usage | 2 | 2.00 | 10.1 ms | 0 | 3.0 KB | 4.8% | 70 MB |
| Fast growth | 4 | 4.00 | 9.5 ms | 0 | 2.8 KB | 5.7% | 83 MB |
| Insane growth | 52 | 51.98 | 8.5 ms | 0 | 2.8 KB | 43.0% | 103 MB |
| Stress probe | 200 | 199.59 | 8.5 ms | 0 | 2.8 KB | 88.3% | 115 MB |

The database container never exceeded 15% of a core or 36 MB of memory through the insane scenario (34% / 51 MB at the stress probe). Database size was 9.9 MB with 8 seeded users — mostly fixed schema overhead; per-user growth is small enough that even 6,000 weekly users stay in single-digit gigabytes.

## Honest limitations — read before quoting these numbers

- **The tests ran on a laptop** (in Docker on macOS), so absolute speeds are approximate. Treat the results as sizing guidance — "does a 2-CPU class of machine cope?" (yes, easily) — not as service-level promises. Re-running the same tests on the actual candidate cloud server is cheap and is the point of [How-to-test-on-Linode.md](How-to-test-on-Linode.md).
- **Photo downloads were not load-tested here** — the local stand-in for photo storage doesn't behave like the real thing, so photo bandwidth is modeled, not measured (see [image-costs-and-caching.md](image-costs-and-caching.md) for what direct image measurements later found).
- **Outside services (chat, email, error reporting) were stubbed out** with dummy credentials. Their traffic isn't on our hosting bill in any case.
- **A practical trap for future testers:** the application intentionally limits login attempts (10 per 15 minutes per address) to slow down password-guessing. A load test coming from one machine hits this immediately — our first attempt failed exactly this way. Real traffic from many users won't, but any test setup must raise the limit via the `RATE_LIMIT_AUTH_*` settings on the stack under test (the experiment stack does this already).

## Appendix — mechanics (for whoever re-runs this)

Scripts live in `scripts/one-off/` and plan documents in `tests/plan/`, both deliberately outside the automated test runner's discovery paths so `npm run qa -- --all` can never trigger a load test.

**Tooling.** k6 (`brew install k6`; an external binary, no package.json change). The test mix is a weighted, read-heavy set of endpoints (bubbles, campus events, categories, me, login) using a seeded account from `scripts/seed-test-data.ts` (`test@example.com`). Rates per scenario are the load model's peak rates (minimum 1/s): zero-growth/low 1, moderate 2, fast 4, insane 52, stress probe 200. Outputs land under `tmp/hosting-perf/run-<scenario>-<UTC>/` (gitignored): `k6-summary.json`, `resources.tsv`, `report.tsv`.

**Run procedure:**

```bash
scripts/one-off/hosting-docker-build.sh
cp scripts/one-off/docker/.env.example scripts/one-off/docker/.env.local  # fill secrets
docker compose -f scripts/one-off/docker/compose.yaml up -d
DATABASE_URL=postgres://bubble:bubble_local_only@127.0.0.1:5433/bubble npx tsx scripts/seed-test-data.ts
scripts/one-off/hosting-loadtest.sh moderate-usage      # ~12 min incl. report
scripts/one-off/hosting-loadtest.sh insane-usage
scripts/one-off/hosting-loadtest.sh headroom 5m
scripts/one-off/hosting-db-size.sh
```

Time budget: all five scenarios ≈ 55 minutes sequentially. In practice run {insane, headroom} plus one small scenario (~30 minutes) — the small scenarios produce load below measurable noise.

**Measurement matrix** (which script produces which pricing input):

| Pricing input | Measured by | Script |
|---|---|---|
| CPU / memory (steady + peak) | container stats sampled every 5 s during load | `hosting-resource-sample.sh` |
| Requests/sec capacity, response-time percentiles | k6 constant-arrival-rate per scenario | `hosting-loadtest.sh` → `hosting-loadtest.js` |
| Average response bytes → data bandwidth | k6 `data_received / http_reqs` × the load model | `hosting-egress-report.sh` |
| Database size, bytes/user, block I/O, connections | SQL snapshot | `hosting-db-size.sh` + `.sql` |
| Container image + data volume sizes | `docker image ls`, volume `du` | build script output |

**Test-runner integration** remains a team decision: wiring these into `npm run qa -- --area hosting` needs a new excluded-by-default tag mechanism in `tests/runner/select.ts` (~20 lines) — until then the tests stay manual by design.
