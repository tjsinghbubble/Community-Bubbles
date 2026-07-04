# Is the Metro Bundler needed for production releases?

**No.** Metro is a development-time tool. No production or store-distributed build of the Bubble mobile app connects to a hosted Metro instance, and nothing about production hosting requires running one.

*Researched: 2026-07-03. Status: settled — evidence below is from the current repo.*

## Evidence

1. **Production builds are self-contained compiled binaries.** `mobile/eas.json` defines EAS build profiles (`production`, `beta`, `testflight-staging`, `preview`). Store builds embed the JS bundle in the binary at build time on Expo's EAS build service. There is no runtime bundler dependency.

2. **The API URL baked into production builds points at the API, not Metro.** All production-class profiles in `mobile/eas.json` set `EXPO_PUBLIC_API_URL = "https://trybubble.io"`. The mobile client resolves its backend from this variable at build time (`mobile/src/config/api.ts`). Nothing references a bundler URL.

3. **Over-the-air JS updates go through Expo's hosted EAS Update service, not our infrastructure.** `mobile/app.config.js` sets `updates.url = 'https://u.expo.dev/87aa84ba-…'` with `runtimeVersion.policy = 'appVersion'`. Expo hosts and serves update bundles; this is a separate (Expo) billing line, not something we self-host.

4. **Metro on Replit is a developer convenience only.** The `.replit` "Expo Mobile" workflow runs `npx expo start --port 8080 --tunnel` so developers can attach a dev build over a tunnel. Repo scripts (`metro_bundler` → `expo start`) and `mobile/package.json`'s intentional `--no-bundler` build flags (see `CLAUDE.md`) confirm Metro is run separately, by developers, during development.

## Implications for hosting/cost planning

- **Do not include Metro in production hosting or pricing.** The production footprint is exactly: one Node 20 process (API + web SPA served from `dist/`), PostgreSQL 16, and object storage.
- Metro remains needed for **local development and CI** only. An optional dev-tooling container is sketched in [dockerization-plan.md](dockerization-plan.md), but it is not part of the production topology and carries no hosting cost.
- Mobile-release costs that DO exist and are independent of hosting vendor: Expo EAS (builds + Update), Apple/Google developer programs. These are unchanged by any Replit migration.
