# Testing Mocks

Mocks/test doubles required before certain use cases (from `docs/use-cases-and-tests.tsv`)
can be automated. Use cases listed here were **removed from the current smoke-test candidate
list** until their mock exists. Companion to `tests/TAXONOMY.md`.

Last updated: 2026-06-12 (smoke-test cycle 2).

## 1. Email capture (outbound mail interceptor)

The test server must deliver mail somewhere a test can read it — a local SMTP sink
(e.g. Mailpit) or a test-only API/DB read of `verification_codes` and reset tokens.
The flow under test needs the **link/code out of the message body**, so a stub that
swallows mail is not enough.

| Use case (TSV row) | Needs |
|---|---|
| Reset or change password (row 4, P1 smoke, negative flagged) | reset URL/token from the email |
| Enter verification code received by email — campus mode (rows 108–110) | the emailed code |
| See prompt / enter .edu email (rows 107–108) | delivery assertion |
| Signup verification (`/api/auth/send-verification`) | code capture; also unblocks deeper sec-0110 follow-ups |

Note: codes live in the `verification_codes` table — a DB-read fixture may be enough for
headless tests without standing up an SMTP sink. The e2e (UI) variant needs the real email
rendered only if we test the mail content itself; otherwise DB-read is the cheap path.

## 2. CometChat responder / sandbox

Chat flows call the external CometChat API (`ensureCometChatUser`, `ensureCometChatGroup`,
`addMemberToGroup`). Tests need either a CometChat sandbox app with seeded peers, or a
local fake of the CometChat REST surface plus a scripted "responder" account that answers
messages so two-way dialogue can be asserted.

| Use case (TSV row) | Needs |
|---|---|
| Participate in bubble group chat (row 23, P1 smoke) | send + receive in a group |
| Contact members via in-app messaging — admin (row 64, P1 smoke, 2-accounts) | DM thread, second party |
| All Communication-area rows (96–106, unranked) | same |
| ** inappropriate language (row 98) | responder + moderation hook |

## 3. Media/photo fixture (simulator photo library + object storage)

Upload flows need (a) a deterministic image in the simulator photo library
(`xcrun simctl addmedia` during run setup, photo-permission auto-grant) and (b) the object
storage backend reachable from the test server (or a local-disk storage fake).

| Use case (TSV row) | Needs |
|---|---|
| Upload event photos (row 38, P1 smoke) | photo library fixture + storage |
| Edit profile photo (row 6, P2) | same |
| Upload bubble cover image / additional photos (rows 68–69, re-ranked 2/3) | same |

## 4. Approval auto-approve (seed/API actor — already available, documented for completeness)

Bubbles are created `status='pending'` and need super-admin approval. Tests do **not**
need a mock here: the seeded `role-site-admin` account approves via the real API
(pattern: `tests/headless/site-admin/site-admin-0100`), and seed-time fixtures insert
pre-approved bubbles directly. Events default to `status='approved'`, so no gate at all.
Use cases relying on this (request-to-join setup, RSVP setup) stay **in** the candidate
list.

## 5. Push-notification capture

Real APNs/FCM delivery can't be asserted locally. Needs either a fake push transport on
the server (record-instead-of-send) or assertion at the in-app notification list level
only (which the API already exposes — partial coverage without a mock).

| Use case (TSV row) | Needs |
|---|---|
| Notifications area rows 112–117 (unranked) | push transport capture |
| Receive join-request / approval notifications (rows 112, 115) | same |

## 6. Share-sheet / pasteboard inspection

Native share sheet and QR-code flows end outside the app; Maestro cannot assert the share
target. Needs pasteboard inspection (copy-link variant) or stopping at "share sheet
visible".

| Use case (TSV row) | Needs |
|---|---|
| Share bubble via QR / share sheet / copy short link (rows 25, 66, 75–77) | pasteboard read or sheet-visible-only assert |

---

## Candidates removed from the current cycle because of the above

- Reset or change password (row 4) — mock 1
- Participate in bubble group chat (row 23) — mock 2
- Contact members via in-app messaging (row 64) — mock 2
- Upload event photos (row 38) — mock 3
