// qa-id: rules-1200
// qa-tags: rules, headless, role-bubble-admin
// qa-reason: Bubble owner can delete a custom rule and it no longer appears in the rule list (UC 148)
//
// UC 148 — Delete a custom bubble-level rule. Positive/blue-sky path.
//
// Creates a disposable bubble with a rule, deletes the rule via DELETE, and verifies
// it no longer appears in the bubble's rule list via GET.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;
let ruleId: number | undefined;
const BUBBLE_TITLE = `QA Rules Bubble ${Date.now()}`;
const RULE_NAME = `Test Rule ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(creator, siteAdmin, { title: BUBBLE_TITLE });

  // Create a rule to be deleted
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

describe("rules-1200 delete a custom bubble-level rule (UC 148)", () => {
  it("owner can DELETE their bubble's rule and it is no longer in GET list", async () => {
    const deleted = await request("DELETE", `/api/rules/bubble/${bubbleId}/${ruleId}`, {
      token: creator.token,
    });
    expect(
      deleted.status,
      `DELETE /api/rules/bubble/${bubbleId}/${ruleId} → ${deleted.status} ${deleted.text.slice(0, 200)}`,
    ).toBe(200);
    expect(deleted.json?.success).toBe(true);

    const list = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: creator.token });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.json)).toBe(true);

    const rule = (list.json ?? []).find((r: any) => r.rule?.id === ruleId);
    expect(rule, `deleted rule ${ruleId} should not appear in bubble rules list`).toBeFalsy();
  });
});
