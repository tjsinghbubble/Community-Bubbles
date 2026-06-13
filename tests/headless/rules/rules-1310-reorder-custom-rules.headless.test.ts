// qa-id: rules-1310
// qa-tags: rules, headless, role-bubble-admin
// qa-reason: Non-owner is denied reorder; invalid payload (non-array ruleIds) is rejected with 400 (UC 149)
//
// UC 149 — Reorder custom rules. Negative path.
//
// Tests two failure cases:
// 1. role-user (non-owner) attempts PUT /api/rules/bubble/:id/reorder → 403 Forbidden
// 2. owner attempts PUT with malformed body (ruleIds not an array) → 400 Bad Request
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const BUBBLE_TITLE = `QA Rules Reorder Neg ${Date.now()}`;

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(owner, await loginAs("role-site-admin"), {
    title: BUBBLE_TITLE,
  });
});

afterAll(async () => {
  await deleteBubble(bubbleId, owner.token).catch(() => undefined);
});

describe("rules-1310 reorder custom bubble rules — negatives (UC 149)", () => {
  it("non-owner is denied reorder (403 Forbidden)", async () => {
    const res = await request("PUT", `/api/rules/bubble/${bubbleId}/reorder`, {
      token: member.token,
      body: { ruleIds: [] },
    });
    expect(res.status, `member PUT reorder → ${res.status}`).toBe(403);
  });

  it("malformed payload (non-array ruleIds) is rejected (400 Bad Request)", async () => {
    const res = await request("PUT", `/api/rules/bubble/${bubbleId}/reorder`, {
      token: owner.token,
      body: { ruleIds: "not an array" },
    });
    expect(res.status, `PUT reorder with non-array → ${res.status}`).toBe(400);
  });
});
