# Akamai/Linode pricing: what Bubble's setup would cost

*Part of the [Move-from-Replit](../Move-from-Replit.md) research set. Researched 2026-07-03 from https://www.akamai.com/cloud/pricing/north-america (the old linode.com pricing pages redirect there). US regions (Newark/Atlanta), USD per month.*

## The bottom line

**Linode is the least expensive suitable vendor for Bubble, at about $45/month — and it is the value recommendation of the whole study.** The recommended setup:

| Piece | Product | Monthly cost |
|---|---|---|
| Application server (2 CPUs / 4 GB) | "Linode 4GB" shared server | $24 |
| Managed database with real backups | Managed PostgreSQL, smallest tier | $16 |
| Photo storage | Object Storage base plan (250 GB included) | $5 |
| Firewall, basic attack protection | Cloud Firewall / DDoS protection | $0 |
| HTTPS and traffic routing | Free software (Caddy) on the server | $0 |
| **Total** | | **~$45** |

Two things make Linode stand out beyond the sticker price:

1. **Bandwidth is effectively free at our scale.** The $24 server includes a 4-terabyte monthly transfer allowance (and the storage plan adds another terabyte to the pool). Even the study's most aggressive usage scenario (~900 GB/month of photo traffic) fits inside it, and overage beyond the pool costs half a cent per gigabyte — versus ~9 cents at Amazon, Microsoft, or Google. This is why Linode's bill stays flat at every usage scenario in [hosting-cost-estimates.md](../hosting-cost-estimates.md) while the big three climb.
2. **The cheap database tier still has real backups.** The $16/month managed PostgreSQL includes free daily backups with 14-day point-in-time recovery — the feature the Replit data-loss incident taught us to insist on, and one that some competitors omit from their entry tiers.

## What the pieces cost, with alternatives

- **Servers.** The smallest machine is the $5/month "Nanode" (1 CPU / 1 GB — genuinely enough to run the whole stack for a demo or staging copy). The recommended production size is the $24 "Linode 4GB" (2 CPUs / 4 GB). If we ever want guaranteed rather than shared CPUs, the dedicated equivalent is $43/month. Growth path: resizing to a bigger plan is a routine operation.
- **Managed PostgreSQL** (run on Aiven's infrastructure, resold by Linode): smallest single-node plan $16/month; a 4-GB single node is $63; a three-node high-availability cluster of that size is $147. Supports PostgreSQL 13–17, including our version 16. Daily backups and point-in-time recovery included at every tier.
- **Photo storage:** $5/month flat, including 250 GB stored and +1 TB added to the account's transfer pool; each extra GB stored is 2 cents/month.
- **Optional extras we can skip:** a managed load balancer ("NodeBalancer") is $10/month — unnecessary at our traffic; free Caddy on the server does the same job. Kubernetes cluster management is free (only the worker servers bill) if we ever go that way; we have no reason to.

## Things to know before signing up (plain-language gotchas)

- **Transfer allowances are pooled account-wide and prorated by time.** All your servers' allowances merge into one monthly pool, and a server that has existed for only a week has earned only a week's share of its allowance. Fine in practice — overage is half a cent per GB — but don't expect a brand-new test server to carry a full 4 TB from day one.
- **Powered-off servers still bill.** Linode charges while a server *exists*, not while it runs. Delete, don't just shut down, to stop charges.
- **The managed-database product has a messy history — check the date on anything you read about it.** The original 2022 product was closed to new customers in 2023 and relaunched in 2024 on Aiven's infrastructure. Older blog posts and price quotes describe the dead product. Managed databases also deploy only to Linode's *core* regions, not its newer "distributed" ones.
- **Old prices circulate widely.** linode.com URLs silently redirect to akamai.com, and third-party articles still quote pre-2025 prices (e.g., dedicated 4 GB at $36 — it's now $43; extra addresses at $1 — now $2). Trust the current Akamai pricing page only.
- **Newest-generation dedicated plans bill by the hour with no monthly cap** (a July 2026 change) — an always-on box on those plans costs *more* than the classic capped plans. Stick to classic plans for always-on work.
- **Storage bandwidth always meters against the pool, even between Linode services in the same data center.** Keep app and bucket in the same region for speed, but don't assume that traffic is free.
- **Pricier outlier regions:** Jakarta and São Paulo carry premium rates on storage and transfer; US/EU regions are uniform. We have no reason to use the outliers.

---

## Appendix — full pricing detail (source worksheet)

| resource_class | vendor_service_name | pricing_inputs (calculator knobs) | unit_prices | minimum / billing granularity | notes |
|---|---|---|---|---|---|
| compute-vm | Shared CPU Linodes / Dedicated CPU Linodes | plan tier (RAM/vCPU bundle), region, shared vs dedicated CPU, hardware generation (G7 vs G8 dedicated) | Shared "Linode 4GB": 2 vCPU / 4 GB / 80 GB SSD / 4 TB transfer = **$24/mo ($0.036/hr)**; smallest shared Nanode 1GB = $5/mo (1 TB transfer). Dedicated G7 "Dedicated 4GB": 2 vCPU / 4 GB / 80 GB SSD / 4 TB transfer = **$43/mo ($0.06/hr)**; newer G8 "Dedicated 4x2" (2 vCPU / 4 GB / 40 GB SSD) = $0.07/hr | Hourly billing capped at monthly price for classic plans; as of Jul 1 2026, G8 dedicated / GPU plans and extra IPv4s bill pure hourly with **no monthly cap** | Local SSD + transfer allowance bundled into plan price (no separate root-disk charge). Region deltas: Jakarta and São Paulo have premium pricing; most NA/EU regions uniform |
| compute-container | LKE (Linode Kubernetes Engine) | worker node plan/count, control-plane tier (standard / HA / Enterprise) | Standard control plane **free**; HA control plane $60/cluster/mo; LKE-Enterprise $300/cluster/mo; workers billed at normal Linode plan prices | Per cluster + per worker node, hourly | NodeBalancer auto-provisioned for LoadBalancer services bills at $10/mo each |
| block-storage | Block Storage | volume size (GB), volume count | **$0.10/GB-mo** ($1.00 per 10 GB) | 10 GB minimum volume; hourly proration | Attachable to one Linode at a time; independent of instance lifecycle; NVMe-backed in most regions |
| object-storage | Object Storage (S3-compatible) | enabled flag (flat base), stored GB above 250, outbound GB above pooled allowance | Base **$5/mo flat, includes 250 GB storage**; enabling adds **1 TB/mo to the account's global transfer pool**; storage overage $0.02/GB-mo (Jakarta $0.024, São Paulo $0.028); transfer overage $0.005/GB (São Paulo $0.007, Jakarta $0.015) | $5/mo minimum once enabled (prorated); per-GB monthly thereafter | Limits per docs (buckets/objects per endpoint type E0–E3); request-based pricing for new high-performance endpoints announced but not billed before Oct 1 2026. All Object Storage egress (even same-DC) counts against the pool |
| managed-postgres | Akamai Managed Databases (powered by Aiven) — PostgreSQL | engine + version (PG 13/14/15/16/17), plan class (Shared vs Dedicated CPU), node count (1-node standalone or 3-node HA), region (core regions only) | Smallest Shared 1GB: 1-node **$16/mo**, 3-node $37/mo. Shared 4GB: 1-node $63/mo, 3-node HA $147/mo. Dedicated G7 4GB: 1-node $81.60/mo, 3-node HA $246/mo | Monthly plans, prorated hourly; storage fixed per plan (25 GB–7,200 GB) | PG 16 supported (13–17). History: original Managed DBs (2022) closed to new customers in 2023, relaunched GA 2024 re-platformed on Aiven. Daily backups free, 14-day retention w/ point-in-time recovery. Not available in distributed compute regions |
| network | Network Transfer / IPv4 / VPC | plan-included transfer (pooled), outbound GB overage, extra IPv4 count | Included transfer **pooled account-wide per region group** (e.g., 4 TB per Linode 4GB, 1 TB per Nanode, +1 TB from Object Storage); overage **$0.005/GB** (distributed regions $0.01, São Paulo $0.007, Jakarta $0.015); additional IPv4 **$2/mo each** (first one free); **VPC free** | Transfer allowance prorated by active hours; overage per GB | Inbound free; IPv6, private/VLAN, intra-VPC and same-DC private IPv4 traffic free. Extra IPv4 on G8/GPU plans bills hourly with no monthly cap (post Jul 2026) |
| load-balancer-tls | NodeBalancer | count of NodeBalancers | **$10/mo ($0.015/hr)** each | Hourly, capped monthly | TLS termination supported; NodeBalancer traffic counts against the transfer pool. Alternative for tiny traffic: skip it and run Caddy/nginx + Let's Encrypt on the VM ($0) |
| firewall-security | Cloud Firewall / DDoS Protection | rule sets, attached services | **Free** (Cloud Firewall); DDoS protection included on all services at no charge | n/a | Cloud Firewall is stateful L3/L4, applies to Linodes and NodeBalancers; no WAF included (Akamai upsells its CDN/App & API Protector separately) |

**Reference price points:** Linode 4GB shared $24/mo · Dedicated 4GB (G7) $43/mo (G8 "4x2" ≈ $51/mo uncapped hourly) · Managed PG Shared 1GB 1-node $16/mo, Shared 4GB 1-node $63/mo (3-node HA $147/mo) · Object Storage base $5/mo. Fuller stack with NodeBalancer and 4-GB database ≈ $102/mo; the recommended minimal stack ≈ **$45/mo**.
