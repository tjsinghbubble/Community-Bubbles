# Communication (tag: comms)

- source: docs/use-cases-and-tests.tsv rows 96–106
- default layer: e2e (chat UI) / headless (DM + conversation state)
- mocks in play: **`mock2-cometchat` blocks nearly everything here.** See
  docs/Testing_Mocks.md §2. Per the 2026-06-13 decision, all mock-blocked units are
  deferred (no partial variants).

Chat is backed by the external CometChat API (`ensureCometChatUser`, `...Group`,
`addMemberToGroup`). Without a CometChat sandbox/fake + a scripted responder peer, two-way
messaging can't be asserted. The whole area is therefore parked until that mock exists —
standing it up unblocks this entire area at once.

## Parked on mock2-cometchat
- UC 168 / 228 — Message any member directly (2-actor DM)
- UC 169 / 222 — View the bubble's group chat
- UC 223 — Send messages in the group chat
- UC 230 — Share the bubble with someone (overlaps mock6-share for the share-sheet half)
- UC 242 — View all direct message conversations
- UC 243 — Filter messages (all / groups / direct)
- UC 244 — Start a new direct conversation
- UC 245 — View unread message count

## UC 170 — ** inappropriate language   [review + mock2]
- TSV `**` meta row. Needs the CometChat responder PLUS a moderation hook to test that
  flagged language is caught. Mark `review`; define the expected moderation behavior with a
  human before authoring. Doubly blocked (mock + spec).

## What we WILL get when mock2 lands (sketch, not yet authored)
- positive: two seeded peers exchange a message in a group; both see it; unread count
  increments then clears on read.
- negative: a non-member cannot post to a bubble's group chat; a blocked/removed user's
  send is refused.

## Future work (knowingly deferred)
- Everything above. Also: message moderation, online-presence dots
  (`status-online-*`), DM permission rules (can a member DM any other member, or only
  shared-bubble peers — confirm with product).
