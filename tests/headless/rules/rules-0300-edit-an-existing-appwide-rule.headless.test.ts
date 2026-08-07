// qa-id: rules-0300
// qa-tags: rules, headless, role-site-admin
// qa-reason: Site admin PUT /api/rules/app/:ruleId changes name, GET confirms (UC 81)
//
// UC 81 — Edit an existing app-wide rule. Positive path.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let createdRuleId: number | undefined;
const ORIGINAL_NAME = `QA App Rule Original ${Date.now()}`;
const NEW_NAME = `QA App Rule Updated ${Date.now()}`;

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

describe("rules-0300 edit an existing app-wide rule (UC 81)", () => {
  it("site-admin PUT /api/rules/app/:ruleId changes name, GET confirms", async () => {
    // Create a rule
    const created = await request("POST", "/api/rules/app", {
      token: siteAdmin.token,
      body: { name: ORIGINAL_NAME, description: "created by rules-0300" },
    });
    expect(created.status).toBe(200);
    createdRuleId = created.json?.rule?.id ?? created.json?.ruleId;
    expect(createdRuleId).toBeTruthy();

    // Edit it
    const updated = await request("PUT", `/api/rules/app/${createdRuleId}`, {
      token: siteAdmin.token,
      body: { name: NEW_NAME, description: "updated by rules-0300" },
    });
    expect(updated.status, `PUT /api/rules/app/${createdRuleId} → ${updated.status}`).toBe(200);

    // Verify the change via GET
    const list = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    expect(list.status).toBe(200);
    const found = (list.json ?? []).find((r: any) => r.rule?.id === createdRuleId);
    expect(found, `rule with id ${createdRuleId} should still exist`).toBeTruthy();
    expect(found.rule.name, `rule name should be updated to ${NEW_NAME}`).toBe(NEW_NAME);
  });
});
