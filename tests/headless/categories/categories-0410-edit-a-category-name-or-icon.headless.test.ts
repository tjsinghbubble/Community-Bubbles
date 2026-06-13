// qa-id: categories-0410
// qa-tags: categories, headless, role-site-admin
// qa-reason: role-user PUT /api/categories/:id → 403; site-admin PUT non-existent id → 404; no state change (UC 92)
//
// UC 92 — Edit a category name or icon. Negative paths: authorization + not-found.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let regularUser!: RoleSession;
let createdCategoryId: string | undefined;
const CATEGORY_NAME = `QA Category for Neg Test ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
  regularUser = await loginAs("role-user");
});

afterAll(async () => {
  if (createdCategoryId != null) {
    await request("DELETE", `/api/categories/${createdCategoryId}`, { token: siteAdmin.token }).catch(
      () => undefined,
    );
  }
});

describe("categories-0410 edit a category authorization and not-found errors (UC 92)", () => {
  it("role-user PUT /api/categories/:id → 403 and category remains unchanged", async () => {
    // Create a category as site-admin
    const created = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: CATEGORY_NAME, displayName: "Test Display" },
    });
    expect(created.status).toBe(200);
    createdCategoryId = created.json?.id;
    expect(createdCategoryId).toBeTruthy();

    // Try to edit as regular user
    const unauthorized = await request("PUT", `/api/categories/${createdCategoryId}`, {
      token: regularUser.token,
      body: { name: "Updated Name" },
    });
    expect(unauthorized.status, `role-user PUT should be denied`).toBe(403);

    // Verify no state change via GET
    const flat = await request("GET", "/api/categories/flat", { token: null });
    expect(flat.status).toBe(200);
    const found = (flat.json ?? []).find((c: any) => c.id === createdCategoryId);
    expect(found, `category should still exist`).toBeTruthy();
    expect(found.name, `category name should be unchanged`).toBe(CATEGORY_NAME);
  });

  it("site-admin PUT non-existent category id → 404", async () => {
    const nonExistentId = "99999999-nonexistent";
    const notFound = await request("PUT", `/api/categories/${nonExistentId}`, {
      token: siteAdmin.token,
      body: { name: "Some Name" },
    });
    expect(notFound.status, `PUT non-existent id should return 404`).toBe(404);
  });
});
