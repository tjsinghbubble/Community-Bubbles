# IBM Cloud pricing: what Bubble's setup would cost

*Part of the [Move-from-Replit](../Move-from-Replit.md) research set. Researched 2026-07-03 via IBM's cost estimator and its public Global Catalog pricing API (price records effective 2026-07-01). Regions us-east (Washington DC) / Dallas, USD.*

## The bottom line

**IBM Cloud is not competitive for this workload — roughly $142–172/month for what Linode does at $45 — and the study recommends dropping it from consideration.** The comparable setup:

| Piece | Product | Monthly cost |
|---|---|---|
| Application server (2 CPUs / 4 GB) | Virtual Server cx2-2x4 | $53.86 |
| Public address + boot disk | (billed separately) | ~$13 |
| Managed database | Databases for PostgreSQL, minimum footprint | $82.54 |
| Photo storage (50 GB) | Cloud Object Storage | ~$1.14 |
| Firewall | Security groups | $0 |
| HTTPS and traffic routing | Free software (Caddy) on the server | $0 |
| **Total** | | **~$150** (study's rounded scenario figure: $142) |

Three structural reasons, each unfixable by shopping harder within IBM:

1. **The database price is doubled by design.** IBM's managed PostgreSQL always deploys as a mandatory pair of data members — a high-availability architecture you cannot opt out of — and every gigabyte of memory and disk you size is billed twice. The minimum possible footprint is ~$82.54/month; a realistic small deployment is ~$127. Every other vendor lets a small product start with one node at $16–26.
2. **The servers are the priciest studied** — $54/month for the 2-CPU/4-GB class that costs $24 at four other vendors, before adding the separately billed disk and address.
3. **The pricing itself is hard to even find.** Public marketing pages carry almost no numbers; real prices live only in the logged-in estimator and a developer API, third-party citations are chronically stale (2024 regional price rises of up to ~26% invalidated many), and the hardware generations churn under the plan names. That opacity is itself a cost.

Nothing else about IBM rescues the picture: bandwidth is metered at big-three rates (~9.2 cents/GB), and its container platform charges ~$214/month for an always-on app our size (~3.2× its own VM). **Recommendation: exclude IBM and spend evaluation effort elsewhere.**

## The one scenario where IBM would deserve a second look

If the company ever lands in an IBM-centric enterprise deal (credits, procurement mandates, an acquirer standardized on IBM), the numbers above are the negotiation baseline — and note that the mandatory database pairing at least *includes* the high-availability posture other vendors charge double for. On pure market pricing, it never wins for this workload.

---

## Appendix — full pricing detail (source worksheet)

Unit prices pulled from IBM's public Global Catalog pricing API (`globalcatalog.cloud.ibm.com/api/v1/<deployment>/pricing`, us-east deployments) — the same source the estimator uses. Monthly figures use 730 hr/mo.

| resource_class | vendor_service_name | pricing_inputs (calculator knobs) | unit_prices | minimum / billing granularity | notes |
|---|---|---|---|---|---|
| compute-vm | Virtual Servers for VPC (bx2/cx2 gen2; bx4/bx3d current gen) | profile (e.g. bx2-2x8, cx2-2x4), region, OS image, boot volume, on-demand vs 1yr/3yr reservation | Gen2 billed as parts: vCPU $0.02798/vCPU-hr + RAM $0.004456/GB-hr (us-east) → bx2-2x8 ≈ $66.87/mo, cx2-2x4 ≈ $53.86/mo. Gen4 bx4-2x8 flat ≈ $74.45/mo (us-south). Ubuntu/Debian $0; RHEL +$0.0606/hr | hourly (suspend-billing on stop for vCPU/RAM); boot volume separate | Reservations available for discounts; prices vary a few % by region. bx2-2x8 disappearing from the estimator in favor of bx4-2x8. |
| compute-container | Code Engine (apps, standard plan) | vCPU, GB, min/max instances, requests | $0.1235/vCPU-hr; $0.0128/GB-hr; $0.538/1M HTTP requests. Free tier/mo: 100k vCPU-s + 200k GB-s + 100k requests (~$4.14 value) | per-second; min instances=1 supported but billed 24×7 | Always-on 2 vCPU/4 GB ≈ $217.69/mo before free tier (~$213.5 net) — ~3.2× the equivalent VSI. Only wins if you can scale to zero (this app cannot). |
| block-storage | Block Storage for VPC | volume GB, IOPS tier (GP 3 IOPS/GB, 5iops, 10iops, custom) or SDP | GP $0.00012025/GB-hr ≈ $0.0878/GB-mo; 5iops ≈ $0.1536/GB-mo; 10iops ≈ $0.5768/GB-mo; SDP $0.08/GB-mo + $0.00505/IOPS-mo above 3,000 incl. | hourly per provisioned GB; 10 GB min | Boot volume (100 GB GP ≈ $8.78/mo) adds to every VM quote. Snapshots ~$0.0031/GB-mo class, billed separately. |
| object-storage | Cloud Object Storage (COS) | plan (Standard vs One-Rate), class (Smart Tier/Standard/Vault/Cold Vault), region, GB, Class A/B requests, egress GB | Smart Tier (US regional): hot $0.0227, cool $0.0144, cold $0.0090 /GB-mo (auto-classified, no retrieval fee); Standard ≈ $0.021–0.023/GB-mo. Class A $0.005/1k, Class B $0.004/10k. Egress ≈ $0.09/GB. One-Rate: flat tiered $/GB incl. egress ≤100% of stored capacity (overage $0.05/GB) | monthly per GB; first-12-months free tier: 5 GB, small request/egress allowances | Exact class rates surface only in console/estimator, not a public rate card; Smart Tier figures are IBM-published US-regional rates. |
| managed-postgres | Databases for PostgreSQL | RAM/disk/vCPU **per member** (deployment = 2 data members, both billed); shared vs isolated compute; region; PG version | us-east: $32.665/vCPU-mo, $5.4408/GB-RAM-mo, $0.6346/GB-disk-mo (each per member); backup overage $0.03225/GB-mo (free backup = disk purchased); isolated bundles e.g. 4vCPU×16GB $217.71/member-mo | minimum 2 members × (0.5 vCPU shared, 4 GB RAM, 5 GB disk); prorated hourly | PG 16 supported (community EOL Nov 2029); 17 also offered. Every GB sized is billed twice. Minimum footprint ≈ **$82.54/mo**; realistic 40 GB-per-member ≈ $126.96/mo (matches IBM's own docs example). |
| network | VPC, subnets, public gateway, floating IP, egress | # floating IPs, egress GB/mo | VPC/subnets/SGs/ACLs/public gateway $0; Floating IPv4 $0.006/hr ≈ $4.38/mo; VPC internet egress (us-east): first ~5 GB free, then $0.0918/GB to 10 TB, tiering down to $0.0528 beyond 150 TB | floating IP hourly; egress monthly tiers | Public gateway is outbound-only (SNAT); inbound needs floating IP or LB. Egress charged by the VPC service on top of any LB data fee. |
| load-balancer-tls | Application Load Balancer for VPC | # LBs, GB processed, listeners (TLS via Secrets Manager cert) | $0.02955/instance-hr ≈ $21.57/mo + $0.00844/GB processed (us-east) | hourly + per GB | NLB similar but no TLS termination. DIY Caddy/nginx on the VSI with the $4.38/mo floating IP is the cheap path at <100 req/s. |
| firewall-security | Security Groups & Network ACLs for VPC | rules per SG/ACL | $0 (free plans) | n/a | Stateful SGs + stateless ACLs included free; no per-rule charge. |

**Reference price points (us-east, 730 hr/mo):** cx2-2x4 VM ≈ $53.86/mo (bx2-2x8 ≈ $66.87; + 100 GB volume $8.78 + floating IP $4.38 → ≈ $80/mo VM stack) · managed PG minimum $82.54/mo, realistic $126.96/mo · COS 50 GB + 100 GB egress ≈ $10.13/mo · Code Engine always-on 2/4 ≈ $213.5/mo (avoid) · rough VM-path total ≈ **$172/mo**.

**Gotchas (full detail):** the ×2 database billing (mandatory 2-member deployments, allocations per member); pricing opacity (no public rate card; console estimator and Catalog API only; 2024 regional uplifts up to ~26% invalidated third-party citations); Code Engine punishes always-on (free tier ≈1.4% of an always-on month); floating IPv4 $4.38/mo billed regardless of traffic; egress stacks (VPC egress + ALB data-processed + COS egress each billed separately unless One-Rate); generation churn (gen2 priced as vCPU+RAM parts vs gen3/4 flat profiles — quotes for "the same" 2×8 box differ: bx2-2x8 $66.87 vs bx4-2x8 $74.45/mo).
