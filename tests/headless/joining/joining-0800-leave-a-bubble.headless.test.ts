// qa-id: joining-0800
// qa-tags: joining, headless, role-user
// qa-reason: Member can leave an approved bubble; membership state transitions from member to non-member (UC 48)
//
// Positive flow: role-user joins a disposable Public bubble, asserts isMember becomes true,
// then calls POST /leave and asserts 200 success, then verifies membership is false.
// Exercises the happy path for leaving a bubble after joining.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Leave Bubble ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: TITLE,
    privacy: "Public",
  });
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("joining-0800 leave a bubble", () => {
  it("member can join a Public bubble", async () => {
    const res = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
    expect(res.status, `join → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.success).toBe(true);
    expect(res.json?.status).toBe("approved");
  });

  it("member's membership reads as isMember true after joining", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: member.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.isMember).toBe(true);
  });

  it("member's leave call succeeds with 200 and success true", async () => {
    const res = await request("POST", `/api/bubbles/${bubbleId}/leave`, { token: member.token });
    expect(res.status, `leave → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.success).toBe(true);
  });

  it("member's membership reads as isMember false after leaving", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: member.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.isMember).toBe(false);
  });
});
