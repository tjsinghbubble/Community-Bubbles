// qa-id: rules-1110
// qa-tags: rules, headless, role-bubble-admin
// qa-reason: Non-owner cannot edit bubble rules (403); empty name rejected (400); no state change on error (UC 147)
//
// UC 147 — Edit a custom bubble-level rule. Negative path.
//
// Tests two refusals: (1) a non-owner (role-user) is denied 403 when attempting PUT,
// and (2) the owner is rejected with 400 when updating to an empty name. Both cases assert
// the rule remains unchanged.

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

describe("rules-1110 edit a custom bubble-level rule — negative (UC 147)", () => {
  it("non-owner (member) is denied 403 when attempting PUT; rule unchanged", async () => {
    const res = await request("PUT", `/api/rules/bubble/${bubbleId}/${ruleId}`, {
      token: member.token,
      body: { name: "Hacked Rule Name" },
    });
    expect(res.status, `PUT from non-owner → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);

    // Verify rule remains unchanged
    const list = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: creator.token });
    expect(list.status).toBe(200);
    const rule = (list.json ?? []).find((r: any) => r.rule?.id === ruleId);
    expect(rule.rule.name).toBe(RULE_NAME);
  });

  it("owner is rejected 400 when updating to empty name; rule unchanged", async () => {
    const res = await request("PUT", `/api/rules/bubble/${bubbleId}/${ruleId}`, {
      token: creator.token,
      body: { name: "" },
    });
    expect(res.status, `PUT empty name → ${res.status} ${res.text.slice(0, 200)}`).toBe(400);

    // Verify rule remains unchanged
    const list = await request("GET", `/api/rules/bubble/${bubbleId}`, { token: creator.token });
    expect(list.status).toBe(200);
    const rule = (list.json ?? []).find((r: any) => r.rule?.id === ruleId);
    expect(rule.rule.name).toBe(RULE_NAME);
  });
});
