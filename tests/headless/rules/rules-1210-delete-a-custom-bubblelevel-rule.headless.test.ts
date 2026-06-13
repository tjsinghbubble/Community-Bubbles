// qa-id: rules-1210
// qa-tags: rules, headless, role-bubble-admin
// qa-reason: Non-owner cannot delete bubble rules (403); non-existent rule returns 404; state unchanged on error (UC 148)
//
// UC 148 — Delete a custom bubble-level rule. Negative path.
//
// Tests two refusals: (1) a non-owner (role-user) is denied 403 when attempting DELETE,
// and (2) the owner is rejected with 404 when deleting a non-existent rule ID. Both cases
// assert no state changed.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;
let ruleId: number | undefined;
const BUBBLE_TITLE = `QA Rules Bubble ${Date.now()}`;
const RULE_NAME = `Test Rule ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
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

describe("rules-1210 delete a custom bubble-level rule — negative (UC 148)", () => {
  it("non-owner (member) is denied 403 when attempting DELETE; rule still present", async () => {
    const res = await request("DELETE", `/api/rules/bubble/${bubbleId}/${ruleId}`, {
      token: member.token,
    });
    expect(res.status, `DELETE from non-owner → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);

    // Verify rule still exists
    const list = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: creator.token });
    expect(list.status).toBe(200);
    const rule = (list.json ?? []).find((r: any) => r.rule?.id === ruleId);
    expect(rule, `rule ${ruleId} should still exist after unauthorized delete`).toBeTruthy();
  });

  it("owner is rejected 404 when deleting a non-existent rule ID", async () => {
    const fakeRuleId = 99999999;
    const res = await request("DELETE", `/api/rules/bubble/${bubbleId}/${fakeRuleId}`, {
      token: creator.token,
    });
    expect(res.status, `DELETE non-existent rule → ${res.status} ${res.text.slice(0, 200)}`).toBe(404);

    // Verify the real rule still exists
    const list = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: creator.token });
    expect(list.status).toBe(200);
    const rule = (list.json ?? []).find((r: any) => r.rule?.id === ruleId);
    expect(rule, `rule ${ruleId} should still exist after failed delete`).toBeTruthy();
  });
});
