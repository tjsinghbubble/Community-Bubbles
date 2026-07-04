# Dockerization & self-hosting plan

Containerization of Bubble's three infrastructure components — API(+web SPA), PostgreSQL, and (dev-only) Metro — plus the topology, DNS, and security controls needed to run them on separately-addressed hosts behind open-source firewalls. **Research artifact; no application code changed.** Experiment files live under `scripts/one-off/docker/`; build with `scripts/one-off/hosting-docker-build.sh`.

*Written 2026-07-03. See [hosting-README.md](hosting-README.md) for the full research set.*

## 1. What actually needs hosting

| component | prod-needed? | container |
|---|---|---|
| API + web SPA (`dist/index.cjs` + `dist/public`, one Node 20 process) | yes, always-on | `bubble-api` (ubuntu:24.04 + Node 20) |
| PostgreSQL 16 | yes | official `postgres:16` |
| Object storage (user photos) | yes | managed bucket (GCS/S3/R2) — not self-hosted; see §4 |
| Metro bundler | **no** ([metro-in-production.md](metro-in-production.md)) | optional dev-tooling container only |
| Chat (CometChat), email (Resend), Sentry, EAS | SaaS | n/a |

The API runs in-process background schedulers (`server/notifications.ts`: event reminders, pruners, crash-spike detection) started on listen → **exactly one always-on API instance**; scale-to-zero platforms and naive horizontal scaling are out until schedulers get leader election (**discuss-item**).

## 2. Images

### API — `scripts/one-off/docker/api.Dockerfile`
- Multi-stage. Builder: `ubuntu:24.04` + NodeSource Node 20, `npm ci`, `npm run build` (vite SPA + esbuild server bundle), then `npm ci --omit=dev` (the esbuild bundle keeps most deps external, so prod `node_modules` must ship). Runtime: fresh `ubuntu:24.04` + Node 20, non-root `bubble` user, `dist/` + prod `node_modules` + `migrations/`+`drizzle/` (read by `server/auto-migrate.ts` at boot).
- `ENV NODE_ENV=production BUBBLE_SERVER_MODE=prod PORT=5000`; healthcheck `GET /api/v1/ping`.
- Ubuntu 24.04 chosen per team preference. Alternative: `node:20-slim` (Debian bookworm) — meaningfully smaller, maintained by the Node image team; swap the two `FROM`s and delete the NodeSource block if size ever matters. `bcrypt` is the only native dep and ships prebuilt linux binaries — both bases work without a toolchain at runtime.
- **Verified 2026-07-03 (built + booted + load-tested locally).** Image sizes: `bubble-api:research` **1.18 GB**, `postgres:16` 451 MB, fake-gcs 57 MB. Build gotchas encoded in the Dockerfile: (a) npm `postinstall` runs `scripts/flag-temp-files.zsh` → builder needs `zsh` and that script in context (it warn-and-continues on Linux); (b) `vite.config.ts` imports root-level `./vite-plugin-meta-images.ts` → must be COPY'd.
- **Fresh-DB bootstrap:** `server/auto-migrate.ts` patches monitoring tables but does **not** create the base schema. A brand-new database needs one-time `npx drizzle-kit push --force` (exactly what CI does) before the API boots cleanly. Any migration runbook must include this.

### PostgreSQL — official `postgres:16`
Recommendation: do **not** hand-roll PG on an Ubuntu base. The official image is the de-facto standard, matches CI (`.github/workflows/ci.yml` already runs a `postgres:16` service container), and gets timely security updates. Data on a named volume (`/var/lib/postgresql/data`); schema applied by the app's startup auto-migrate.

For production, prefer **managed Postgres** over self-hosted-in-container: automated backups/PITR directly addresses the Replit data-loss incident. Self-hosting PG in docker is fine for the experiment/local perf stack and viable in prod only with a real backup regimen (wal-g/pgBackRest to object storage + tested restores — that operational cost belongs in the vendor comparison).

### Metro (optional, dev only) — sketch, not built
`node:20` full image, `npm ci` in `mobile/`, `CMD npx expo start --port 8080`. Only useful as shared dev tooling; **never** part of production topology or pricing.

### Local experiment stack — `scripts/one-off/docker/compose.yaml`
`db` (postgres:16, healthcheck) + `gcs` (fake-gcs-server; `@google-cloud/storage` honors `STORAGE_EMULATOR_HOST`, so object storage works locally with **zero code changes**) + `api` (built image, `env_file: .env.local`). Ports bound to 127.0.0.1 only.

## 3. Environment & secrets

Required to boot in prod mode (from the `process.env` audit of `server/`): `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY` (32-byte hex; server refuses to start without it), `PORT`/`API_WEB_SERVER_PORT`, CometChat (`EXPO_PUBLIC_COMETCHAT_APP_ID`, `EXPO_PUBLIC_COMETCHAT_REGION`, `COMETCHAT_AUTH_KEY`, `COMETCHAT_API_KEY`). Optional: `RESEND_API_KEY`+`EMAIL_FROM`, `SENTRY_DSN`+`BUBBLE_SENTRY_USAGE`, `SHARE_BASE_URL`, `ALLOWED_ORIGINS`/`ALLOWED_PHOTO_ORIGINS`, `PRIVATE_OBJECT_DIR`+`PUBLIC_OBJECT_SEARCH_PATHS`, rate-limit/retention tuning (`RATE_LIMIT_*`, `*_RETENTION_DAYS`, `SLOW_CALL_*`, `FATAL_CRASH_SPIKE_*`), `SEED_SECRET`, `OLD_DATABASE_URL` (one-time import), `API_BIND_HOST`, `GOOGLE_PLACES_API_KEY`, Apple/Google auth IDs. Template: `scripts/one-off/docker/.env.example`.

Handling: root-owned `0600` env file per host consumed via docker `env_file:`/systemd `EnvironmentFile=`; or docker secrets. Never baked into images. **Migration must rotate every secret currently committed in `.replit [userenv.shared]`** (JWT_SECRET, SEED_SECRET at minimum) — cross-ref `docs/SECRETS_MANAGEMENT.md`.

## 4. The object-storage coupling (the one real blocker)

`server/replit_integrations/object_storage/objectStorage.ts:12-31` hard-codes `external_account` credentials whose token endpoints are a **Replit sidecar at `http://127.0.0.1:1106`**. There is no `GOOGLE_APPLICATION_CREDENTIALS` fallback in the code. Options, no-code-change first:

1. **Sidecar shim (no code change).** A ~50-line container on the API host listening on `127.0.0.1:1106`, implementing `/credential` and `/token` by exchanging a real GCS service-account key for access tokens. The app keeps working against a normal GCS bucket. Works because the credential shape is standard `external_account` with a URL token source.
2. **Local/CI: fake-gcs-server (no code change).** `STORAGE_EMULATOR_HOST` is honored by `@google-cloud/storage`; used in the compose stack today.
3. **Small code change (discuss-item, cleanest).** Make the `Storage()` constructor fall back to ambient credentials (`GOOGLE_APPLICATION_CREDENTIALS` / workload identity) when the sidecar is absent, or swap to S3-compatible storage (R2/S3/MinIO). Blast radius: one directory (`server/replit_integrations/object_storage/`); client upload path (Uppy `@uppy/aws-s3` presigned flow) already speaks S3 semantics.

Recommendation for the team discussion: option 3 (≈20 lines) beats operating a token shim forever; option 1 proves the migration without touching code.

## 5. Topology, IPs, DNS

Requirement: each component separately hostable on its own IP.

```
                    internet
                       │
            ┌──────────▼──────────┐
            │ host A (public IP)  │  api.trybubble.io / trybubble.io
            │ Caddy :80/:443      │  ── TLS termination, reverse proxy
            │  └─ bubble-api :5000│
            │ wg0 10.66.0.1       │
            └──────────┬──────────┘
                       │ WireGuard (51820/udp)
            ┌──────────▼──────────┐
            │ host B (public IP,  │  db.internal — private DNS only
            │  nothing exposed)   │
            │ postgres:16 :5432   │  binds 10.66.0.2 (wg0) only
            │ wg0 10.66.0.2       │
            └─────────────────────┘
   object storage: managed bucket (GCS/S3/R2) — provider-hosted, no IP of ours
```

### DNS changes (zone `trybubble.io`, currently → Replit)
| record | type | value | notes |
|---|---|---|---|
| `trybubble.io` | A/AAAA | host A | serves SPA + API + AASA (`/.well-known/apple-app-site-association` must keep working — universal links; see `docs/universal-links-setup.md`) |
| `www` | CNAME | `trybubble.io` | |
| `api` | A/AAAA | host A | optional split; mobile builds pin `EXPO_PUBLIC_API_URL=https://trybubble.io`, so apex must serve the API regardless |
| `db.internal` | — | 10.66.0.2 | **private** DNS/hosts entry over WireGuard only; no public record ever |

Cutover: drop TTL to 300 s ≥24 h ahead → stand up new stack → dual-run (new DB restored from dump, read-only verify) → flip A records → watch logs/Sentry → keep Replit warm 1–2 weeks as rollback → decommission + rotate secrets. Mobile clients need **no release**: the domain stays the same.

### Single-host variant
All scenarios through fast-usage fit one 2 vCPU/4 GB VM running both containers (see [usage-scenarios-to-load-model.md](usage-scenarios-to-load-model.md)); the two-host topology is the "separately hosted IPs" requirement, and the same firewall rules apply with wg0 replaced by the docker bridge.

## 6. Security controls (open-source firewalls)

**Inter-host: WireGuard** point-to-point (or Tailscale for zero-config + ACLs). Postgres listens only on the wg0 address; `pg_hba.conf` allows only the wg subnet with `scram-sha-256`.

**nftables per host** (ufw one-liners in parentheses for the simpler route):

Host A (edge/API):
```
table inet filter {
  chain input {
    type filter hook input priority 0; policy drop;
    ct state established,related accept
    iif lo accept
    tcp dport {80, 443} accept                    # ufw allow 80,443/tcp
    udp dport 51820 accept                        # ufw allow 51820/udp
    tcp dport 22 ip saddr <admin-ip> accept       # ufw allow from <admin-ip> to any port 22
    icmp type echo-request limit rate 5/second accept
  }
}
```

Host B (db): same skeleton; **no** 80/443; allow `tcp dport 5432 iifname "wg0"` only (`ufw allow in on wg0 to any port 5432`). SSH via admin IP or over wg0 only.

Additional controls:
- **fail2ban** on sshd both hosts; ssh keys only, `PasswordAuthentication no`.
- **TLS: Caddy** on host A (`caddy reverse_proxy 127.0.0.1:5000`, automatic Let's Encrypt, ~6-line Caddyfile). nginx+certbot equivalent if the team prefers; Caddy recommended for zero-maintenance renewal.
- API container binds 127.0.0.1 (or docker network) — only Caddy is exposed. Express rate limiting already in-app (`express-rate-limit`, `RATE_LIMIT_*`).
- Docker: non-root user in image (done), `--read-only` rootfs feasible later, no docker socket exposure, `live-restore: true`.
- Backups (the Replit-incident lesson): managed-PG PITR, or self-hosted wal-g nightly base + WAL to the object bucket, restore drill documented and rehearsed.
- **Dev-mode serving must stay fail-closed (already fixed on this branch; verify it shipped).** Historically `server/vite.ts` had a custom Vite logger whose `error` handler called `process.exit(1)`, and because the Vite dev middleware runs in the same process as the API, a single unauthenticated request that made Vite throw (e.g. `GET /.DS_Store` → import-analysis parse failure) killed the whole server — a single-packet DoS whenever a deployed host ran non-production. **Commit `ebcaff4` (2026-06-26) fixed this:** the `process.exit` is gone (`server/vite.ts:25`), and `server/index.ts:249-260` now throws at boot if the Vite branch is reached with `REPLIT_DEPLOYMENT`/`BUBBLE_DEPLOYED` set. Combined with esbuild inlining `NODE_ENV="production"` into `dist/index.cjs` (`scripts/build.ts`), the container/deploy artifact is doubly safe. Two things for the migration: (a) keep this guard — the containerized deploy must run the production/static path, never Vite; (b) confirm the fix is actually present in the deployed/cherry-picked release and verify which Replit run path is user-facing (see §8 item 6 for the verification recipe). Card: https://trello.com/c/5S47nGpb.

## 7. Costs feed

Instance sizing and egress inputs for this topology come from the perf runs ([perf-test-plan.md](perf-test-plan.md)); per-vendor unit prices in [hosting-pricing-parameters.md](hosting-pricing-parameters.md); scenario × vendor totals in [hosting-cost-estimates.md](hosting-cost-estimates.md).

## 8. Discuss-items (require code or team decisions)

1. Object-storage credential fallback (§4 option 3) — small, high-value code change.
2. Scheduler leader election if we ever want >1 API instance.
3. Managed vs self-hosted Postgres (backup posture vs ~$16–54/mo managed floor).
4. Optional qa-runner `hosting` area registration (`tests/runner/select.ts` AREA_TAGS) with an excluded-by-default mechanism.
5. Secret rotation plan for everything in `.replit [userenv.shared]`.
6. **Verify the Vite dev-mode DoS fix (`ebcaff4`) shipped to production and confirm Replit's user-facing run path.** The code fix is already on this branch (see §6) — the open items are release/ops confirmation, not a code change:
   - **(a)** Confirm the deployed/cherry-picked release includes `ebcaff4` (`server/vite.ts` has no `process.exit`; `server/index.ts` has the deployed-host guard). Cherry-picks can drop it.
   - **(b)** Determine which `.replit` run path serves trybubble.io: the `[deployment]` block (`node dist/index.cjs` → production/static, safe) vs the workspace Run button (`.replit:2` `npm run dev` → `NODE_ENV=development` → Vite, unsafe if pre-fix).
   - **Safe verification probes** (never crash live prod): `GET /api/v1/version` (liveness); fetch `/` and check for `/@vite/client`/`/@react-refresh`/unhashed `/src/main.tsx` (dev) vs hashed `/assets/index-<hash>.js` (prod); `GET /@vite/client` returns JS on dev, 404/SPA-fallback on prod (does not throw). Reserve `GET /.DS_Store` for a disposable instance only — on an unpatched dev server it triggers the crash you're testing for.
   - Trello https://trello.com/c/5S47nGpb.
