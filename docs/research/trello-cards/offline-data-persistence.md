---
title: Offline data persistence — render cached bubbles/profile when offline
list: Feature/Functionality Defects
request_type: Feature
priority: Medium
platform: Mobile
menu_item: Bubbles
status: To do
reviewed: false
---
Design and implement an offline data layer so a signed-in user sees their own data when the app starts without connectivity. Today API responses live only in memory: an offline cold start renders nothing (see bug https://trello.com/c/35zL09dU).

**Scope sketch:**
- Persist the React Query cache (e.g. `persistQueryClient` + AsyncStorage/MMKV) for the high-value read queries: my bubbles, memberships, profile, upcoming events, categories.
- Serve stale data on startup with an offline indicator; refetch on reconnect (NetInfo listener).
- Decide staleness/eviction policy and what is deliberately NOT cached (chat via CometChat, admin views).
- Pairs with image-cache fixes (https://trello.com/c/GNEzRqYm, https://trello.com/c/oPbIV5sq) — data without images still renders blank cards.

**Out of scope:** offline writes/mutation queueing — separate, much larger effort.

Context: docs/research/image-costs-and-caching.md §6 (item 6).
