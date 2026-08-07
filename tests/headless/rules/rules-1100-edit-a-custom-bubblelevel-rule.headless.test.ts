// qa-id: rules-1100
// qa-tags: rules, headless, role-bubble-admin
// qa-reason: Bubble owner can edit a custom rule name and the change is persisted (UC 147)
//
// UC 147 — Edit a custom bubble-level rule. Positive/blue-sky path.
//
// Creates a disposable bubble with a rule, updates the rule name via PUT, and verifies
// the new name appears in the bubble's rule list via GET.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;
let ruleId: number | undefined;
const BUBBLE_TITLE = `QA Rules Bubble ${Date.now()}`;
const RULE_NAME = `Test Rule ${Date.now()}`;
const NEW_RULE_NAME = `Updated Rule ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(creator, siteAdmin, { title: BUBBLE_TITLE });

  // Create a rule to be edited
  const created = await request("POST", `/api/rules/bubble/${bubbleId}`, {
    token: creator.token,
    body: { name: RULE_NAME },
  });
  if (created.status !== 200) {
    throw new Error(`fixture: POST rule → ${created.status} ${created.text.slice(0, 200)}`);
  }
  ruleId = created.json?.rule?.id ?? created.json?.ruleId;
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token).catch(() => undefined);
});

describe("rules-1100 edit a custom bubble-level rule (UC 147)", () => {
  it("owner can PUT a new name for their bubble's rule and it reflects in GET", async () => {
    const updated = await request("PUT", `/api/rules/bubble/${bubbleId}/${ruleId}`, {
      token: creator.token,
      body: { name: NEW_RULE_NAME, description: "updated description" },
    });
    expect(
      updated.status,
      `PUT /api/rules/bubble/${bubbleId}/${ruleId} → ${updated.status} ${updated.text.slice(0, 200)}`,
    ).toBe(200);
    // PUT returns the flat updated rule (res.json(updated)); POST returns {...bubbleRule, rule}.
    expect(updated.json?.name).toBe(NEW_RULE_NAME);

    const list = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: creator.token });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.json)).toBe(true);

    const rule = (list.json ?? []).find((r: any) => r.rule?.id === ruleId);
    expect(rule, `rule ${ruleId} missing from bubble rules list`).toBeTruthy();
    expect(rule.rule.name).toBe(NEW_RULE_NAME);
  });
});
