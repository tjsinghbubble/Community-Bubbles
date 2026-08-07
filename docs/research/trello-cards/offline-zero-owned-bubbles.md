---
title: Offline start shows zero owned bubbles for a signed-in owner
list: Feature/Functionality Defects
request_type: Defect
priority: High
platform: Mobile
menu_item: Bubbles
status: To do
reviewed: false
---
A signed-in account that owns four bubbles sees **zero** bubbles when the app is started offline (previously observed by Travis; confirmed root cause 2026-07-03 during hosting research).

**Root cause:** API responses are not persisted on-device. There is no offline store / React Query persistence, so an offline cold start has no data to render — this is a data-layer gap, not an image issue.

**Repro:** own ≥1 bubble → force-quit app → enable airplane mode → launch → My Bubbles is empty.

**Suggested direction:** persist the query cache (e.g. React Query `persistQueryClient` with AsyncStorage) for owned bubbles/profile, render stale data with an offline banner. Larger design discussion; see docs/research/image-costs-and-caching.md §6.
