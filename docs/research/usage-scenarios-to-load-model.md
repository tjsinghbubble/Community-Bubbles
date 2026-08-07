# From usage scenarios to hosting numbers

*Part of the [Move-from-Replit](Move-from-Replit.md) research set. Written 2026-07-03; measured values folded in the same day.*

## What this document is

Cloud vendors price hosting in technical units — requests per second, gigabytes transferred, database size. The business thinks in users — how many people use Bubble each day and each week. This document is the bridge: it takes the five usage scenarios agreed with the business team and converts them, with stated assumptions and real measurements, into the numbers every vendor's pricing calculator asks for.

## The five scenarios

Each scenario is defined by daily active users (DAU), weekly active users (WAU), and how long a typical visit lasts.

| Scenario | Daily active users | Weekly active users | Typical visit length |
|---|---|---|---|
| Zero growth | 3 | 5 | 5 minutes |
| Low usage | 10 | 25 | 8 minutes |
| Moderate usage | 50 | 100 | 12 minutes |
| Fast growth | 100 | 700 | 15 minutes |
| "Insane" growth | 1,500 | 6,000 | 15 minutes |

## What the conversion found

**Even the most aggressive scenario is, by server standards, a small workload.** The insane scenario works out to about 5 requests per second on average, rising to roughly 50 per second in the busiest evening hour. Our load tests ([perf-test-plan.md](perf-test-plan.md)) showed one small server absorbing four times that without strain. Three consequences follow:

1. **Server cost is effectively flat across all scenarios.** The smallest always-on server covers everything from zero-growth through fast-growth, and insane-growth at most argues for one size up. Since the application must run continuously anyway (its internal scheduled chores require one always-on copy), the number to compare across vendors is simply each vendor's floor price for a small always-on setup.

2. **Photo bandwidth is the only number that grows meaningfully with usage** — from about 2 GB per month at zero growth to roughly 900 GB per month at insane growth. Vendors treat this very differently: the big three charge per gigabyte (~$0.09–0.12), Linode and Vultr bundle generous allowances with the server, and Cloudflare's R2 storage charges nothing for it. At high usage this single line dominates the bill at the big three.

3. **The database stays tiny at every scenario** — comfortably under 10 GB even at 6,000 weekly users. The smallest managed database tier suffices everywhere; what should drive that choice is backup and recovery quality (the lesson of the Replit data-loss incident), not capacity.

## The scenario numbers

Converted traffic and bandwidth per scenario, using the measured average response size (see appendix for the arithmetic):

| Scenario | Requests per day | Average requests/sec | Peak-hour requests/sec | Data responses, GB/month (measured) | Photo downloads, GB/month (modeled) | Total transfer, GB/month |
|---|---|---|---|---|---|---|
| Zero growth | 300 | 0.003 | 0.03 | 0.03 | 1.7 | ~2 |
| Low usage | 1,600 | 0.02 | 0.2 | 0.14 | 5.7 | ~6 |
| Moderate usage | 12,000 | 0.14 | 1.4 | 1.1 | 28.5 | ~30 |
| Fast growth | 30,000 | 0.35 | 3.5 | 2.5 | 57 | ~60 |
| Insane growth | 450,000 | 5.2 | 52 | 39 | 855 | ~894 |

One honest caveat: the "data responses" column is measured; the **photo downloads column is an assumption** (10 photos viewed per visit at ~300 KB each), not a measurement. Since photos are the one growing cost, measuring them for real is a stated goal of proper performance testing ([How-to-test-on-Linode.md](How-to-test-on-Linode.md)), and the related image-serving inefficiency in [image-costs-and-caching.md](image-costs-and-caching.md) could push real numbers above this model until fixed.

## Appendix — the model's assumptions and arithmetic (for anyone re-deriving the numbers)

### Assumptions (deliberately kept in one tunable place)

| Assumption | Value | Reasoning |
|---|---|---|
| Visits per user per day | 2 | Event-planning app; people check in the morning and evening |
| Requests per active minute | 10 | Fallback; measured empirically by replaying a scripted session |
| Peak factor | 10× | Evening-heavy social usage: the busiest hour runs ~10× the daily average |
| Average data-response size | **2.8 KB measured** (fallback was 15 KB) | From the load-test tool's totals; the fallback overestimated data bandwidth ~5× |
| Photos viewed per visit | 10 | Feed and event browsing |
| Average photo size | 300 KB (modeled) | Mix of thumbnails and full images |
| Days per month | 30.4 | — |

Changing an assumption in the pricing model script (`scripts/one-off/hosting-pricing-model.sh`) recomputes the scenario table.

### Formulas

```
requests/day        = DAU × visits/day × visit minutes × requests/active-minute
average requests/s  = requests/day ÷ 86,400
peak requests/s     = average × peak factor (10)
data GB/month       = requests/day × 30.4 × average response bytes
photo GB/month      = DAU × visits/day × 30.4 × photos/visit × average photo bytes
database size       = base + WAU × measured bytes per weekly user
```

### What the performance tests were required to measure (the contract with [perf-test-plan.md](perf-test-plan.md))

- Steady-state and peak CPU / memory of the application at each scenario's peak request rate
- Average response size per endpoint class (feeds the data-bandwidth column)
- Database size per seeded user/event/message, plus block I/O rates
- Maximum concurrent database connections under peak load (managed-database tiers cap these)
- Container image and data volume sizes (feeds block-storage pricing)
