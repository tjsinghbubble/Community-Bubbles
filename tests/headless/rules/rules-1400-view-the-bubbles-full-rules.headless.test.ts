// qa-id: rules-1400
// qa-tags: rules, headless, role-user
// qa-reason: Member can view all bubble rules (custom + inherited) via GET /api/rules/bubble/:id (UC 229)
//
// UC 229 — View the bubble's full rules (member). Positive/blue-sky path.
//
// Creates a disposable bubble, adds a custom rule to it, then a member (non-owner)
// GETs /api/rules/bubble/:id and asserts the rule appears in the returned list.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;
let ruleId: number | undefined;

const BUBBLE_TITLE = `QA Rules View ${Date.now()}`;
const RULE_NAME = "Be respectful";

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  member = await loginAs("role-user");
  const approver = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(owner, approver, {
    title: BUBBLE_TITLE,
  });

  // Owner creates one custom rule
  const rule = await request("POST", `/api/rules/bubble/${bubbleId}`, {
    token: owner.token,
    body: { name: RULE_NAME, description: "Treat all members with respect" },
  });
  expect(rule.status, `POST rule → ${rule.status}`).toBe(200);
  ruleId = rule.json?.rule?.id ?? rule.json?.ruleId;
  expect(ruleId, "POST should return rule id").toBeTruthy();
});

afterAll(async () => {
  await deleteBubble(bubbleId, owner.token).catch(() => undefined);
});

describe("rules-1400 view bubble's full rules as a member (UC 229)", () => {
  it("member can view the bubble's custom rules", async () => {
    const res = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: member.token });
    expect(res.status, `GET rules → ${res.status}`).toBe(200);
    expect(Array.isArray(res.json), "rules list should be an array").toBe(true);

    const rules = res.json ?? [];
    const found = rules.find((r: any) => (r.rule?.id ?? r.ruleId) === ruleId);
    expect(found, `rule '${RULE_NAME}' not found in member's view`).toBeTruthy();
    expect(found.rule?.name, "rule name should match").toBe(RULE_NAME);
  });
});
