# Bubble API + web SPA — hosting research experiment (docs/research/dockerization-plan.md)
# Ubuntu 24.04 runtime per team preference; node:20-slim (Debian) documented
# as the smaller alternative in the plan doc.
#
# Build context must be the Bubble/ project root:
#   docker build -f scripts/one-off/docker/api.Dockerfile -t bubble-api:research .
# (see api.Dockerfile.dockerignore next to this file — BuildKit picks it up)

# ---- builder: full dev deps, runs vite + esbuild -> dist/ ----
FROM ubuntu:24.04 AS builder
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg python3 make g++ zsh \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# npm postinstall runs scripts/flag-temp-files.zsh (macOS backup-flagging;
# no-ops with warnings on Linux, but must exist and zsh must be installed)
COPY package.json package-lock.json ./
COPY scripts/flag-temp-files.zsh scripts/flag-temp-files.zsh
RUN npm ci
COPY tsconfig.json vite.config.ts vite-plugin-meta-images.ts drizzle.config.ts components.json postcss.config.js ./
COPY scripts/build.ts scripts/build.ts
COPY shared shared
COPY server server
COPY client client
COPY migrations migrations
COPY drizzle drizzle
RUN npm run build \
    && npm ci --omit=dev

# ---- runtime: Ubuntu 24.04 + Node 20, prod node_modules + dist only ----
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --shell /usr/sbin/nologin bubble
WORKDIR /app
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/dist dist
COPY --from=builder /app/package.json package.json
# auto-migrate reads migration SQL at startup
COPY --from=builder /app/migrations migrations
COPY --from=builder /app/drizzle drizzle
COPY --from=builder /app/shared shared

ENV NODE_ENV=production \
    BUBBLE_SERVER_MODE=prod \
    PORT=5000
EXPOSE 5000
USER bubble
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=5 \
    CMD curl -fsS http://127.0.0.1:5000/api/v1/ping || exit 1
CMD ["node", "./dist/index.cjs"]
