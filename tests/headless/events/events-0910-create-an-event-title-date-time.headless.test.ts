// qa-id: events-0910
// qa-tags: events, smoke, headless, role-bubble-admin
// qa-reason: Empty title is rejected (400) on event creation, proving title validation (UC 160)
//
// Negative: ensure the insertEventSchema title: z.string().min(1).max(150) enforces min(1).
// This proves the validation gate prevents empty titles from being stored.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: `QA Event Validation Bubble ${Date.now()}`,
    privacy: "Public",
  });
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("events-0910 create an event (title validation)", () => {
  it("POST /api/events with empty title → 400 (rejected)", async () => {
    const res = await request("POST", "/api/events", {
      token: creator.token,
      body: {
        bubbleId,
        title: "",
        date: "2027-03-01",
        startTime: "18:00",
        timezone: "UTC",
      },
    });
    expect(res.status, `POST → ${res.status} ${res.text.slice(0, 200)}`).toBe(400);
  });

  it("the empty-title request did not create an event (no id in response)", async () => {
    const res = await request("POST", "/api/events", {
      token: creator.token,
      body: {
        bubbleId,
        title: "",
        date: "2027-03-01",
        startTime: "18:00",
        timezone: "UTC",
      },
    });
    expect(res.json?.id).toBeUndefined();
  });
});
