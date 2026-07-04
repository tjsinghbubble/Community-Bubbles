# Image sourcing, caching, and hidden costs

Answers three questions the hosting research didn't cover: (1) did the perf data measure image downloads? (2) do we face Unsplash fees? (3) are missing HTTP cache headers causing unnecessary downloads? Evidence gathered 2026-07-03 against the local experiment stack and live Unsplash CDN.

**TL;DR: the hidden image cost is not Unsplash — it's our own 124 MB of unoptimized category images served with `Cache-Control: max-age=0`.** That same header is the mechanical cause of the "icons disappear offline" bug.

## 1. Did the load tests measure image traffic? No.

The k6 mix ([perf-test-plan.md](perf-test-plan.md)) exercised JSON endpoints (~2.8 KB avg). Photo egress was **modeled** (10 × 300 KB/session), and third-party image hosts weren't measured at all. This doc closes that gap with direct measurements.

## 2. Where images actually come from (verified in code + seeded DB)

| source | what | size (measured) | cached? |
|---|---|---|---|
| **Bundled assets** (`require(...)`) | logged-out Welcome photo grid (`mobile/.../WelcomeScreen.tsx:19-29`), most interest tiles | in-binary | always; works offline. **The logged-out home array is NOT Unsplash.** |
| **Our API host, static** (`/images/categories/*.jpg`) | create-bubble & category tiles (46 categories → `categories.image`) | **124 MB / 38 files, up to 9.1 MB each** | `Cache-Control: public, max-age=0` (live-verified) — revalidate every view, never served offline |
| **Our API host, object storage** (`/objects/…`) | user-uploaded bubble/event covers, avatars | varies | `max-age=3600` (`objectStorage.ts:98`) — web re-fetches hourly |
| **images.unsplash.com** (hotlinked) | 19 seeded bubble covers (`server/seed-bubble-images.ts`), 3 mobile fallback covers, 4 interest tiles | ~48 KB each at w=800 (live-verified) | `max-age=31536000` (1 year), imgix CDN — excellent |

## 3. Unsplash: fee risk low, compliance/availability risk real

- **No per-download fees.** Hotlinked `images.unsplash.com` URLs are served free from Unsplash's imgix CDN with 1-year cache headers; their bandwidth, not ours. There is no metered bill to us at any usage level.
- **Real risks:** (a) **Terms** — Unsplash's API guidelines require apps embedding photos to use the API (with attribution and download-tracking); bare hotlinking of gallery URLs in a product is outside the licensed path and could be blocked or rate-limited without notice. (b) **Availability/control** — photos can be removed or URLs rotated; our seeded covers and fallbacks then 404 forever (they're rows in *our* DB). (c) **Unsplash+** is their paid tier; if compliance were enforced, that's the paid path.
- **Exposure is small and fixable:** 26 URLs total. Migrating them into our object storage costs ~1.3 MB of storage (~$0.00003/mo) and removes the dependency. Recommend doing this during the Replit migration (discuss-item).

## 4. The real problem: `max-age=0` on our static images

Live headers from the containerized API (identical logic in prod — `server/static.ts:29`, `express.static(distPath)` with no options):

```
GET /images/categories/yoga.jpg  → Cache-Control: public, max-age=0   (7.8 MB!)
GET /assets/index-*.js           → Cache-Control: public, max-age=0   (hashed, immutable content)
```

Consequences:
1. **Unnecessary downloads/revalidations.** Every image view revalidates (304 round-trip at best). Mobile HTTP caches evict multi-MB entries aggressively, so tiles frequently re-download in full. The create-bubble grid alone is ~12 × 3–9 MB = **~40 MB** on a cold cache — 130× the photo-egress model's per-session assumption.
2. **Offline blanks (reported bug, root cause confirmed).** A `max-age=0` entry is stale immediately; iOS/Android HTTP caches will not serve stale content offline, so `CreateBubbleScreen` tiles (plain RN `Image`, `mobile/.../CreateBubbleScreen.tsx:552`) render blank. Screens using `expo-image` (Explore, MyBubbles, BubbleDetails) have their own disk cache that ignores HTTP headers and mostly survives offline. The Ionicons fallback only renders when a category has *no* image URL — not when the fetch fails.
3. **"Owner sees zero bubbles offline" is a data-layer issue, not images:** API responses aren't persisted (no offline store), so an offline start has no bubbles to render at all. Filed separately.
4. **Bloat:** the 124 MB rides inside `dist/public` — it's most of the 1.18 GB docker image and every deploy.

## 5. Updated cost picture

Static-image egress with today's headers (per-user cache-miss heavy; assume conservatively 20 MB/user/month of category/static image re-downloads):

| scenario | extra static-image egress GB/mo | hyperscaler cost @ ~$0.09/GB | after fixes |
|---|---|---|---|
| zero-growth (5 WAU) | ~0.1 | ~$0 | ~0 |
| moderate (100 WAU) | ~2 | ~$0.2 | ~0 |
| fast (700 WAU) | ~14 | ~$1.3 | ~0 |
| insane (6,000 WAU) | ~120 | **~$11/mo** | ~0 |

With fixes the whole category catalog compresses to ~5 MB (38 images × ~130 KB at sane web quality) downloaded **once per device**: the line rounds to zero at every scenario, and the [hosting-cost-estimates.md](hosting-cost-estimates.md) numbers stand unchanged. Without fixes, the bigger costs are UX (7.8 MB tile loads on cellular) and the offline bug — the dollar line only bites at scale. Unsplash contributes $0 either way.

## 6. Recommended fixes (all discuss-items; none applied — research only)

1. **One-line server change:** `express.static(distPath, { maxAge: "30d" })` — or `immutable, max-age=31536000` for hashed `/assets/`, `30d` for images. Directly mitigates offline blanks, revalidation churn, and egress. (`server/static.ts:29`)
2. **Compress category images** (38 files, 124 MB → ~5 MB at 800px/q80). Asset-only change, no code.
3. **Raise object-route TTL** for immutable user photos: `max-age=86400+` with the existing ACL split (`objectStorage.ts:98` default 3600).
4. **Standardize on `expo-image`** (disk cache, offline-tolerant) for CreateBubble/BubbleEvents, matching Explore/MyBubbles.
5. **Migrate the 26 Unsplash URLs** into object storage during the hosting migration; add attribution if any remain.
6. **Offline data layer** (React Query persistence or similar) so owned bubbles render offline — separate, larger discussion; bug filed.
