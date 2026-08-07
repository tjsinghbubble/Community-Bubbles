// qa-id: rules-1300
// qa-tags: rules, headless, role-bubble-admin
// qa-reason: Bubble admin can reorder custom bubble rules and the reordered positions read back correctly (UC 149)
//
// UC 149 — Reorder custom rules. Positive/blue-sky path.
//
// Creates a disposable bubble, adds two custom rules (A, B), then reorders them
// (B, A) via PUT /api/rules/bubble/:id/reorder with swapped ruleIds, and asserts
// the list reads back with the new order.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let bubbleId!: string;
let ruleAId: number | undefined;
let ruleBId: number | undefined;

const BUBBLE_TITLE = `QA Rules Reorder ${Date.now()}`;
const RULE_A_NAME = "Rule A";
const RULE_B_NAME = "Rule B";

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  bubbleId = await createApprovedBubble(owner, await loginAs("role-site-admin"), {
    title: BUBBLE_TITLE,
  });

  // Create rule A
  const ruleA = await request("POST", `/api/rules/bubble/${bubbleId}`, {
    token: owner.token,
    body: { name: RULE_A_NAME, description: "First rule", position: 0 },
  });
  expect(ruleA.status, `POST rule A → ${ruleA.status}`).toBe(200);
  ruleAId = ruleA.json?.rule?.id ?? ruleA.json?.ruleId;
  expect(ruleAId, "POST should return rule A id").toBeTruthy();

  // Create rule B
  const ruleB = await request("POST", `/api/rules/bubble/${bubbleId}`, {
    token: owner.token,
    body: { name: RULE_B_NAME, description: "Second rule", position: 1 },
  });
  expect(ruleB.status, `POST rule B → ${ruleB.status}`).toBe(200);
  ruleBId = ruleB.json?.rule?.id ?? ruleB.json?.ruleId;
  expect(ruleBId, "POST should return rule B id").toBeTruthy();
});

afterAll(async () => {
  await deleteBubble(bubbleId, owner.token).catch(() => undefined);
});

describe("rules-1300 reorder custom bubble rules (UC 149)", () => {
  it("owner can reorder two rules and the new order reads back", async () => {
    // Get initial order
    const before = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: owner.token });
    expect(before.status, `GET before reorder → ${before.status}`).toBe(200);
    expect(Array.isArray(before.json), "rules list should be an array").toBe(true);
    const beforeList = before.json ?? [];
    expect(beforeList.length, "should have 2 rules before reorder").toBe(2);
    const beforeOrder = beforeList.map((r: any) => r.rule?.id ?? r.ruleId);
    expect(beforeOrder[0], "rule A should be first initially").toBe(ruleAId);
    expect(beforeOrder[1], "rule B should be second initially").toBe(ruleBId);

    // Reorder: swap B and A
    const reorder = await request("PUT", `/api/rules/bubble/${bubbleId}/reorder`, {
      token: owner.token,
      body: { ruleIds: [ruleBId, ruleAId] },
    });
    expect(reorder.status, `PUT reorder → ${reorder.status}`).toBe(200);

    // Get final order
    const after = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: owner.token });
    expect(after.status, `GET after reorder → ${after.status}`).toBe(200);
    const afterList = after.json ?? [];
    expect(afterList.length, "should still have 2 rules after reorder").toBe(2);
    const afterOrder = afterList.map((r: any) => r.rule?.id ?? r.ruleId);
    expect(afterOrder[0], "rule B should be first after reorder").toBe(ruleBId);
    expect(afterOrder[1], "rule A should be second after reorder").toBe(ruleAId);
  });
});
