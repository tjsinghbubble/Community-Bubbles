// qa-id: rules-0400
// qa-tags: rules, headless, role-site-admin
// qa-reason: Site admin deletes an app-wide rule; it is removed from the list (UC 82)
//
// UC 82 — Delete an app-wide rule. Positive/blue-sky path.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let createdRuleId: number | undefined;
const NAME = `QA Rule Delete ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

afterAll(async () => {
  if (createdRuleId != null) {
    await request("DELETE", `/api/rules/app/${createdRuleId}`, { token: siteAdmin.token }).catch(
      () => undefined,
    );
  }
});

describe("rules-0400 delete an app-wide rule (UC 82)", () => {
  it("site-admin DELETE /api/rules/app/:ruleId removes the rule from the list", async () => {
    // Create a rule to delete
    const created = await request("POST", "/api/rules/app", {
      token: siteAdmin.token,
      body: { name: NAME, description: "disposable test rule" },
    });
    expect(created.status, `POST /api/rules/app → ${created.status}`).toBe(200);
    createdRuleId = created.json?.rule?.id ?? created.json?.ruleId;
    expect(createdRuleId, "POST should return the new rule id").toBeTruthy();

    // Verify it's in the list before deletion
    let list = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    expect(list.status).toBe(200);
    let found = (list.json ?? []).find((r: any) => r.rule?.id === createdRuleId);
    expect(found, `rule ${createdRuleId} should exist before deletion`).toBeTruthy();

    // Delete the rule
    const deleted = await request("DELETE", `/api/rules/app/${createdRuleId}`, {
      token: siteAdmin.token,
    });
    expect(deleted.status, `DELETE /api/rules/app/${createdRuleId} → ${deleted.status}`).toBe(200);
    expect(deleted.json?.success, "DELETE response should have success: true").toBe(true);

    // Verify it's gone from the list
    list = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    expect(list.status).toBe(200);
    found = (list.json ?? []).find((r: any) => r.rule?.id === createdRuleId);
    expect(found, `rule ${createdRuleId} should be gone after deletion`).toBeFalsy();

    // Mark as handled in afterAll cleanup
    createdRuleId = undefined;
  });
});
