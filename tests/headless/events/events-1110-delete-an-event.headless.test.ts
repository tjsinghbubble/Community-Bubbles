// qa-id: events-1110
// qa-tags: events, smoke, headless, role-user
// qa-reason: Non-owner/non-bubble-admin cannot delete an event (403), proving authz (UC 163)
//
// Negative: a plain member (role-user) cannot delete an event created by another user,
// even if they are a member of the bubble. The DELETE /api/events/:id endpoint checks:
// isEventCreator || isBubbleAdmin || isSuperAdmin. This test proves the gate denies
// unauthorized actors and no state is lost.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, createEvent, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let attacker!: RoleSession;
let bubbleId!: string;
let eventId!: string;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  attacker = await loginAs("role-user");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: `QA Deletable Event Bubble ${Date.now()}`,
    privacy: "Public",
  });
  eventId = await createEvent(creator, bubbleId, `QA Deletable Event ${Date.now()}`);
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("events-1110 delete an event (authz)", () => {
  it("DELETE /api/events/:id as a non-owner/non-admin → 403 (denied)", async () => {
    const res = await request("DELETE", `/api/events/${eventId}`, { token: attacker.token });
    expect(res.status, `DELETE → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);
    expect(res.json?.error).toBe("Not authorized to delete this event");
  });

  it("the event still exists after the failed deletion", async () => {
    const res = await request("GET", `/api/events/${eventId}`);
    expect(res.status, "event must still be readable after denied delete").toBe(200);
    expect(res.json?.id).toBe(eventId);
  });
});
