// qa-id: rules-0200
// qa-tags: rules, headless, role-site-admin
// qa-reason: Site admin POST /api/rules/app with {name:NAME} creates rule (UC 80)
//
// UC 80 — Create a new app-wide rule. Positive path.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let createdRuleId: number | undefined;
const NAME = `QA App Rule ${Date.now()}`;

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

describe("rules-0200 create a new app-wide rule (UC 80)", () => {
  it("site-admin POST /api/rules/app with {name} creates rule and returns id", async () => {
    const created = await request("POST", "/api/rules/app", {
      token: siteAdmin.token,
      body: { name: NAME, description: "created by rules-0200 test" },
    });
    expect(created.status, `POST /api/rules/app → ${created.status} ${created.text.slice(0, 200)}`).toBe(200);
    createdRuleId = created.json?.rule?.id ?? created.json?.ruleId;
    expect(createdRuleId, "POST should return the new rule id").toBeTruthy();

    // Verify the rule appears in GET list
    const list = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    expect(list.status, `GET /api/rules/app → ${list.status}`).toBe(200);
    expect(Array.isArray(list.json), "app-rules response should be an array").toBe(true);

    const found = (list.json ?? []).find((r: any) => r.rule?.name === NAME);
    expect(found, `created rule '${NAME}' should appear in GET list`).toBeTruthy();
    expect(found.rule.id, "listed rule id should match").toBe(createdRuleId);
  });
});
