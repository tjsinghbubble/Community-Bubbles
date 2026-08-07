// qa-id: categories-0110
// qa-tags: categories, headless, role-site-admin
// qa-reason: Created category appears in GET flat, DELETE removes it, phantom check after deletion (UC 89)
//
// UC 89 — View the full category hierarchy. Negative path: deleted category no longer appears.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let createdCategoryId: number | undefined;
const NAME = `QA Test Category ${Date.now()}`;

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

describe("categories-0110 view the full category hierarchy, deleted-state negative (UC 89)", () => {
  it("deleted category no longer appears in GET /api/categories/flat", async () => {
    // Create a category
    const created = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: NAME },
    });
    expect(created.status, `POST /api/categories → ${created.status} ${created.text.slice(0, 200)}`).toBe(200);
    createdCategoryId = created.json?.id;
    expect(createdCategoryId, "POST should return category id").toBeTruthy();

    // Verify it appears in the flat list
    let list = await request("GET", "/api/categories/flat", { token: siteAdmin.token });
    expect(list.status, `GET /api/categories/flat → ${list.status}`).toBe(200);
    expect(Array.isArray(list.json), "response should be an array").toBe(true);
    let found = (list.json ?? []).find((c: any) => c.id === createdCategoryId);
    expect(found, `newly created category '${NAME}' should appear in flat list`).toBeTruthy();

    // Delete the category
    const deleted = await request("DELETE", `/api/categories/${createdCategoryId}`, {
      token: siteAdmin.token,
    });
    expect(deleted.status, `DELETE /api/categories/${createdCategoryId} → ${deleted.status}`).toBe(200);

    // Verify it NO LONGER appears in the flat list
    list = await request("GET", "/api/categories/flat", { token: siteAdmin.token });
    expect(list.status, `GET /api/categories/flat after DELETE → ${list.status}`).toBe(200);
    found = (list.json ?? []).find((c: any) => c.id === createdCategoryId);
    expect(found, `deleted category should no longer appear in flat list`).toBeFalsy();
  });
});
