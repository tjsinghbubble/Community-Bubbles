# Test Taxonomy & ID Registry

Single source of truth for the tag vocabulary and the test-ID registry used across both
Maestro (e2e) and the TypeScript/newman headless layers. Tags live **next to each test**
(Maestro `tags:` header, or `// qa-tags:` comment in TS); the runner scans them. This file is
the human-readable index and the place to reserve IDs before a test exists.

## Tag vocabulary

Every test carries one **area** tag, at least one **selection** tag, one **layer** tag, and
(for e2e) **role** + **platform** tags. **status** tags are optional.

| Dimension | Tags | Notes |
|---|---|---|
| **area** | `auth` `discovery` `joining` `inside` `events` `bubble-admin` `site-admin` `comms` `campus` `notification` `categories` `reports` `monitoring` `rules` `perf` `security` `wander` | Functional grouping from `docs/use-cases-and-tests.tsv`. `perf`/`security` are orthogonal and may co-tag a use-case test. `wander` = the role-based wandering-path flows (`tests/plan/wander/`). |
| **selection** | `smoke` `slow` `alpha-high` `alpha-low` `beta` | Drives what runs. `smoke` is the default suite. `wander` flows take `slow`, never `smoke`. |
| **status** | `unverified` `wip` `bug-filed` `bug-deferred` | `unverified` = assertion not yet trusted (a.k.a. `test_unverified`); reported separately, excluded from `smoke`. `bug-filed`/`bug-deferred` = the test exercises a *known* defect; it still runs, but a failure is counted as a **known bug** (🐞), not a new failure, and does not fail the suite. See [Bug tracking & reasons](#bug-tracking--reasons). |
| **layer** | `e2e` `headless` | Which engine runs it. |
| **role** | `role-any` `role-user` `role-bubble-admin` `role-site-admin` | `role-any` = role-agnostic; the runner still iterates all three by default. |
| **platform** | `ios` `android` `web` | e2e only. Default `ios`. |

These tag strings are stable and slow-changing. They are shared verbatim between Maestro and
headless so a single `--tag` / `--area` selection spans both engines.

## Default behavior

`npm run qa` with no arguments selects `smoke`, iterates all three roles, on `ios`.

## Bug tracking & reasons

**Failure accounting.** Every failing test is classified, in this precedence:

1. **known bug** 🐞 — test tagged `bug-filed` or `bug-deferred`. Tracked, does **not** fail the suite.
2. **expected finding** 🔎 — test tagged `unverified`. Reported separately, does not fail the suite.
3. **new failure** ❌ — anything else. This is what fails the suite (exit code 1).

The run summary prints all three counts: `N new failure(s), M known bug(s), K expected finding(s)`.
A 🐞 test that turns **green** is a hint the underlying bug may be fixed — worth re-checking the tag.

**Reasons (human-readable labels).** Add a `qa-reason:` line so each test announces its purpose in
the run output (and `summary.json`). It accepts `${ROLE}`, interpolated with the role under test.

- Maestro flow header: `# qa-reason: Sign in as ${ROLE} (UC 182)`
- Headless TS: `// qa-reason: Forgot-password must not leak which emails are registered`

Example run line: `🐞 auth-0700 [role-user]  12.3456s  Login rejects unicode-spoofed email — Bug filed: BUB-481`.

## Test-ID scheme

`<area>-<NNNN>`. Top-level use-cases are spaced by **100**. Named negative variants take
adjacent numbers in the gap (e.g. `auth-0100` happy, `auth-0110` wrong-password). Positive
value-range variants (case-insensitive email, password lengths) are **not** separately
numbered — only named negative variants are, because they map ~1:1 to future bugs.

Security tests use the `sec-` prefix (area `security`).

## Registry

### auth — Account & Onboarding (area rank 1)
| ID | Use case | Layer | Roles | Selection | Status | Implemented |
|----|----------|-------|-------|-----------|--------|-------------|
| `auth-0100` | Sign in with email + password (UC 182) | e2e | all | smoke | — | ✅ |
| `auth-0110` | Sign in — wrong password rejected (negative) | e2e | role-user | smoke | — | ✅ |
| `auth-0200` | Sign up with name/email/dob/password (UC 180) | e2e | role-user | smoke | — | ✅ |
| `auth-0210` | Sign up — duplicate email + short password rejected, no session (negative) | headless | role-user | smoke | — | ✅ |
| `auth-0220` | Sign up — invalid email shows/clears the inline validation message (UI negative) | e2e | role-user | smoke | unverified | ✅ |
| `auth-0230` | Sign up — duplicate email surfaces "Email already exists" alert, stays on form (UI negative; wording = sec-0110's leak) | e2e | role-user | smoke | unverified | ✅ |
| `auth-0300` | Reset or change password (UC 188) | e2e | role-user | alpha-high | — | blocked on email-capture mock (`docs/Testing_Mocks.md` §1) |

### security — orthogonal (area rank 9)
| ID | Use case | Layer | Selection | Status | Prediction | Implemented |
|----|----------|-------|-----------|--------|-----------|-------------|
| `sec-0100` | Login lockout resists password-stuffing (429 after 5 fails) | headless | security, smoke | — | very likely PASS (lockout exists) | ✅ |
| `sec-0110` | Signup endpoint resists email enumeration | headless | security | unverified | very likely FAIL — documents the `send-verification` 400-vs-200 leak | ✅ |
| `sec-0120` | Password-reset resists enumeration (uniform 200) | headless | security, smoke | — | likely PASS (`forgot-password` already uniform) | ✅ |
| `sec-0200` | Role-authz matrix: every role-gated route denies lower-privilege tokens (super-only × {user, bubble-admin}, bubble-admin-only × user, cross-user resources, scoped-empty admin reads) + coverage guard over routes.ts. Tagged `role-user, role-bubble-admin` — the roles whose tokens it probes (site-admin is never exercised) | headless | security, smoke | — | verified PASS 2026-06-11 (117 probes, all gates held) | ✅ |
| `sec-0300` | Bubble role affordances: role-user sees NO manage/admin-dashboard/create-event/add-photo controls; admin roles see the SAME selectors (selector-validity control) — Details + Events tabs | e2e (role-any) | security, smoke | unverified | authored from real testIDs; verify on sim, then drop tag | ✅ |

### discovery — Discovering Bubbles (area rank 2)
| ID | Use case | Layer | Roles | Selection | Implemented |
|----|----------|-------|-------|-----------|-------------|
| `discovery-0300` | Browse bubbles in the Explore tab (UC 204) | e2e | role-any | smoke | ✅ (unverified — verify on sim, then drop tag) |
| `discovery-0400` | View bubble details (tagline, members, about) before joining (UC 45) — reads the never-joined "QA Browse Bubble" fixture | e2e | role-user | smoke | ✅ (unverified — verify on sim, then drop tag) |

### joining — Joining Bubbles (area rank 3)
| ID | Use case | Layer | Roles | Selection | Implemented |
|----|----------|-------|-------|-----------|-------------|
| `joining-0400` | Join a public bubble instantly (UC 212) | e2e | role-user | smoke | ✅ (unverified — verify on sim, then drop tag; 2026-06-12: now completes the join via the welcome modal's "Let's Go" and taps the card by title) |
| `joining-0500` | Request to join a Request-to-Join bubble → pending + admin queue (UC 44 + 215) | headless | role-user | smoke | ✅ |
| `joining-0510` | Duplicate join request rejected, queue not duplicated (negative) | headless | role-user | smoke | ✅ |
| `joining-0520` | Request-pending UI: "Request Sent" alert, then disabled "Request Pending" on revisit blocks the duplicate (UI negative) — uses seeded "QA Request Bubble" | e2e | role-user | smoke | ✅ (unverified — verify on sim, then drop tag) |
| `joining-0600` | Accept bubble rules (checkbox) gates the join (UC 213) — uses the seeded "QA Rules Bubble" | e2e | role-user | smoke | ✅ (unverified — verify on sim, then drop tag) |
| `joining-1900` | Join a full bubble → waitlisted status (UC 218 positive) | headless | role-user | — | ✅ |
| `joining-1910` | Join a non-full bubble → approved status, not waitlisted (UC 218 negative) | headless | role-user | — | ✅ |

### events — Events (area rank 5)
| ID | Use case | Layer | Roles | Selection | Implemented |
|----|----------|-------|-------|-----------|-------------|
| `events-0500` | Create an event in own bubble end-to-end (UC 160 / 33) | e2e | role-bubble-admin | smoke | ✅ |
| `events-0600` | Member RSVPs to an event → attendee list + /events/my (UC 47 / 225, 2-accounts) | headless | role-user | smoke | ✅ |
| `events-0610` | Duplicate RSVP rejected, attendee row not duplicated (negative) | headless | role-user | smoke | ✅ |
| `events-0700` | Edit own event, change persists (UC 162) — positive counterpart to sec-0200's PUT-denied probe | headless | role-bubble-admin | smoke | ✅ |
| `events-0710` | Invalid edit (empty title) rejected, event untouched (negative; authz negative lives in sec-0200) | headless | role-bubble-admin | smoke | ✅ |
| `events-0720` | Edit form: clearing the title disables Save (UI negative) — opens seeded "QA Seeded Event", saves nothing | e2e | role-bubble-admin | smoke | ✅ (unverified — verify on sim, then drop tag) |
| `events-0800` | Delete own event → 404 + gone from bubble list (UC 163) | headless | role-bubble-admin | smoke | ✅ |

### bubble-admin — Bubble Admin (area rank 6)
| ID | Use case | Layer | Roles | Selection | Implemented |
|----|----------|-------|-------|-----------|-------------|
| `bubble-admin-0600` | Create a new bubble (UC 129) | e2e | role-bubble-admin | smoke | ✅ |
| `bubble-admin-0700` | Edit own bubble's details (UC 26) — positive counterpart to sec-0200's PUT-denied probe | headless | role-bubble-admin | smoke | ✅ |

### site-admin — Site Admin (area rank 7)
| ID | Use case | Layer | Roles | Selection | Implemented |
|----|----------|-------|-------|-----------|-------------|
| `site-admin-0100` | Approve a submitted bubble: submit (UC 135) → pending queue → approve (UC 68) → publicly visible — positive counterpart to sec-0200's super-only denials | headless | role-site-admin | smoke | ✅ |

### rules — Rules (area rank 16)
First unit from the test-expansion backlog (`tests/plan/`). See that tree for the rest.
| ID | Use case | Layer | Roles | Selection | Status | Implemented |
|----|----------|-------|-------|-----------|--------|-------------|
| `rules-0100` | View all app-wide rules (UC 79) — creates an app rule, asserts it appears in `GET /api/rules/app` | headless | role-site-admin | — | verified PASS 2026-06-13 | ✅ |

### contract — API contract/smoke (newman)
| ID | Use case | Layer | Selection | Implemented |
|----|----------|-------|-----------|-------------|
| `contract-0100` | Liveness + login contract via newman | headless | smoke | ✅ |

### infra — connectivity/runtime (area rank — orthogonal)
| ID | Use case | Layer | Selection | Prediction | Implemented |
|----|----------|-------|-----------|-----------|-------------|
| `infra-0100` | API reachable over IPv4 loopback (127.0.0.1) | headless | infra, smoke | PASS | ✅ |
| `infra-0110` | API reachable over IPv6 loopback (::1) — needs dual-stack bind | headless | infra, smoke | FAIL until API started with `API_BIND_HOST=::` (qa:server) | ✅ |
| `infra-0200` | Maestro env-precedence semantics pinned (file defaults beat -e; subflow defaults beat caller env; literal `${…}` for unset) — alerts if a Maestro upgrade changes them | e2e | infra, smoke | PASS under Maestro 2.2.0 (syntax-checked; first live run pending) | ✅ |

## Future notes

- **Data content-signatures** (not built). `tests/fixtures/signatures.ts` currently does schema
  fingerprints + per-table row counts. A future addition is full per-table CONTENT hashing
  (`md5` over row contents) with a `count|content` mode. Two motivating uses: (1) tests that
  require specific **predefined content** to pass can assert the DB matches an expected content
  signature; (2) comparing two servers' data for equality without shipping rows (e.g. an
  image-cache-on vs image-cache-off perf comparison). Keep the short rollup in the journal; put
  any per-table detail in a `meta` companion table, mirroring `meta.schema_baseline`.
