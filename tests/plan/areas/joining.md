# Joining Bubbles (tag: joining)

- source: docs/use-cases-and-tests.tsv rows 21–36
- default layer: e2e for the join/RSVP UI; headless for membership-state + waitlist/limit
  logic that is API-observable
- mocks in play: `mock2-cometchat` (group chat), `mock6-share` (share bubble)

Covered: join public (0400), request-to-join + duplicate + pending-UI (0500/0510/0520),
accept-rules (0600). Remaining is the rich middle of the member lifecycle.

## UC 46 — RSVP to events   [todo · e2e]
- roles: role-user. (Note: overlaps Events UC 225 which is done headless; this is the
  joining-area *UI* RSVP from inside a bubble's events.)
- positive: member opens a bubble event → `button-rsvp` → `button-rsvp-going`; UI reflects
  Going.
- negative: RSVP to a full event (attendee limit reached) is blocked / waitlisted, not
  silently accepted.
- fixtures: QA Browse Bubble's QA Seeded Event (upcoming). For the full-event negative, a
  disposable event with attendee-limit 0/1 pre-filled.
- notes: keep distinct from events-0600 (that's the headless state assertion; this is the
  in-bubble UI traversal). Consider marking the pos a near-dup and prioritising the negative.

## UC 47 — Participate in bubble group chat (CometChat)   [blocked:mock2-cometchat]
- roles: role-user. Parked — needs a CometChat sandbox/fake + a responder peer to assert
  two-way messaging. See docs/Testing_Mocks.md §2.

## UC 48 — Leave a bubble   [todo · e2e or headless]
- roles: role-user.
- positive: a member leaves (`button-join-leave` toggle, or DELETE membership); membership
  reads back gone; they no longer see member-only content.
- negative: the bubble OWNER cannot "leave" their own bubble (must transfer/delete instead)
  — assert the action is blocked/absent for the owner.
- fixtures: member must first join a disposable/public bubble (QA Test Bubble), then leave —
  so re-running reseeds cleanly. Headless is cleaner for the state assertion.

## UC 49 — Share a bubble with others   [blocked:mock6-share]
- roles: role-user. Parked — share sheet ends outside the app. Unblocked variant: the
  copy-link path could assert pasteboard contents (mock6 "pasteboard read"); otherwise stop
  at "share sheet visible". Note as a partial-coverage option.

## UC 50 — Report a concern about a bubble or member   [todo · e2e]  (Security/Trust/Safety, High)
- roles: role-user.
- positive: kebab → `button-report-concern` / `button-report-bubble` → submit a reason; the
  report is accepted (and shows up in the site-admin reports queue — that's reports-area /
  2-actor).
- negative: submitting an empty report reason is rejected; submit disabled.
- fixtures: any seeded bubble. The admin-side review is reports UC 111 (separate, 2-actor).
- notes: T&S priority — good candidate to promote.

## UC 52 — Enable or join Campus Mode   [blocked:mock1-email · campus area]
Cross-listed with the campus area; needs .edu verification (mock1-email). Park here, own it
in `areas/campus.md`.

## UC 54 — Delete their account   [duplicate of auth UC 192]
Same flow as auth-1100/1110. Do NOT author twice — point the unit at the auth coverage in
handback and mark this `done`/`review`.

## UC 55 — Manage notification and privacy settings   [duplicate of auth UC 189/190]
Same as auth-1200/1300. De-dup; mark `review`.

## UC 216 — Access a Private bubble via a direct link   [todo · e2e]
- roles: role-user.
- positive: open a deep link to a Private bubble the user is permitted to see; the bubble
  details load (universal-links-setup.md has the link scheme).
- negative: a user NOT permitted sees a denied/not-found state, not the private content.
- fixtures: a disposable Private bubble + a membership for the permitted case. **2-ish
  setup.** Deep-link launch in Maestro uses `openLink`.

## UC 217 — See how many spots are left if a member limit is set   [todo · e2e or headless]
- roles: role-user.
- positive: a bubble with a member limit shows remaining spots ("N spots left") that
  decrements as members join.
- negative: a bubble with NO limit shows no spots-left UI (not "0 left" / not NaN).
- fixtures: disposable bubble created with a member limit; add members to move the count.

## UC 218 — Be added to a waitlist if a bubble is full   [todo · headless]
- roles: role-user.
- positive: joining a full (limit-reached) bubble puts the member on the waitlist
  (membership/waitlist status reads back "waitlisted"), not "approved".
- negative: a non-full bubble never waitlists — a normal join is instant/pending as
  configured, not waitlisted.
- fixtures: disposable bubble at its limit (seed members up to the cap). Headless is the
  clean engine. Pairs with UC 217.

## UC 227 — View other members   [todo · e2e]
- roles: role-user (member viewing the roster).
- positive: inside a joined bubble → `button-view-members` → the roster lists members
  (the owner at least).
- negative: a NON-member cannot view the full member roster (privacy) — assert denied/empty
  for a user who hasn't joined.
- fixtures: QA Test Bubble (join first) for the positive; QA Browse Bubble (never joined)
  for the non-member negative.

## Sequencing / dependencies

- 217 + 218 share the "bubble with a member limit, filled to cap" fixture — author together
  (disposable bubble, bulk-add members via API; see tests/fixtures/bulk-users.ts).
- 227's non-member negative reuses the QA Browse Bubble (the never-join fixture).
- 50 (report) sets up the reports-area admin review (2-actor across areas).

## Future work (knowingly deferred)

- Group chat (47), share (49), campus (52) — mock-blocked.
- Private-link authz (216) deserves a fuller matrix later (expired link, revoked access).
- Waitlist promotion (when a spot frees up, the next waitlisted member is admitted) — a
  future 2-actor positive not yet in the backlog.
