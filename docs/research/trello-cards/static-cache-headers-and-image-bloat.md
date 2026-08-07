---
title: Static assets served max-age=0; 124 MB unoptimized category images
list: Feature/Functionality Defects
request_type: Defect
priority: High
platform: All
menu_item: Deployment, Monitoring, Logs
status: To do
reviewed: false
---
Two compounding server-side issues (measured 2026-07-03, live headers from containerized prod build):

1. **`Cache-Control: public, max-age=0` on ALL static assets** — category images *and* content-hashed `/assets/*.js` bundles (`server/static.ts:29`, `express.static(distPath)` with no options). Every view revalidates; mobile caches evict multi-MB entries and re-download in full; nothing renders offline.
2. **`client/public/images/categories` is 124 MB across 38 JPGs, up to 9.1 MB each** (study_groups 9.1 MB, gardening 8.4 MB, yoga 7.5 MB served as a tile!). A cold create-bubble grid pulls ~40 MB. Also inflates `dist/public` (128 MB) and the docker image.

**Impact:** slow tile loads on cellular, the offline blank-tiles bug (separate card), avoidable egress at scale (~$11/mo at insane-usage on hyperscalers; see docs/research/image-costs-and-caching.md §5), deploy bloat.

**Suggested fixes:**
- `express.static(distPath, { maxAge: "30d" })`, or split: `immutable, max-age=31536000` for hashed `/assets/`, `30d` for images.
- Recompress the 38 category images (800px, q80 → ~130 KB each, catalog ~5 MB).
- Raise the object-storage route TTL for immutable photos (`objectStorage.ts:98`, currently 3600s).
