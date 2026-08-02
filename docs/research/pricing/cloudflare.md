# Cloudflare pricing: what Bubble's setup would cost

*Part of the [Move-from-Replit](../Move-from-Replit.md) research set. Researched 2026-07-03 from Cloudflare's published pricing pages (linked in the appendix). USD.*

## The bottom line

**Cloudflare cannot host Bubble by itself — but one of its products, R2 photo storage, is the single best cost lever found in the entire study, and it can be bolted onto any other vendor's setup.** Two findings, in order of importance:

1. **R2 storage charges nothing — ever, at any volume — for downloads.** Photo bandwidth is the only cost in Bubble's profile that grows with usage: ~$0 today, but ~$70–105/month at the big three in the study's most aggressive scenario. Photos stored in R2 cost 1.5 cents/GB-month to store (cheaper than Amazon's 2.3) and **$0 to serve, forever, by explicit policy**. R2 speaks the same protocol as Amazon's S3, so it pairs with any vendor's servers. If the recommended photo-storage code change happens (see [dockerization-plan.md](../dockerization-plan.md)), our 50 GB of photos would cost about **$0.60/month, all-in, with zero growth exposure.**

2. **As a complete host, Cloudflare is missing two of our three pieces.** It has no ordinary rentable servers and no managed PostgreSQL — its compute products are built for a different style of application than our always-on, scheduled-chores server, and its own database product is not PostgreSQL. The closest fit (its young "Containers" product, generally available only since April 2026) could run our app for roughly $13/month, which is genuinely cheap — but it offers no permanent disk, can restart the app at will, and would still leave the database to be bought from a second vendor. That is a lot of novelty and vendor-juggling to save $30/month.

**Recommended role for Cloudflare: adjunct, not host.** Its free tier alone provides HTTPS certificates, a content-delivery network, a basic web application firewall, and unmetered protection against traffic-flood attacks — in front of whatever server we rent elsewhere, at $0. Add R2 for photos and the growth-cost problem is permanently closed.

## Why the compute story doesn't fit (plain-language)

Cloudflare's flagship compute product ("Workers") runs small pieces of code for the milliseconds of each web request, then evaporates — brilliant for some applications, structurally wrong for ours, which is one long-running program with internal timers doing reminder and cleanup chores around the clock. Making Bubble fit would mean rewriting those parts of the application into Cloudflare's shapes — a redesign, not a migration, and not recommended just to fit a platform. The "Containers" product can run our program unmodified (~$13/month at our size, because it bills processor time only when actually working), but its immaturity plus the missing database make it a watch-list item rather than a plan.

## What the useful pieces cost

| Product | What we'd use it for | Cost |
|---|---|---|
| R2 storage | All user photos | 50 GB ≈ **$0.60/month**; downloads $0 at any volume |
| Free plan (DNS, HTTPS, CDN, basic firewall, DDoS protection) | The free front door in front of any server | **$0** |
| Pro plan (fuller managed firewall rules) | Optional upgrade if we want managed WAF | $20–25/month |
| Containers | A possible future home for the app itself | ~$13/month at our size — watch-list, not plan |

## Things to know (plain-language gotchas)

- **R2's free allowance is generous for our scale:** the first 10 GB stored and healthy monthly request quotas are free; our current photo volume would bill under a dollar.
- **R2 usage rounds up** to whole billing units, and its cheaper "infrequent access" class carries retrieval fees and a 30-day minimum — plain Standard class is the right choice for user photos.
- **The $13/month container figure has fine print:** memory and disk bill for every hour the app exists (processor time only when busy), the disk is wiped on every restart, and the app must be configured never to sleep. Treat the number as real but the product as young.
- **A database would still be needed elsewhere regardless** — Cloudflare's own database is a different technology (SQLite-based), and its "Hyperdrive" product is a free accelerator that sits in front of a PostgreSQL you buy from someone else (its unlimited-queries tier is included in the $5/month Workers plan).

---

## Appendix — full pricing detail (source worksheet)

| resource_class | vendor_service_name | pricing_inputs (calculator knobs) | unit_prices | minimum / billing granularity | notes |
|---|---|---|---|---|---|
| compute-vm | n/a | — | — | — | Cloudflare has **no traditional VMs**. Closest substitutes: Workers (request-scoped isolates) and Containers. |
| compute-container | Workers Paid; Cloudflare Containers (GA 2026-04-13, on Workers Paid) | Workers: requests/mo, CPU-ms/mo. Containers: instance type (lite 1/16 vCPU-256 MiB-2 GB disk; basic 1/4-1 GiB-4 GB; standard-1 1/2-4 GiB-8 GB; up to standard-4 4 vCPU-12 GiB-20 GB), running hours, active-CPU seconds | Workers Paid $5/mo: 10M req incl., +$0.30/M; 30M CPU-ms incl., +$0.02/M. Containers: vCPU $0.000020/vCPU-s (**active CPU only**), memory $0.0000025/GiB-s (provisioned, wall-clock), disk $0.00000007/GB-s. Incl. on Paid: 375 vCPU-min, 25 GiB-h, 200 GB-h /mo | $5/mo plan minimum; containers billed per 10 ms while running; scale-to-zero after sleep timeout | Workers alone are a known bad fit for an always-on Express app with in-process `setInterval` schedulers. Containers CAN run the monolith always-on. Refactor path (Workers Cron Triggers / Durable Objects alarms) = a rewrite, not a lift-and-shift. |
| block-storage | n/a (Container ephemeral disk only) | disk GB-s of provisioned container disk (2–20 GB fixed per type) | $0.00000007/GB-s beyond 200 GB-h/mo incl. | per 10 ms while running | **Not durable** — container disk lost on restart. No EBS-equivalent. Persist state to R2/D1/external DB. |
| object-storage | R2 | GB-mo (Standard or Infrequent Access), Class A ops/M, Class B ops/M, egress GB | Storage $0.015/GB-mo Standard ($0.01 IA); Class A $4.50/M ($9.00 IA); Class B $0.36/M ($0.90 IA); **egress $0.00 — zero egress fees, all classes**; IA retrieval $0.01/GB | Free tier: 10 GB-mo, 1M Class A, 10M Class B /mo. Usage rounds UP to next whole unit. IA has 30-day minimum | **Zero egress is the standout lever.** S3-compatible API; custom domains supported. |
| managed-postgres | n/a — Hyperdrive (connector only); D1 is SQLite | Hyperdrive: queries/day (free-plan cap only) | Hyperdrive incl. in Workers Free (100k queries/day) and Paid (**unlimited, no per-query charge**); no egress charges | included with plan; limits reset 00:00 UTC | **No managed PostgreSQL 16.** Hyperdrive is a pooler/cache in front of an external Postgres (Neon, RDS, PlanetScale-PG — the latter billable via Cloudflare invoice). D1 is not a Postgres substitute. |
| network | CDN / R2 egress / Containers egress | egress GB (containers only); DNS zone | CDN-proxied HTTP egress not metered on Free/Pro/Business; R2 egress $0; Containers egress 1 TB/mo incl. NA/EU then $0.025/GB ($0.04–0.05 other regions); authoritative DNS free | container egress per GB after allotment | Custom domain + DNS + proxied CDN are $0 on Free. At ~100 req/s peak with photos on R2, egress ≈ $0 unless serving heavy traffic directly from Containers. |
| load-balancer-tls | Proxied DNS + Universal SSL (free); Load Balancing add-on | LB: endpoints/origins, DNS queries, steering mode | Universal SSL + proxied DNS $0 all plans. LB add-on from $5/mo (2 origins, 60 s health checks, 500k DNS queries incl.); +$5/mo per extra origin; +$0.50 per extra 500k queries | $5/mo add-on minimum | For a single-origin tiny API the LB add-on is unnecessary — free orange-cloud proxy + Universal SSL already gives TLS, HTTP/2/3, and CDN caching. |
| firewall-security | WAF on Free / Pro / Business | plan tier; custom + rate-limiting rule counts | Free $0 (Free Managed Ruleset, basic WAF, 1 rate-limiting rule, unmetered DDoS); Pro $20/mo annual ($25 monthly); Business $200/mo annual | flat monthly per zone; no per-request WAF metering | Unmetered DDoS on every tier incl. Free. Free (or Pro) sufficient for this workload. |

**Reference price points:** Workers Paid at our scale ≈ $10.25/mo — *only after a rewrite; the Express monolith won't run as-is* · Containers always-on "basic" ≈ $7.90 overage + $5 base ≈ **$13/mo** (Postgres still external) · R2 50 GB photos ≈ **$0.60/mo** storage, egress $0 at any volume · TLS + CDN + WAF **$0/mo** (Free plan; LB add-on $5/mo only if multi-origin failover ever needed).

**Fit assessment (full detail):** the Express monolith does not map onto Cloudflare alone (no VMs, no managed PG 16, Workers can't host a long-lived process with `setInterval` schedulers); Containers is the one honest lift-and-shift path on-platform (~$13/mo all-in, active-CPU billing) with caveats — ephemeral disk, restartable instances, must configure no-sleep, young product; Durable Objects alarms / Cron Triggers could replace the schedulers but that's a refactor; Postgres must live elsewhere regardless (Hyperdrive adds free pooling/caching); the pragmatic hybrid is a small VM elsewhere + Cloudflare Free front door + photos on R2. Net verdict: use Cloudflare as the free edge plus R2 in nearly any architecture; treat Containers as viable-but-bleeding-edge; never plan on Cloudflare for Postgres.

**Sources:** [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Containers pricing](https://developers.cloudflare.com/containers/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/), [plans](https://www.cloudflare.com/plans/), [rate-limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/).
