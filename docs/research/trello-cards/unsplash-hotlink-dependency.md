---
title: Remove Unsplash hotlink dependency (26 URLs) — ToS/availability risk
list: Feature/Functionality Defects
request_type: Defect
priority: Low
platform: All
menu_item: Explore Page
status: To do
reviewed: false
---
26 `images.unsplash.com` URLs are hotlinked in the product: 19 seeded bubble cover images (`server/seed-bubble-images.ts`, stored in our DB), 3 mobile fallback covers (Explore/BubbleEvents/BubbleDetails), 4 interest tiles (`InterestsScreen.tsx`).

**No fee risk:** Unsplash serves these free from its imgix CDN with 1-year cache headers (verified 2026-07-03; ~48 KB per w=800 image). The logged-out Welcome photo grid is bundled local assets, NOT Unsplash.

**Actual risks:** Unsplash's API guidelines require apps embedding photos to use their API with attribution + download tracking — bare hotlinking is outside the licensed path and can be blocked/rate-limited without notice; photos can also be removed, permanently 404ing rows in our DB.

**Suggested fix:** copy the 26 images into our object storage (~1.3 MB total) and update the seed/fallback URLs — ideally bundled into the Replit hosting migration. Analysis: docs/research/image-costs-and-caching.md §3.
