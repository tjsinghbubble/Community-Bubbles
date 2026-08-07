// qa-id: bubble-admin-2400
// qa-tags: bubble-admin, headless, role-bubble-admin
// qa-reason: Bubble admin removes an approved member from bubble; member transitions to non-member (UC 32)
//
// Covers UC 32 positive: owner removes an approved member from a Public bubble.
// Asserts the remove succeeds with 200 and the member transitions from isMember:true
// to isMember:false.
//
// Uses a disposable Public bubble (created + site-admin-approved per run) so the
// shared seeded bubbles are never touched. Two actors: bubble-admin owner and role-user
// member. The member joins in beforeAll; removal is tested in the test.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Remove Member ${Date.now()}`;

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(owner, siteAdmin, {
    title: TITLE,
    privacy: "Public",
  });

  // Establish the approved member (member joins Public bubble → auto-approved).
  const joinRes = await request("POST", `/api/bubbles/${bubbleId}/join`, { token: member.token });
  expect(joinRes.status, `join setup failed: ${joinRes.status}`).toBe(200);
  expect(joinRes.json?.status).toBe("approved");

  // Verify the member is actually in the bubble.
  const membershipRes = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: member.token });
  expect(membershipRes.json?.isMember).toBe(true);
});

afterAll(async () => {
  await deleteBubble(bubbleId, owner.token);
});

describe("bubble-admin-2400 owner removes a member from the bubble", () => {
  it("owner removes the member → 200 success", async () => {
    const res = await request("DELETE", `/api/bubbles/${bubbleId}/members/${member.userId}`, {
      token: owner.token,
    });
    expect(res.status, `remove member → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
  });

  it("member's membership now reads as non-member", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}/membership`, { token: member.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    expect(res.json?.isMember).toBe(false);
  });
});
