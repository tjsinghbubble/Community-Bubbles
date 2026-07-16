# Mobile ↔ Web Feature Parity

Last generated: 2026-07-10, from `mobile/src` (React Native/Expo) vs `client/src` (React/wouter web app), against `develop` (`671c872`).

This document is a snapshot, not a contract — regenerate it whenever mobile or web ship a feature area, by re-reading `mobile/src/screens/**` and `client/src/pages/**` rather than trusting this file blindly.

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Full parity — same capability on both, both wired to real APIs |
| 🟡 | Partial — present on both but web (or mobile) is missing sub-features, or one side is a non-functional stub |
| 📱 | Mobile-only |
| 🌐 | Web-only |
| ⚠️ | **Facade** — UI exists and *looks* functional but is not wired to any API (silent no-op / fake success) |

## Executive summary

- **Web trails mobile in nearly every consumer-facing area**: auth, event RSVP, bulletin authoring, chat features, member management, and all of Help & Support are mobile-only or badly stubbed on web.
- **Web leads in admin/observability**: System Monitor, Latency Dashboard, and full Category management are web-exclusive and more capable than their closest mobile equivalents.
- **Several web "settings" screens are facades** — they update local React state and show success, but never call an API: Notification Preferences, Privacy settings, bulletin/member/report actions on `bubble-details`, message reactions/edit/delete/calls in chat. A user saving these on web will believe the change persisted when it did not.
- **Web has zero live camera capture** (`getUserMedia`/`mediaDevices`) anywhere in `client/src` — confirmed by full-repo grep. All web uploads are file-picker based. This means the camera capability-detection work is new functionality on web, not a fix to an existing broken path — worth keeping in mind when scoping that task.
- **Bubble cover-image upload on web create-bubble is broken end-to-end**: a file is picked and previewed locally, but the submit payload always sends `coverImage: null`.
- **No RSVP action exists on web** despite an "Your RSVPs" section on the Upcoming page — confirmed via grep, no button/mutation writes RSVP state anywhere in `client/src`.

---

## 1. Auth & Onboarding

| Capability | Mobile | Web | Notes |
|---|---|---|---|
| Login (email/password) | ✅ | ✅ | |
| Signup (email/password) | ✅ | ✅ | Web is a 2-step form (info → interests); mobile also collects legal name, gender, DOB (18+ gate), profile photo |
| Email verification (OTP) | 📱 | — | Not present on web at all |
| Password reset (forgot/reset) | 📱 | — | Not present on web at all |
| Social login (Google, Apple) | 📱 | — | Not present on web at all |
| Interests selection | ✅ | ✅ | Mobile requires ≥3 of 16; web requires ≥1 of 18 |
| Guidelines / ToS acceptance step | 📱 | — | Mobile has a dedicated agree-to-guidelines screen; web has no equivalent onboarding step (static legal pages exist but no acceptance gate) |
| Campus (.edu) verification | 📱 | 🌐 (read-only) | Mobile has a full verify flow; web only *displays* campus stats in System Monitor, no way for a user to complete verification from web |
| Duplicate/inconsistent auth state | — | ⚠️ | `create-bubble.tsx` has its own separate login gate with different localStorage keys than `AuthContext` — a latent bug, not a feature |

**Status: 🟡 Partial.** Web auth is bare-bones; verification, recovery, and social login are entirely mobile-only.

---

## 2. Bubbles (Groups)

| Capability | Mobile | Web | Notes |
|---|---|---|---|
| Create bubble | ✅ | 🟡 | Web wizard mirrors mobile's steps closely, but cover image is never actually uploaded (submits `null` regardless of selection) |
| Edit bubble | 📱 | — | No edit route/page exists on web at all |
| Location search / radius | ✅ | 🟡 | Mobile uses real Google Places autocomplete; web location is a plain text field with a decorative, non-functional map-pin button |
| Rules (inherited + custom) | ✅ | 🌐-admin only | Mobile: full add/edit/delete/reorder during create/edit. Web: rules are only manageable app-wide/by-category via admin (`admin-rules.tsx`), no per-bubble rule editing |
| Bubble details view | ✅ | 🟡 | Web has Details/Events/Bulletin tabs; "Attachments" section is a permanent stub ("No attachments yet") |
| Join / Leave / Request / Waitlist | ✅ | ✅ | Both wired to real APIs; web's join flow requires tapping through rules like mobile |
| Members list | 📱 (real) | ⚠️ | **Web members list is hardcoded fake seed data**, not fetched from the API — only the member *count* elsewhere is real |
| Member management (DM/promote/demote/remove/report) | ✅ (mobile, wired) | ⚠️ | Web has the kebab menu UI but **no onClick handlers are wired** — pure stub |
| Waitlist management | ✅ | ✅ | Both have admin approve/reject; web's lives in `admin-pending.tsx` rather than per-bubble |
| Bulletin board (view) | ✅ | ✅ | |
| Bulletin board (create/react) | 📱 | ⚠️ | Web's "New Post" button and reaction button render with no handlers |
| Share / QR code | ✅ | 🟡 | Mobile renders a real scannable QR; web's "QR Code" menu item just copies the URL to clipboard (mislabeled) |
| Report bubble / concern | ✅ (mobile, wired to `apiService.submitReport`) | ⚠️ | Web's report modal shows a fake "sent" success after a timeout — **no API call is made** |
| Campus-only bubbles | 📱 | — | No web equivalent |

**Status: 🟡 Partial, with significant stubs.** Browse/create/join work on web; nearly everything else in this area (members, bulletin authoring, editing, reporting) is a non-functional facade.

---

## 3. Events

| Capability | Mobile | Web | Notes |
|---|---|---|---|
| Create event | ✅ | 🟡 | Mobile: 4-step wizard with recurrence, cover image, campus/environment tags, attendee limit, RSVP deadline. Web: single-step form — no recurrence, no cover image, no tags, no RSVP deadline |
| Edit event | 📱 | — | No edit route/page exists on web |
| Standalone event details page | 📱 | — | Web has no dedicated event page; events only appear as list rows inside a bubble's Events tab or as cards in Explore/Upcoming |
| RSVP (Going / Not Going) | 📱 | — | **No RSVP button or mutation exists anywhere in `client/src`** — confirmed by grep. The "Your RSVPs" section on Upcoming can only reflect state set elsewhere (e.g. mobile) |
| Volunteer sign-up tasks | 📱 | — | No web equivalent at all |
| Event participants management | 📱 | — | No web equivalent |
| Static map / directions | 📱 | — | No web equivalent |
| Share event | ✅ | ✅ | |
| Report event | ✅ (mobile, wired) | ⚠️ | Same non-functional stub as bubble reports |

**Status: 📱 Mobile-heavy.** Web can create and browse events but a user cannot RSVP, edit, manage participants, or use volunteer tasks from the browser at all.

---

## 4. Messaging / Chat

| Capability | Mobile | Web | Notes |
|---|---|---|---|
| Group chat (per bubble) | ✅ | ✅ | Both use CometChat; real-time text works on both |
| 1:1 direct messages | 📱 | — | Web has "Direct Message" menu entries elsewhere but no DM implementation exists — CometChat is wired for bubble groups only |
| Admin/contact DMs | 📱 | — | No web equivalent |
| Image/photo messages | 📱 | ⚠️ | Web shows a "Photo upload coming soon" toast |
| Reactions | 📱 | ⚠️ | Web shows a toast, no CometChat reaction API call |
| Delete / edit / star message | 📱 | ⚠️ | Web deletes/stars locally only; "edit" actually sends a new message since the composer never reads the edit id |
| Voice / video calls | — | ⚠️ | Web shows a toast only; neither platform report found real calling — confirm before assuming mobile has this |
| Reply threading | ✅ | ✅ | |
| Presence (online/last-seen) | 📱 | — | No web equivalent |
| Chat info actions (mute, search, view members, leave) | 📱 | ⚠️ | Web sheet items just close the sheet |

**Status: 🟡 Partial.** Core group text messaging works on both; DMs, media, reactions, message management, and calling are mobile-only or stubbed on web.

---

## 5. Bulletin Board / Posts

| Capability | Mobile | Web |
|---|---|---|
| View posts | ✅ | ✅ |
| Create post | 📱 | — |
| Pin/unpin, edit, delete | 📱 | — |
| Reactions | 📱 | ⚠️ (button renders, no handler) |
| Threaded replies | 📱 | — |

**Status: 📱 Mobile-only for authoring.** Web is read-only, embedded as a tab inside `bubble-details.tsx` rather than a standalone feature.

---

## 6. Profile & Account

| Capability | Mobile | Web | Notes |
|---|---|---|---|
| View own profile | ✅ | ✅ | |
| Edit name/bio | ✅ | ✅ | |
| Edit profile photo | ✅ | ⚠️ | Web's "Change photo" button has no handler despite the page subtitle claiming photo is editable |
| Edit interests (post-signup) | 📱 | — | No UI for this on web at all |
| View another member's profile | 📱 | — | No web equivalent (only reachable via the fake members list anyway) |
| Notification preferences | ✅ (real, persisted, offline-cached) | ⚠️ | Web toggles are local React state only — no save button, no API call, lost on reload |
| Privacy settings | ✅ (mobile UI present, backend wiring unclear per mobile report) | ⚠️ | Web toggles are local-state only, same as notifications |
| Account deactivation | 📱 | — | Mobile has a real 2-step flow calling `DELETE /api/auth/delete-account`; no web equivalent |
| Data export / deletion request (GDPR-style) | 📱 | — | No web equivalent |
| Admin/system info panel | 📱 (superadmin) | — | Mobile-only dev utility |

**Status: 🟡 Partial, with a misleading gap.** Web's Notification and Privacy "settings" pages give the impression of a persisted save but do nothing — worth prioritizing since it's a trust issue, not just a missing feature.

---

## 7. Admin / Moderation

| Capability | Mobile | Web | Notes |
|---|---|---|---|
| Pending bubble/event approval | ✅ | ✅ | Both wired to real approve/reject mutations |
| Reports queue | ✅ (resolve/dismiss actions) | 🟡 | Web's Reports tab is **read-only** — no resolve/dismiss action, unlike mobile |
| Waitlist approval | ✅ | ✅ | |
| Manage rules (app + category) | ✅ | ✅ | Parity |
| Category placeholder text (example copy shown during bubble creation) | 📱 | — | No web equivalent |
| Full category management (create/edit/reparent/delete, image upload) | — | 🌐 | Web-exclusive and more capable than mobile's placeholder-only screen |
| System Monitor (health, memory, DAU/MAU, retention, integrations) | — | 🌐 | Web-exclusive, no mobile equivalent |
| Latency dashboard (per-endpoint p50/95/99, sparklines) | 📱 (simpler: Slow-Call Trends charts) | 🌐 (richer: sortable table + trend charts) | Web is more capable here |
| Slow-call log + config | ✅ (charts) | ✅ (table + editable config) | Roughly at parity, different presentation |
| Error log | 📱 | — | Mobile-only (in-memory server error buffer viewer) |
| Span/performance health | 📱 | — | Mobile-only, client-side screen-load instrumentation |

**Status: 🌐 Web-heavier.** This is the one area where web is ahead — System Monitor and the Latency dashboard have no mobile equivalent — but web's Reports queue is a step behind mobile's (view-only vs. actionable).

---

## 8. Help & Support

| Capability | Mobile | Web |
|---|---|---|
| Help Center hub | 📱 | — |
| Give Feedback / Feature Request / Defect Report | 📱 | — |
| Generic "Report a Concern" form | 📱 | — |
| In-context report (on bubble/event/member) | ✅ wired to `apiService.submitReport` | ⚠️ facade only |

**Status: 📱 Mobile-only.** Web has no dedicated help/feedback surface at all. The one web analog — in-context report modals — is the *opposite* of mobile: on mobile it's the functional pathway, on web it's a fake-success stub. Web's "Get Help" nav link simply opens the Terms of Service page.

---

## 9. Notifications

| Capability | Mobile | Web |
|---|---|---|
| Push notifications | 📱 (Expo push, tap-routing/deep-links) | — |
| In-app notification inbox/feed | 📱 | — |
| Unread badges | 📱 | — |
| Preference persistence | ✅ | ⚠️ facade (see §6) |

**Status: 📱 Mobile-only.** Notifications are effectively a mobile-exclusive feature area; web has no delivery mechanism and no feed.

---

## 10. Camera / Media Capture

| Capability | Mobile | Web |
|---|---|---|
| Live camera capture | 📱 (`expo-image-picker`, camera or library choice, custom permission pre-prompt) | — |
| File-picker upload | ✅ | ✅ |
| Permission gating | 📱 (asks once, redirects to OS Settings on repeat denial) | n/a — no camera code path exists to gate |

**Status: 📱 Mobile-only — and currently a hard gap, not a bug.** A full-repo grep of `client/src` for `getUserMedia`, `mediaDevices`, and `camera` found no live-capture code at all; every "camera" icon on web (bubble hero photo, profile-edit "change photo") is either decorative/non-functional or triggers a plain `<input type="file">`. This is the relevant context for the current camera capability-detection task: it's building new web functionality, not repairing a broken existing path.

---

## 11. Web-only surfaces

| Page | Purpose |
|---|---|
| `mobile-qr.tsx` (`/mobile`, `/qr-code`) | Drives app installs via a QR code linking to an Expo `exp://` deep link — dev/testing utility |
| `legal.tsx` (`/legal/:page`) | Static ToS/Privacy/Community Guidelines — mobile has equivalent static screens |
| `home.tsx` | **Dead code** — not routed anywhere in `App.tsx`; a legacy marketing page over fake seed data. Excluded from all counts above |

---

## How to keep this current

Regenerate the two source inventories rather than hand-editing this table when either app changes meaningfully:
1. Re-read `mobile/src/screens/**` (auth + main) and `mobile/src/navigation/**`.
2. Re-read `client/src/pages/**`, `client/src/App.tsx` (route wiring), and `client/src/components/**`.
3. Re-diff against the tables above, especially the ⚠️ facade rows — those are the ones most likely to silently regress or silently get "fixed" without anyone updating this doc.
