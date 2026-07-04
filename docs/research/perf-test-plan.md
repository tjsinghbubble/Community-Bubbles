# Performance test plan (hosting research)

Measures the numbers cloud pricing calculators need, per usage scenario, against the **local docker experiment stack** — never the live Replit deployment. Every test < 1 hour. Scripts live in `scripts/one-off/` and plan docs in `tests/plan/` — deliberately **outside** the qa runner's discovery paths (`tests/e2e/`, `tests/headless/`), so `npm run qa -- --all` can never execute them.

*Written 2026-07-03. Companion: [usage-scenarios-to-load-model.md](usage-scenarios-to-load-model.md) (arithmetic model), tests/plan/areas/hosting.md (unit specs hosting-0100…0400).*

## Measurement matrix

| calculator input | measured by | script |
|---|---|---|
| vCPU / RAM (steady + peak) | `docker stats` sampled 5 s during load | `hosting-resource-sample.sh` |
| req/s capacity, p50/p95/p99 | k6 constant-arrival-rate per scenario | `hosting-loadtest.sh` → `hosting-loadtest.js` |
| avg response bytes → API egress GB/mo | k6 `data_received / http_reqs` × model | `hosting-egress-report.sh` |
| DB size, bytes/user, block I/O, connections | SQL snapshot | `hosting-db-size.sh` + `.sql` |
| object storage GB + bandwidth | model knobs (photos measured per-object in app) | load-model doc |
| image/volume GB (block storage) | `docker image ls`, volume du | build script output |

## Tooling

- **k6** (external binary, `brew install k6` — no package.json change). Weighted read-heavy endpoint mix (bubbles, campus events, categories, me, login) with a seeded auth user (`scripts/seed-test-data.ts`: `test@example.com`).
- Rates per scenario = peak req/s from the load model (mean × 10), min 1 req/s: zero-growth/low 1, moderate 2, fast 4, insane 52, plus a synthetic `headroom` probe at 200 req/s to find the single-container ceiling.
- Outputs under `tmp/hosting-perf/run-<scenario>-<UTC>/` (gitignored): `k6-summary.json`, `resources.tsv`, `report.tsv`.

## Run procedure

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

Time budget: five scenarios ≈ 55 min sequential; in practice run {insane, headroom} + one low scenario (~30 min) — the small scenarios are arithmetic below measurable noise.

## Caveats

- Numbers are relative to the dev machine (Docker Desktop on macOS, virtualized). Treat as **sizing guidance** (does a 2 vCPU class cope? what's the bytes/response?), not SLOs. Re-run on a candidate cloud VM before final commitment.
- CometChat/Resend/Sentry calls are not exercised (dummy creds); their egress is not on our bill anyway.
- Object download egress is modeled (photos × avg bytes), not load-tested — fake-gcs bytes are not representative.

## Results (run 2026-07-03, Docker Desktop 4.8.0 on macOS host, 10 min steady state each; headroom 5 min)

| run | target req/s | achieved | p95 ms | fail rate | avg resp bytes | peak api CPU% (1 core=100) | peak api mem |
|---|---|---|---|---|---|---|---|
| zero-growth | 1 | 1.00 | 11.2 | 0 | 2,835 | 4.9 | 67 MiB |
| low-usage | 1 | 1.00 | 11.4 | 0 | 2,888 | 5.2 | 69 MiB |
| moderate-usage | 2 | 2.00 | 10.1 | 0 | 3,046 | 4.8 | 70 MiB |
| fast-usage | 4 | 4.00 | 9.5 | 0 | 2,787 | 5.7 | 83 MiB |
| insane-usage | 52 | 51.98 | 8.5 | 0 | 2,843 | 43.0 | 103 MiB |
| headroom | 200 | 199.59 | 8.5 | 0 | 2,848 | 88.3 | 115 MiB |

DB container: ≤15% CPU / 36 MiB through insane; 34% / 51 MiB at the 200 req/s probe. DB size 9.9 MB at 8 seeded users (mostly base schema overhead; per-user marginal bytes are small — single-digit GB even at insane WAU). Peak DB connections observed: 2 (pool default; far below any managed-PG limit).

### Conclusions

1. **One 2 vCPU / 4 GB instance covers every scenario with ~4× headroom.** Insane-usage (52 req/s peak) used 43% of one core and ~103 MiB RSS; the API served 200 req/s at 88% of one core with p95 8.5 ms and zero failures — it never saturated even there. The smallest always-on tier at any vendor suffices; pick on backup quality and egress model, not compute.
2. **Real avg API response is ~2.8 KB** (fallback assumption was 15 KB). Measured API egress at insane-usage: ~39 GB/mo (model's 15 KB guess said 205). **Photo/object egress dominates the egress bill**, reinforcing the R2/pooled-transfer lever in [hosting-pricing-parameters.md](hosting-pricing-parameters.md).
3. p95 stayed ≤11.4 ms at all rates (local network; treat as relative). Latency is not a sizing constraint at these volumes.
4. Auth rate limiting (10/15 min per IP, `server/routes.ts:40`) is the first thing a load test hits — round 1 failed on it. Real multi-user traffic won't, but any future perf work must set `RATE_LIMIT_AUTH_*` on the stack under test.

## Runner-integration discuss-item

If the team wants `npm run qa -- --area hosting` to drive these, `tests/runner/select.ts` needs a new excluded-by-default tag set (the existing `unverified` filter is bypassed by `--all`); ~20 lines in `select.ts:selectTests()` + `qa.ts` tag resolution. Until then these stay manual by design.
