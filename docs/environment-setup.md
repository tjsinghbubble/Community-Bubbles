# Environment Setup

This document lists all environment variables required to run the project. These are **never committed to git** — each developer must set them in their own environment.

---

## Replit (primary workflow)

Add each variable via the **Secrets** tab (padlock icon in the Replit sidebar).

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | Secret key used to sign and verify auth tokens. Must be a long random string. The server will refuse to start without this. |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. Auto-provided by Replit's PostgreSQL integration. |
| `RATE_LIMIT_AUTH_MAX` | No | Max attempts for `/api/auth/login` and `/api/auth/verify-code` per window. Default: `10` |
| `RATE_LIMIT_AUTH_WINDOW_MIN` | No | Window size in minutes for auth limiter. Default: `15` |
| `RATE_LIMIT_SEND_MAX` | No | Max requests for `/api/auth/send-verification` and `/api/auth/signup` per window. Default: `5` |
| `RATE_LIMIT_SEND_WINDOW_MIN` | No | Window size in minutes for send limiter. Default: `60` |
| `ENCRYPTION_KEY` | **Yes** | 32-byte hex key for AES-256-GCM email encryption. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

> **Note:** If you are on a shared Repl (not a fork), Secrets are shared — one team member adding them covers everyone.

---

## Local development

Create a `.env` file in the project root (already gitignored):

```
JWT_SECRET=<ask a teammate for the shared dev value>
DATABASE_URL=<your local postgres connection string>
```

The server does **not** auto-load `.env` (no dotenv). You can either:
- Set variables in your shell: `export JWT_SECRET=...`
- Or install dotenv and load it in `server/index.ts` (see below)

---

## Generating a new JWT_SECRET

If you need to generate a fresh secret (e.g. for a new environment):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use a separate secret per environment (dev, staging, prod). Sharing secrets across environments means a leaked dev secret can compromise production tokens.

---

## Production checklist

Before deploying to production, make sure the following are set in the production environment's secrets:

- [ ] `JWT_SECRET` — generate a fresh value, do not reuse the dev secret
- [ ] `DATABASE_URL` — points to the production database
- [ ] `ENCRYPTION_KEY` — generate a fresh value, do not reuse the dev key. Run `server/migrations/encrypt_emails.ts` after first deploy.
- [ ] Google Places API key — replace the hardcoded key in `mobile/src/config/api.ts` with a key restricted to production bundle IDs only
