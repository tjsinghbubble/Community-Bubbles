# E2E Test Descriptions

This document describes E2E tests to write — no code yet. Each test is described by what it
does, what it verifies, what data it needs, and what can go wrong. Organised by surface area.

---

## Frameworks

| Surface | Framework | Why |
|---|---|---|
| **Mobile** | [Maestro](https://maestro.mobile.dev) | YAML-based flows, works with Expo dev builds out of the box, no native code changes, runs on real devices and CI |
| **Server API** | Playwright (API mode) or supertest | Playwright can test full HTTP flows end-to-end against a running server; supertest already in use |
| **Analytics Dashboard** | Playwright | Browser-based, same framework as API tests, screenshots on failure |

Maestro flows live in `mobile/maestro/`. Playwright tests live in `server/__tests__/e2e/` (directory exists, currently empty).

---

## Mobile E2E (Maestro)

Each Maestro flow is a YAML file that drives the app on a simulator or physical device.
Test data uses a dedicated seed account (`e2e-test@trybubble.io`) reset before each run.

---

### AUTH-01: New user signup — happy path

**File:** `mobile/maestro/auth/signup.yaml`

**Preconditions:** App freshly installed or logged out. Test email does not exist in DB.

**Steps:**
1. App opens to WelcomeScreen
2. Tap "Sign Up"
3. Tap the avatar placeholder → photo picker appears → dismiss (skip photo)
4. Fill "Legal name" → `Test User E2E`
5. Tap Gender → select "Prefer not to say" → confirm
6. Tap Date of birth → navigate to year 1995, month June, day 15 → confirm
7. Fill Email → `e2e-signup-{timestamp}@trybubble.io`
8. Fill Password → `TestPass123!`
9. Tap "Terms of Service" link → TermsOfService screen opens → go back
10. Tap "Privacy Policy" link → PrivacyPolicy screen opens → go back
11. Check the terms checkbox (only enabled after both links visited)
12. Tap "Agree & Continue"
13. EmailVerificationScreen appears with 6 digit input
14. Enter the 6-digit code from the test inbox (or seeded code in test mode)
15. InterestsScreen appears
16. Tap "Running", "Cooking", "Yoga" (3 minimum)
17. Tap "Continue" (button becomes active after 3 selections)
18. GuidelinesScreen appears
19. Tap "I Agree"
20. App navigates to Explore tab (main app)

**Verifies:**
- Full onboarding flow completes without error
- `Continue` stays disabled with fewer than 3 interests selected
- User lands on Explore, not back at Welcome

**Test data needed:** Unique email per run, test verification code delivery or seeded bypass

---

### AUTH-02: Login — happy path

**File:** `mobile/maestro/auth/login.yaml`

**Preconditions:** Account `e2e-test@trybubble.io` / `TestPass123!` exists and is verified.

**Steps:**
1. App opens to WelcomeScreen
2. Tap "Log In"
3. Fill Email → `e2e-test@trybubble.io`
4. Fill Password → `TestPass123!`
5. Tap "Log In"
6. App navigates to Explore tab

**Verifies:**
- Correct credentials → authenticated state
- App does not hang on loading spinner
- Bottom tabs visible after login

---

### AUTH-03: Login — wrong password

**File:** `mobile/maestro/auth/login-wrong-password.yaml`

**Preconditions:** Account exists.

**Steps:**
1. Navigate to LoginScreen
2. Fill Email → `e2e-test@trybubble.io`
3. Fill Password → `WrongPassword1`
4. Tap "Log In"
5. Error message appears: "Invalid credentials"
6. Fields remain filled (email stays, password clears)
7. "Log In" button is active again

**Verifies:**
- Invalid credentials show error without crashing
- User stays on login screen
- Can retry

---

### AUTH-04: Login — rate limit

**File:** `mobile/maestro/auth/login-rate-limit.yaml`

**Preconditions:** Account exists. Fresh rate-limit state.

**Steps:**
1. Navigate to LoginScreen
2. Fill Email → `e2e-test@trybubble.io`
3. Fill Password → `Wrong1` → Tap Log In → repeat 5 times
4. On 5th attempt: response changes to "Account temporarily locked"
5. Correct password attempt also fails with same message

**Verifies:**
- Rate limit activates after 5 failed attempts
- Lock persists even with correct password
- Error message is clear to user

---

### AUTH-05: Logout

**File:** `mobile/maestro/auth/logout.yaml`

**Preconditions:** Logged in as `e2e-test@trybubble.io`.

**Steps:**
1. Tap Profile tab
2. Tap "Account Settings"
3. Scroll to "Log Out"
4. Tap "Log Out"
5. Confirm in dialog
6. App returns to WelcomeScreen

**Verifies:**
- Token is invalidated (subsequent API calls would fail)
- App state clears (no stale user data visible)
- WelcomeScreen is shown

---

### BUBBLE-01: Browse and join a public bubble

**File:** `mobile/maestro/bubbles/join-public-bubble.yaml`

**Preconditions:** Logged in. At least one approved, public bubble exists: `E2E Test Bubble`.

**Steps:**
1. Land on Explore tab, "Bubbles" tab selected
2. See bubble list — `E2E Test Bubble` is visible
3. Tap the bubble card
4. BubbleDetails screen opens
5. See title, tagline, member count
6. "Join Bubble" button is visible
7. Tap "Join Bubble"
8. Button state changes to "Leave Bubble" (or pending if request-to-join)
9. Navigate back to Explore
10. Tap MyBubbles tab
11. `E2E Test Bubble` appears in the list

**Verifies:**
- Explore list loads and is scrollable
- Bubble details screen shows correct data
- Join action reflects immediately in UI
- Bubble appears in MyBubbles after joining

---

### BUBBLE-02: Create a bubble

**File:** `mobile/maestro/bubbles/create-bubble.yaml`

**Preconditions:** Logged in as a regular user.

**Steps:**
1. Tap Explore tab
2. Tap the "+" / Create button
3. CreateBubbleScreen appears at Step 1
4. Select a category → "Social"
5. Fill Title → `E2E Bubble {timestamp}`
6. Fill Tagline → `Created by E2E test`
7. Fill Description → `This bubble was created by an automated test.`
8. Tap "Next" → Step 2 (Bubble Details)
9. Skip image upload
10. Tap "Next" → Step 3 (Rules)
11. Skip adding rules
12. Tap "Next" → Step 4 (Privacy & Settings)
13. Privacy → "Public"
14. Tap "Next" → Step 5 (Preview)
15. Tap "Create"
16. Success state: bubble created, shown in pending state

**Verifies:**
- 5-step form navigates forward and back correctly
- "Next" is blocked if required fields empty (title, category)
- Bubble is created and visible in "My Bubbles" in a pending/submitted state
- No crash on submission

---

### BUBBLE-03: Leave a bubble

**File:** `mobile/maestro/bubbles/leave-bubble.yaml`

**Preconditions:** Logged in. User is already a member of `E2E Test Bubble`.

**Steps:**
1. Navigate to `E2E Test Bubble` via MyBubbles or Explore
2. BubbleDetails shows "Leave Bubble" button
3. Tap "Leave Bubble"
4. Confirmation dialog appears
5. Confirm leave
6. Button reverts to "Join Bubble"
7. Navigate to MyBubbles tab
8. `E2E Test Bubble` no longer in list

**Verifies:**
- Leave requires confirmation (no accidental leave)
- UI state updates immediately
- Bubble removed from MyBubbles

---

### EVENT-01: Create an event inside a bubble

**File:** `mobile/maestro/events/create-event.yaml`

**Preconditions:** Logged in. User is member/admin of `E2E Test Bubble`.

**Steps:**
1. Navigate to BubbleDetails for `E2E Test Bubble`
2. Tap "Create Event" (visible on Events tab or FAB)
3. CreateEventScreen appears at Step 1
4. Bubble is pre-selected
5. Fill Title → `E2E Event {timestamp}`
6. Fill Description → `Test event description`
7. Tap "Next" → Step 2 (Date & Location)
8. Tap date field → pick tomorrow's date
9. Set start time → 2:00 PM
10. Set end time → 4:00 PM
11. Location → tap "TBD" toggle (skip location picker)
12. Tap "Next" → Step 3 (Privacy & Settings)
13. Visibility → "Public"
14. Tap "Next" → Step 4 (Review & Publish)
15. Tap "Publish"
16. Event appears in EventDetails or returns to bubble

**Verifies:**
- 4-step form navigates correctly
- End time cannot precede start time
- Event is created and visible in the bubble's event list
- No crash on multi-step navigation

---

### EVENT-02: RSVP to an event

**File:** `mobile/maestro/events/rsvp-event.yaml`

**Preconditions:** Logged in. Approved event `E2E Public Event` exists in an accessible bubble.

**Steps:**
1. Navigate to Upcoming tab
2. `E2E Public Event` is visible
3. Tap the event card
4. EventDetails screen opens
5. See title, date, location, attendee count (e.g. "3 attending")
6. Tap "RSVP"
7. Button changes to "Cancel RSVP" / "Going"
8. Attendee count increments by 1
9. Tap the attendee count / "View Participants"
10. User appears in the attendees list

**Verifies:**
- Event details load correctly
- RSVP action reflects in real time
- Attendee count is accurate
- User appears in participant list after RSVP

---

### EVENT-03: Cancel RSVP

**File:** `mobile/maestro/events/cancel-rsvp.yaml`

**Preconditions:** Logged in. User has already RSVP'd to `E2E Public Event`.

**Steps:**
1. Navigate to EventDetails for `E2E Public Event`
2. Button shows "Cancel RSVP" / "Going"
3. Tap "Cancel RSVP"
4. Confirmation appears (if applicable)
5. Button reverts to "RSVP"
6. Attendee count decrements by 1

**Verifies:**
- RSVP cancellation reflects immediately
- Count is accurate after cancel

---

### EVENT-04: Share an event

**File:** `mobile/maestro/events/share-event.yaml`

**Preconditions:** Logged in. `E2E Public Event` has a `shortId` (generated on create).

**Steps:**
1. Navigate to EventDetails for `E2E Public Event`
2. Tap the Share button (top-right header icon or in menu)
3. Native share sheet appears
4. Share message contains text like: `Check out "E2E Public Event" on Bubble! https://trybubble.io/e/abc123`
5. URL contains `/e/` followed by a short alphanumeric ID
6. Cancel share sheet

**Verifies:**
- Share sheet opens without crash
- URL is well-formed (contains `/e/` + shortId, not the full event title or UUID)
- Does not fall back to base URL when shortId exists

---

### EVENT-05: Open event via deep link

**File:** `mobile/maestro/events/deep-link-event.yaml`

**Preconditions:** App installed. Known shortId `e2etest1` exists in DB for a test event. App may or may not be logged in.

**Steps:**
1. Trigger deep link: `bubble://e/e2etest1` (via `adb shell am start` on Android or `xcrun simctl openurl` on iOS)
2. If not logged in: app opens to WelcomeScreen, shortId is stored as pending
3. Log in with test credentials
4. After login: app navigates automatically to EventDetails for `e2etest1`
5. If already logged in: app navigates directly to EventDetails

**Verifies:**
- Deep link is parsed and matched (`/e/:shortId` pattern)
- Pending deep link fires after login
- Correct event is shown for the given shortId
- No crash if shortId does not exist (graceful 404 handling)

---

### ADMIN-01: Super admin approves a pending bubble

**File:** `mobile/maestro/admin/approve-bubble.yaml`

**Preconditions:** Logged in as `e2e-admin@trybubble.io` (super admin). At least one bubble in pending state.

**Steps:**
1. Tap Profile tab
2. Pending reviews badge visible (count > 0)
3. Tap "Pending Reviews" (or navigate via AdminDashboard)
4. PendingReviewsScreen shows a pending bubble
5. Tap the bubble entry
6. Review details
7. Tap "Approve"
8. Bubble disappears from pending list
9. Badge count decrements

**Verifies:**
- Super admin can see pending reviews
- Approval action removes item from queue
- Regular user account does NOT see this screen

---

### ADMIN-02: Super admin rejects a pending event

**File:** `mobile/maestro/admin/reject-event.yaml`

**Preconditions:** Logged in as super admin. At least one event in pending state.

**Steps:**
1. Navigate to Pending Reviews
2. Tap a pending event
3. Tap "Reject"
4. Rejection reason input appears
5. Fill reason → "Does not meet community guidelines"
6. Confirm rejection
7. Event disappears from pending list

**Verifies:**
- Rejection requires a reason
- Event removed from queue after rejection
- Creator would receive notification (verified via server-side test)

---

### NOTIFY-01: Notification badge and mark as read

**File:** `mobile/maestro/notifications/mark-read.yaml`

**Preconditions:** Logged in as user who has at least one unread notification.

**Steps:**
1. Profile tab shows a badge with unread count
2. Tap Profile tab
3. Tap Notifications entry
4. Notifications list shows unread items (highlighted)
5. Tap a notification
6. Notification is marked read (highlight removed)
7. Navigate back
8. Unread count decremented or badge cleared

**Verifies:**
- Unread count displays correctly
- Reading a notification marks it read
- Badge updates without requiring app restart

---

### CAMPUS-01: Campus email verification

**File:** `mobile/maestro/campus/verify-campus-email.yaml`

**Preconditions:** Logged in. User has not yet verified a campus email. A campus exists for `testuniversity.edu`.

**Steps:**
1. Explore screen shows campus prompt banner
2. Tap "Verify your campus email"
3. CampusJoin screen opens
4. Fill campus email → `student@testuniversity.edu`
5. Tap "Send Verification Code"
6. CampusVerify screen opens (6-digit input)
7. Enter code from test inbox
8. Success: campus badge/filter appears on Explore
9. Campus-specific bubbles appear

**Verifies:**
- Campus verification flow completes end-to-end
- Campus bubbles are shown after verification
- Prompt dismisses after successful verification

---

## Server API E2E (Playwright)

Run against a live server pointed at a test database. Each test suite seeds its own data and tears it down.

---

### API-01: Full auth lifecycle

**File:** `server/__tests__/e2e/auth.e2e.ts`

**Sequence:**
1. `POST /api/auth/signup` with valid payload → `201`, returns `{ token, user }`
2. `POST /api/auth/send-verification` → `200`
3. `POST /api/auth/verify-code` with correct code → `200`, user marked verified
4. `POST /api/auth/login` with those credentials → `200`, returns new token
5. `GET /api/auth/me` with token → `200`, returns user object
6. `POST /api/auth/logout` → `200`
7. `GET /api/auth/me` with invalidated token → `401`

**Verifies:** Token lifecycle, verification requirement, logout invalidation

---

### API-02: Bubble CRUD and member count

**File:** `server/__tests__/e2e/bubbles.e2e.ts`

**Sequence:**
1. Create user A and user B, log both in
2. User A: `POST /api/bubbles` → `201`, bubble in pending state
3. Super admin: `POST /api/admin/bubbles/:id/approve` → `200`
4. User B: `POST /api/bubbles/:id/join` → `200`
5. `GET /api/bubbles/:id` → `members` count is 2
6. User B: `POST /api/bubbles/:id/leave` → `200`
7. `GET /api/bubbles/:id` → `members` count is 1
8. User A: `DELETE /api/bubbles/:id` → `200`
9. `GET /api/bubbles/:id` → `404`

**Verifies:** Full bubble lifecycle, atomic member count accuracy, approval gate, cascade delete

---

### API-03: Event short ID and share link resolution

**File:** `server/__tests__/e2e/event-share.e2e.ts`

**Sequence:**
1. Create and approve a bubble
2. `POST /api/events` → `201`, response contains `shortId` (non-null, 8 chars)
3. Approve the event
4. `GET /api/events/short/:shortId` → `200`, returns event with bubble
5. `GET /e/:shortId` → `200`, HTML response with OG tags:
   - `og:title` contains event title
   - `og:description` contains event description
   - HTML body contains `bubble://e/:shortId` deep link
6. `GET /api/events/short/doesnotexist` → `404`
7. `GET /e/doesnotexist` → `404` HTML page (not a crash)

**Verifies:** shortId generated on create, JSON API and HTML landing page both resolve correctly, 404 handled gracefully

---

### API-04: Bubble short ID and share link resolution

**File:** `server/__tests__/e2e/bubble-share.e2e.ts`

**Sequence:**
1. Create and approve a bubble
2. `GET /api/bubbles/short/:shortId` → `200`, returns bubble data
3. `GET /b/:shortId` → `200`, HTML with OG tags and `bubble://b/:shortId` deep link
4. `GET /b/doesnotexist` → `404`

**Verifies:** Same pattern as event share, for bubbles

---

### API-05: Rate limiting on auth endpoints

**File:** `server/__tests__/e2e/rate-limit.e2e.ts`

**Sequence:**
1. `POST /api/auth/login` with wrong password × 5 → each returns `401`
2. 6th attempt with wrong password → `429`, body contains "locked"
3. 7th attempt with correct password → still `429`
4. Reset rate limit (wait or clear via test helper)
5. `POST /api/auth/send-verification` × 6 → 6th returns `429`

**Verifies:** Login lock triggers at 5 attempts, lock applies to correct password too, send-verification has separate rate limit

---

### API-06: Admin access control

**File:** `server/__tests__/e2e/admin-access.e2e.ts`

**Sequence:**
1. Regular user token: `GET /api/admin/stats` → `403`
2. Regular user token: `GET /api/admin/pending-bubbles` → `403`
3. Super admin token: `GET /api/admin/stats` → `200`
4. Super admin token: `GET /api/admin/pending-bubbles` → `200`
5. No token: `GET /api/admin/stats` → `401`

**Verifies:** Admin endpoints are not accessible to regular users or unauthenticated requests

---

### API-07: RSVP and attendee count

**File:** `server/__tests__/e2e/rsvp.e2e.ts`

**Sequence:**
1. Create user A (event creator), user B (attendee)
2. Create bubble, approve, user B joins bubble
3. User A: `POST /api/events` → create event
4. Approve event
5. User B: `POST /api/events/:id/rsvp` → `200`
6. `GET /api/events/:id/attendees` → user B appears
7. User B: `DELETE /api/events/:id/rsvp` → `200`
8. `GET /api/events/:id/attendees` → user B absent
9. User B RSVP again → concurrent RSVP from user C → both succeed, count is accurate

**Verifies:** RSVP/unRSVP lifecycle, attendee list accuracy, no double-RSVP

---

### API-08: Universal links files are served

**File:** `server/__tests__/e2e/deep-link-files.e2e.ts`

**Sequence:**
1. `GET /.well-known/apple-app-site-association` → `200`, `Content-Type: application/json`
2. Response body is valid JSON with `applinks.apps` array containing bundle ID `io.bubble.app`
3. `GET /.well-known/assetlinks.json` → `200`, `Content-Type: application/json`
4. Response body is valid JSON array with `target.package_name = "com.bubble.mobile"`

**Verifies:** Deep link verification files are served correctly so iOS/Android can verify the domain association

---

## Analytics Dashboard E2E (Playwright)

Run against a Playwright-controlled Chromium browser pointed at the local analytics dashboard.

---

### DASH-01: Dashboard loads and shows metrics

**File:** `app/e2e/dashboard.e2e.ts`

**Preconditions:** Server running, at least one session + bubble + event in DB.

**Steps:**
1. Navigate to dashboard URL
2. Metrics cards appear: Total Users, Total Bubbles, Total Events, Total Sessions
3. Retention row shows Day 1, Day 7, Day 30 values (may be 0% in test env)
4. DAU/MAU charts render (Recharts SVG elements present in DOM)
5. Session length chart renders

**Verifies:**
- Dashboard renders without JS error
- All stat cards present
- Charts render (SVG exists, not blank)

---

### DASH-02: Dashboard handles API failure gracefully

**File:** `app/e2e/dashboard-error.e2e.ts`

**Preconditions:** Server is stopped or `/api/analytics/metrics` returns 500.

**Steps:**
1. Navigate to dashboard URL
2. Loading state appears initially
3. Error message or empty state appears (not a blank white screen or console error crash)

**Verifies:**
- UI degrades gracefully on API failure
- No unhandled JS exceptions thrown

---

## Test Data Strategy

All E2E tests rely on a set of seeded accounts and content that are reset before each run.

| Fixture | Value | Purpose |
|---|---|---|
| Regular user | `e2e-test@trybubble.io` / `TestPass123!` | Standard user flows |
| Super admin | `e2e-admin@trybubble.io` / `TestPass123!` | Admin approval flows |
| Approved bubble | `E2E Test Bubble` (shortId: `e2etest0`) | Existing bubble flows |
| Approved event | `E2E Public Event` (shortId: `e2etest1`) | RSVP and share flows |
| Campus | `testuniversity.edu` → mapped to a test campus | Campus verification |

The seed script at `scripts/seed-e2e.ts` (to be created) inserts this data and is called:
- Before the full E2E suite in CI
- Manually with `npm run seed:e2e` in local dev

---

## CI Integration

Maestro flows run on EAS — add to `.github/workflows/eas-preview.yml`:

```yaml
- name: Run Maestro E2E
  run: maestro cloud --apiKey ${{ secrets.MAESTRO_API_KEY }} mobile/maestro/
```

Playwright tests run on every PR against a test server:

```yaml
- name: Run API E2E tests
  run: npx playwright test server/__tests__/e2e/
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    JWT_SECRET: test-secret-not-for-production
```

---

## What to Implement First (priority order)

| # | Test | Value | Effort |
|---|---|---|---|
| 1 | `API-03` Event share link resolution | High — core new feature | Low |
| 2 | `API-04` Bubble share link resolution | High — same pattern | Low |
| 3 | `API-01` Full auth lifecycle | High — foundational | Medium |
| 4 | `API-05` Rate limiting | High — security | Low |
| 5 | `API-06` Admin access control | High — security | Low |
| 6 | `API-08` Universal links files served | Medium — needed for deep links | Low |
| 7 | `BUBBLE-01` Browse and join (Maestro) | High — primary user journey | Medium |
| 8 | `EVENT-02` RSVP (Maestro) | High — primary user journey | Medium |
| 9 | `EVENT-04` Share event (Maestro) | High — tests new feature | Medium |
| 10 | `EVENT-05` Deep link opens event (Maestro) | High — tests new feature | Medium |
| 11 | `AUTH-01` Full signup (Maestro) | Medium — slow to run, complex setup | High |
| 12 | `DASH-01` Dashboard renders | Low — internal tool | Low |
