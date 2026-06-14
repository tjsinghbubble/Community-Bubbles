// qa-id: bubble-admin-2310
// qa-tags: bubble-admin, headless, role-bubble-admin
// qa-reason: Non-admin requestor cannot approve membership requests; 403 refusal, no state change (UC 31)
//
// Covers UC 31 negative: a non-admin (role-user) attempts to approve a join request.
// Asserts the request fails with 403 "Only admins can approve join requests" and that
// the pending membership does not transition. No state change verification required since
// the request was rejected, but we check the member's status still reads as pending.
//
// Uses a disposable Request-to-Join bubble (created + site-admin-approved per run).
// Two actors: bubble-admin owner (establishes bubble + pending request) and role-user
// (both requester and attempted approver).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Approve Req Neg ${Date.now()}`;

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

describe("bubble-admin-2310 non-admin cannot approve membership requests", () => {
  it("non-admin (the requester) attempts to approve → 403 forbidden", async () => {
    const res = await request("POST", `/api/bubbles/${bubbleId}/join-requests/${member.userId}/approve`, {
      token: member.token,
    });
    expect(res.status, `approve by non-admin → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);
    expect(res.json?.error).toContain("Only admins can approve join requests");
  });

  it("member's membership remains pending and non-member", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: member.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.isMember).toBe(false);
    expect(res.json?.membershipStatus).toBe("pending");
  });
});
