# Google Cloud pricing: what Bubble's setup would cost

*Part of the [Move-from-Replit](../Move-from-Replit.md) research set. Researched 2026-07-03 via https://cloud.google.com/products/calculator. Region us-central1 (Iowa), on-demand USD.*

## The bottom line

**Google Cloud is a mid-pack big-three option at about $83/month — workable, but beaten on price at both ends: its database floor is triple Azure's, and its bandwidth rate is the highest of any vendor studied.** The comparable setup:

| Piece | Product | Monthly cost |
|---|---|---|
| Application server (2 CPUs / 4 GB) | Compute Engine e2-medium | $24.46 |
| Public internet address + 30 GB disk | (billed separately) | ~$6.65 |
| Managed database with backups | Cloud SQL PostgreSQL, smallest sensible + 20 GB | ~$54 |
| Photo storage (50 GB) | Cloud Storage | ~$1 |
| Firewall | VPC firewall rules | $0 |
| HTTPS and traffic routing | Free software (Caddy) on the server | $0 |
| **Total** | | **~$83** |

What distinguishes Google in this comparison:

1. **The database is the cost problem.** Cloud SQL prices by CPU and memory rather than cheap fixed tiers, and its smallest sensible production shape lands near **$54/month** — versus $16 at Azure or Linode for our tiny database. This single line is most of the gap between Google's $83 and Azure's $51.
2. **Bandwidth is the most expensive studied: 12 cents/GB** on the default network tier — versus 9 at AWS, 8.7 at Azure, and effectively zero at Linode/Vultr/R2. At the insane scenario this makes Google the priciest mainstream option (~$166/month, [hosting-cost-estimates.md](../hosting-cost-estimates.md)).
3. **There is one genuine sweetener:** an irrelevant-to-production but pleasant always-free tier (one micro server, 5 GB of storage) that could host a tiny utility box.

There is nothing wrong with Google's quality; it is simply the wrong price shape for a workload whose only growing cost is photo bandwidth and whose database is tiny.

## What the pieces cost, with alternatives

- **Servers.** The $24.46 e2-medium matches our size on paper, but its two processors are *shared-core* (borrowed slices, fine for bursty light work). The honest "two real CPUs" machine is the e2-standard-2 at $48.92 — which is the fairer number to compare against Linode's $24 for dedicated-feeling capacity. One-year committed-use pricing cuts ~37%.
- **Managed database (Cloud SQL):** priced per CPU (~$30/month each) plus per GB of memory (~$5/month each), plus storage at ~22 cents/GB — it adds up fast even for small shapes. High availability doubles the compute. PostgreSQL 12–17 supported.
- **Photo storage (Cloud Storage):** 2 cents/GB stored — fine; it's the 12-cent download rate that stings.
- **Things to deliberately avoid at Google:** the global load balancer (~$18/month floor before any traffic — more than the server it would front; Caddy is $0); Cloud NAT (unnecessary for our layout); and Cloud Run for this app (~$152/month for our size always-on — the app's internal schedulers force the always-allocated billing mode, ~3× the honest VM).

## Things to know before signing up (plain-language gotchas)

- **The cheap server's discount fine print:** Google's automatic "sustained use" discounts do *not* apply to the e2 family — its list price is already the discount. Committed-use contracts are the only lever.
- **Public addresses cost ~$3.65/month** (since 2024), on every line item that has one.
- **The 200 GB/month free bandwidth tier applies only to the "Standard" network tier**, which most setups aren't on — the default "Premium" tier meters from the first gigabyte after a token allowance.
- **Database estimates drift upward ~10–20%** in practice: backups bill separately (~10.5 cents/GB), storage auto-grows and never shrinks, and recent third-party price trackers show SSD storage up from older published rates — confirm in the live calculator before quoting.
- **Take the freebies for side infrastructure, not production:** one free e2-micro server (specific US regions), 5 GB of storage, 30 GB of standard disk — a fine free bastion or staging toy.

---

## Appendix — full pricing detail (source worksheet)

| resource_class | vendor_service_name | pricing_inputs (calculator knobs) | unit_prices | minimum / billing granularity | notes |
|---|---|---|---|---|---|
| compute-vm | Compute Engine (e2 / n2) | machine type (e2-medium, e2-standard-2, n2-standard-2), region, OS (Linux free), count, commitment (none/1yr/3yr CUD), SUD (n-series only) | e2-medium (2 shared vCPU/4GB) $0.0335/hr ≈ $24.46/mo; e2-standard-2 (2 vCPU/8GB) $0.067/hr ≈ $48.92/mo; n2-standard-2 ≈ $70.9/mo; e2-medium 1yr CUD ≈ $15.41/mo, 3yr ≈ $11.01/mo | per-second, 1-minute minimum | e2 gets NO sustained-use discounts; n-series get up to ~20% automatic. e2-medium vCPUs are shared-core (bursty); e2-standard-2 is the safer prod pick. Boot disk + external IP separate. |
| compute-container | Cloud Run (services) | billing mode (request- vs instance-based), vCPU, GiB, min/max instances, requests/mo, region tier | Instance-based (required here): $0.000024/vCPU-s + $0.0000025/GiB-s (Tier 1), no per-request fee. Request-based: same rates + $0.40/M requests; idle min-instances at reduced idle rates | per 100 ms of instance lifetime | Schedulers → min-instances=1, instance-based billing (CPU always allocated). 2 vCPU/4 GiB always-on ≈ $152/mo; 1 vCPU/2 GiB ≈ $76/mo (before free tier 180k vCPU-s + 360k GiB-s + 2M req/mo). Flexible CUDs cut ~17–20%. |
| block-storage | Persistent Disk (zonal) | type (pd-standard/balanced/ssd), GB, region, snapshots | pd-standard $0.04/GB-mo; pd-balanced $0.10; pd-ssd $0.17; standard snapshots ≈ $0.026/GB-mo; archive $0.019 (90-day min) | provisioned GB, per-second proration | Pay for provisioned, not used. pd-balanced is the sensible default. IOPS/throughput scale with size — tiny disks are slow. |
| object-storage | Cloud Storage (GCS) | class (Standard/Nearline/Coldline/Archive), location, GB, Class A ops, Class B ops, egress GB | Standard regional $0.020/GB-mo (multi-region $0.026); Class A $0.05/10k; Class B $0.004/10k; internet egress $0.12/GB (first 1 TB, premium tier) | per GB-month prorated; Nearline/Coldline/Archive have 30/90/365-day minimums | Photos → Standard, single region co-located with compute. Always-free: 5 GB + ops (us-central1/east1/west1). Egress dominates at any real read volume — consider Cloud CDN. |
| managed-postgres | Cloud SQL for PostgreSQL (Enterprise) | edition, vCPU + RAM (custom), storage type + GB, HA y/n, backup GB, PG version, region | vCPU $0.0413/hr (≈$30.15/mo); RAM ≈$5.11/GB-mo; SSD ≈$0.222/GB-mo (HA ≈$0.34); HDD ≈$0.118; backups ≈$0.105–0.11/GB-mo; HA = 2× compute | per-second while running; storage prorated | PG 12–17 (16 supported). Smallest sensible prod: db-custom-1-3840 (1 vCPU/3.75GB) + 20 GB SSD ≈ **$54/mo** zonal; HA ≈ $105–110/mo. Storage auto-grows. CUDs up to 52%. |
| network | VPC / external IPv4 / Cloud NAT / transfer | egress GB by destination + tier (Premium vs Standard), IPv4 × hours, NAT hrs+GB, inter-zone GB | VPC $0; in-use external IPv4 $0.005/hr ≈ $3.65/mo (since Feb 2024); Cloud NAT $0.0014/hr/VM + $0.045/GB; inter-zone $0.01/GB; internet egress (Premium) $0.12/GB 0–1 TB, ~$0.11 1–10 TB, ~$0.08 10 TB+ | egress per GB; IP per hour | Ingress free; ~1 GB/mo NA egress free (compute); Standard tier includes 200 GB/mo free egress per region but can't use global LB. Single VM with own IP needs no Cloud NAT. |
| load-balancer-tls | Cloud Load Balancing (Global External App LB) + managed SSL | forwarding rules, inbound GB, outbound GB, region/global | $0.025/hr first 5 rules (≈$18.26/mo); +$0.01/hr per extra rule; inbound $0.008/GB; Google-managed TLS certs $0 | per hour per rule; data per GB | ≈$18–19/mo floor before data — significant vs a $24 VM. Skip: Caddy/nginx + Let's Encrypt on the VM; or Cloud Run's built-in HTTPS at $0 extra. |
| firewall-security | VPC firewall rules / Cloud NGFW / Cloud Armor | rule count; Armor: policies, rules, requests | Classic VPC firewall rules $0 (any count); Cloud Armor Standard $5/policy + $1/rule + $0.75/M requests | monthly per policy/rule | Basic allow-22/80/443 + deny-all is free and sufficient. Armor only attaches behind Cloud LB; skip at this scale. |

**Reference price points (us-central1):** VM path e2-standard-2 + disk + IP ≈ $55.6/mo (e2-medium variant ≈ $31.1 but shared-core) · Cloud Run always-on 2/4 ≈ $152/mo (avoid) · Cloud SQL smallest sensible ≈ $54/mo (HA ≈ $105–110) · GCS 50 GB + 100 GB egress ≈ $13/mo.

**Gotchas (full detail):** e2 excluded from SUD (use 1-yr CUD ~37%); IPv4 $3.65/mo everywhere it appears; $0.12/GB egress is ~6× the monthly storage cost of the same GB, and the 200 GB free tier applies only to Standard network tier; ~$18/mo LB floor at zero traffic; Cloud Run min-instances=1 with CPU always allocated ≈ 3× the equivalent VM; Cloud SQL HA doubles compute and raises storage ~55%, backups and auto-grow quietly add 10–20%; always-free e2-micro/5 GB GCS/30 GB pd-standard useful for bastion/staging only.
