# Contributing to Community Bubbles

## Branch & PR workflow

1. Always branch off `develop` — never work directly on `main` or `develop`
2. Name your branch anything descriptive: `feature/event-reminders`, `fix/login-bug`
3. Open a PR targeting `develop` when your work is ready
4. CI runs automatically on every PR — all checks must pass before merging
5. Get at least 1 approval before merging
6. After your PR merges, go to Replit → Git panel → **Sync changes** to pull the latest `develop`

## Releasing to production

1. When `develop` is stable and ready to release, open a PR from `develop` → `main`
2. Get it reviewed and merged
3. In Replit: Git panel → switch branch to `main` → Sync changes
   - Replit's post-merge hook runs automatically: installs dependencies and pushes DB schema
4. Click the **Deploy** button in Replit — it builds and starts the production server (`npm run build` → `node dist/index.cjs`)
5. Verify everything works
6. Switch back to `develop` → Sync changes to resume development

> Replit normally stays on `develop` and uses the **Run** button (development mode, no build). Only switch to `main` and use **Deploy** during a deliberate release, then switch back to `develop` immediately after.

## Replit first-time setup

When you first open the Replit project, it may only show `main`. To switch to `develop`, open the Replit **Shell** and run:

```bash
git fetch origin
git checkout develop
```

After that, `develop` will appear in the Git panel and you can switch branches from there going forward.

## Local setup

```bash
# Install root dependencies
npm install

# Install mobile dependencies
cd mobile && npm install
```

Run tests locally before pushing:

```bash
# Server unit tests
npx vitest run

# Mobile unit tests
cd mobile && npm test
```

> The full dev server cannot run locally — `DATABASE_URL` is a Replit secret. Use Replit for live testing.

## Rules

- Do not push directly to `main` or `develop`
- Do not merge without CI passing
- Do not merge without at least 1 review
- Do not leave Replit on `main` after a release — always switch back to `develop`
