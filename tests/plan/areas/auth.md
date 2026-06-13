# Account & Onboarding (tag: auth)

- source: docs/use-cases-and-tests.tsv rows 2–14
- default layer: e2e for anything the user sees/taps (onboarding, profile edits, sign
  out); headless for data-rights + settings that are pure API state (export, delete,
  privacy, notification prefs)
- mocks in play: `mock1-email` (password reset), `mock3-media` (profile photo),
  `mock5-push` (notification prefs)

The four signin/signup units are already covered (auth-0100/0110/0200/0210 + the 0220/0230
UI negatives). What remains is profile editing, the two CCPA data-rights flows, and
settings.

## UC 181 — Select interests during onboarding (multi-select)   [todo · e2e]
- roles: role-user (the only role that onboards). Do not replicate.
- positive: a fresh signup reaches the interests screen, selects ≥2 chips
  (`button-interest-<id>`), Continue (`button-continue`) advances; the chosen interests
  persist (visible later on the profile / via `/api/users/me`).
- negative: Continue is disabled (or blocked) with **zero** interests selected — the screen
  must not let you onboard with an empty multi-select. Assert the gate, assert no advance.
- fixtures: needs a brand-new account (signup inside the flow, like auth-0200), because the
  seeded users are already onboarded. Use a unique email per run.
- notes/future: value-range variant (1 vs many interests) deferred. Interleaves with the
  signup flow — reuse auth-0200's signup steps as the prefix.

## UC 184 — Edit profile photo   [blocked:mock3-media · e2e]
- roles: role-user.
- positive: from EditProfile, `button-edit-photo` → pick the seeded simulator photo →
  the avatar updates and persists.
- negative: cancel/permission-denied leaves the old avatar unchanged.
- fixtures: needs `mock3-media` (deterministic image in the sim photo library + reachable
  object storage). Parked until that exists.

## UC 185 — Edit display name   [todo · e2e]
- roles: role-user (any logged-in user can edit their own; the mechanic is identical for
  all three — replicate across roles mechanically if cheap).
- positive: EditProfile → change name → `button-done`; new name shows on the profile and
  survives a re-open. Reset it at end so the run stays deterministic (or use a disposable
  account).
- negative: empty name is rejected / Save disabled; name unchanged.
- fixtures: prefer a disposable signup account so we never mutate the shared role users'
  names (other tests assert on those labels). **Important dependency** — see Sequencing.

## UC 186 — Edit "about me" bio   [todo · e2e]  (TSV flags a negative)
- roles: role-user.
- positive: `input-about-me` → type a bio → `button-done`; bio renders on the profile.
- negative: over-max-length bio is truncated/rejected (TSV explicitly wants a negative
  here) — assert the limit is enforced and nothing malformed is saved.
- fixtures: disposable account (same reason as UC 185).

## UC 187 — Edit interests   [todo · e2e]  (TSV flags a negative)
- roles: role-user.
- positive: from EditProfile toggle interests (`chip-interest-<id>`) → done; change
  persists.
- negative: deselecting to zero is rejected if a minimum is required (mirror UC 181's
  empty-gate); else assert that a removed interest truly disappears (no phantom state).
- fixtures: disposable account.

## UC 191 — Export their personal data (CCPA)   [todo · headless]
- roles: role-user. App-store-testing priority (CCPA) per the TSV.
- positive: trigger the data export/download request via the real endpoint; assert it is
  accepted and the export contains the user's own records (name/email/memberships) and
  ONLY theirs.
- negative: an unauthenticated request (no token) is denied; one user cannot export
  another user's data (cross-user denial — overlaps sec-0200's spirit).
- fixtures: a disposable account with a little data (one membership) so the export has
  something to contain. Grep `server/routes.ts` for the export route first.
- notes/future: the e2e UI variant (LoginSecurity → `button-download-data` → the
  DataConfirmAccount code flow) is **blocked on mock1-email** (it sends a confirmation
  code). Headless API-level export is the unblocked path.

## UC 192 — Delete account (CCPA)   [todo · headless]
- roles: role-user.
- positive: delete/deactivate the account via API; the account can no longer log in and
  its data is gone/anonymised. **Must use a disposable account** — never the seeded users.
- negative: deletion requires auth + the right confirmation; an anonymous or mismatched
  request is refused.
- fixtures: disposable account created in `beforeAll`.
- notes/future: the e2e Deactivate UI (`button-deactivate-account` →
  DeactivateReason/Confirm) is a separate, later variant. CCMA hard-delete vs soft
  deactivate distinction worth a future negative.

## UC 189 — Configure notification preferences (push, email)   [blocked:mock5-push · headless]
- roles: role-user. Parked: asserting push delivery needs `mock5-push`. The *preference
  toggle persistence* alone (no delivery) could be an unblocked headless test — note as a
  future de-scoped variant if we want partial coverage now.

## UC 190 — Configure privacy settings   [todo · headless]
- roles: role-user.
- positive: flip a privacy setting via API; read it back changed; confirm it actually
  gates the thing it controls (e.g. profile visibility) if cheaply observable.
- negative: anonymous request denied; invalid value rejected.
- fixtures: disposable or the seeded user if read-only-safe.

## UC 183 — Sign out   [todo · e2e]
- roles: any (mechanic identical). Primary role-user; replicate if cheap.
- positive: from a logged-in state, sign out; land back on the login screen; the session
  is cleared (relaunch does not auto-login). Reuse `common/logout.yaml`.
- negative: low value — signing out is hard to "fail". Skip the negative or make it
  "after sign-out, a protected screen is not reachable." Mark the neg unit `review`/skip in
  handback if it adds nothing.

## Sequencing / dependencies

- The profile-edit positives (185/186/187) mutate user state. To keep them
  order-independent and not corrupt the shared role users that OTHER areas assert on,
  author them against a **disposable signup account** (create in the flow, like auth-0200),
  OR have each test restore the original value at the end. Prefer disposable.
- 181 (onboarding) is naturally the front of the signup chain; it can share auth-0200's
  signup prefix.

## Future work (knowingly deferred)

- Password reset (UC 188) and the email-confirmed export/delete UI variants — all waiting
  on `mock1-email`.
- Role replication for the "any role can edit their own X" units (185/187/190/183) —
  mechanical, do once the role-user version is green.
- Negative-path richness: wrong-current-password on change, oversized uploads, malformed
  privacy payloads — one negative each is the floor here.
