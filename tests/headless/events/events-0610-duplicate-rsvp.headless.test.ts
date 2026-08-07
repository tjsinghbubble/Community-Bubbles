// qa-id: events-0610
// qa-tags: events, smoke, headless, role-user
// qa-reason: A second RSVP to the same event is rejected, not duplicated (negative for UC 47 / 225)
//
// Named negative variant of events-0600: re-RSVPing must 400 with "Already RSVP'd" and
// must NOT add a second attendee row. Guards the double-tap / retry path in the app.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, createEvent, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;
let eventId!: string;

const TITLE = `QA RSVP Dup Bubble ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(creator, siteAdmin, { title: TITLE, privacy: "Public" });
  eventId = await createEvent(creator, bubbleId, `QA RSVP Dup Event ${Date.now()}`);
  const join = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
  if (join.status !== 200) throw new Error(`setup: member join → ${join.status} ${join.text.slice(0, 200)}`);
  const rsvp = await request("POST", `/api/events/${eventId}/rsvp`, { token: member.token });
  if (rsvp.status !== 200) throw new Error(`setup: first rsvp → ${rsvp.status} ${rsvp.text.slice(0, 200)}`);
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("events-0610 duplicate RSVP is rejected", () => {
  it("second RSVP → 400 'Already RSVP'd'", async () => {
    const res = await request("POST", `/api/events/${eventId}/rsvp`, { token: member.token });
    expect(res.status, `duplicate rsvp → ${res.status} ${res.text.slice(0, 200)}`).toBe(400);
    expect(res.json?.error).toMatch(/already rsvp/i);
  });

  it("the attendee list still holds exactly ONE row for the member", async () => {
    const res = await request("GET", `/api/events/${eventId}/attendees`);
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    const mine = (res.json ?? []).filter((a: any) => a.userId === member.userId);
    expect(mine.length, "duplicate RSVP must not duplicate the attendee row").toBe(1);
    expect(mine[0]?.status).toBe("going");
  });
});
