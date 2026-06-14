// qa-id: events-0700
// qa-tags: events, smoke, headless, role-bubble-admin
// qa-reason: Bubble admin edits their event and the change persists (UC 162 / row 34)
//
// Positive counterpart to sec-0200's PUT /api/events/:id deny probe: the deny matrix
// proves lower-privilege callers get 403; this proves the edit actually WORKS for the
// event creator. Disposable bubble + event per run; nothing shared is mutated.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, createEvent, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;
let eventId!: string;

const EDITED_TITLE = `QA Edited Event ${Date.now()}`;
const EDITED_DESCRIPTION = "Edited by events-0700 — new description.";

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: `QA Edit Event Bubble ${Date.now()}`,
    privacy: "Public",
  });
  eventId = await createEvent(creator, bubbleId, `QA Edit Event ${Date.now()}`);
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("events-0700 edit an event", () => {
  it("PUT /api/events/:id as the creator → 200 with the new values", async () => {
    const res = await request("PUT", `/api/events/${eventId}`, {
      token: creator.token,
      body: { title: EDITED_TITLE, description: EDITED_DESCRIPTION },
    });
    expect(res.status, `PUT /api/events/${eventId} → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.title).toBe(EDITED_TITLE);
    expect(res.json?.description).toBe(EDITED_DESCRIPTION);
  });

  it("the edit persists on a fresh read", async () => {
    const res = await request("GET", `/api/events/${eventId}`);
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.title).toBe(EDITED_TITLE);
    expect(res.json?.description).toBe(EDITED_DESCRIPTION);
  });
});
