// qa-id: events-1120
// qa-tags: events, smoke, headless, role-bubble-admin
// qa-reason: A bubble admin can create, modify, and delete events in their OWN bubble (UC 161/162/163)
//
// Positive (Goal 4): a bubble admin owns a bubble (bubble.createdBy === them) and holds the
// 'admin' membership role in it. They must be able to run the full event lifecycle there:
//   - POST   /api/events           → 200 (Public-bubble create gate: memberRole === 'admin')
//   - PUT    /api/events/:id        → 200 (edit gate: isEventCreator || isBubbleAdmin || super)
//   - DELETE /api/events/:id        → 200 (same gate), then the event is gone (GET → 404)
// This is the affirmative counterpart to events-1110 (non-owner delete denied) and the
// cross-bubble denials in events-1130: it proves the gate ALLOWS the legitimate owner.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;
let eventId!: string;

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(owner, siteAdmin, {
    title: `QA BA Event Lifecycle Bubble ${Date.now()}`,
    privacy: "Public",
  });
});

afterAll(async () => {
  await deleteBubble(bubbleId, owner.token);
});

describe("events-1120 bubble admin event lifecycle (own bubble)", () => {
  it("POST /api/events in own bubble → 200 (created)", async () => {
    const res = await request("POST", "/api/events", {
      token: owner.token,
      body: {
        bubbleId,
        title: `QA BA Lifecycle Event ${Date.now()}`,
        date: "2027-03-01",
        startTime: "18:00",
        timezone: "UTC",
      },
    });
    expect(res.status, `POST → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.id, "created event must return an id").toBeTruthy();
    eventId = res.json.id;
  });

  it("PUT /api/events/:id in own bubble → 200 (modified)", async () => {
    const res = await request("PUT", `/api/events/${eventId}`, {
      token: owner.token,
      body: { title: "QA BA Lifecycle Event (edited)" },
    });
    expect(res.status, `PUT → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.title).toBe("QA BA Lifecycle Event (edited)");
  });

  it("DELETE /api/events/:id in own bubble → 200, then the event is gone (404)", async () => {
    const del = await request("DELETE", `/api/events/${eventId}`, { token: owner.token });
    expect(del.status, `DELETE → ${del.status} ${del.text.slice(0, 200)}`).toBe(200);

    const gone = await request("GET", `/api/events/${eventId}`);
    expect(gone.status, "deleted event must no longer be readable").toBe(404);
  });
});
