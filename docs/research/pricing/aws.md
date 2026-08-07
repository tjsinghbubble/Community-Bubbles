# AWS pricing: what Bubble's setup would cost

*Part of the [Move-from-Replit](../Move-from-Replit.md) research set. Researched 2026-07-03 via https://calculator.aws/. Region us-east-1 (N. Virginia), on-demand USD.*

## The bottom line

**Amazon can host Bubble comfortably at about $55/month — competitive with the budget vendors at today's usage, but with a bill that climbs with photo traffic where Linode's and Vultr's stay flat.** The comparable setup:

| Piece | Product | Monthly cost |
|---|---|---|
| Application server (2 CPUs / 4 GB, ARM) | EC2 t4g.medium | $24.53 |
| Public internet address + 30 GB disk | (billed separately at AWS) | ~$6 |
| Managed database with backups | RDS PostgreSQL, small single-node + 20 GB | ~$25.66 |
| Photo storage (50 GB) | S3 | ~$1.25 |
| Firewall | Security groups | $0 |
| HTTPS and traffic routing | Free software (Caddy) on the server | $0 |
| **Total** | | **~$58** |

What distinguishes AWS in this comparison:

1. **Bandwidth is metered at 9 cents/GB after a 100 GB/month free allowance.** At today's usage that rounds to zero; at the study's "insane" scenario (~900 GB/month of photos) it adds roughly **$70/month**, which is the entire reason AWS's insane-scenario estimate is $126 versus Linode's flat $45 ([hosting-cost-estimates.md](../hosting-cost-estimates.md)). Pairing AWS compute with Cloudflare R2 for photos would neutralize this.
2. **The ecosystem is the argument for it** — the deepest tooling, hiring pool, and service catalog — not the price. Nothing in Bubble's workload needs that depth today.
3. **The bill is assembled from many small separate meters** (the address is extra, the disk is extra, the bandwidth is extra), which makes estimates drift upward and demands more attention than a bundled-plan vendor.

## What the pieces cost, with alternatives

- **Servers.** The $24.53 t4g.medium uses ARM processors — our application runs on ARM without issue, and it's ~20% cheaper than the equivalent Intel machine ($30.37). These are "burstable" servers: they assume mostly-idle behavior and can charge a small premium under sustained heavy CPU — a non-issue at our measured loads. A 1-year commitment cuts compute ~30–40% once the workload is proven stable.
- **Managed database (RDS):** small single-node PostgreSQL 16 with 20 GB is ~$25.66/month, automatic backups included up to the database's own size. The high-availability option (a synchronized standby in a second data center) doubles it to ~$51 — worth skipping initially if a short restore window is acceptable.
- **Photo storage (S3):** ~2.3 cents/GB stored; requests are negligible at our scale. The cost that matters is the download bandwidth discussed above.
- **Things to deliberately avoid at AWS** (each a classic small-account budget trap, detailed in the appendix): the managed load balancer (~$16–22/month for what free Caddy does), the NAT gateway (~$33/month and simply unnecessary for our layout), and the managed-container services Fargate/App Runner (2.4×–5× the cost of the equivalent plain server for an always-on app like ours).

## Things to know before signing up (plain-language gotchas)

- **Public addresses now cost money** — ~$3.65/month each, charged even while idle. Budget one.
- **The 100 GB/month free bandwidth allowance is account-wide, not per-service** — every AWS service shares the same allowance, so don't count it twice in estimates.
- **"Burstable" servers have fine print:** sustained CPU above a baseline (~20% per core on our size) bills small surcharges automatically. Our measured peak usage sits below the threshold, but it's worth a monitoring alarm.
- **The free tier changed in 2025:** new accounts now get up to $200 in credits for six months, not the old year of free small servers. Don't build a plan around perpetual free instances.
- **Managed containers are the expensive way to run this app.** Because Bubble must run continuously, Fargate (~$58/month) and App Runner (~$134/month) pay a hefty premium over the $24.53 plain server for zero benefit to us.

---

## Appendix — full pricing detail (source worksheet)

| resource_class | vendor_service_name | pricing_inputs (calculator knobs) | unit_prices | minimum / billing granularity | notes |
|---|---|---|---|---|---|
| compute-vm | Amazon EC2 | Instance family/size (t4g = ARM/Graviton burstable, t3 = x86 burstable), region, OS (Linux), tenancy, commitment (on-demand vs 1-yr Savings Plan/Reserved), count, hrs/mo | t4g.medium (2 vCPU/4 GB) $0.0336/hr (~$24.53/mo); t3.medium $0.0416/hr (~$30.37/mo); t4g.small $0.0168/hr; 1-yr reserved t3.medium ~$0.026/hr (~37% off) | Per-second billing, 60-second minimum (Linux) | t4g requires ARM64 Node.js build (trivially supported). T-family is burstable: CPU-credit model; "unlimited" mode on by default can add cost under sustained load. m7g.medium (1 vCPU/4 GB) is the non-burstable alternative. |
| compute-container | AWS Fargate (ECS) / AWS App Runner | Fargate: vCPU, GB, arch, hrs/mo, Savings Plan. App Runner: provisioned instances (min ≥1 = always-on), active vCPU+GB | Fargate ARM: $0.0324/vCPU-hr + $0.00356/GB-hr → 2vCPU/4GB ≈ $57.70/mo; x86 ≈ $71.95/mo. App Runner: 2vCPU/4GB always-active ≈ $134/mo | Per-second, 1-minute minimum | Both support always-on (desired-count=1 / min provisioned=1) — compatible with in-process schedulers. Fargate Savings Plan up to ~50% with commit. Notably pricier than equivalent EC2. |
| block-storage | Amazon EBS (gp3) / Amazon EFS | gp3: GB, IOPS >3,000, MB/s >125, snapshot GB. EFS: GB by class, throughput mode | gp3 $0.08/GB-mo; extra IOPS $0.005/IOPS-mo; extra throughput $0.06/MiB/s-mo. EFS Regional Standard $0.30/GB-mo; IA $0.016/GB-mo | Per-second, 60-second minimum (gp3) | gp3 baseline 3,000 IOPS / 125 MB/s free regardless of size — ample here. EFS unnecessary for a single VM. |
| object-storage | Amazon S3 | Storage class, GB, PUT/GET counts, transfer-out GB, lifecycle | Standard $0.023/GB-mo (first 50 TB); Standard-IA $0.0125/GB-mo (128 KB min, 30-day min); PUT $0.005/1,000; GET $0.0004/1,000; egress $0.09/GB (first 10 TB) after free allowance | Monthly, GB-hour prorated | First 100 GB/mo internet egress free, aggregated across all AWS services/regions. Photos → Standard class; request costs negligible at this scale. |
| managed-postgres | Amazon RDS for PostgreSQL | Instance class, engine version (PG 16 supported; 17 GA), Single-AZ vs Multi-AZ (≈2×), gp3 GB + IOPS, backup retention, region | db.t4g.micro $0.016/hr (~$11.68/mo); db.t4g.small (2 vCPU/2 GB) $0.032/hr (~$23.36/mo) Single-AZ; Multi-AZ ≈ 2×; storage gp3 $0.115/GB-mo (20 GB min); backup free up to DB size then ~$0.095/GB-mo | Per-hour instance; storage monthly | PG 16 fully supported. Multi-AZ doubles cost — skip for tiny prod if minutes of restore downtime acceptable. Aurora Serverless v2 min-ACU usually exceeds db.t4g.small for always-on. |
| network | Amazon VPC | VPC/subnets/routes/IGW free. Knobs: public IPv4 count, NAT gateway hrs+GB, inter-AZ GB, egress GB | Public IPv4 $0.005/hr (~$3.65/mo, in-use AND idle); NAT gateway $0.045/hr (~$32.85/mo) + $0.045/GB; inter-AZ $0.01/GB each direction; egress: first 100 GB/mo free, then $0.09/GB (first 10 TB) | Hourly (IPv4, NAT); per GB (transfer) | IPv6 free. Avoid NAT gateway (public subnet or fck-nat instead); NAT alone exceeds the app server cost. |
| load-balancer-tls | Application Load Balancer + ACM | ALB: hours + LCU-hours (LCU = max of 25 new conn/s, 3,000 active conn/min, 1 GB/hr, 1,000 rule evals/s). ACM: # public certs | ALB $0.0225/hr (~$16.43/mo) + $0.008/LCU-hr (tiny traffic ≈ ≤$5.84/mo); NLB similar; ACM public certs $0 (auto-renew) | Hourly + LCU-hourly | At <100 req/s ALB is mostly the fixed ~$16–22/mo. Cheaper: Caddy/nginx + Let's Encrypt on the instance; ACM certs attach only to ALB/CloudFront/API GW, not EC2 directly. |
| firewall-security | Security Groups / NACLs (+ WAF optional) | No knobs; unlimited rules within quotas | $0 | n/a | Stateful SG + stateless NACL cover "basic firewall" free. AWS WAF ≈ $5/ACL + $1/rule + $0.60/M req; Network Firewall ≈ $0.395/hr — overkill here. |

**Reference price points (us-east-1, 730 hr/mo):** t4g.medium + IPv4 + 30 GB gp3 ≈ $30.58/mo all-in VM · RDS db.t4g.small Single-AZ + 20 GB ≈ $25.66/mo (Multi-AZ ≈ $51) · S3 50 GB + 100 GB egress ≈ $1.25–10.25/mo · stack without ALB/NAT ≈ **$58/mo** (with ALB ≈ $75/mo).

**Gotchas (full detail):** public IPv4 billed even idle (ALB uses one per AZ, min 2 → ~$7.30/mo hidden); 100 GB egress allowance shared account-wide; NAT gateway budget trap; Fargate ≈2.4× / App Runner ≈5× equivalent EC2 for always-on; T-family surplus credits bill ~$0.04–0.05/vCPU-hr above baseline (20%/vCPU on t4g.medium); 2025+ free tier is $200 credits/6 months, not perpetual free instances; 1-yr Savings Plans cut compute ~30–40% once stable.
