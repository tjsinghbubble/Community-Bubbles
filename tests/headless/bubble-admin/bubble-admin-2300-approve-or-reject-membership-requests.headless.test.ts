// qa-id: bubble-admin-2300
// qa-tags: bubble-admin, headless, role-bubble-admin
// qa-reason: Bubble admin approves a pending join request, transitioning member to approved status (UC 31)
//
// Covers UC 31 positive: owner approves a pending membership request submitted by a member
// on a Request-to-Join bubble. Asserts the member transitions from pending-non-member to
// approved-member via the approve endpoint.
//
// Uses a disposable Request-to-Join bubble (created + site-admin-approved per run) so
// the shared seeded bubbles are never touched. Two actors: bubble-admin owner and role-user
// requester. The join request is established in beforeAll; approval is tested in the test.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Approve Req ${Date.now()}`;

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(owner, siteAdmin, {
    title: TITLE,
    privacy: "Request to Join",
  });

  // Establish the pending request (member joins Request-to-Join bubble).
  const joinRes = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
  expect(joinRes.status, `join setup failed: ${joinRes.status}`).toBe(200);
  expect(joinRes.json?.status).toBe("pending");
});

afterAll(async () => {
  await deleteBubble(bubbleId, owner.token);
});

describe("bubble-admin-2300 owner approves a pending membership request", () => {
  it("owner approves the member's join request → 200 success", async () => {
    const res = await request("POST", `/api/bubbles/${bubbleId}/join-requests/${member.userId}/approve`, {
      token: owner.token,
    });
    expect(res.status, `approve → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.success).toBe(true);
  });

  it("member's membership now reads as approved and member", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: member.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.isMember).toBe(true);
    expect(res.json?.membershipStatus).toBe("approved");
  });
});
