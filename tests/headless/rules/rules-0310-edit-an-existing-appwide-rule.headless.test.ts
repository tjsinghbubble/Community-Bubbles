// qa-id: rules-0310
// qa-tags: rules, headless, role-site-admin, role-user
// qa-reason: Non-super PUT rejected 403; rule name unchanged after denial (UC 81)
//
// UC 81 — Edit an existing app-wide rule. Negative path: authz.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let member!: RoleSession;
let createdRuleId: number | undefined;
const ORIGINAL_NAME = `QA App Rule ${Date.now()}`;
const ATTEMPTED_NEW_NAME = `QA App Rule Attempted Edit ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
});

afterAll(async () => {
  if (createdRuleId != null) {
    await request("DELETE", `/api/rules/app/${createdRuleId}`, { token: siteAdmin.token }).catch(
      () => undefined,
    );
  }
});

describe("rules-0310 edit an existing app-wide rule, negative (UC 81)", () => {
  it("role-user PUT /api/rules/app/:ruleId is rejected with 403; name unchanged", async () => {
    // Create a rule as site-admin
    const created = await request("POST", "/api/rules/app", {
      token: siteAdmin.token,
      body: { name: ORIGINAL_NAME, description: "created by rules-0310" },
    });
    expect(created.status).toBe(200);
    createdRuleId = created.json?.rule?.id ?? created.json?.ruleId;
    expect(createdRuleId).toBeTruthy();

    // Attempt to edit as role-user
    const attempted = await request("PUT", `/api/rules/app/${createdRuleId}`, {
      token: member.token,
      body: { name: ATTEMPTED_NEW_NAME },
    });
    expect(attempted.status, `PUT as role-user → ${attempted.status}, expected 403`).toBe(403);

    // Verify the name is unchanged
    const list = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    expect(list.status).toBe(200);
    const found = (list.json ?? []).find((r: any) => r.rule?.id === createdRuleId);
    expect(found, `rule with id ${createdRuleId} should still exist`).toBeTruthy();
    expect(found.rule.name, `rule name should remain ${ORIGINAL_NAME}`).toBe(ORIGINAL_NAME);
  });
});
