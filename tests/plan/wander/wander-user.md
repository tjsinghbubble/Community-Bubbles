# Wander — role-user (wander-0100)

A member spends a few minutes browsing and dipping into activity. Login as
`member@bubble.test`. Screenshot (`${SHOT_PREFIX}<step>`) at every numbered stop. Tolerant
asserts only (landmark visible). Seeded fixtures only.

## Path

1. **Login** → land on Explore. Assert `tab-bubbles` visible.
2. **Browse bubbles** — Explore Bubbles tab; scroll the list; assert a `card-bubble-.*` is
   visible. (Exercises the ScrollView gesture path — see CLAUDE.md.)
3. **Search** — `input-search`, type "QA"; assert the seeded QA bubbles filter in;
   `button-clear-search`.
4. **View a bubble's details** — open **QA Browse Bubble**; assert tagline / `member-info`.
   Read the Details tab.
5. **Look at events** — inside that bubble, `tab-events`; assert the seeded **QA Seeded
   Event** appears under upcoming.
6. **Open the event** — tap the event card; assert event detail (title, date).
7. **RSVP** — `button-rsvp` → `button-rsvp-going`; assert the RSVP state reflects "Going".
   (Real action; idempotent — re-running just re-confirms.)
8. **Bulletins** — back to the bubble; open the bulletin board; assert it renders (empty
   state is fine — it's seeded with post *types* but no posts).
9. **Members** — `button-view-members`; assert the owner (bubble-admin) row is listed.
10. **Join a public bubble** — go to **QA Test Bubble** (rule-free) and join via the
    welcome modal "Let's Go"; assert membership. (The one state-changing join in the path.)
11. **Messages tab** — open Messages; assert the screen renders (chat is CometChat-backed
    and may be empty/unconfigured locally — tolerate it; do NOT assert a conversation).
12. **Profile / settings** — open Account; assert `button-personal-info` and
    `text-version` visible. End here (no destructive settings).

## Notes

- Stops 11 (chat) and any photo are the fragile, externally-backed ones — keep them
  assertion-light so the wander survives a missing CometChat/storage config.
- Do not attempt the TSV example's "create requests for three new bubbles" here — bubble
  creation belongs to the bubble-admin wander; a plain member creating bubbles is a
  separate use case (creation is allowed but routes through approval). Keep this wander to
  member-shaped activity. (If desired later, a "member submits a bubble" stop can be added
  as a future variant.)
- Future: parametrise the device/text-size for the Product/Design sweep; add a
  network-condition profile knob.
