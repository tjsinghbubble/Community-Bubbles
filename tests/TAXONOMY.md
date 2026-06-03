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
| **area** | `auth` `discovery` `joining` `inside` `events` `bubble-admin` `site-admin` `comms` `campus` `notification` `categories` `reports` `monitoring` `rules` `perf` `security` | Functional grouping from `docs/use-cases-and-tests.tsv`. `perf`/`security` are orthogonal and may co-tag a use-case test. |
| **selection** | `smoke` `slow` `alpha-high` `alpha-low` `beta` | Drives what runs. `smoke` is the default suite. |
| **status** | `unverified` `wip` | `unverified` = assertion not yet trusted (a.k.a. `test_unverified`); reported separately, excluded from `smoke`. |
| **layer** | `e2e` `headless` | Which engine runs it. |
| **role** | `role-any` `role-user` `role-bubble-admin` `role-site-admin` | `role-any` = role-agnostic; the runner still iterates all three by default. |
| **platform** | `ios` `android` `web` | e2e only. Default `ios`. |

These tag strings are stable and slow-changing. They are shared verbatim between Maestro and
headless so a single `--tag` / `--area` selection spans both engines.

## Default behavior

`npm run qa` with no arguments selects `smoke`, iterates all three roles, on `ios`.

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
| `auth-0300` | Reset or change password (UC 188) | e2e | role-user | alpha-high | — | reserved |

### security — orthogonal (area rank 9)
| ID | Use case | Layer | Selection | Status | Prediction | Implemented |
|----|----------|-------|-----------|--------|-----------|-------------|
| `sec-0100` | Login lockout resists password-stuffing (429 after 5 fails) | headless | security, smoke | — | very likely PASS (lockout exists) | ✅ |
| `sec-0110` | Signup endpoint resists email enumeration | headless | security | unverified | very likely FAIL — documents the `send-verification` 400-vs-200 leak | ✅ |
| `sec-0120` | Password-reset resists enumeration (uniform 200) | headless | security | — | likely PASS (`forgot-password` already uniform) | reserved |

### discovery — Discovering Bubbles (area rank 2)
| ID | Use case | Layer | Roles | Selection | Implemented |
|----|----------|-------|-------|-----------|-------------|
| `discovery-0300` | Browse bubbles in the Explore tab (UC 204) | e2e | role-any | smoke | ✅ (unverified — verify on sim, then drop tag) |

### joining — Joining Bubbles (area rank 3)
| ID | Use case | Layer | Roles | Selection | Implemented |
|----|----------|-------|-------|-----------|-------------|
| `joining-0400` | Join a public bubble instantly (UC 212) | e2e | role-user | smoke | ✅ (unverified — verify on sim, then drop tag) |

### bubble-admin — Bubble Admin (area rank 6)
| ID | Use case | Layer | Roles | Selection | Implemented |
|----|----------|-------|-------|-----------|-------------|
| `bubble-admin-0600` | Create a new bubble (UC 129) | e2e | role-bubble-admin | smoke | ✅ |

### contract — API contract/smoke (newman)
| ID | Use case | Layer | Selection | Implemented |
|----|----------|-------|-----------|-------------|
| `contract-0100` | Liveness + login contract via newman | headless | smoke | ✅ |
