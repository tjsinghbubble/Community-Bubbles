// qa-id: rules-1410
// qa-tags: rules, headless, role-user
// qa-reason: Empty-state: member views a bubble with no rules and gets an empty array, no leaked/phantom rules (UC 229)
//
// UC 229 — View the bubble's full rules (member). Negative/edge case: empty state.
//
// Creates a disposable bubble with NO custom rules, then a member GETs the rules
// endpoint and asserts an empty array is returned (no phantom/leaked rules).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;

const BUBBLE_TITLE = `QA Rules Empty ${Date.now()}`;

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  member = await loginAs("role-user");
  const approver = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(owner, approver, {
    title: BUBBLE_TITLE,
  });
  // Intentionally do NOT add any custom rules
});

afterAll(async () => {
  await deleteBubble(bubbleId, owner.token).catch(() => undefined);
});

describe("rules-1410 view bubble's rules — empty state (UC 229)", () => {
  it("member views a rule-free bubble and gets an empty array", async () => {
    const res = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: member.token });
    expect(res.status, `GET rules → ${res.status}`).toBe(200);
    expect(Array.isArray(res.json), "rules list should be an array").toBe(true);
    expect(res.json?.length, "empty bubble should have no rules").toBe(0);
  });
});
