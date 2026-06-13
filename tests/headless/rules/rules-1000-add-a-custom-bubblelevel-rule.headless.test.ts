// qa-id: rules-1000
// qa-tags: rules, headless, role-bubble-admin
// qa-reason: Bubble owner can create a custom rule and retrieve it from the bubble's rule list (UC 146)
//
// UC 146 — Add a custom bubble-level rule. Positive/blue-sky path.
//
// Creates a disposable bubble, adds a rule to it via POST, and verifies it appears in the
// bubble's rule list via GET.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;
let createdRuleId: number | undefined;
const BUBBLE_TITLE = `QA Rules Bubble ${Date.now()}`;
const RULE_NAME = `Test Rule ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(creator, siteAdmin, { title: BUBBLE_TITLE });
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token).catch(() => undefined);
});

describe("rules-1000 add a custom bubble-level rule (UC 146)", () => {
  it("owner can POST a rule to their bubble and it appears in GET /api/rules/bubble/:id", async () => {
    const created = await request("POST", `/api/rules/bubble/${bubbleId}`, {
      token: creator.token,
      body: { name: RULE_NAME, description: "headless test rule" },
    });
    expect(created.status, `POST /api/rules/bubble/${bubbleId} → ${created.status} ${created.text.slice(0, 200)}`).toBe(
      200,
    );
    createdRuleId = created.json?.rule?.id ?? created.json?.ruleId;
    expect(createdRuleId, "POST should return the new rule id").toBeTruthy();
    expect(created.json?.rule?.name).toBe(RULE_NAME);

    const list = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: creator.token });
    expect(list.status, `GET /api/rules/bubble/${bubbleId} → ${list.status} ${list.text.slice(0, 200)}`).toBe(200);
    expect(Array.isArray(list.json), "bubble rules response should be an array").toBe(true);

    const mine = (list.json ?? []).find((r: any) => r.rule?.name === RULE_NAME);
    expect(mine, `created rule '${RULE_NAME}' is missing from the bubble rules list`).toBeTruthy();
    expect(mine.rule.id).toBe(createdRuleId);
  });
});
