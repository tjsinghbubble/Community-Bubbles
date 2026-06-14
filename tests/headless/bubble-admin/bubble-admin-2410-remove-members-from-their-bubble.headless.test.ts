// qa-id: bubble-admin-2410
// qa-tags: bubble-admin, headless, role-bubble-admin
// qa-reason: Non-admin cannot remove members; 403 refusal, no state change (UC 32)
//
// Covers UC 32 negative: a non-admin (role-user) attempts to remove a member (the owner).
// Asserts the request fails with 403 "Only admins can remove members" and that the owner
// remains a member. Verifies no state change from the failed removal attempt.
//
// Uses a disposable Public bubble (created + site-admin-approved per run). Two actors:
// bubble-admin owner and role-user member. Both are joined members; the member
// (non-admin) attempts to remove the owner (who stays as isMember:true).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Remove Member Neg ${Date.now()}`;

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(owner, siteAdmin, {
    title: TITLE,
    privacy: "Public",
  });

  // Owner is created automatically as the bubble creator.
  // Establish the approved member (member joins Public bubble → auto-approved).
  const joinRes = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
  expect(joinRes.status, `join setup failed: ${joinRes.status}`).toBe(200);
  expect(joinRes.json?.status).toBe("approved");
});

afterAll(async () => {
  await deleteBubble(bubbleId, owner.token);
});

describe("bubble-admin-2410 non-admin cannot remove members", () => {
  it("non-admin (member) attempts to remove owner → 403 forbidden", async () => {
    const res = await request("DELETE", `/api/bubbles/${bubbleId}/members/${owner.userId}`, {
      token: member.token,
    });
    expect(res.status, `remove by non-admin → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);
    expect(res.json?.error).toContain("Only admins can remove members");
  });

  it("owner remains a member (no state change)", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: owner.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.isMember).toBe(true);
  });
});
