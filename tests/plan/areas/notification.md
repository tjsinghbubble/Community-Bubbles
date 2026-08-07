# Notifications (tag: notification)

- source: docs/use-cases-and-tests.tsv rows 112–117
- default layer: headless (notification state) / e2e (the in-app list + mark-read UI)
- mocks in play: **`mock5-push` blocks delivery assertions.** See docs/Testing_Mocks.md §5.
  Real APNs/FCM delivery can't be asserted locally. Deferred per the 2026-06-13 decision.

Important nuance the backlog flags everything `mock5`, but the app already exposes an
**in-app notification list** via API. Asserting that a notification ROW was created (without
asserting a push was delivered) is unblocked. We are deferring per the decision, but these
are the cheapest to revive if priorities change — recorded here so that option isn't lost.

## Parked on mock5-push (delivery half)
- UC 173 — Receive notifications for join requests (admin)
- UC 176 / 238 — Mark notifications as read
- UC 236 — Receive a notification when a join request is approved/rejected
- UC 237 — View all unread notifications

## UC 174 — Configure notification preferences (admin)   [parked → see auth UC 189]
Same toggle-persistence flow as auth UC 189 (also mock5-tagged). De-dup with auth; don't
author twice.

## Unblocked slices we are NOT doing now (decision: defer all)
- "A join request creates an in-app notification ROW for the owner" — assertable today via
  the notifications GET endpoint (no push). 2-actor (member requests, owner reads list).
- "Mark-as-read flips the row's read flag and decrements unread count" — assertable today.
Recorded for when we revisit; do not start without re-confirming the defer decision.

## Future work (knowingly deferred)
- Push delivery (mock5-push). Notification preferences actually SUPPRESSING a notification
  (cross of prefs + delivery). Deep-link from a notification to its target screen.
