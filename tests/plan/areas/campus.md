# Campus Mode (tag: campus)

- source: docs/use-cases-and-tests.tsv rows 107–111
- default layer: e2e (the verification UI flow)
- mocks in play: **`mock1-email` blocks the verification steps** (the .edu code is
  emailed). See docs/Testing_Mocks.md §1. Deferred per the 2026-06-13 decision.

A user verifies a .edu email to unlock campus-exclusive bubbles/events. The code-entry
steps need the emailed code captured (SMTP sink or a DB read of `verification_codes`).

## Mostly parked on mock1-email
- UC 197 — Enter a .edu email to begin campus verification (sends the code) — parked
- UC 198 — Enter the verification code received by email — parked (needs the code)
- UC 199 — Gain access to campus-exclusive bubbles/events after verification — parked
  (depends on 198 completing)

## UC 196 — See a prompt to verify a university email   [todo · e2e]  (partially unblocked)
- roles: role-user.
- positive: an unverified user sees the campus prompt on Explore
  (`button-join-campus` / the campus prompt card). This is just the PROMPT appearing — no
  email involved — so it is **not** mock-blocked.
- negative: a user who dismissed the prompt (UC 200) does not see it again on return.
- fixtures: the seeded member (unverified) sees the prompt by default.

## UC 200 — Dismiss the campus mode prompt   [todo · e2e]
- roles: role-user.
- positive: tap `button-dismiss-campus-prompt` ("I'm not a student") → the prompt
  disappears and stays dismissed across a relaunch.
- negative: low value; dismissing rarely "fails". Consider `review`/skip, or assert
  dismissal persists (doesn't reappear next session).

## Sequencing / dependencies
- 196 and 200 are the unblocked pair (prompt visibility + dismissal). The verification chain
  (197→198→199) all waits on mock1-email; when it lands, author them in sequence (one test
  may need to drive the whole chain since 199 depends on a verified state).

## Future work (knowingly deferred)
- Full .edu verification + campus-exclusive access gating — mock1-email. Invalid/non-.edu
  email rejected; wrong code rejected; code expiry — negatives for when the mock exists.

## Blocked/done this pass (2026-06-14)
- `campus-0500` (UC200 dismiss-prompt, pos) — DONE (e2e, unverified; no email involved).
- `campus-0400` / `campus-0410` (UC199 campus-exclusive access) — BLOCKED on mock1-email
  (access depends on the UC197->198 .edu verification chain).
- `campus-0510` (UC200 neg) — BLOCKED: low value; "stays dismissed across relaunch" is
  fragile under Maestro clearState/openLink. Revisit as `review`.
