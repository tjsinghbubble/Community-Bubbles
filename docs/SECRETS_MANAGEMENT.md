# Secrets Management

How Bubble handles API keys, tokens, and credentials across the server, the
mobile app, and the web app — and how to keep them working without leaking them.

If your build just started failing with a "Missing required env var" error, skip
to [Why is my build breaking?](#b-why-is-my-build-breaking).

---

## a. Introduction

A "secret" is any value an attacker could misuse: a credential, token, or a key
that costs money to use. Not all keys are equally sensitive, and the single most
important distinction is **where the value runs**.

### Sharable vs. non-sharable

- **Non-sharable (true secrets) — server-side only.** Database credentials,
  `JWT_SECRET`, `ENCRYPTION_KEY`, OAuth *client secrets*, payment *secret* keys,
  and any third-party REST/admin key. If one of these reaches client code, treat
  it as compromised. These live only in the server's environment.
- **Sharable (public identifiers) — fine to ship.** OAuth *client IDs* (public
  clients use PKCE), payment *publishable* keys, the **CometChat App ID**, Firebase
  web config. Secrecy was never their protection; the backend validates and scopes
  them. Exposure is expected.
- **Billable client keys — the awkward middle.** The **Google Maps/Places key** is
  designed to be used from the client, so it *cannot* be kept confidential — but it
  bills your account. It must be **restricted and quota-capped**, and ideally
  proxied through our server (see [Future work](#f-future-work)).

### Three truths to internalize

1. **Client code is public.** `EXPO_PUBLIC_*` (mobile) and `VITE_*` (web) values are
   inlined into the shipped bundle. They are extractable from the app binary
   (unzip/decompile) **and** from network traffic (a user can MITM their own
   device). TLS does not hide a key from the person holding the phone. So only put
   sharable values behind those prefixes; true secrets stay on the server.
2. **Keys cost money.** A leaked billable key (Maps) or a leaked privileged cloud
   credential can run up real charges fast — see [Costs of leaked
   secrets](#e-costs-of-leaked-secrets).
3. **Rotate.** Once a secret has been in a binary, a repo, a log, or a screenshare,
   assume it is known. Rotating (issuing a new value, revoking the old) is the only
   reliable remedy — scrubbing git history is not enough, because the value already
   shipped. Rotate on exposure, on team-member departure, and periodically.

### Where Bubble stores values

| Layer | Mechanism | Holds |
|---|---|---|
| Server (local) | root `.env` (gitignored) | DB creds, `JWT_SECRET`, `ENCRYPTION_KEY`, server-side service keys |
| Server (Replit) | Replit **Secrets** | same, per Repl |
| Mobile (local) | `mobile/.env` (gitignored) | the `EXPO_PUBLIC_*` client vars |
| Mobile (CI/release) | **EAS** env vars / secrets + `eas.json` `env` | the `EXPO_PUBLIC_*` client vars |
| Web | `app/.env` (gitignored) / host env | `VITE_*` client vars |

`*.env.example` files are committed and contain **placeholders only**.

### Naming convention: one canonical name per value

Every logical value has exactly **one** env-var name, used identically in every
context (local `.env`, Replit, EAS). The prefix encodes sharability:

- **`EXPO_PUBLIC_*` — sharable public identifiers.** Expo requires this prefix to
  inline a value into the client bundle, so it is the canonical name everywhere —
  the **server reads the same `EXPO_PUBLIC_*` name** for values it shares with the
  client (e.g. `EXPO_PUBLIC_COMETCHAT_APP_ID`, `EXPO_PUBLIC_COMETCHAT_REGION`).
  Corollary: anything named `EXPO_PUBLIC_*` is public by definition — never name a
  secret that way.
- **Unprefixed — server-only secrets.** `COMETCHAT_AUTH_KEY`, `COMETCHAT_API_KEY`,
  `JWT_SECRET`, etc. These never appear in `mobile/.env`, `eas.json`, or `.replit`.
- `SENTRY_DSN` is the one shared value without the prefix: the mobile app receives
  it at **build time** via `app.config.js` `extra` (not Metro inlining), so no
  prefix is required and the server/CI name is reused as-is.

**Migration note (2026-06):** the server previously read `COMETCHAT_APP_ID` /
`COMETCHAT_REGION`. It now prefers the `EXPO_PUBLIC_*` names and falls back to the
old ones, so un-migrated Replit Secrets keep working. Rename them in Replit when
convenient, then the fallbacks in `server/cometchat.ts`, `server/routes.ts`, and
`server/health.ts` can be dropped.

---

## b. Why is my build breaking?

We deliberately **fail loudly** when a required value is missing, instead of
silently falling back to a baked-in key (which is how live keys used to leak into
source). There are two layers:

1. **Build gate** — `mobile/scripts/check-secrets.sh` runs before a build (locally
   via `preandroid`/`preios`, and on EAS via the `eas-build-pre-install` hook). A
   missing required var stops the build immediately.
2. **Runtime backstop** — `requireEnv()` in `mobile/src/config/env.ts` throws at app
   startup if a value somehow wasn't present at bundle time.

### Errors you might see (non-exhaustive)

- **Build gate (build log):**
  ```
  ❌ check-secrets: required client env var(s) missing:
       - EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
  ```
  → The var isn't set in the environment this build runs in. Fix per
  [How to manage secrets](#c-how-to-manage-secrets).

- **Runtime (red box / immediate crash on launch):**
  ```
  Error: Missing required env var EXPO_PUBLIC_COMETCHAT_APP_ID. Set it in
  mobile/.env for local dev, or via EAS secrets / EXPO_PUBLIC_* for builds.
  ```
  → The bundle was built without the var. Set it and rebuild (restart Metro after
  editing `mobile/.env` — `EXPO_PUBLIC_*` values are inlined at bundle time).

- **Local health check (`scripts/local_bubble_health`):**
  ```
  ❌  Secrets: mobile/.env missing/empty: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
  ❌  Secrets: .env is NOT gitignored — secrets could be committed
  ❌  Secrets: possible live secret(s) committed: ...
  ```

- **Feature works on the simulator but not the device / not after a build:** usually
  a value that resolves on your Mac (e.g. a Bonjour `*.local` host or a key in your
  local `mobile/.env`) but isn't set in the EAS/Replit build environment.

The required client vars are: `EXPO_PUBLIC_API_URL`,
`EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`, `EXPO_PUBLIC_COMETCHAT_APP_ID`.

---

## c. How to manage secrets

General rules: never paste a real value into a committed file (including
`.replit`, `eas.json`, or `*.example`); never log a secret; share values through
the secret store, not chat.

### Replit

- **Sensitive values** → Tools → **Secrets** (the lock icon). These are injected as
  environment variables into the Repl at runtime and are not committed.
- **Non-secret identifiers** (e.g. `EXPO_PUBLIC_COMETCHAT_APP_ID`, region) may live
  in the committed `.replit` `[env]` block — but never real keys.
- The server (`npm run dev`) reads true secrets (DB, `JWT_SECRET`, …) from Replit
  Secrets. The "Expo Mobile" workflow bundles the app, so any `EXPO_PUBLIC_*` it
  reads is inlined and public — keep only sharable values there.
- After changing a Secret, restart the relevant workflow (and re-bundle Metro for
  mobile) so the new value is picked up.

### EAS (cloud builds)

`EXPO_PUBLIC_*` values must exist in the EAS build environment, or
`eas-build-pre-install` fails the build.

- **Create an env var / secret:**
  ```bash
  cd mobile
  eas env:create --name EXPO_PUBLIC_GOOGLE_PLACES_API_KEY --value "<key>" \
      --environment production --visibility secret
  eas env:list                       # verify (legacy CLI: `eas secret:create` / `eas secret:list`)
  ```
- **Non-secret, build-profile-specific values** can also go in `eas.json` under the
  profile's `env` (e.g. `EXPO_PUBLIC_API_URL` for `production`). Do **not** put real
  secret keys in `eas.json` — it is committed.
- Set the vars for **every profile you build** (`development`, `preview`,
  `testflight-staging`, `production`). A profile missing a required var fails the gate.

### EAS Local builds (`eas build --local`)

`eas build --local` runs the same `package.json` lifecycle hooks, so
`eas-build-pre-install` → `check-secrets.sh` runs the same way. The difference is
where values come from: a local build reads them from your shell environment /
`mobile/.env`, not from EAS-hosted env vars. So `eas env:pull` (or a populated
`mobile/.env`) before a local build:
```bash
cd mobile
eas env:pull --environment production   # writes a local .env from EAS (do not commit it)
eas build --local --profile preview
```

### Local development

1. `cp mobile/.env.example mobile/.env` and fill in real values (this file is
   gitignored).
2. For the server, populate the root `.env` (DB URL, `JWT_SECRET`, `ENCRYPTION_KEY`).
3. Run `scripts/local_bubble_health` — its `check_secrets` step verifies the env
   files are complete, that `.env` is gitignored, and that no live secret is
   committed.
4. Restart Metro after editing `mobile/.env`.

---

## d. Managing cost overruns (the Maps key)

The Google Maps/Places key ships in the client, so assume it is public and limit
the blast radius:

1. **Restrict the key** (Google Cloud Console → Credentials → the key):
   - *Application restrictions:* Android apps (package name + SHA-1 signing
     certificate) and iOS apps (bundle ID). **Caveat:** these protect the Maps
     *SDKs* but **not** Places *web-service* REST calls (which is what
     `react-native-google-places-autocomplete` makes) — so also do the next step.
   - *API restrictions:* limit the key to only the Places API(s) you actually use.
2. **Cap usage** so abuse can't run unbounded:
   - Per-API **quotas** (e.g. requests/day) in *APIs & Services → Quotas* — this is
     your practical hard ceiling.
   - **Budget alerts** in *Billing → Budgets & alerts* to get notified early.
3. **Watch it:** review the API dashboard for unexpected spikes.
4. **Best fix:** proxy Places through our server so the key never ships at all
   (see [Future work](#f-future-work)). Restriction + quotas reduce risk; a
   server-side proxy removes the client exposure.

The same thinking applies to any billable key: restrict, cap, alert, and prefer
server-side use.

---

## e. Costs of leaked secrets

You don't pay "per leak" — you pay for whatever an attacker does with the key,
which can be effectively unbounded until someone notices and rotates it.

Two mechanisms dominate:

- **Billable API keys (like Maps):** automated scrapers harvest keys from public
  repos and shipped apps — researchers have repeatedly shown a key pushed to public
  GitHub is found and used within **minutes**. They burn your quota for their own
  apps or run abusive traffic, and the charges land on your billing account.
- **Privileged cloud credentials (service-account keys, broad API keys):** far
  worse — an attacker can stand up compute (crypto mining) and generate **enormous**
  bills. This genre of "I leaked a key and woke up to a five- or six-figure cloud
  bill" is extensively documented. It has become especially common in the
  "vibe-coding" era: people ship AI-generated apps with credentials hard-coded
  client-side, the keys are scraped, and the bills arrive within hours — reports of
  tens of thousands of dollars overnight are not rare. (Maps keys can't spin up
  compute, so our worst case here is Places-usage bill abuse — bounded, but still
  potentially thousands of dollars.)

The takeaway isn't a precise figure; it's that an **unmanaged secret converts into
an arbitrary, attacker-controlled bill**. Keeping secrets off the client, scoping
and quota-capping the ones that must ship, and rotating on exposure are what keep
that number near zero. See the GitGuardian reference in
[References](#g-references) for the scope of the problem.

---

## f. Future work

- **Named-host model for dev/staging:** replace machine-specific hostnames with the
  logical `api_host` / `db_host` / `metro_host` indirection; see `docs/dev-hosts.md`.
- **Server-side Places proxy:** move address lookup behind our API
  (`/api/places/...`) so the Google key lives only on the server. This removes the
  client key entirely and lets us rate-limit per user. After this, drop
  `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` from the app.
- **ToS-appropriate caching for Maps:** cache to cut cost and calls, within Google's
  terms — store **Place IDs indefinitely**, cache other Places content **up to 30
  days**, keep **Autocomplete session-based (do not cache predictions)**, and never
  build a permanent derived dataset. (See Google's Places policies in References.)
- **Cost guardrails via Google's mechanisms:** standardize per-API quotas, billing
  budgets + alerts, and (optionally) a programmatic kill-switch
  (`capping API usage`) for the Maps project; document the agreed limits here.
- **CometChat auth tokens:** for production, mint auth tokens server-side via the
  CometChat REST key instead of relying on a client-side auth key.
- **Pre-commit secret scanning:** add a hook (e.g. gitleaks/GitGuardian) so a live
  key can't be committed in the first place; `check_secrets` is a manual backstop.

---

## g. References

URLs change over time; if one 404s, search the vendor's docs for the topic.

**Expo / EAS**
- Environment variables (and the `EXPO_PUBLIC_` public-by-design warning):
  https://docs.expo.dev/guides/environment-variables/
- EAS environment variables & secrets: https://docs.expo.dev/eas/environment-variables/
- EAS Build env reference: https://docs.expo.dev/build-reference/variables/
- `.easignore` / uploaded files: https://docs.expo.dev/build-reference/easignore/

**Replit**
- Secrets / environment variables: https://docs.replit.com/replit-workspace/workspace-features/secrets

**CometChat**
- Docs home: https://www.cometchat.com/docs
- Authentication (Auth Key vs server-minted Auth Token): search the docs for
  "Authentication" / "Auth Token"

**Google Maps Platform**
- API security best practices (key restrictions): https://developers.google.com/maps/api-security-best-practices
- Places web-service policies (caching, Place ID storage): https://developers.google.com/maps/documentation/places/web-service/policies
- Usage & billing: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- Maps Platform Terms (caching, §3.2.3): https://cloud.google.com/maps-platform/terms/
- Billing budgets & alerts: https://cloud.google.com/billing/docs/how-to/budgets
- Capping API usage (quota kill-switch): https://cloud.google.com/apis/docs/capping-api-usage

**General best practice**
- GitGuardian, State of Secrets Sprawl (scope of leaked-key abuse): https://www.gitguardian.com/state-of-secrets-sprawl-report
- OWASP MASVS (mobile app secrets / "no secrets in the binary"): https://mas.owasp.org/
