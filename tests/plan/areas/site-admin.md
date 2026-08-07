# Site Admin (tag: site-admin)

- source: docs/use-cases-and-tests.tsv rows 82–95
- default layer: **headless** (approval pipeline + platform-wide CRUD are API-observable;
  this is the cheap, reliable engine). e2e for the admin-pages-render smoke.
- mocks in play: none for the core pipeline.

This area overlaps several others. Author the **site-admin-unique** behaviors here
(approval pipeline, super-reach, admin-page authz) and **de-dup** the rest by pointing at
its home area. The positive approve-bubble pipeline is already done (site-admin-0100).

## Dedup map (do NOT author here — point at the home area)
- UC 13 manage app-wide rules → `rules` area (UC 80–83)
- UC 14 category-level rules → `rules` area (UC 84–85)
- UC 15 category hierarchy → `categories` area
- UC 16 health dashboard / UC 17 growth metrics → `monitoring` area (UC 98–99)
- UC 18 manage waitlist → `reports` area (UC 110)
- UC 19 review reported content → `reports` area (UC 111)
- UC 63 sign in → `auth` UC 182 (done, auth-0100)
- UC 65 negative login → `auth` UC 182 neg (done, auth-0110)

## UC 10 — Approve OR reject bubble submissions (with rejection reason)   [pos done; reject todo · headless]
- roles: role-site-admin.
- positive (approve): DONE — site-admin-0100 (submit → pending → approve → publicly
  visible).
- negative / sibling (**reject**): the unfilled half. Submit a disposable bubble → admin
  rejects it **with a written reason** → bubble reads back `rejected` + the reason is
  stored; it does NOT become publicly visible. Also: a non-super-admin cannot approve or
  reject (authz). This reject path is the high-value gap here (UC 69 below is the same
  thing under the bubble-admin area — author once, cross-reference).
- fixtures: **2-actor** — bubble-admin creates+submits, site-admin rejects. Copy
  site-admin-0100's structure.

## UC 11 — Approve or reject events   [todo · headless]
- roles: role-site-admin.
- positive: an event needing approval is approved → becomes visible. NOTE: events default
  to `status='approved'` (per Testing_Mocks §4) — confirm whether an approval gate exists
  at all; if events are auto-approved, mark the positive `review` and focus on the reject
  path or a config that forces pending.
- negative: non-super-admin cannot approve/reject an event.
- fixtures: 2-actor; may need an event forced to `pending`.

## UC 12 — Edit or delete ANY bubble or event on the platform   [todo · headless]
- roles: role-site-admin (super-reach beyond ownership — this is the distinguishing power).
- positive: site-admin edits/deletes a bubble they do NOT own → succeeds (where a non-owner
  bubble-admin would be denied — that denial is sec-0200's job).
- negative: a non-super-admin attempting the same cross-owner edit/delete is denied
  (overlaps sec-0200; keep the positive super-reach here, reference sec-0200 for the
  denial).
- fixtures: a disposable bubble owned by the bubble-admin role; site-admin acts on it.

## UC 20 — Access all admin pages   [todo · e2e or headless]
- roles: role-site-admin.
- positive: every admin route/page loads for the super admin (a coverage sweep — pairs with
  the affordance idea in sec-0300). Headless: each admin GET returns 200 for site-admin.
- negative: every one of those routes is denied to role-user AND role-bubble-admin — this
  is essentially what sec-0200's authz matrix already proves. **De-dup with sec-0200**;
  here, focus the positive (super admin CAN reach them all) + a coverage guard that no admin
  route is missing from the matrix.

## UC 64 — View super admin badge on profile   [todo · e2e]
- roles: role-site-admin.
- positive: the super admin's profile shows the super-admin badge.
- negative: role-user / role-bubble-admin profiles do NOT show it.
- fixtures: seeded role accounts (siteadmin has it, others don't).

## Sequencing / dependencies
- The approval/reject pipeline (10, 11) is 2-actor; reuse site-admin-0100 + the headless
  fixtures helpers. UC 12 + UC 20 negatives are sec-0200 territory — reference, don't
  duplicate.

## Future work (knowingly deferred)
- Bulk admin actions, audit trail of admin edits, rejection-reason surfaced back to the
  submitting owner (cross with notifications) — future.
