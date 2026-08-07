// qa-id: joining-1900
// qa-tags: joining, headless, role-user
// qa-reason: Verify user is waitlisted when joining a full bubble (UC 218)
//
// Tests the positive path for UC 218: when a bubble has reached its member limit,
// a new user's join request returns status "waitlisted" (200 success, not member).
// Creates a disposable Public bubble with memberLimit=1 (filled by owner), then
// verifies role-user's join lands them on the waitlist.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Waitlist Bubble ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: TITLE,
    privacy: "Public",
  });
  // Set member limit to 1, which is already filled by the creator
  const limitRes = await request("PUT", `/api/bubbles/${bubbleId}`, {
    token: creator.token,
    body: { memberLimit: 1 },
  });
  if (limitRes.status !== 200) {
    throw new Error(`Failed to set memberLimit: ${limitRes.status} ${limitRes.text.slice(0, 200)}`);
  }
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("joining-1900 be added to a waitlist if bubble is full", () => {
  it("member's join call returns 'waitlisted' status", async () => {
    const res = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
    expect(res.status, `join → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.success).toBe(true);
    expect(res.json?.status, "Bubble is full; user should be waitlisted, not approved").toBe("waitlisted");
  });

  it("membership reads back as waitlisted, not member", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: member.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.isMember, "Waitlisted user should not be a member").toBe(false);
    expect(res.json?.membershipStatus).toBe("waitlisted");
  });
});
