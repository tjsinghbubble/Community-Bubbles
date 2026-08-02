# Does the developer preview tool (Metro) need production hosting?

*Part of the [Move-from-Replit](Move-from-Replit.md) research set. Researched 2026-07-03; question is settled.*

## The answer

**No.** Metro is a tool developers use while they are actively writing and previewing changes to the phone app. No released version of the Bubble app — nothing installed from the App Store or Play Store, and nothing our users touch — ever connects to it. When we move off Replit, Metro does not come along, does not need a server, and does not appear on the hosting bill.

This matters because Metro is one of the things visibly running on Replit today, so it was natural to assume it was part of "the site." It is not. Taking it off the list simplified the entire hosting plan: what actually needs to be hosted is just the application server, the database, and photo storage.

## Why we are confident

Four independent lines of evidence, each verifiable in the current codebase:

1. **Released apps are self-contained.** When we produce an App Store or Play Store build, all of the app's code is packaged inside the app itself at build time, on Expo's build service. The finished app has no need to fetch code from anywhere at runtime.

2. **Released apps are pointed at the real server, not at Metro.** The address baked into every production-class build is `https://trybubble.io` — the application server. Nothing in any release configuration references a Metro address.

3. **Over-the-air app updates are Expo's job, not ours.** When we push a code update to phones without going through the app stores, Expo's hosted update service delivers it. That is part of our existing Expo subscription and is completely independent of where we host the website.

4. **Metro on Replit exists purely for developer convenience.** The Replit workflow that runs Metro is there so a developer can preview changes on a device while working. Our own build scripts deliberately start Metro separately from everything else, underscoring that it is a desk tool, not infrastructure.

## What this means for planning

- **Production hosting and pricing exclude Metro entirely.** The production footprint is exactly: one application server process, one PostgreSQL 16 database, and photo storage.
- **Developers keep using Metro locally**, on their own machines, exactly as the build scripts already encourage. An optional shared "developer tooling" container is sketched in [dockerization-plan.md](dockerization-plan.md) if the team ever wants one, but it is not part of production and carries no required cost.
- **The mobile-side costs that do exist** — Expo's build and update services, and the Apple and Google developer programs — are the same regardless of hosting vendor and are unaffected by leaving Replit.

## Appendix — technical pointers (for developers)

- Build profiles: `mobile/eas.json` (`production`, `beta`, `testflight-staging`, `preview`), all setting `EXPO_PUBLIC_API_URL=https://trybubble.io`; the client resolves its backend at build time in `mobile/src/config/api.ts`.
- Over-the-air updates: `mobile/app.config.js` sets `updates.url` to Expo's hosted EAS Update service with `runtimeVersion.policy = 'appVersion'`.
- Replit's "Expo Mobile" workflow runs `npx expo start --port 8080 --tunnel` — a dev-attach convenience only.
- The repo's build scripts intentionally pass `--no-bundler` and start Metro separately (`npm run metro_bundler`); see the repo `CLAUDE.md` for why.
