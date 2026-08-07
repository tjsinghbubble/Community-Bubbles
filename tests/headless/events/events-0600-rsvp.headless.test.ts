// qa-id: events-0600
// qa-tags: events, smoke, headless, role-user
// qa-reason: Member RSVPs to an event and appears in the attendee list (UC 47 / 225)
//
// Two-account use case: role-bubble-admin creates a disposable public bubble + event,
// role-user joins the bubble and RSVPs. Asserts the RSVP response, the attendee list
// (member 'going' alongside the creator's auto-RSVP), and the member's /api/events/my
// view. Disposable fixtures keep this independent of the seeded bubbles and e2e flows.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, createEvent, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;
let eventId!: string;

const TITLE = `QA RSVP Bubble ${Date.now()}`;
const EVENT_TITLE = `QA RSVP Event ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(creator, siteAdmin, { title: TITLE, privacy: "Public" });
  eventId = await createEvent(creator, bubbleId, EVENT_TITLE);
  // The member joins the public bubble first — RSVP-as-a-group-member is the use case.
  const join = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
  if (join.status !== 200) throw new Error(`setup: member join → ${join.status} ${join.text.slice(0, 200)}`);
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("events-0600 RSVP to an event", () => {
  it("member RSVP → 200 with status 'going'", async () => {
    const res = await request("POST", `/api/events/${eventId}/rsvp`, { token: member.token });
    expect(res.status, `rsvp → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.success).toBe(true);
    expect(res.json?.status).toBe("going");
  });

  it("the member appears in the attendee list as 'going'", async () => {
    const res = await request("GET", `/api/events/${eventId}/attendees`);
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    const attendees: any[] = res.json ?? [];
    const mine = attendees.find((a: any) => a.userId === member.userId);
    expect(mine, `member ${member.userId} missing from attendees`).toBeTruthy();
    expect(mine?.status).toBe("going");
  });

  it("the event shows up in the member's /api/events/my", async () => {
    const res = await request("GET", "/api/events/my", { token: member.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    const ids = (res.json ?? []).map((e: any) => e.id);
    expect(ids, `event ${eventId} missing from member's events`).toContain(eventId);
  });
});
