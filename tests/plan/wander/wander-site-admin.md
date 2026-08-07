# Wander — role-site-admin (wander-0300)

A super admin does an oversight pass: review the platform, work the approval queues, touch
app-wide settings. Login as `siteadmin@bubble.test`. Screenshot every stop. Tolerant
asserts. This wander leans on **admin pages**; several are pure reads (good for the
device-review/network sweeps).

## Path

1. **Login** → Explore (or the admin landing). Assert the super-admin affordance is present
   (e.g. access to admin dashboard) that the other two roles never see.
2. **Platform health dashboard** — open Site Monitoring; assert stats render (users,
   bubbles, events counts). These auto-refresh ~30s — a good network-degradation subject.
3. **Growth / content-health stats** — scroll the dashboard; assert the metrics sections
   render (orphan bubbles, avg members, etc.).
4. **Integration status** — assert the CometChat + object-storage status rows render
   (locally these may show degraded/unconfigured — TOLERATE; that's signal, not failure).
5. **Bubble approval queue** — open the pending-bubbles admin view; if a bubble is pending
   (e.g. from the bubble-admin wander's stop 9), assert it's listed. Approve one; assert it
   moves to live/approved. (The approval counterpart to wander-0200 stop 9 and
   site-admin-0100.)
6. **Event approval queue** — open pending events (if any); assert the queue renders.
7. **Reported concerns / waitlist** — open the reports/waitlist admin views; assert they
   render (likely empty locally — fine).
8. **App-wide rules** — open Manage Rules → App rules tab (`tab-app-rules`); assert the
   rules list renders. Optionally add a rule (`button-add-rule`, unique text) and assert it
   appears; reseed restores. Keep it light.
9. **Categories** — open the category hierarchy; assert it renders (parent/subcategories).
10. **Profile** — assert the super-admin badge on the profile; `text-version`. End.

## Notes

- Stop 5 is the only firmly state-changing action and it pairs with the bubble-admin
  wander — run wander-0200 before wander-0300 if you want a real pending bubble to approve;
  otherwise tolerate an empty queue.
- Admin pages are the richest material for the network-condition effort (lots of async
  data, auto-refresh, external integration status) — flag stops 2–4 as priority network
  subjects.
- Many admin testIDs may not be in `docs/maestro_testids.md` yet; the Writer should flag
  any missing selector in the handback rather than guess, and a human verifies via Maestro
  MCP. This wander is the most likely to surface selector gaps — that's useful.
- Future: device/text-size sweep; network profile; split the read-only oversight pass from
  the queue-working pass if the single flow gets too long.
