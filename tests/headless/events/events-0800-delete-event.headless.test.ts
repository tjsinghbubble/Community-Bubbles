// qa-id: events-0800
// qa-tags: events, smoke, headless, role-bubble-admin
// qa-reason: Bubble admin deletes their event and it is gone everywhere (UC 163 / row 35)
//
// Positive counterpart to sec-0200's DELETE /api/events/:id deny probe. Creator deletes
// the event; it must 404 on direct read and disappear from the bubble's event list.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, createEvent, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;
let eventId!: string;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: `QA Delete Event Bubble ${Date.now()}`,
    privacy: "Public",
  });
  eventId = await createEvent(creator, bubbleId, `QA Delete Event ${Date.now()}`);
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("events-0800 delete an event", () => {
  it("DELETE /api/events/:id as the creator → 200 success", async () => {
    const res = await request("DELETE", `/api/events/${eventId}`, { token: creator.token });
    expect(res.status, `DELETE → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.success).toBe(true);
  });

  it("the event 404s on a direct read", async () => {
    const res = await request("GET", `/api/events/${eventId}`);
    expect(res.status, "deleted event must not be readable").toBe(404);
  });

  it("the event is gone from the bubble's event list", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/events`);
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    const ids = (res.json ?? []).map((e: any) => e.id);
    expect(ids).not.toContain(eventId);
  });
});
