# Usage scenarios → load model

Translates the five business usage scenarios into the numeric parameters cloud pricing calculators ask for. The measured inputs (avg response bytes, DB bytes/user, CPU/RAM under load) come from the perf tests in [perf-test-plan.md](perf-test-plan.md); everything else is arithmetic from the model below.

*Written: 2026-07-03. Model knobs are assumptions — tune them in one place (the table below) and the scenario table recomputes (see `scripts/one-off/hosting-pricing-model.sh`).*

## Scenarios (given)

| scenario | DAU | WAU | ATS (min) |
|---|---|---|---|
| zero-growth | 3 | 5 | 5 |
| low-usage | 10 | 25 | 8 |
| moderate-usage | 50 | 100 | 12 |
| fast-usage | 100 | 700 | 15 |
| insane-usage | 1,500 | 6,000 | 15 |

## Model knobs (assumptions, tunable)

| knob | value | rationale |
|---|---|---|
| `sessions_per_user_per_day` | 2 | event-planning app; open morning + evening |
| `req_per_active_minute` | 10 | fallback; measured empirically by replaying a scripted session (see perf plan) |
| `peak_factor` | 10× | evening-heavy social usage; peak-hour req/s = mean × 10 |
| `avg_api_response_bytes` | measured (fallback 15 KB) | k6 `data_received / http_reqs` |
| `object_downloads_per_session` | 10 photos | feed/event browsing |
| `avg_object_bytes` | measured (fallback 300 KB) | photo thumbnails/originals mix |
| `db_bytes_per_wau` | measured | `pg_database_size()` per seeded user incl. events/messages |
| days/month | 30.4 | — |

## Arithmetic

```
requests/day   = DAU × sessions_per_day × ATS_min × req_per_active_minute
mean req/s     = requests/day ÷ 86,400
peak req/s     = mean req/s × peak_factor
API egress/mo  = requests/day × 30.4 × avg_api_response_bytes
object egress/mo = DAU × sessions_per_day × 30.4 × object_downloads_per_session × avg_object_bytes
DB size        = base + WAU × db_bytes_per_wau   (point-in-time; growth tracked per month of retention)
```

## Scenario table (updated with measured values, 2026-07-03)

Measured avg API response = **~2.8 KB** (k6 `data_received/http_reqs` across the mix; the 15 KB fallback overestimated API egress ~5×). Object egress remains modeled (10 photos/session × 300 KB).

| scenario | req/day | mean req/s | peak req/s | API egress GB/mo (measured) | object egress GB/mo (modeled) | total egress GB/mo |
|---|---|---|---|---|---|---|
| zero-growth | 300 | 0.003 | 0.03 | 0.03 | 1.7 | ~2 |
| low-usage | 1,600 | 0.019 | 0.19 | 0.14 | 5.7 | ~6 |
| moderate-usage | 12,000 | 0.14 | 1.4 | 1.1 | 28.5 | ~30 |
| fast-usage | 30,000 | 0.35 | 3.5 | 2.5 | 57 | ~60 |
| insane-usage | 450,000 | 5.2 | 52 | 39 | 855 | ~894 |

## The headline finding

**Even the insane scenario is a small workload.** 5.2 mean / ~52 peak req/s is comfortably served by one 2 vCPU / 4 GB instance (validated by load test; see perf-test-plan.md results). Consequences:

1. **Compute pricing is effectively flat across scenarios** — the smallest always-on tier covers zero-growth through fast-usage; insane-usage at most steps up one tier. The app cannot scale to zero anyway (in-process schedulers in `server/notifications.ts`), so the always-on floor price is the real number to compare across vendors.
2. **Egress and object storage are the only parameters that move meaningfully with growth** (~2 GB/mo → ~1 TB/mo). Vendor egress models differ radically: hyperscalers charge ~$0.09/GB after a free allowance; Vultr/Linode include pooled TB-scale transfer with the VM; Cloudflare R2 has zero egress fees. At insane-usage this line item dominates the bill on hyperscalers.
3. **Database stays tiny.** Even 6,000 WAU × generous per-user bytes is well under 10 GB; smallest managed-PG tiers suffice everywhere. The pricing driver is HA (2×) and backup retention, not size — and given the Replit data-loss incident, backup/PITR quality should be weighted alongside price.

## What the perf tests must measure (contract with perf-test-plan.md)

- steady-state and peak **vCPU / RAM** of the API container at each scenario's peak req/s
- **avg response bytes** per endpoint class (API egress input)
- **DB size** per seeded user/event/message + `pg_stat_database` block I/O (IOPS input)
- **max concurrent DB connections** under peak load (managed-PG connection limits)
- container **image + volume GB** (block-storage input)
