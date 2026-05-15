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
4. Verify everything works on production
5. Switch back to `develop` → Sync changes to resume development

> Replit normally stays on `develop`. Only switch to `main` during a deliberate release, then switch back immediately after.

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
