// qa-id: events-0710
// qa-tags: events, smoke, headless, role-bubble-admin
// qa-reason: An invalid event edit (empty title) is rejected and changes nothing (negative for UC 162)
//
// Named negative variant of events-0700, validation side (the AUTHZ negative — non-owner
// PUT → 403 — is already covered by sec-0200's deny matrix, so it is not repeated here).
// updateEventSchema requires title min(1): an empty title must 400 and leave the event
// untouched.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, createEvent, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;
let eventId!: string;

const ORIGINAL_TITLE = `QA Invalid Edit Event ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: `QA Invalid Edit Bubble ${Date.now()}`,
    privacy: "Public",
  });
  eventId = await createEvent(creator, bubbleId, ORIGINAL_TITLE);
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("events-0710 invalid event edit is rejected", () => {
  it("PUT with an empty title → 400", async () => {
    const res = await request("PUT", `/api/events/${eventId}`, {
      token: creator.token,
      body: { title: "" },
    });
    expect(res.status, `PUT empty title → ${res.status} ${res.text.slice(0, 200)}`).toBe(400);
  });

  it("the event is unchanged on a fresh read", async () => {
    const res = await request("GET", `/api/events/${eventId}`);
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.title, "rejected edit must not partially apply").toBe(ORIGINAL_TITLE);
  });
});
