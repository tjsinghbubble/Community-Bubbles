// qa-id: categories-0200
// qa-tags: categories, headless, role-site-admin
// qa-reason: Site admin POST /api/categories {name:NAME} creates parent with parentId null (UC 90)
//
// UC 90 — Create a new parent category. Positive path.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let createdCategoryId: number | undefined;
const NAME = `QA Parent Category ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

afterAll(async () => {
  if (createdCategoryId != null) {
    await request("DELETE", `/api/categories/${createdCategoryId}`, { token: siteAdmin.token }).catch(
      () => undefined,
    );
  }
});

describe("categories-0200 create a new parent category (UC 90)", () => {
  it("site-admin POST /api/categories with {name} creates parent and returns category with parentId null", async () => {
    const created = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: NAME },
    });
    expect(created.status, `POST /api/categories → ${created.status} ${created.text.slice(0, 200)}`).toBe(200);
    createdCategoryId = created.json?.id;
    expect(createdCategoryId, "POST should return category id").toBeTruthy();
    expect(created.json?.parentId, "returned category should have parentId === null").toBeNull();

    // Verify it appears in the flat list
    const list = await request("GET", "/api/categories/flat", { token: siteAdmin.token });
    expect(list.status, `GET /api/categories/flat → ${list.status}`).toBe(200);
    expect(Array.isArray(list.json), "response should be an array").toBe(true);

    const found = (list.json ?? []).find((c: any) => c.id === createdCategoryId);
    expect(found, `created category '${NAME}' should appear in flat list`).toBeTruthy();
    expect(found?.name, "category name should match").toBe(NAME);
    expect(found?.parentId, "category in flat list should have parentId === null").toBeNull();
  });
});
