// qa-id: site-admin-0300
// qa-tags: site-admin, headless, role-site-admin
// qa-reason: Site admin rejects a pending event using /api/admin/events/:id/reject (UC 11)
//
// Positive test for event rejection: an approved event in a bubble can be rejected
// by a site admin. This proves the event rejection endpoint works and state changes
// from the current status to "rejected".
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, createEvent, deleteBubble } from "../lib/fixtures.js";

let bubbleAdmin!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;
let eventId!: string;

beforeAll(async () => {
  bubbleAdmin = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(bubbleAdmin, siteAdmin, {
    title: `QA Reject Event Bubble ${Date.now()}`,
    privacy: "Public",
  });
  eventId = await createEvent(bubbleAdmin, bubbleId, `QA Rejectable Event ${Date.now()}`);
});

afterAll(async () => {
  await deleteBubble(bubbleId, siteAdmin.token);
});

describe("site-admin-0300 reject an event", () => {
  it("site admin POSTs /api/admin/events/:id/reject with reason → 200, status 'rejected'", async () => {
    const res = await request("POST", `/api/admin/events/${eventId}/reject`, {
      token: siteAdmin.token,
      body: { reason: "Event content violates community guidelines" },
    });
    expect(res.status, `reject → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.status).toBe("rejected");
  });

  it("the event status is persisted as 'rejected'", async () => {
    const res = await request("GET", `/api/events/${eventId}`);
    expect(res.status).toBe(200);
    expect(res.json?.status).toBe("rejected");
  });
});
