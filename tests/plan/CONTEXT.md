# Shared Context for Test-Creation Agents

Every test-creation prompt (`tests/plan/units/<id>.md`) references THIS file instead of
repeating it. Read it once at the start of a unit. It is the ground truth a cheap agent
needs to write ONE Bubble test without exploring the whole repo.

> If anything here contradicts the code, the code wins — and say so in your handback note.

---

## 1. What you are producing

ONE test file at the `output_path` named in your unit card. Two engines exist; your unit
card says which (`layer`):

- **e2e** — a Maestro YAML flow under `tests/e2e/<area>/`. Drives the real iOS app.
- **headless** — a vitest TypeScript test under `tests/headless/<area>/`, hitting the API
  directly. No simulator. Faster, more reliable; prefer it whenever the behaviour is
  observable at the API layer.

Do **not** invent a third pattern. Copy the closest sibling test (your unit card names
one) and change what the use case requires.

## 2. The running system

- API server: **port 3000**, started by `npm run qa:server` (serves the dedicated
  `bubble_test` DB — NOT the dev DB; a plain dev server will fail seeded logins).
- Headless base URL comes from `tests/headless/lib/http.ts` (`baseUrl()`); never hardcode.
- e2e: Metro on `localhost:8081`, app id `com.bubble.mobile`, iOS simulator.
- DB is reset + seeded by `npm run qa:seed` before a run. Tests must NOT depend on
  artifacts left by other tests.

## 3. Seeded accounts (tests/config/roles.json)

| Role tag | Email | Password | Notes |
|---|---|---|---|
| `role-user` | member@bubble.test | Member123! | lowest privilege, owns no bubble |
| `role-bubble-admin` | bubbleadmin@bubble.test | BubbleAdmin123! | owns the seeded bubbles below |
| `role-site-admin` | siteadmin@bubble.test | SiteAdmin123! | super admin |

Extra fixture: `lockout-victim@bubble.test` (sec-0100 only — do not reuse).

## 4. Seeded fixtures (tests/fixtures/seed.ts) — deterministic, present every run

Owned by `role-bubble-admin`, all `approved`:

| Bubble | Privacy | Purpose / rule |
|---|---|---|
| **QA Test Bubble** | Public | general-purpose, NO rules |
| **QA Rules Bubble** | Public | exactly ONE bubble rule ("Be kind") — rules-gate flows |
| **QA Browse Bubble** | Public | VIEW-ONLY — no test may ever join it; contains **QA Seeded Event** (+30 days) |
| **QA Request Bubble** | Request to Join | request/pending flows |

Bulletin post types seeded: `general` (member-postable), `announcement` (admin-only).

**Disposable fixtures** (headless): create your own bubble/event instead of mutating the
shared ones — see `tests/headless/lib/fixtures.ts` (`createApprovedBubble`, `createEvent`,
`deleteBubble`). Title must be unique per run (append `Date.now()`); clean up in `afterAll`.

## 5. Selectors (e2e) — docs/maestro_testids.md

Real `testID`s live in `docs/maestro_testids.md` (one row per element, with file path).
**Never guess a selector.** If the one you need is not listed, stop and say so in your
handback — do not invent it. Common ones: `tab-bubbles`, `tab-events`, `input-email`,
`input-password`, `button-log-in`, `card-bubble-<id>`, `button-join-bubble`,
`button-view-members`, `button-rsvp` / `button-rsvp-going`, `button-create-event-fab`.
To verify a selector against the live app, the human can use Maestro MCP in a short
burst — request it in your handback rather than guessing.

## 6. API surface (headless)

Auth + request helpers: `tests/headless/lib/auth.ts` (`loginAs(role)`, `request(method,
path, {token, body})`). Endpoints you'll see in existing tests: `POST /api/auth/login`,
`POST /api/bubbles`, `POST /api/admin/bubbles/:id/approve`, `POST /api/bubbles/:id/join`,
`GET /api/bubbles/:id/membership`, `GET /api/bubbles/:id/join-requests`, `POST
/api/events`, `POST /api/events/:id/rsvp`. For a route you don't recognise, grep
`server/routes.ts` (or note "endpoint unverified" in your handback).

## 7. Hard rules (do not violate — these cost the team real debugging hours)

1. **Maestro env: NO `env:` defaults in any flow file.** In Maestro 2.2.0 a file's `env:`
   defaults OVERRIDE the runner's `-e` values, silently running the wrong user. Every flow
   starts with the fail-fast `assertTrue` guard — copy it verbatim from the sibling flow.
2. **Output naming** must be shell-typeable. The runner enforces this; you just keep
   filenames to `[a-z0-9-]` and follow the `output_path` you were given.
3. **No artifacts at the repo root.** Screenshots use `${SHOT_PREFIX}` (e2e). Never write
   to the repo root or commit a `.png`.
4. **Tag every test.** e2e: `tags:` header. headless: `// qa-tags:` comment. Include the
   area, `smoke` (only if it's a core happy path), the `layer`, `role-*`, and for e2e
   `ios`. Add `unverified` if you authored selectors/assertions you could not run — it is
   expected and correct to do this; a human drops the tag after one green run.
5. **Add a `qa-id:` and `qa-reason:` line** (see TAXONOMY.md §Reasons). The id is on your
   unit card; the reason is a one-line "what this proves (UC <n>)".

## 8. Positive vs negative (what your `kind` means)

- **pos** — the blue-sky happy path: the use case succeeds and the success is asserted
  (state changed, item visible, status 200, etc.). ONE clean path. Don't over-assert.
- **neg** — exactly one thing goes wrong and the system correctly refuses: invalid input
  rejected with the right error, an unauthorized actor denied, a duplicate not duplicated,
  a required field blocking submit. Assert BOTH the rejection AND that no state changed.

## 9. Handback (what you return when done)

End with a short note: which file you wrote, whether you could verify it (and how), any
selector/endpoint you couldn't confirm, any `unverified`/`bug-filed` tag you added and
why, and whether TAXONOMY.md should get a new registry row (yes — propose the row text).

## 10. Reference index

- Tag vocabulary + ID registry: `tests/TAXONOMY.md`
- Runner / how tests are selected and run: `tests/README.md`
- Mocks that block certain use cases: `docs/Testing_Mocks.md`
- App-level gotchas you must not reverse: `CLAUDE.md` (repo root)
