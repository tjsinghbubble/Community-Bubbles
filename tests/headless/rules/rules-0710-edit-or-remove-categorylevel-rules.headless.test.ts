// qa-id: rules-0710
// qa-tags: rules, headless, role-site-admin
// qa-reason: Non-super-admin is denied from editing or deleting a category rule; the rule remains unchanged (UC 85 negative)
//
// UC 85 — Edit or remove category-level rules. Negative path.
//
// Tests authorization denial: a role-user attempting to PUT or DELETE a category rule
// is denied (403). Verifies the rule remains unchanged after the denied attempt.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let member!: RoleSession;
let categoryId: number | undefined;
let ruleId: number | string | undefined;
const CATEGORY_NAME = `QA Rules Category ${Date.now()}`;
const RULE_NAME = `QA Category Rule ${Date.now()}`;
const ATTEMPTED_NAME = `${RULE_NAME} ATTEMPTED`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");

  // Create category
  const catRes = await request("POST", "/api/categories", {
    token: siteAdmin.token,
    body: { name: CATEGORY_NAME },
  });
  if (catRes.status === 200 && catRes.json?.id) {
    categoryId = catRes.json.id;
  }

  // Create rule
  const ruleRes = await request("POST", `/api/rules/category/${categoryId}`, {
    token: siteAdmin.token,
    body: { name: RULE_NAME, description: "test rule" },
  });
  if (ruleRes.status === 200) {
    ruleId = ruleRes.json?.rule?.id ?? ruleRes.json?.ruleId;
  }
});

afterAll(async () => {
  if (ruleId != null && categoryId != null) {
    await request("DELETE", `/api/rules/category/${categoryId}/${ruleId}`, {
      token: siteAdmin.token,
    }).catch(() => undefined);
  }
  if (categoryId != null) {
    await request("DELETE", `/api/categories/${categoryId}`, {
      token: siteAdmin.token,
    }).catch(() => undefined);
  }
});

describe("rules-0710 edit or remove category-level rules — authorization denial (UC 85)", () => {
  it("role-user is denied from editing a category rule (403)", async () => {
    const res = await request("PUT", `/api/rules/category/${categoryId}/${ruleId}`, {
      token: member.token,
      body: { name: ATTEMPTED_NAME },
    });
    expect(res.status, `PUT /api/rules/category/${categoryId}/${ruleId} as role-user → ${res.status}`).toBe(403);
  });

  it("after edit denial, the rule's name is unchanged", async () => {
    const res = await request("GET", `/api/rules/category/${categoryId}`, {
      token: siteAdmin.token,
    });
    expect(res.status).toBe(200);
    const mine = (res.json ?? []).find((r: any) => r.rule?.id === ruleId || r.ruleId === ruleId);
    expect(mine?.rule?.name || mine?.name, "rule name should still be the original").toBe(RULE_NAME);
  });

  it("role-user is denied from deleting a category rule (403)", async () => {
    const res = await request("DELETE", `/api/rules/category/${categoryId}/${ruleId}`, {
      token: member.token,
    });
    expect(res.status, `DELETE /api/rules/category/${categoryId}/${ruleId} as role-user → ${res.status}`).toBe(403);
  });

  it("after delete denial, the rule is still present in the category rules list", async () => {
    const res = await request("GET", `/api/rules/category/${categoryId}`, {
      token: siteAdmin.token,
    });
    expect(res.status).toBe(200);
    const mine = (res.json ?? []).find((r: any) => r.rule?.id === ruleId || r.ruleId === ruleId);
    expect(mine, "rule should still exist after failed delete").toBeTruthy();
  });
});
