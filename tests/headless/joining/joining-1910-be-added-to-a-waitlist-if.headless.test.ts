// qa-id: joining-1910
// qa-tags: joining, headless, role-user
// qa-reason: Verify user is approved when joining a non-full bubble (UC 218)
//
// Tests the negative path for UC 218: when a bubble has NOT reached its member limit,
// a new user's join request returns status "approved" (not "waitlisted"). Creates a
// disposable Public bubble with memberLimit=2 (creator fills 1 slot, leaving 1 open),
// then verifies role-user's join is approved immediately, not waitlisted.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA No Waitlist Bubble ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: TITLE,
    privacy: "Public",
  });
  // Set member limit to 2, leaving one slot open (creator takes 1)
  const limitRes = await request("PUT", `/api/bubbles/${bubbleId}`, {
    token: creator.token,
    body: { memberLimit: 2 },
  });
  if (limitRes.status !== 200) {
    throw new Error(`Failed to set memberLimit: ${limitRes.status} ${limitRes.text.slice(0, 200)}`);
  }
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("joining-1910 NOT be added to waitlist if bubble has capacity", () => {
  it("member's join call returns 'approved' status", async () => {
    const res = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
    expect(res.status, `join → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.success).toBe(true);
    expect(res.json?.status, "Bubble has capacity; user should be approved, not waitlisted").toBe("approved");
  });

  it("membership reads back as approved and member", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: member.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.isMember, "Approved user should be a member").toBe(true);
    expect(res.json?.membershipStatus).toBe("approved");
  });
});
