// qa-id: site-admin-0310
// qa-tags: site-admin, headless, role-site-admin
// qa-reason: Non-admin is denied event approval authz; denies 403 and event state unchanged (UC 11)
//
// Negative test for event approval authz: a regular user (non-super-admin) attempts to
// approve an event and must receive a 403 with "Only super admins can approve events".
// Asserts both the rejection AND that the event status did not change.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, createEvent, deleteBubble } from "../lib/fixtures.js";

let bubbleAdmin!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;
let eventId!: string;
let originalStatus!: string;

beforeAll(async () => {
  bubbleAdmin = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(bubbleAdmin, siteAdmin, {
    title: `QA Authz Event Bubble ${Date.now()}`,
    privacy: "Public",
  });
  eventId = await createEvent(bubbleAdmin, bubbleId, `QA Authz Event ${Date.now()}`);

  // Capture original status for state-unchanged assertion
  const statusRes = await request("GET", `/api/events/${eventId}`);
  originalStatus = statusRes.json?.status;
});

afterAll(async () => {
  await deleteBubble(bubbleId, siteAdmin.token);
});

describe("site-admin-0310 approve event authz denied to non-admins", () => {
  it("non-admin POSTs /api/admin/events/:id/approve → 403 'Only super admins can approve events'", async () => {
    const res = await request("POST", `/api/admin/events/${eventId}/approve`, {
      token: member.token,
    });
    expect(res.status, `approve as non-admin → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);
    expect(res.json?.error).toBe("Only super admins can approve events");
  });

  it("the event status did not change after denied approval", async () => {
    const res = await request("GET", `/api/events/${eventId}`);
    expect(res.status).toBe(200);
    expect(res.json?.status).toBe(originalStatus);
  });
});
