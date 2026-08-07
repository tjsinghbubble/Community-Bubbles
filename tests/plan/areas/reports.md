# Waitlist & Reports (tag: reports)

- source: docs/use-cases-and-tests.tsv rows 124–126
- default layer: **headless** (admin review of queues; API-observable)
- mocks in play: none. (The member-side "report a concern" that feeds this is joining UC 50.)

Super-admin review surfaces. The "set up" half is 2-actor: a member must create the report /
land on the waitlist before the admin can review it.

## UC 110 — View users on the waitlist   [todo · headless]
- roles: role-site-admin.
- positive: GET the platform waitlist → users who landed on it are listed. Set up by putting
  a member on a waitlist first (joining UC 218 mechanism: a full bubble). Assert the member
  appears.
- negative: non-super-admin denied the waitlist view.
- fixtures: **2-actor** — disposable full bubble + a member who tried to join (waitlisted),
  then admin reads. Reuse the joining-218 setup.

## UC 111 — Review reported concerns submitted by members   [todo · headless]
- roles: role-site-admin.
- positive: a member reports a concern (joining UC 50 endpoint) → admin GETs the reports
  queue → the report is present with reason/target; admin can action it (resolve/dismiss)
  and the state changes.
- negative: non-super-admin denied; resolving a non-existent report id is a clean 404.
- fixtures: **2-actor** — member submits a report against a seeded bubble/member, then admin
  reviews. Pairs directly with joining UC 50.

## UC 115 — Account   [review]
- TSV row is just "Account" — unclear use case. Mark `review`; a human should clarify what
  admin action this is (likely "view/act on a reported user's account") before authoring.

## Sequencing / dependencies
- Both real UCs are 2-actor: set up the member-side artifact (waitlist entry / report), then
  assert + action it as the admin. Use the headless 2-actor pattern (loginAs two roles in
  one test; see joining-0500 / site-admin-0100).

## Future work (knowingly deferred)
- Report lifecycle states (open → actioned → closed), repeat-offender handling, member
  notification on resolution — future. Waitlist promotion when a spot frees — future (also
  noted in joining).
