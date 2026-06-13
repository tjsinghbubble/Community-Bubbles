// qa-id: rules-0410
// qa-tags: rules, headless, role-user, role-site-admin
// qa-reason: Role-user denied DELETE; site-admin DELETE non-existent id returns 404; rule unchanged (UC 82)
//
// UC 82 — Delete an app-wide rule. Negative path: unauthorized actor and missing resource.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let member!: RoleSession;
let createdRuleId: number | undefined;
const NAME = `QA Rule Neg Delete ${Date.now()}`;

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

describe("rules-0410 delete an app-wide rule (UC 82 negatives)", () => {
  it("role-user DELETE /api/rules/app/:ruleId is denied with 403", async () => {
    // Create a rule via site-admin
    const created = await request("POST", "/api/rules/app", {
      token: siteAdmin.token,
      body: { name: NAME, description: "test for unauthorized delete" },
    });
    expect(created.status).toBe(200);
    createdRuleId = created.json?.rule?.id ?? created.json?.ruleId;
    expect(createdRuleId).toBeTruthy();

    // Verify the rule exists
    let list = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    let found = (list.json ?? []).find((r: any) => r.rule?.id === createdRuleId);
    expect(found).toBeTruthy();

    // Attempt delete as member (non-super-admin)
    const denied = await request("DELETE", `/api/rules/app/${createdRuleId}`, {
      token: member.token,
    });
    expect(denied.status, `member DELETE should be denied → ${denied.status}`).toBe(403);

    // Verify rule still exists (no state change)
    list = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    found = (list.json ?? []).find((r: any) => r.rule?.id === createdRuleId);
    expect(found, "rule should still exist after denied delete attempt").toBeTruthy();
  });

  it("site-admin DELETE /api/rules/app/:ruleId with non-existent id returns 404", async () => {
    const nonExistentId = 99999999;
    const notFound = await request("DELETE", `/api/rules/app/${nonExistentId}`, {
      token: siteAdmin.token,
    });
    expect(notFound.status, `DELETE non-existent rule → ${notFound.status}`).toBe(404);
  });
});
