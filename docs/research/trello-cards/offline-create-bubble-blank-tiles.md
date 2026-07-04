---
title: Create-bubble category tiles render blank offline
list: UI Defects
request_type: Defect
priority: Medium
platform: Mobile
menu_item: Bubbles
status: To do
reviewed: false
---
Most category tiles disappear on the create-bubble screen when offline.

**Root cause (confirmed 2026-07-03):** category images come from our API host (`/images/categories/*.jpg`) which serves them with `Cache-Control: public, max-age=0` (`server/static.ts:29` — `express.static` with no options). A max-age=0 entry is stale immediately, and iOS/Android HTTP caches will not serve stale content offline → blank tiles. The screen uses plain React Native `Image` (`mobile/src/screens/main/CreateBubbleScreen.tsx:552`); the Ionicons fallback only renders when a category has *no* image URL, not when the fetch fails.

**Fix options (either largely resolves it):**
1. Serve static images with a long `max-age` (one-line change in `server/static.ts`).
2. Use `expo-image` (own disk cache, ignores HTTP staleness) as Explore/MyBubbles already do.

Full analysis: docs/research/image-costs-and-caching.md §4.
