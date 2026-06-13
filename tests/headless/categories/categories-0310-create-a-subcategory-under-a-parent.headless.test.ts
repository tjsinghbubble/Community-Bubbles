// qa-id: categories-0310
// qa-tags: categories, headless, role-site-admin, role-user
// qa-reason: Non-super POST rejected 403; child not created in parent's children[] (UC 91)
//
// UC 91 — Create a subcategory under a parent. Negative path: authz denial.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let member!: RoleSession;
let createdParentId: number | undefined;
const PARENT_NAME = `QA Parent Category ${Date.now()}`;
const CHILD_NAME = `QA Child Category ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");

  // Create a parent category for the test
  const parentRes = await request("POST", "/api/categories", {
    token: siteAdmin.token,
    body: { name: PARENT_NAME },
  });
  if (parentRes.status === 200) {
    createdParentId = parentRes.json?.id;
  }
});

afterAll(async () => {
  if (createdParentId != null) {
    await request("DELETE", `/api/categories/${createdParentId}`, { token: siteAdmin.token }).catch(
      () => undefined,
    );
  }
});

describe("categories-0310 create a subcategory under a parent, negative (UC 91)", () => {
  it("role-user POST /api/categories with parentId is rejected with 403", async () => {
    expect(createdParentId, "parent should exist for this test").toBeTruthy();

    const result = await request("POST", "/api/categories", {
      token: member.token,
      body: { name: `${CHILD_NAME}-user-attempt`, parentId: createdParentId },
    });
    expect(result.status, `POST /api/categories (subcategory) as role-user → ${result.status}, expected 403`).toBe(403);

    // Verify the child was not created and does not appear in parent's children[]
    const list = await request("GET", "/api/categories", { token: siteAdmin.token });
    expect(list.status, `GET /api/categories → ${list.status}`).toBe(200);

    const foundParent = (list.json ?? []).find((c: any) => c.id === createdParentId);
    expect(foundParent, `parent should exist in hierarchy`).toBeTruthy();

    const parentChildren = foundParent?.children ?? [];
    const found = parentChildren.find((c: any) => c.name === `${CHILD_NAME}-user-attempt`);
    expect(
      found,
      `rejected role-user POST should not create child in parent's children[]`,
    ).toBeFalsy();
  });
});
