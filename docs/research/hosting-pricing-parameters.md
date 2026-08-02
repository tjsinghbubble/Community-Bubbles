# What cloud vendors charge for: the cross-vendor comparison

*Part of the [Move-from-Replit](Move-from-Replit.md) research set. All prices quoted 2026-07-03, US regions, standard on-demand rates in USD. Per-vendor source worksheets: [pricing/](pricing/). Bottom-line monthly totals: [hosting-cost-estimates.md](hosting-cost-estimates.md).*

## What this document is

Seven vendors were researched — Amazon (AWS), Google (GCP), Microsoft (Azure), IBM, Vultr, Akamai/Linode, and Cloudflare. Their pricing pages look bewilderingly different, but every one of them ultimately charges for the same handful of things. This document names those things in plain language, shows what each vendor charges for each, and draws the conclusions that matter for the decision.

## The conclusions, up front

1. **From launch through the "fast growth" scenario, every vendor's bill is essentially flat — so the comparison is simply each vendor's floor price.** For a small always-on server, a managed database, and 50 GB of photo storage: **Linode ~$45/month, Azure ~$51, AWS ~$55, Vultr ~$60, GCP ~$83, IBM ~$142.**

2. **Only the "insane growth" scenario separates vendors, and the entire difference is photo bandwidth.** The big three charge ~$0.09–0.12 per GB transferred, adding $85–105/month at that scale. Vultr and Linode bundle multi-terabyte allowances with the server (bill stays flat), and Cloudflare's R2 storage charges **nothing** for outbound transfer, by design.

3. **Cloudflare R2 is the standout cost lever for photos** — and it works as an add-on with *any* vendor's servers, because it speaks the same protocol as Amazon's storage. Worth pricing into any final configuration as growth insurance.

4. **Renting a plain server and running our containers on it is the economical shape.** Every vendor also sells fancier "managed container" services, but because our application must run continuously, those cost 2–6× the equivalent plain server. No thank you.

5. **IBM is not competitive** for this workload (its database floor is structurally doubled, its servers are priciest, and its pricing is opaque). It can be dropped.

6. **Replit's actual current cost** (reserved machine + database + storage) should be placed beside these numbers in the team discussion as the negotiating baseline.

## The seven things vendors charge for

1. **The server** — sized by CPUs and memory, billed by the hour, running 24/7 in our case (the application cannot pause when idle; see [Move-from-Replit.md](Move-from-Replit.md)).
2. **Server disk** — a modest fixed amount; bundled free with the server at some vendors.
3. **Photo storage** — billed per GB stored, plus (crucially) per GB *downloaded*.
4. **Managed database** — a small always-on service; the real differentiators are backup quality and whether high-availability doubles the price.
5. **Network** — outbound data transfer (the photo-bandwidth item again), plus a public address (~$2–4/month everywhere now).
6. **Load balancer and HTTPS certificates** — skippable at our scale: free software on the server does both jobs. Vendors' managed versions run $10–22/month.
7. **Firewall** — free at every vendor.

## Vendor comparison, item by item

### A small always-on server (2 CPUs / 4 GB) — $/month

| | AWS | GCP | Azure | IBM | Vultr | Linode |
|---|---|---|---|---|---|---|
| Plain server | $24.53 | $24.46 | $30.37 | $53.86 | $24 (5 TB transfer included) | **$24 (4 TB transfer included)** |
| "Managed container" alternative | $57.70 | $152 | $152 | $213 | — | — |

The managed-container row is why we rent plain servers: our always-on requirement forces those services into their most expensive billing mode.

### Smallest production-worthy managed database (PostgreSQL 16) — $/month

| AWS | GCP | Azure | IBM | Vultr | Linode |
|---|---|---|---|---|---|
| $25.66 | $54 | $16.09 | $82.54 | $18 | **$16** |

High availability (a permanently synchronized second copy) roughly doubles the price everywhere. Given the Replit data-loss incident, weigh backup and point-in-time-recovery quality heavily: **Azure and Linode are the "cheap with real backups" options** (Linode's includes daily backups with 14-day point-in-time recovery); Vultr's entry tier lacks point-in-time recovery; IBM's floor price is structurally doubled.

### Photo storage and bandwidth — the only line that grows with usage

| | Storage $/GB-month | Download $/GB | Free download allowance |
|---|---|---|---|
| AWS | 0.023 | 0.09 | 100 GB/month |
| GCP | 0.020 | 0.12 | 200 GB/month |
| Azure | 0.0208 | 0.087 | 100 GB/month |
| IBM | 0.0227 | 0.09 | — |
| Vultr | $18/month flat incl. 1 TB stored | 0.01 overage | pooled with server (3–5 TB) |
| Linode | $5/month flat incl. 250 GB stored | 0.005 overage | pooled with server (4 TB) |
| **Cloudflare R2** | **0.015** | **$0** | **all of it** |

At insane growth (~900 GB downloaded/month) this line is ~$86–115/month at the big three, roughly $0 at Vultr/Linode (inside the bundled allowance), and $0 at R2 by design.

### Fixed odds and ends

- Public internet address: $2–4.40/month depending on vendor (first one free at Vultr and Linode).
- Firewalls: free everywhere. (Avoid AWS/GCP/Azure "NAT gateways" — ~$33/month and unnecessary for our shape.)
- HTTPS and traffic routing: $0 using free software (Caddy) on the server — our plan; managed equivalents $10–22/month.
- Basic protection against traffic-flood attacks: included free at Cloudflare, Vultr, and Linode; a paid add-on at the big three; not a concern at our scale either way.

## Appendix — measurement contract and machine-readable data

Every vendor calculator reduces to knobs the performance tests measured (starred) or the load model computes: server class*, always-on hours (730/month), disk GB, photos stored GB*, photos downloaded GB*, database class* and storage*, high-availability yes/no, backup retention, outbound transfer GB/month*, public addresses.

- Unit prices in machine-readable form: `scripts/one-off/hosting-unit-prices.tsv`
- The model that turns these into the scenario totals: `scripts/one-off/hosting-pricing-model.sh`
- Per-vendor research worksheets with sources, caveats, and vendor-specific traps: [pricing/](pricing/) (one file per vendor; the Linode file also documents its pooled-transfer and billing quirks that matter for testing)
