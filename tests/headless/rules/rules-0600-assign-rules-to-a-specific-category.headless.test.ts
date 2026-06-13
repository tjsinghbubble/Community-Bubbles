// qa-id: rules-0600
// qa-tags: rules, headless, role-site-admin
// qa-reason: Site admin can create a category rule by assigning a rule to a category and verify it appears in the list (UC 84)
//
// UC 84 — Assign rules to a specific category. Positive/blue-sky path.
//
// Creates a category, then creates a rule linked to that category, then verifies
// the rule appears in GET /api/rules/category/:categoryId. Cleans up the rule
// and category in afterAll.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let categoryId: number | undefined;
let ruleId: number | string | undefined;
const CATEGORY_NAME = `QA Rules Category ${Date.now()}`;
const RULE_NAME = `QA Category Rule ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
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

describe("rules-0600 assign rules to a specific category (UC 84)", () => {
  it("site admin can create a category", async () => {
    const res = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: CATEGORY_NAME },
    });
    expect(res.status, `POST /api/categories → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.id, "POST /api/categories should return category id").toBeTruthy();
    categoryId = res.json?.id;
  });

  it("site admin can assign a rule to the category", async () => {
    const res = await request("POST", `/api/rules/category/${categoryId}`, {
      token: siteAdmin.token,
      body: { name: RULE_NAME, description: "test rule for category" },
    });
    expect(res.status, `POST /api/rules/category/${categoryId} → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.rule?.id || res.json?.ruleId, "POST should return the new rule id").toBeTruthy();
    ruleId = res.json?.rule?.id ?? res.json?.ruleId;
  });

  it("the assigned rule appears in GET /api/rules/category/:categoryId", async () => {
    const res = await request("GET", `/api/rules/category/${categoryId}`, {
      token: siteAdmin.token,
    });
    expect(res.status, `GET /api/rules/category/${categoryId} → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(Array.isArray(res.json), "category rules response should be an array").toBe(true);

    const mine = (res.json ?? []).find((r: any) => r.rule?.name === RULE_NAME);
    expect(mine, `assigned rule '${RULE_NAME}' is missing from the category rules list`).toBeTruthy();
    expect(mine?.rule?.id || mine?.ruleId, "listed rule should have an id").toBeTruthy();
  });
});
