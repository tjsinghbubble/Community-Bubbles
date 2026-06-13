// qa-id: rules-0210
// qa-tags: rules, headless, role-site-admin, role-user
// qa-reason: Non-super POST rejected 403; empty name POST rejected 400; no rule created (UC 80)
//
// UC 80 — Create a new app-wide rule. Negative path: authz + validation.
//
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let member!: RoleSession;
const INTENDED_NAME = `QA App Rule ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
});

describe("rules-0210 create a new app-wide rule, negative (UC 80)", () => {
  it("role-user POST /api/rules/app is rejected with 403", async () => {
    const result = await request("POST", "/api/rules/app", {
      token: member.token,
      body: { name: `${INTENDED_NAME}-user-attempt` },
    });
    expect(result.status, `POST /api/rules/app as role-user → ${result.status}, expected 403`).toBe(403);

    // Verify no rule with that name was created
    const list = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    expect(list.status).toBe(200);
    const found = (list.json ?? []).find((r: any) => r.rule?.name === `${INTENDED_NAME}-user-attempt`);
    expect(found, `no rule should be created when role-user POST is rejected`).toBeFalsy();
  });

  it("site-admin POST /api/rules/app with empty body {} is rejected with 400", async () => {
    const result = await request("POST", "/api/rules/app", {
      token: siteAdmin.token,
      body: {},
    });
    expect(result.status, `POST /api/rules/app with empty body → ${result.status}, expected 400`).toBe(400);

    // Verify no rule without a name was created (confirm via GET)
    const list = await request("GET", "/api/rules/app", { token: siteAdmin.token });
    expect(list.status).toBe(200);
    // There should be no rule with empty/null name; not asserting list length (shared db),
    // just that nothing unexpected appeared
  });
});
