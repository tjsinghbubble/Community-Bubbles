# Area: hosting (perf / capacity measurements for hosting research)

**Status: deliberately NOT registered in `tests/runner/select.ts:AREA_TAGS`.**
These tests must never run under `npm run qa -- --all` (they load-test a local
docker stack for up to ~1 h and require docker + k6). They live outside the qa
runner's discovery paths (`tests/e2e/`, `tests/headless/`) as standalone
scripts under `scripts/one-off/`. Registering a `hosting` area with an
excluded-by-default mechanism in `select.ts`/`qa.ts` is a **discuss-item** —
see docs/research/hosting-README.md.

Purpose: produce the measured inputs that cloud pricing calculators need
(vCPU/RAM under load, req/s capacity, bytes/response → egress GB/mo, DB
size/IO, connection counts) for the five usage scenarios defined in
docs/research/usage-scenarios-to-load-model.md.

Prereqs (all units):
- Local experiment stack up: `docker compose -f scripts/one-off/docker/compose.yaml up -d`
  (build first via `scripts/one-off/hosting-docker-build.sh`)
- Seeded: `DATABASE_URL=postgres://bubble:bubble_local_only@127.0.0.1:5433/bubble npx tsx scripts/seed-test-data.ts`
- `k6` on PATH (`brew install k6`)
- NEVER point BASE_URL at the live Replit deployment.

Constraints: each unit < 1 hour wall time; outputs under `tmp/hosting-perf/`
(gitignored), never the repo root.

Units:
- hosting-0100 — stack boot + smoke (build, compose up, ping/health, login)
- hosting-0200 — scenario load tests (one per scenario) + resource sampling
- hosting-0300 — DB sizing snapshot (bytes/user, block I/O, connections)
- hosting-0400 — headroom probe (find single-container req/s ceiling)
