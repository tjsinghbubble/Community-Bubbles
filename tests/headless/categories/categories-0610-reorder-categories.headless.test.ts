// qa-id: categories-0610
// qa-tags: categories, headless, role-site-admin
// qa-reason: role-user PUT /api/categories/:id {displayOrder} → 403; order unchanged (UC 94)
//
// UC 94 — Reorder categories. Negative path: authorization.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let regularUser!: RoleSession;
let createdCategoryId: string | undefined;
const CATEGORY_NAME = `QA Category for Reorder Neg ${Date.now()}`;

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

describe("categories-0610 reorder categories authorization (UC 94)", () => {
  it("role-user PUT /api/categories/:id {displayOrder} → 403 and order unchanged", async () => {
    // Create a category with displayOrder 0
    const created = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: CATEGORY_NAME, displayName: "Reorder Test", displayOrder: 0 },
    });
    expect(created.status).toBe(200);
    createdCategoryId = created.json?.id;
    expect(createdCategoryId).toBeTruthy();
    const originalDisplayOrder = created.json?.displayOrder;

    // Try to change displayOrder as regular user
    const unauthorized = await request("PUT", `/api/categories/${createdCategoryId}`, {
      token: regularUser.token,
      body: { displayOrder: 5 },
    });
    expect(unauthorized.status, `role-user PUT displayOrder should be denied`).toBe(403);

    // Verify displayOrder unchanged via GET
    const flat = await request("GET", "/api/categories/flat", { token: null });
    expect(flat.status).toBe(200);
    const found = (flat.json ?? []).find((c: any) => c.id === createdCategoryId);
    expect(found, `category should still exist`).toBeTruthy();
    expect(found.displayOrder, `displayOrder should be unchanged`).toBe(originalDisplayOrder);
  });
});
