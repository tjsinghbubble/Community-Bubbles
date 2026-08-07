# Estimated monthly hosting cost, by vendor and usage scenario

*Part of the [Move-from-Replit](Move-from-Replit.md) research set. Generated 2026-07-03 by `scripts/one-off/hosting-pricing-model.sh` from the measured traffic numbers.*

## The table

Each figure is the estimated **total monthly bill in US dollars** for the minimal always-on setup — one small application server, the smallest production-worthy managed database, and 50 GB of photo storage — at each vendor, for each usage scenario. (Scenario definitions in [usage-scenarios-to-load-model.md](usage-scenarios-to-load-model.md): "zero growth" is 5 weekly active users; "insane growth" is 6,000.)

| Scenario | AWS | GCP | Azure | IBM Cloud | Vultr | **Akamai/Linode** | Cloudflare (partial) |
|---|---|---|---|---|---|---|---|
| Zero growth | $55 | $83 | $51 | $142 | $60 | **$45** | $14 + a database elsewhere |
| Low usage | $55 | $83 | $51 | $142 | $60 | **$45** | $14 + a database elsewhere |
| Moderate usage | $55 | $83 | $51 | $145 | $60 | **$45** | $14 + a database elsewhere |
| Fast growth | $55 | $83 | $51 | $147 | $60 | **$45** | $14 + a database elsewhere |
| Insane growth | $126 | $166 | $120 | $222 | $60 | **$45** | $14 + a database elsewhere |

## How to read it

- **Within each vendor, the bill barely moves until the insane scenario.** The workload is small at every usage level, so what you're really comparing is each vendor's floor price for an always-on setup.
- **The jump in the insane row at AWS, GCP, Azure, and IBM is photo bandwidth** — they charge per gigabyte downloaded, and at ~900 GB/month that adds $70–85. Vultr and Linode include multi-terabyte transfer allowances with the server, so their columns stay flat.
- **The Cloudflare column is not a complete setup** — Cloudflare cannot host our database or our always-on application on its own. It is listed because its R2 photo storage (free downloads, forever) can be combined with any other vendor as growth insurance.
- **Linode at ~$45/month is the value recommendation**, and its managed database includes daily backups with 14-day point-in-time recovery — the feature the Replit incident taught us to insist on.

## Caveats

- High-availability database options (a permanently synchronized second copy) are **not** included; they roughly double the database line at every vendor. See [hosting-pricing-parameters.md](hosting-pricing-parameters.md) for those deltas.
- Figures are estimates from vendors' published prices, assembled by our pricing model — spot-check against each vendor's own calculator before signing anything. Sources and per-vendor caveats: [pricing/](pricing/).
- Replit's actual current spend should be placed beside this table in the team discussion; it is the baseline being compared against.
