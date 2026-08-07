# Bubble Admin (tag: bubble-admin)

- source: docs/use-cases-and-tests.tsv rows 45–81 (the largest area — but heavily
  deduplicated; the TSV folds both Group-Admin own-bubble powers AND Super-Admin
  any-bubble powers under this heading)
- default layer: **headless** for own-bubble CRUD + member management (API-observable);
  e2e for the create/edit flows already covered and the share UI
- mocks in play: `mock3-media` (cover/photos), `mock6-share` (QR/share/copy-link),
  `mock2-cometchat` (contact members)

Covered: create bubble (0600), edit own bubble (0700). The backlog over-counts this area
(~50 todo) because the TSV repeats use cases (e.g. "set member limit" appears as both UC 36
and UC 132; "edit after creation" == UC 26). Use the dedup map; author each behavior ONCE.

## Dedup map (author once; collapse the repeats)
- UC 26 == UC 134 (edit own bubble after creation) → DONE bubble-admin-0700
- UC 36 == UC 132 (set member limit) → author once (below)
- UC 27 == UC 136 (delete own bubble) → author once (below)
- UC 33 (create events) → DONE events-0500; UC 34 (edit/delete own events) → `events` UC
  162/163 (done)
- UC 29 (add/edit/delete bubble rules) → `rules` UC 146–148; UC 30 (override inherited) →
  `rules` UC 145
- UC 32 == UC 156 (remove a member) → author once (below)
- UC 35 (contact members) → blocked mock2-cometchat (`comms` area)
- UC 37 == UC 138/139/140 (share via QR / sheet / copy link) → blocked mock6-share
- UC 130/131 (upload cover / photos) → blocked mock3-media
- UC 135 (submit for approval) → exercised by site-admin-0100 setup (done)
- The Super-Admin rows 68–77 are platform-wide powers → `site-admin` area (68/69 approve/
  reject bubble == site-admin UC 10; 70/71 events == UC 11; 72–75 edit/delete any == UC 12)

## UC 27 / 136 — Delete their own bubble   [todo · headless]
- roles: role-bubble-admin (owner).
- positive: owner DELETEs their disposable bubble → 404 on re-read; gone from listings;
  memberships/events cleaned up.
- negative: a non-owner (member or a different bubble-admin) cannot delete it (overlaps
  sec-0200) → bubble still exists.
- fixtures: disposable bubble (never the seeded ones — other tests need those).

## UC 28 — Set bubble privacy (Public / Request to Join / Private)   [todo · headless]
- roles: role-bubble-admin.
- positive: owner changes privacy on their bubble; the new privacy reads back and changes
  join behavior (Public = instant; Request = pending) — assert the behavior shift, not just
  the field.
- negative: invalid privacy value rejected; non-owner cannot change it.
- fixtures: disposable bubble.

## UC 31 / 154 / 155 — Approve / reject a pending join request   [todo · headless]  (2-actor)
- roles: role-bubble-admin (owner) acting on a member's request.
- positive (approve): member requests to join a Request-to-Join bubble (joining-0500
  setup) → owner approves → member's membership reads back `approved`/member; they appear in
  the roster.
- positive (reject) / negative: owner rejects → member stays non-member; a second approve of
  an already-handled request is a no-op; a non-owner cannot approve/reject (authz).
- fixtures: **2-actor** — reuse joining-0500 (creator + member + the pending request), then
  add the owner's approve/reject. This is the approval counterpart to the existing
  request-side coverage.

## UC 32 / 156 — Remove an existing member from the bubble   [todo · headless]  (2-actor)
- roles: role-bubble-admin.
- positive: owner removes a member → membership gone; member no longer in the roster / loses
  member-only access.
- negative: owner cannot remove THEMSELF this way (must relinquish/delete); a non-owner
  cannot remove anyone.
- fixtures: 2-actor — a member joined a disposable bubble, then the owner removes them.

## UC 36 / 132 — Set a member limit (cap on total members)   [todo · headless]
- roles: role-bubble-admin.
- positive: owner sets a limit; the bubble reports the cap and "spots left" (joining UC
  217); joins beyond the cap waitlist/block (joining UC 218).
- negative: a non-numeric / negative limit is rejected; setting a limit below the current
  member count behaves per spec (assert the documented behavior).
- fixtures: disposable bubble; pairs with joining 217/218.

## UC 133 — Set bubble location   [todo · headless]
- roles: role-bubble-admin.
- positive: owner sets a location; reads back on the bubble.
- negative: malformed location payload rejected; non-owner denied.
- notes: e2e variant uses `button-location-picker` (a map/picker) — harder to automate;
  headless first.

## UC 153 — View all current members of the bubble (as owner)   [todo · headless or e2e]
- roles: role-bubble-admin.
- positive: owner GETs the member list → all current members + their roles/status.
- negative: a non-owner cannot read the admin member view (the public roster is joining UC
  227; this is the *management* view with pending/roles).
- fixtures: disposable bubble with a couple of members.

## UC 76 — ** is there a badge for being a bubble admin   [review]
TSV `**` open question, not a use case yet. Mark `review`; a human/product decides if a
bubble-admin badge exists before authoring. (UC 77 == negative login, dup of auth.)

## Sequencing / dependencies
- The 2-actor units (31/154/155, 32/156) all build on a member joining a disposable bubble
  first — reuse the joining-0500 / fixtures helpers. Member-limit (36/132) ties to joining
  217/218; author them as a cluster sharing the "bubble with a cap, filled" fixture.
- Everything operates on **disposable** bubbles; never mutate or delete the seeded QA
  bubbles.

## Future work (knowingly deferred)
- Cover/photo uploads (mock3), share/QR/copy-link (mock6), contact-members chat (mock2).
- Transfer ownership, demote/promote co-admins (`button-member-make-admin` /
  `button-member-demote` / `button-relinquish-admin`) — a rich future cluster not in the
  backlog yet. Bulk member actions. Privacy-change side effects on existing pending
  requests.
