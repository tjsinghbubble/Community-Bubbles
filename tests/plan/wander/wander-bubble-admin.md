# Wander — role-bubble-admin (wander-0200)

A bubble owner checks on their bubble and does some light management. Login as
`bubbleadmin@bubble.test` (owns the four seeded QA bubbles). Screenshot every stop.
Tolerant asserts. Create actions use unique titles per run.

## Path

1. **Login** → Explore. Assert `tab-bubbles`.
2. **My bubbles** — open the My Bubbles view; assert the seeded **QA Test Bubble** is
   listed and shows an owner/admin affordance (the admin sees manage controls that a member
   does not — this is the sec-0300 distinction, here just observed).
3. **Open own bubble** — QA Test Bubble → Details; assert the admin-only
   `button-admin-dashboard` / kebab `button-manage-bubble` is present.
4. **Edit the bubble** — Manage/Edit → change the tagline to a unique string → save; assert
   it persists. (Real, reversible-ish edit; next reseed restores it.)
5. **Members & join requests** — open members; if **QA Request Bubble** has a pending
   request (from a join flow), view the join-request queue; assert it renders. (Approving
   is a discrete use case — observe, don't necessarily action, to keep the wander light.)
6. **Create an event** — `button-create-event-fab` in own bubble → fill title (unique +
   `Date.now()`), date, time → create; assert the new event appears in the bubble's Events
   tab. (Mirrors events-0500.)
7. **View RSVPs** — open an event with the seeded RSVP (or the one just made) →
   `button-view-participants`; assert the roster renders.
8. **Rules** — open the bubble's rules; assert the seeded rule on **QA Rules Bubble** (if
   visited) or the empty/inherited rules render.
9. **Create a new bubble** — `button-create-fab` → Create a Bubble → fill title (unique),
   tagline, category, privacy Public → finish; assert it submits to pending (new bubbles
   need site-admin approval — assert the "submitted/pending" state, NOT live visibility).
10. **Profile** — open Account; assert `text-version`. End.

## Notes

- Stop 9 demonstrates the create→pending pipeline from the owner side; the site-admin
  wander picks up the approval end.
- The TSV example for the admin path ("add a bulletin, accept one of three submitted
  bubbles") maps to: stop 5 (requests) and the site-admin wander (approvals). Bulletin
  creation can be an added stop if `button-new-post-header` is reachable for the owner.
- Keep edits reversible-by-reseed; never delete the seeded bubbles (other tests need them).
- Future: device/text-size sweep; network profile.
