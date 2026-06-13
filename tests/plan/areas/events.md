# Events (tag: events)

- source: docs/use-cases-and-tests.tsv rows 37–44
- default layer: headless for create/edit/delete/RSVP state (cheap, API-observable);
  e2e for the two "view" use cases and as the smoke happy-path counterpart
- mocks in play: `mock3-media` (event photos)

Heavily covered already: create (events-0500), RSVP + duplicate (0600/0610), edit + invalid
+ empty-title-UI (0700/0710/0720), delete (0800). Remaining: photos, view-RSVPs,
view-upcoming/past, cancel-RSVP.

## UC 160 / 33 — Create an event   [done · events-0500]
Covered. Future: the e2e create is smoke; a headless create-with-all-fields (timezone,
location, description, recurring/attendee-limit) positive is a worthwhile breadth add.

## UC 161 — Upload event photos   [blocked:mock3-media · e2e]
- roles: role-bubble-admin (event owner).
- positive: on an owned event, add a photo from the sim library; it appears on the event.
- negative: non-owner / non-image rejected.
- fixtures: needs `mock3-media`. Parked.

## UC 162 — Edit an event   [done · events-0700 (+0710/0720)]
Covered positive + invalid + UI-empty-title. Future negative ideas: edit by a non-owner
admin of a *different* bubble (authz — partially in sec-0200), editing a past event.

## UC 163 — Delete an event   [done · events-0800]
Covered. Future: delete cascers RSVPs/tasks cleanly (state-integrity assertion); delete by
non-owner denied.

## UC 164 — View who has RSVPed to an event   [todo · e2e or headless]
- roles: role-bubble-admin (owner sees the attendee list). role-user sees the participant
  count/list too if a member — a second, lower-priority replicate.
- positive: owner opens the event → `button-view-participants` → the attendee list shows
  the member who RSVP'd. Headless variant: `GET` the event's participants and assert the
  RSVP'd user is present.
- negative: a non-member / non-owner cannot see the attendee roster (privacy) — assert the
  list is empty or the request is denied.
- fixtures: **2-actor** — needs a member to RSVP first (reuse the events-0600 setup: create
  bubble+event, member RSVPs), then the owner reads the roster. Headless is the natural
  engine; copy events-0600.

## UC 224 — View upcoming and past events   [todo · e2e]
- roles: role-user (member viewing a bubble's events tab). Replicate to admin trivially.
- positive: open a bubble → Events tab (`tab-events`) → the seeded upcoming **QA Seeded
  Event** (+30 days) appears under "upcoming". A past event (seed one, or rely on
  date math) appears under "past" and not "upcoming".
- negative: a bubble with no events shows the empty state, not a stale/leaked event from
  another bubble.
- fixtures: **QA Browse Bubble** already contains QA Seeded Event (+30d). For the "past"
  half you may need a disposable past-dated event (seed via the create API with a past
  date) — note in handback if the seed lacks one.
- notes/future: "past vs upcoming bucketing" is the real assertion here; date boundaries
  are a fertile future negative (event exactly today, timezone edges).

## UC 225 — RSVP to an event   [done · events-0600 (+0610)]
Covered positive + duplicate-negative.

## UC 226 — Cancel an RSVP   [todo · headless]
- roles: role-user.
- positive: a member who has RSVP'd cancels (RSVP → Not Going, `button-rsvp-not-going`, or
  the cancel endpoint); they drop off the attendee list and `/events/my` no longer lists
  it.
- negative: cancelling an RSVP you never made is a no-op / refused — not an error that
  corrupts the count; assert the attendee count is unchanged.
- fixtures: **2-actor-ish** — same setup as events-0600 (member RSVPs first), then cancels.
  Copy events-0600/0610 structure. Natural counterpart to the duplicate-RSVP negative.

## Sequencing / dependencies

- 164 and 226 both build on the events-0600 RSVP setup (create bubble + event, member
  RSVPs). Author them by copying events-0600 so the fixture creation is identical and they
  stay order-independent (each makes its own disposable bubble).
- 224's "past" bucket needs a past-dated event; the seed only provides an upcoming one.

## Future work (knowingly deferred)

- Event photos (161) — `mock3-media`.
- Recurring-event creation, attendee-limit / waitlist behaviour, location-TBD toggle,
  timezone correctness — each a future positive+negative pair not yet in the backlog.
- Cross-bubble authz negatives for edit/delete live in sec-0200; don't duplicate them here.
