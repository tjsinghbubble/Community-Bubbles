# Images: where they come from, what they cost, and the caching problem

*Part of the [Move-from-Replit](Move-from-Replit.md) research set. Evidence gathered 2026-07-03 against the local experiment stack and live image services.*

## What this document is

The hosting cost research left three image questions open: Did our performance tests actually measure image traffic? Are we at risk of fees from Unsplash (the stock-photo service some of our images come from)? And are we serving images inefficiently in a way that costs money or hurts the app? This document answers all three with direct measurements.

## The answers, up front

1. **No, the load tests did not measure image traffic** — they measured the application's data responses precisely, but photo bandwidth was estimated from assumptions. This document closes that gap with direct measurements of the image paths.

2. **Unsplash will not send us a bill — that risk is essentially zero.** But there are two real, non-money risks in how we use it, both cheap to eliminate (below).

3. **The real problem is our own images.** We ship 124 MB of oversized category pictures (some files nearly 8–9 MB — poster-sized files used as small tiles) **and** we tell phones not to keep them. Every viewing forces re-checking and frequent full re-downloads. This one issue causes three separate harms:
   - **A known bug:** it is the confirmed root cause of "category icons disappear when offline."
   - **A bad experience:** first-time screens can pull ~40 MB over a cellular connection.
   - **A future cost:** harmless-looking at today's usage, but at high usage on a big-three cloud vendor it would add real dollars (~$11/month at the insane scenario) — and it inflates our deployment package (it is most of the 1.18 GB application container).

4. **The fixes are small and cheap** — compress the images (124 MB → ~5 MB with no visible loss at tile sizes) and change one line of server configuration so phones keep images they have already downloaded. Recommended to ride along with the Replit migration. After the fixes, image costs round to zero at every usage scenario and the published cost estimates stand unchanged.

## Where Bubble's images actually come from

Verified in code and against the running application:

| Source | What it serves | Size | Kept by phones? |
|---|---|---|---|
| **Packaged inside the app** | The logged-out welcome photo grid, most interest tiles | In the app itself | Always — works offline. (The welcome grid is *not* Unsplash, contrary to assumption.) |
| **Our server — category images** | Create-bubble and category tiles (46 categories) | **124 MB across 38 files, up to 9.1 MB each** | **No — told to re-check every single view.** The problem child. |
| **Our server — user uploads** | Bubble/event covers, profile photos | Varies | Kept for one hour only — the web app re-fetches hourly |
| **Unsplash (linked directly)** | 19 sample bubble covers, a few fallbacks and tiles — 26 addresses total | ~48 KB each | Kept for a year — excellent |

## The Unsplash question, settled

- **No fees at any usage level.** Directly linked Unsplash images are served from Unsplash's own delivery network at their expense; there is no metered billing to us, period.
- **Two real risks, neither about money:** (a) *Terms of use* — apps that embed Unsplash photos are supposed to use Unsplash's API with attribution; bare hotlinking sits outside the licensed path and could be blocked or throttled without notice. (b) *Control* — Unsplash can remove photos or change addresses at any time, and our sample covers would then be broken images forever, because the addresses are stored in **our** database.
- **The exposure is tiny and permanently fixable:** 26 addresses. Copying those images into our own photo storage costs about 1.3 MB of storage (effectively $0/month) and removes the dependency entirely. Recommended during the migration.

## The caching problem, precisely

Our server currently answers every category-image request with an instruction meaning "you may keep this, but consider it stale immediately and check with me before using it again." Measured live from the packaged application (identical logic in production):

```
GET /images/categories/yoga.jpg  → Cache-Control: public, max-age=0   (a 7.8 MB file!)
GET /assets/index-*.js           → Cache-Control: public, max-age=0   (content that never changes without a new name)
```

Consequences, each verified:

1. **Waste.** Every view triggers at least a check-in with the server; and because phones evict large cached files aggressively, multi-megabyte tiles frequently re-download in full. A cold first view of the create-bubble grid alone is ~40 MB — 130× what the cost model assumed for a whole session of photo browsing.
2. **The offline bug.** A "stale immediately" image will not be shown by the phone when offline, so the create-bubble screen's tiles render blank. (Screens built on a different image component that keeps its own disk cache mostly survive offline — which is why only *some* screens lose their images.)
3. **A related but separate issue:** "owner sees zero bubbles offline" is *not* an image problem — the app currently has no offline copy of its data at all. Filed separately; noted here so the two aren't conflated.
4. **Bloat.** The 124 MB rides inside every deployment package and is most of the application container's 1.18 GB.

## What it costs if left unfixed

Assuming conservatively 20 MB per user per month of unnecessary re-downloads:

| Scenario | Extra transfer/month | Cost on a big-three vendor | Cost after fixes |
|---|---|---|---|
| Zero growth (5 WAU) | ~0.1 GB | ~$0 | ~$0 |
| Moderate (100 WAU) | ~2 GB | ~$0.20 | ~$0 |
| Fast growth (700 WAU) | ~14 GB | ~$1.30 | ~$0 |
| Insane (6,000 WAU) | ~120 GB | **~$11/month** | ~$0 |

On Linode this hides inside the bundled transfer allowance, so the *dollar* line only bites on big-three vendors at scale — but the slow screens and the offline bug hurt everywhere, today.

## Recommended fixes (all are decision items; none applied — this is research)

1. **One line of server configuration** to let phones keep images: 30-day caching for images, and "never expires" for the fingerprinted files whose names change on every release. Directly mitigates the offline bug, the re-download churn, and the bandwidth waste. (`server/static.ts:29` — `express.static(distPath, { maxAge: "30d" })`, or `immutable, max-age=31536000` for hashed `/assets/`.)
2. **Compress the 38 category images**: 124 MB → ~5 MB at 800 px / quality 80. An asset-only change; no code.
3. **Lengthen the keep-time for user-uploaded photos** from one hour to a day or more (`objectStorage.ts:98`, default 3600).
4. **Standardize on the caching image component** (`expo-image`) for the create-bubble and events screens, matching the screens that already survive offline.
5. **Copy the 26 Unsplash images into our own storage** during the migration; add attribution for any that remain.
6. **An offline data layer** so owned bubbles render offline — a separate, larger discussion; bug filed.
