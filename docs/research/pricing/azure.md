# Azure pricing: what Bubble's setup would cost

*Part of the [Move-from-Replit](../Move-from-Replit.md) research set. Researched 2026-07-03 via the Azure calculator, verified against Azure's Retail Prices API. Region East US, pay-as-you-go USD.*

## The bottom line

**Microsoft Azure is the strongest of the big three for this workload, at about $51/month — mainly because its cheap database tier is genuinely cheap and still has real backups.** The comparable setup:

| Piece | Product | Monthly cost |
|---|---|---|
| Application server (2 CPUs / 4 GB) | B2s virtual machine | $30.37 |
| Public internet address + 32 GB disk | (billed separately) | ~$6 |
| Managed database with backups | PostgreSQL Flexible Server B1ms + 32 GB | $16.09 |
| Photo storage (50 GB) | Blob Storage, Hot tier | ~$1.04 |
| Firewall | Network security groups | $0 |
| HTTPS and traffic routing | Free software (Caddy) on the server | $0 |
| **Total** | | **~$51** |

What distinguishes Azure in this comparison:

1. **The $16 database is the best big-three database deal** — a small managed PostgreSQL 16 with automatic backups, matching Linode's price. It's the main reason Azure undercuts AWS here.
2. **Bandwidth is still metered** (~8.7 cents/GB after 100 GB/month free), so like AWS its bill climbs with photo traffic: the insane scenario adds ~$70/month, taking Azure from $51 to ~$120 while Linode stays at $45 ([hosting-cost-estimates.md](../hosting-cost-estimates.md)). The Cloudflare R2 photo pairing neutralizes this here too.
3. **If the team ever prefers a big-name vendor** for procurement or credibility reasons, Azure is the one to pick for this workload.

## What the pieces cost, with alternatives

- **Servers.** The $30.37 B2s is the classic 2 CPU / 4 GB fit. Like AWS's equivalent it is "burstable" — designed for mostly-idle workloads, with CPU credits that can run out under sustained heavy load (a real caveat: Azure's baseline is 40% of capacity on this size; our measured insane-scenario load sits at about half that, so we fit, but monitoring is warranted). Reserved 1–3-year pricing cuts this roughly a third to a half.
- **Managed database (PostgreSQL Flexible Server):** the B1ms tier (1 core / 2 GB) plus the 32 GB minimum storage is $16.09/month, with backups free up to the provisioned storage size. Stepping up to the 2-core B2s class is ~$53. Two limitations of the cheap tier worth knowing: it cannot do high availability at all (that requires the pricier General Purpose tier), and storage can grow but never shrink.
- **Photo storage (Blob):** ~2.1 cents/GB stored in the Hot tier; request costs are pennies at our scale. Bandwidth as discussed above.
- **Things to deliberately avoid at Azure:** the managed load balancer (~$18/month, and it can't even do HTTPS certificates — that needs the ~$180/month Application Gateway); the NAT gateway (~$33/month, unnecessary); the "Azure Firewall" product ($290+/month — the free network security groups are the actual firewall for our purposes); and Container Apps for an always-on app (~$152/month for our size, ~5× the equivalent VM, because our internal schedulers keep it permanently "active" and thus permanently billed at the active rate).

## Things to know before signing up (plain-language gotchas)

- **"Stopped" resources keep costing:** a deallocated VM stops compute charges but its disk and address keep billing; a stopped database only pauses for 7 days, then auto-restarts and resumes billing.
- **Every public address now costs ~$3.65/month**, and the old cheaper "Basic" addresses were retired — plan on Standard pricing.
- **The 100 GB/month free bandwidth allowance is per subscription, not per service** — shared across the VM, storage, and everything else, so count it once.
- **Disks bill by size tier, rounding up:** needing 40 GB means paying for the 64 GB tier. The cheap disk class also charges a tiny fee per 10,000 disk operations.
- **Burstable CPU credits are the fine print to respect:** a sustained traffic spike that exhausts credits throttles the server rather than billing more. The next tier up (B2as v2) roughly doubles the price for a higher baseline.

---

## Appendix — full pricing detail (source worksheet)

| resource_class | vendor_service_name | pricing_inputs (calculator knobs) | unit_prices | minimum / billing granularity | notes |
|---|---|---|---|---|---|
| compute-vm | Virtual Machines, B-series burstable (B2s / B2as v2 / B2s v2) | Series+size (B2s = 2 vCPU/4 GB; B2as v2 = 2 vCPU/8 GB AMD; B2s v2 = 2 vCPU/8 GB), region, OS (Linux), PAYG vs 1yr/3yr reserved vs savings plan; OS disk separate | B2s $0.0416/hr (~$30.37/mo @730h); B2as v2 $0.0752/hr (~$54.90/mo), 1yr RI ~$32.4/mo, 3yr RI ~$20.9/mo; B2s v2 $0.0832/hr (~$60.74/mo) | Per-second billing; deallocated VMs stop compute charges but disks/IP keep billing | B2s is the classic fit; burstable = CPU-credit model, sustained 100% CPU not guaranteed. Savings plans apply to B-series. |
| compute-container | Azure Container Apps (Consumption) | vCPU (0.25–4), GiB, min/max replicas, requests/mo; active vs idle rate; free grant | Active: $0.000024/vCPU-s + $0.000003/GiB-s; Idle: $0.000003/vCPU-s + $0.000003/GiB-s; requests $0.40/1M after 2M free; free grant/mo: 180k vCPU-s + 360k GiB-s + 2M req | Per-second; min replicas ≥1 = billed 24/7 (idle rate only when truly quiescent: <0.01 vCPU, <1000 B/s, no requests) | Always-on 2 vCPU/4 GiB at ACTIVE rate ≈ $152–158/mo; idle rate ≈ $47/mo — but in-process schedulers keep the replica active, so budget active. 0.5 vCPU/1 GiB active ≈ $39/mo. |
| block-storage | Managed Disks: Standard SSD (E-tier) / Premium SSD (P-tier) | Type, size tier (E4/P4=32 GB, E6/P6=64, E10/P10=128), LRS, transactions (Std SSD only) | Std SSD LRS: E4 $2.40/mo, E6 $4.80, E10 $9.60 (~$0.075/GB-mo) + $0.002/10k ops; Premium: P4 $5.28, P6 $10.21, P10 $19.71, no transaction fees | Billed per provisioned tier (round up), hourly proration | E4–E10 Std SSD: 500 IOPS/60 MBps bursting; E4 is plenty for a small API VM OS disk. |
| object-storage | Blob Storage (Block Blob, StorageV2, LRS) | GB by tier (Hot/Cool/Cold/Archive), write ops/10k, read ops/10k, retrieval GB, egress GB | Hot LRS $0.0208/GB-mo; Cool $0.0152 (+$0.01/GB retrieval); Hot writes $0.05/10k, reads $0.004/10k; egress shared bandwidth meter (first 100 GB/mo free, then ~$0.087/GB) | Per-GB-month, prorated daily | Photos → Hot. 50 GB ≈ $1.04/mo + pennies. Cool has 30-day early-deletion + retrieval fees. |
| managed-postgres | Azure Database for PostgreSQL Flexible Server | Tier: Burstable (B1ms/B2s/B2ms) vs General Purpose (D-series); storage GB (32 GB–32 TB); HA (zone-redundant, doubles compute+storage); backup retention 7–35 days; PG 11–17 (**16 supported**) | B1ms $0.017/hr (~$12.41/mo); B2s $0.068/hr (~$49.64/mo); storage $0.115/GB-mo; backup $0.095/GB-mo beyond free (free up to provisioned size); HA = 2× compute + 2× storage | Per-hour compute; storage min 32 GB, grows but never shrinks; stopped server auto-restarts after 7 days | Burstable tier does NOT support HA. Smallest sane prod: B1ms + 32 GB ≈ $16.1/mo; B2s + 32 GB ≈ $53.3/mo; GP D2ds_v5 ~$120+/mo. |
| network | VNet / IPs / Bandwidth | VNet+NSG $0; Standard static IPv4 $0.005/hr; NAT Gateway hrs+GB; egress tiers | IPv4 ~$3.65/mo; NAT ~$32.9/mo + $0.045/GB; egress first 100 GB/mo free, then $0.087/GB to 10 TB, $0.065–0.04 above; ingress free | IP hourly while allocated; egress monthly per subscription | Skip NAT for this workload. All public IPv4 charged; Basic SKU retired Sep 2025 → Standard pricing. |
| load-balancer-tls | Standard LB (L4) / Application Gateway (L7) | LB: rules, GB processed; AppGW v2: fixed hrs + capacity units | Std LB $0.025/hr first 5 rules (~$18.25/mo) + $0.005/GB; AppGW Standard_v2 ~$0.246/hr (~$180/mo) + CU | Hourly; partial hour = full hour | Std LB is L4 only — no TLS termination/managed certs. Cheaper: Caddy/nginx + Let's Encrypt on VM ($0). |
| firewall-security | NSGs / Azure Firewall | NSG rules free; Firewall SKU hrs + GB | NSGs $0; Azure Firewall Basic ~$290+/mo, Standard ~$912+/mo — skip | n/a for NSG | NSGs + VM-level firewall cover the requirement at $0. |

**Reference price points:** B2s VM + E4 disk + IP ≈ $36.4/mo all-in · PG Flexible B1ms + 32 GB = $16.09/mo (B2s class = $53.32) · Blob Hot 50 GB ≈ $1.04/mo · 100 GB egress $0 if allowance unconsumed (else ~$8.70) · Container Apps always-on 2/4 ≈ $152/mo (avoid).

**Gotchas (full detail):** B2s banks credits at 40% baseline (~20%/core) — sustained load can throttle; Container Apps idle rate rarely applies to this app (schedulers keep it active → ~5× the B2s VM); Burstable DB tier has no HA and storage never shrinks; stopped DB auto-restarts after 7 days; egress allowance per subscription; LB data-processed and NAT per-GB fees stack on top of bandwidth egress; disks round up to tier sizes; Std SSD charges per-10k operations.
