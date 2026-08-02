# Vultr pricing: what Bubble's setup would cost

*Part of the [Move-from-Replit](../Move-from-Replit.md) research set. Researched 2026-07-03 from https://www.vultr.com/pricing/ and Vultr's official docs (sources listed in the appendix). US regions (New Jersey/Atlanta), USD per month.*

## The bottom line

**Vultr is a solid runner-up at about $60/month — a well-priced Linode-alike that loses to Linode on two specifics.** The comparable setup:

| Piece | Product | Monthly cost |
|---|---|---|
| Application server (2 CPUs / 4 GB) | Cloud Compute "High Performance" | $24 |
| Managed database | Managed PostgreSQL, smallest plan | $18 |
| Photo storage | Object Storage, Standard tier (1 TB included) | $18 |
| Firewall | Cloud firewall | $0 |
| HTTPS and traffic routing | Free software (Caddy) on the server | $0 |
| **Total** | | **~$60** |

Like Linode, Vultr bundles generous transfer allowances with the server (3–5 TB, pooled account-wide, plus 2 TB of account-level free egress; overage a flat 1 cent/GB), so **its bill also stays flat at every usage scenario** — the same growth insurance Linode offers.

The two specifics where it loses to Linode:

1. **Its cheapest managed database has no point-in-time recovery.** The $18/month entry plan is "Hobbyist class" — daily-backup-less recovery is exactly the weakness the Replit incident exposed. Getting real point-in-time recovery means stepping up to a pricier plan tier. Linode includes it at $16.
2. **Its photo-storage minimum is $18/month for a terabyte** we won't fill for years (the old $6 small plan was retired). Linode's comparable line is $5.

Neither is disqualifying; both simply make the total $15/month worse than Linode for the same shape. If Linode were ever off the table, Vultr is the natural second call.

## What the pieces cost, with alternatives

- **Servers.** 2 CPU / 4 GB comes in three flavors: Regular ($20), High Performance ($24, faster NVMe disk and 5 TB transfer — the sensible pick), High Frequency ($24). Dedicated-CPU plans start at $60 for 2 CPU / 8 GB. Plans are fixed bundles (CPU + memory + disk + transfer + public address all included); hourly billing capped at the monthly price.
- **Managed PostgreSQL:** smallest plan $18/month (1 CPU / 1 GB / 32 GB). A production-comfortable 2 CPU / 4 GB / 128 GB plan is $72; each high-availability replica adds about two-thirds of the base price ($72 → $120 → $168). PostgreSQL 13 through 16 supported. Point-in-time recovery windows depend on plan tier: none on Hobbyist, 2 days on Startup, 14 on Business, 30 on Premium.
- **Photo storage:** Standard tier $18/month including 1 TB stored and 1 TB transfer; overage ~$0.018/GB stored, $0.01/GB transferred. No per-request charges.
- **Optional extras we can skip:** managed load balancer $10/month (Caddy on the server is $0); Kubernetes cluster management free (worker servers bill normally); enhanced per-server DDoS protection $10/month (baseline platform-wide filtering is free and sufficient).

## Things to know before signing up (plain-language gotchas)

- **Bandwidth is bundled, not metered.** Every server plan includes terabytes of pooled transfer, worldwide, plus 2 TB of account-level free egress; inbound is always free. For our workload, bandwidth cost is effectively $0 at any scenario — same virtue as Linode.
- **Backup quality is a plan-tier decision, not a default.** Budget for at least the "Startup" database tier in production, or you have no point-in-time recovery — the exact Replit failure mode.
- **Stopped servers still bill.** Vultr charges while a server exists, not while it runs. Destroy, don't just stop, to end charges.
- **The storage minimum jumped.** The old $6/month 250 GB plan is gone; hot storage now starts at $18/month for 1 TB, even if photos occupy 5 GB. (The $6/TB "Archival" tier is not suitable for serving user photos.)
- **Third-party price summaries disagree on small items** (reserved addresses quoted as $2 or $3; DDoS as free or $10). Official docs say: reserved IPv4 $3/month, DDoS add-on $10/month per server. Treat the official docs as canonical.

---

## Appendix — full pricing detail (source worksheet)

| resource_class | vendor_service_name | pricing_inputs (calculator knobs) | unit_prices | minimum / billing granularity | notes |
|---|---|---|---|---|---|
| compute-vm | Cloud Compute (shared vCPU): Regular / High Performance (AMD/Intel) / High Frequency; Optimized Cloud Compute (dedicated vCPU) | Plan size (vCPU/RAM/SSD), CPU tier, region, OS (Linux free) | 2 vCPU/4 GB: Regular $20/mo (80 GB SSD, 3 TB xfer); High Performance AMD/Intel $24/mo (100 GB NVMe, 5 TB xfer); High Frequency $24/mo (128 GB NVMe, 3 TB xfer). Optimized General Purpose 2 vCPU/8 GB dedicated: $60/mo (50 GB NVMe, 5 TB xfer) | Hourly billing ($0.03–$0.036/hr for 2/4 shared), capped at monthly rate; billed while instance exists (stopped ≠ free) | Plan price bundles vCPU+RAM+local NVMe/SSD+transfer allotment+1 public IPv4. Fixed plan sizes, no custom CPU/RAM knobs. |
| compute-container | Vultr Kubernetes Engine (VKE) + Container Registry | Worker node plan sizes (any cloud server ≥2 GB RAM), node count; registry tier | VKE managed control plane: $0 (free); pay only worker nodes/LB/block storage at normal rates. Registry: free tier w/ 10 GB | Worker nodes billed hourly like normal VMs | No per-cluster management fee, unlike EKS/GKE. |
| block-storage | Block Storage (NVMe and HDD) | Storage type, size GB | NVMe: $0.10/GB-mo (10,000 IOPS, 400 MB/s), min 10 GB = $1/mo, max 10 TB. HDD: $0.04/GB-mo (500 IOPS, 100 MB/s), min 100 GB = $4/mo | Min 10 GB (NVMe) / 100 GB (HDD); billed hourly, size-based | Attachable to one instance at a time; not in every region. Root disk included in VM plan. |
| object-storage | Object Storage (S3-compatible) | Tier (Standard/Premium/Performance/Accelerated/Archival), storage TB, outbound TB | Standard $18/TB-mo (base $18/mo incl. 1 TB storage + 1 TB transfer); Premium $36/TB; Performance $50/TB; Accelerated $100/TB; Archival $6/TB. Overage: storage at tier rate (Standard ≈$0.018/GB); transfer $10/TB (≈$0.01/GB) | Base subscription incl. 1 TB storage + 1 TB transfer/mo; monthly | No API request charges; free ingress. Legacy $6/mo 250 GB plan retired. |
| managed-postgres | Vultr Managed Databases for PostgreSQL | Underlying compute tier, plan (RAM/vCPU/storage), replica count (0–3), region | Cloud Compute HP tier: 1 vCPU/1 GB/32 GB = $18/mo; 2 vCPU/4 GB/128 GB = $72/mo ($120 w/1 replica, $168 w/2). Optimized tier: 1 vCPU/4 GB/30 GB = $90/mo ($150 w/1 replica). Marketing "from $15/mo" (Regular Performance entry) | Hourly billing; smallest plan $15–18/mo; each HA replica adds ~2/3 of base price | PG 13 → latest (16 included). Replicas double as failover nodes (read-only). PITR window by tier: Hobbyist none; Startup 2 days; Business 14; Premium 30. |
| network | Bandwidth / Reserved IPs / VPC | Included transfer per plan, account-level free egress, overage GB, reserved IPv4 count | Included transfer 3–5 TB/mo per 2/4 plan + 2 TB/mo free account-level egress, pooled globally; overage **$0.01/GB flat worldwide**; ingress free; Reserved IPv4 $3/mo ($0.004/hr), first IPv4 per VM included; VPC free incl. intra-VPC traffic | Overage per GB; pooling account-wide monthly | Included-transfer pooling means tiny workloads essentially never pay egress. IPv6 free. |
| load-balancer-tls | Vultr Load Balancer | Number of LBs; region | $10/mo ($0.015/hr) each | Hourly, capped monthly | Includes TLS termination (BYO cert or Let's Encrypt), health checks, failover. Cheaper: Caddy/nginx on the VM for $0. |
| firewall-security | Vultr Firewall + DDoS Protection add-on | Firewall groups/rules (free); DDoS toggle per instance | Firewall $0 (stateful cloud firewall groups). DDoS add-on $10/mo per instance (10 Gbps mitigation) | DDoS add-on monthly per instance | Baseline network-level DDoS filtering platform-wide; OS-level firewall also free. |

**Reference price points:** app VM $24/mo (HP NVMe, 5 TB transfer) · smallest managed PG $18/mo (no PITR; production-ish 2/4/128 = $72, +1 replica $120) · Object Storage base $18/mo · minimal stack ≈ **$60/mo** without LB (≈$70 with).

**Sources:** [vultr.com/pricing](https://www.vultr.com/pricing/), [Object Storage](https://www.vultr.com/products/object-storage/), [Block Storage](https://www.vultr.com/products/block-storage/), [Load Balancers](https://www.vultr.com/products/load-balancers/), [Managed Databases](https://www.vultr.com/products/managed-databases/), [bandwidth overage doc](https://docs.vultr.com/support/platform/billing/what-is-the-bandwidth-overage-rate), [reserved IP doc](https://docs.vultr.com/support/products/network/are-reserved-ips-free), [bandwidth pooling announcement](https://blogs.vultr.com/vultr-announces-reduced-bandwidth-pricing-2-tb-of-free-monthly-egress-free-ingress-and-global-pooling), [PostgreSQL FAQ](https://docs.vultr.com/products/managed-database/postgresql/faq), [VKE](https://www.vultr.com/kubernetes/).
