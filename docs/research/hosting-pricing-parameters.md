# Cross-vendor pricing parameters (merged)

What the seven vendors' pricing calculators actually ask for, merged from the per-vendor research in [pricing/](pricing/) (all quoted 2026-07-03, US regions, on-demand USD). Machine-readable unit prices: `scripts/one-off/hosting-unit-prices.tsv`; scenario × vendor totals: [hosting-cost-estimates.md](hosting-cost-estimates.md).

## The calculator inputs (what we must know about our workload)

Every calculator reduces to these knobs — the perf tests ([perf-test-plan.md](perf-test-plan.md)) measure the starred ones:

1. **compute**: vCPU/RAM class*, region, OS, on-demand vs committed, always-on hours (730/mo — we cannot scale to zero)
2. **block storage**: GB, type/IOPS
3. **object storage**: GB stored*, request counts, **egress GB***
4. **managed Postgres**: instance class*, storage GB*, HA y/n, backup retention, PG 16 support
5. **network**: internet egress GB/mo*, public IPv4 (now ~$2–4.4/mo everywhere), NAT (avoidable)
6. **LB/TLS**: skippable at our scale (Caddy on the VM); managed LB floor is $10–22/mo
7. **firewall**: security groups/cloud firewalls are free at every vendor; paid WAF optional

## 2 vCPU / 4 GB always-on VM ($/mo)

| | AWS | GCP | Azure | IBM | Vultr | Linode | Cloudflare |
|---|---|---|---|---|---|---|---|
| VM | 24.53 (t4g.medium) | 24.46 (e2-medium, shared) | 30.37 (B2s) | 53.86 (cx2-2x4) | 24 (High Perf, 5TB transfer incl.) | 24 (Linode 4GB, 4TB incl.) | n/a |
| container alt | 57.70 (Fargate) | 152 (Cloud Run min=1) | 152 (Container Apps active) | 213 (Code Engine min=1) | — | — | ~13 (Containers, 0.25vCPU/1GiB) |

Managed always-on containers cost 2–6× the equivalent VM at every hyperscaler — the in-process schedulers force always-active billing. **VM + docker compose is the economical shape.**

## Managed Postgres 16, smallest production tier ($/mo)

| AWS | GCP | Azure | IBM | Vultr | Linode |
|---|---|---|---|---|---|
| 25.66 (db.t4g.small + 20GB) | 54 (1vCPU/3.75GB + 20GB) | 16.09 (B1ms + 32GB) | 82.54 (2 mandatory members) | 18 (1GB, no PITR) | 16 (Aiven 1GB shared) |

HA roughly doubles everywhere. Given the Replit data-loss incident: weight PITR/backup quality — Azure B1ms and Linode/Aiven are the cheap-with-real-backups options; Vultr's entry tier lacks PITR; IBM's floor is structurally 2× (mandatory dual data members).

## Object storage + egress (the only line that grows with usage)

| | storage $/GB-mo | egress $/GB | free egress |
|---|---|---|---|
| AWS S3 | 0.023 | 0.09 | 100 GB/mo |
| GCP GCS | 0.020 | 0.12 (premium) | 200 GB/mo (standard tier) |
| Azure Blob | 0.0208 | 0.087 | 100 GB/mo |
| IBM COS | 0.0227 | 0.09 | — (One-Rate alt.) |
| Vultr | $18/mo base incl. 1 TB | 0.01 overage | pooled with VM (3–5 TB) |
| Linode | $5/mo base incl. 250 GB | 0.005 overage | pooled with VM (4 TB) |
| **Cloudflare R2** | **0.015** | **0** | **all of it** |

At insane-usage (~1 TB egress/mo) this line is ~$86–115/mo on hyperscalers, ~$0 on Vultr/Linode (inside pooled transfer), and $0 on R2 by design. **R2 for photos is the standout cost lever and works as an adjunct to any compute vendor** (S3-compatible; pairs with discuss-item #1 in [dockerization-plan.md](dockerization-plan.md)).

## Network / security fixed costs

- Public IPv4: AWS/GCP/Azure 3.65, IBM 4.38, Vultr 3 (first one free with VM), Linode 2 (first free) $/mo.
- VPC, security groups, cloud firewalls: free everywhere. NAT gateways (AWS ~$33/mo, GCP/Azure similar) are avoidable — public subnet + own nftables.
- LB+TLS: managed 10–22 $/mo; $0 with Caddy/nginx on the VM (our plan).
- DDoS baseline: included at Cloudflare (free tier), Vultr/Linode (basic); paid add-ons elsewhere; unnecessary at our scale.

## Read of the numbers (for the team discussion)

1. **Zero-growth through fast-usage price identically within each vendor** (~flat: smallest always-on tier + tiny egress). The comparison is a floor-price comparison: **Linode ~$45, Azure ~$51, AWS ~$55, Vultr ~$60, GCP ~$83, IBM ~$142** for VM + managed PG + 50 GB photos.
2. **Only insane-usage separates vendors**, entirely via egress: hyperscalers +$85–105/mo; Vultr/Linode/R2 flat.
3. IBM Cloud is not competitive for this workload (2× PG floor, priciest VM, opaque pricing).
4. Cloudflare alone cannot host the stack (no VM, no managed PG; Workers can't run the scheduler monolith) — but R2 hybrid is worth pricing into any final shape.
5. Replit today (Reserved VM + PG + object storage) should be priced side-by-side in the discussion; these numbers give the negotiating baseline.
