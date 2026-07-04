# Hosting research (Replit migration study)

Research set for moving Bubble off Replit: pricing parameters across seven vendors, a load model for the five usage scenarios, performance measurements, and a containerization plan. **Research only — no application code was changed.** Produced 2026-07-03 for team discussion.

Motivation: cost uncertainty under growth, plus the Replit database-loss incident (multi-day backup recovery).

| Doc | Contents | Status |
|---|---|---|
| [metro-in-production.md](metro-in-production.md) | Is Metro needed in prod? **No** — evidence | done |
| [usage-scenarios-to-load-model.md](usage-scenarios-to-load-model.md) | DAU/WAU/ATS → req/s, egress, DB-size arithmetic (measured values folded in) | done |
| [pricing/](pricing/) | Per-vendor calculator parameters (AWS, GCP, Azure, IBM, Cloudflare, Vultr, Akamai/Linode) | done |
| [hosting-pricing-parameters.md](hosting-pricing-parameters.md) | Merged cross-vendor comparison + measurement contract | done |
| [perf-test-plan.md](perf-test-plan.md) | Perf/load test design + **measured results** (all scenarios 0% failures; one small instance suffices) | done |
| [dockerization-plan.md](dockerization-plan.md) | Containers (built & load-tested), topology, DNS cutover, firewalls, secrets | done |
| [hosting-cost-estimates.md](hosting-cost-estimates.md) | Scenario × vendor monthly cost table (generated from measured egress) | done |
| [image-costs-and-caching.md](image-costs-and-caching.md) | Unsplash exposure, cache-header audit, offline root cause, image egress deltas | done |

**Headline findings:** (1) Metro needs no production hosting. (2) One 2 vCPU/4 GB always-on instance covers every scenario with ≥4× headroom (measured: 200 req/s at 88% of one core, 0% failures). (3) Floor prices: Linode ~$45, Azure ~$51, AWS ~$55, Vultr ~$60, GCP ~$83, IBM ~$142 /mo; only insane-usage separates vendors, entirely via photo egress (R2/pooled-transfer vendors stay flat). (4) The single real migration blocker is the Replit object-storage sidecar coupling — one directory, three documented workarounds.

Companion artifacts:

- `scripts/one-off/hosting-*.sh` — container build, load test, resource sampling, egress report, pricing model. Deliberately **outside** the qa runner's discovery paths so `npm run qa --all` never executes them.
- `scripts/one-off/docker/` — Dockerfiles + compose for the local experiment stack.
- `tests/plan/areas/hosting.md` + `tests/plan/units/hosting-*.md` — test-plan authoring docs for the hosting area (not registered in `AREA_TAGS`; runner integration is a discuss-item).
