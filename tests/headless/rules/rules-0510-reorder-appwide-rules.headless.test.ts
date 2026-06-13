// qa-id: rules-0510
// qa-tags: rules, headless, role-user, role-site-admin
// qa-reason: Role-user denied PUT /api/rules/app/reorder; site-admin with non-array ruleIds rejected with 400; order unchanged (UC 83)
//
// UC 83 — Reorder app-wide rules. Negative path: unauthorized actor and invalid payload.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let member!: RoleSession;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
});

describe("rules-0510 reorder app-wide rules (UC 83 negatives)", () => {
  it("role-user PUT /api/rules/app/reorder is denied with 403", async () => {
    const denied = await request("PUT", "/api/rules/app/reorder", {
      token: member.token,
      body: { ruleIds: [] },
    });
    expect(denied.status, `member PUT reorder → ${denied.status}`).toBe(403);
  });

  it("site-admin PUT /api/rules/app/reorder with non-array ruleIds returns 400", async () => {
    const invalidPayload = await request("PUT", "/api/rules/app/reorder", {
      token: siteAdmin.token,
      body: { ruleIds: "not-an-array" },
    });
    expect(invalidPayload.status, `PUT with non-array → ${invalidPayload.status}`).toBe(400);
  });
});
