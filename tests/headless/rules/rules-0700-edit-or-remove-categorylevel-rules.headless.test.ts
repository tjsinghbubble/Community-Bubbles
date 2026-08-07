// qa-id: rules-0700
// qa-tags: rules, headless, role-site-admin
// qa-reason: Site admin can edit a category rule's name and verify the change is reflected in the list (UC 85)
//
// UC 85 — Edit or remove category-level rules. Positive/blue-sky path (edit variant).
//
// Creates a category and a rule linked to it, then edits the rule's name via PUT,
// and verifies the change appears in GET /api/rules/category/:categoryId.
// Cleans up in afterAll.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let categoryId: number | undefined;
let ruleId: number | string | undefined;
const CATEGORY_NAME = `QA Rules Category ${Date.now()}`;
const RULE_NAME = `QA Category Rule ${Date.now()}`;
const UPDATED_NAME = `${RULE_NAME} UPDATED`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");

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

describe("rules-0700 edit or remove category-level rules (UC 85)", () => {
  it("site admin can edit a category rule's name", async () => {
    const res = await request("PUT", `/api/rules/category/${categoryId}/${ruleId}`, {
      token: siteAdmin.token,
      body: { name: UPDATED_NAME },
    });
    expect(res.status, `PUT /api/rules/category/${categoryId}/${ruleId} → ${res.status} ${res.text.slice(0, 200)}`).toBe(
      200,
    );
  });

  it("the edited rule's name appears in GET /api/rules/category/:categoryId", async () => {
    const res = await request("GET", `/api/rules/category/${categoryId}`, {
      token: siteAdmin.token,
    });
    expect(res.status, `GET /api/rules/category/${categoryId} → ${res.status}`).toBe(200);
    expect(Array.isArray(res.json), "category rules response should be an array").toBe(true);

    const mine = (res.json ?? []).find((r: any) => r.rule?.name === UPDATED_NAME);
    expect(mine, `edited rule '${UPDATED_NAME}' is missing from the category rules list`).toBeTruthy();
    expect(mine?.rule?.id || mine?.ruleId, "listed rule should have an id").toBeTruthy();
  });

  it("the old rule name is no longer in the list", async () => {
    const res = await request("GET", `/api/rules/category/${categoryId}`, {
      token: siteAdmin.token,
    });
    expect(res.status).toBe(200);
    const old = (res.json ?? []).find((r: any) => r.rule?.name === RULE_NAME);
    expect(old, `old rule name '${RULE_NAME}' should not be in the list`).toBeUndefined();
  });
});
