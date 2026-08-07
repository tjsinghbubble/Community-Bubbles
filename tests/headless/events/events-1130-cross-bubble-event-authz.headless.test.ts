// qa-id: events-1130
// qa-tags: events, security, headless, role-bubble-admin
// qa-reason: A bubble admin cannot create/modify/delete events in a bubble they do not own (UC 161/162/163, authz)
//
// Negative (Goal 5): "bubble-admin" privilege is per-bubble, not global. An admin of bubble A
// must be denied on a DIFFERENT owner's bubble for which they hold no admin role / membership.
// The two bubbles below are owned by role-user (a separate account); the actor is role-bubble-admin,
// who is neither a member nor an admin of them:
//   - POST   /api/events on a PUBLIC foreign bubble  → 403 (gate: memberRole === 'admin')
//   - POST   /api/events on a PRIVATE foreign bubble → 403 (gate: isMember)
//   - PUT/DELETE an event owned by the foreign bubble → 403 (gate: creator || bubble owner || super)
// This complements events-1120 (owner ALLOWED in own bubble) and the generic non-member denial
// in sec-0200; here the denied actor is specifically a bubble admin, proving the privilege does
// not leak across bubble boundaries.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, createEvent, deleteBubble } from "../lib/fixtures.js";

let foreignOwner!: RoleSession; // role-user: owns the bubbles the attacker has no rights to
let siteAdmin!: RoleSession;
let attacker!: RoleSession; // role-bubble-admin: admin of OTHER bubbles, not these
let publicBubbleId!: string;
let privateBubbleId!: string;
let foreignEventId!: string;

beforeAll(async () => {
  foreignOwner = await loginAs("role-user");
  siteAdmin = await loginAs("role-site-admin");
  attacker = await loginAs("role-bubble-admin");

  publicBubbleId = await createApprovedBubble(foreignOwner, siteAdmin, {
    title: `QA Foreign Public Bubble ${Date.now()}`,
    privacy: "Public",
  });
  privateBubbleId = await createApprovedBubble(foreignOwner, siteAdmin, {
    title: `QA Foreign Private Bubble ${Date.now()}`,
    privacy: "Request to Join",
  });
  // The owner seeds one event in the public bubble; the attacker will try to mutate it.
  foreignEventId = await createEvent(foreignOwner, publicBubbleId, `QA Foreign Event ${Date.now()}`);
});

afterAll(async () => {
  await deleteBubble(publicBubbleId, foreignOwner.token);
  await deleteBubble(privateBubbleId, foreignOwner.token);
});

describe("events-1130 cross-bubble event authz (bubble admin on a foreign bubble)", () => {
  it("POST /api/events on a foreign PUBLIC bubble → 403 (not an admin of it)", async () => {
    const res = await request("POST", "/api/events", {
      token: attacker.token,
      body: { bubbleId: publicBubbleId, title: "QA Cross-Bubble Event", date: "2027-03-01", startTime: "18:00", timezone: "UTC" },
    });
    expect(res.status, `POST → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);
  });

  it("POST /api/events on a foreign PRIVATE bubble → 403 (not a member)", async () => {
    const res = await request("POST", "/api/events", {
      token: attacker.token,
      body: { bubbleId: privateBubbleId, title: "QA Cross-Bubble Event", date: "2027-03-01", startTime: "18:00", timezone: "UTC" },
    });
    expect(res.status, `POST → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);
  });

  it("PUT /api/events/:id on a foreign event → 403 (not creator/owner/super)", async () => {
    const res = await request("PUT", `/api/events/${foreignEventId}`, {
      token: attacker.token,
      body: { title: "QA Cross-Bubble Hijack" },
    });
    expect(res.status, `PUT → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);
  });

  it("DELETE /api/events/:id on a foreign event → 403, and the event survives", async () => {
    const del = await request("DELETE", `/api/events/${foreignEventId}`, { token: attacker.token });
    expect(del.status, `DELETE → ${del.status} ${del.text.slice(0, 200)}`).toBe(403);

    const still = await request("GET", `/api/events/${foreignEventId}`);
    expect(still.status, "foreign event must survive the denied delete").toBe(200);
    expect(still.json?.id).toBe(foreignEventId);
  });
});
