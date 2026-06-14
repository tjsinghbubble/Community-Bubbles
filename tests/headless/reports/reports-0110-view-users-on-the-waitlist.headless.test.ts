// qa-id: reports-0110
// qa-tags: reports, headless, role-site-admin
// qa-reason: Non-admin cannot view per-bubble waitlist; admin-gated endpoint returns 403 (UC 110)
//
// Negative path: role-user attempts GET /api/bubbles/:bubbleId/waitlist and receives
// 403 "Only admins can view the waitlist" — the per-bubble admin endpoint denies access.
// Setup: creates a Public bubble with memberLimit=1, role-user joins → waitlisted,
// then role-user tries to view the per-bubble waitlist and is correctly denied.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Waitlist Deny Bubble ${Date.now()}`;

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
  // Join as member → should be waitlisted
  const joinRes = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
  if (joinRes.status !== 200 || joinRes.json?.status !== "waitlisted") {
    throw new Error(`Failed to waitlist member: ${joinRes.status} ${joinRes.text.slice(0, 200)}`);
  }
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("reports-0110 view users on the waitlist (negative)", () => {
  it("non-admin user gets 403 when accessing per-bubble waitlist", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/waitlist`, { token: member.token });
    expect(res.status, `GET /api/bubbles/:id/waitlist → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);
    expect(res.json?.error).toContain("Only admins can view the waitlist");
  });
});
