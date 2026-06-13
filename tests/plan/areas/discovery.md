# Discovering Bubbles (tag: discovery)

- source: docs/use-cases-and-tests.tsv rows 15–20
- default layer: e2e (this area is entirely the pre-join browsing UI)
- mocks in play: none

Covered: browse Explore (0300), view bubble details (0400). Remaining is finer-grained
viewing + search, all against the never-joined **QA Browse Bubble** so nothing mutates.

## UC 206 — View a bubble's cover image, tagline, member count, category (pre-join)   [todo · e2e]
- roles: role-user (any non-member browsing).
- positive: open QA Browse Bubble from Explore → assert tagline (`text-tagline`),
  `member-info` (count), category, and that the cover image element renders.
- negative: a field that's absent on a sparse bubble degrades gracefully (no "undefined"/
  empty-NaN count) — use a disposable minimal bubble.
- fixtures: QA Browse Bubble (rich) + optionally a disposable bare bubble for the negative.

## UC 207 — View a bubble's full details (description, rules, events, members)   [todo · e2e]
- roles: role-user.
- positive: on the JoinBubble/details screen, expand About (`button-about-toggle`) →
  `text-about-description`; assert the rules section, the events section
  (`text-upcoming-events`), and members area all render for a non-member.
- negative: member-only content (e.g. group chat, manage controls) is NOT shown to the
  non-member (overlaps sec-0300's affordance check — keep light here).
- fixtures: QA Browse Bubble (has the seeded event; QA Rules Bubble has a rule if you want
  the rules section populated).

## UC 208 — View upcoming events inside a bubble before joining   [todo · e2e]
- roles: role-user.
- positive: non-member opens QA Browse Bubble → upcoming events list shows **QA Seeded
  Event** (+30d). (This is the pre-join view; the joined-view is events UC 224.)
- negative: a bubble with no upcoming events shows the empty state, not a past/leaked event.
- fixtures: QA Browse Bubble (has the event) + a disposable event-less bubble for negative.

## UC 205 — Filter or search bubbles by interest/category   [todo · e2e]
- roles: role-user.
- positive: Explore `input-search` "QA" → the seeded QA bubbles filter in; a
  category/interest filter narrows results; `button-clear-search` restores.
- negative: a query that matches nothing shows a clean "no results" empty state (not a
  spinner-forever, not a crash).
- fixtures: seeded QA bubbles provide stable search hits.

## Sequencing / dependencies
- All four read-only against QA Browse Bubble (the never-join fixture) → fully
  order-independent. No teardown.

## Future work (knowingly deferred)
- Search relevance/ranking, multi-filter combinations, campus-toggle filtering — future
  positives. Pull-to-refresh and pagination of the Explore list — future.
