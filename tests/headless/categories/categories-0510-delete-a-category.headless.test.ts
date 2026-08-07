// qa-id: categories-0510
// qa-tags: categories, headless, role-site-admin
// qa-reason: role-user DELETE /api/categories/:id → 403; category still present (UC 93)
//
// UC 93 — Delete a category. Negative path: authorization.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let regularUser!: RoleSession;
let createdCategoryId: string | undefined;
const CATEGORY_NAME = `QA Category for Delete Neg ${Date.now()}`;

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

describe("categories-0510 delete a category authorization (UC 93)", () => {
  it("role-user DELETE /api/categories/:id → 403 and category remains", async () => {
    // Create a category as site-admin
    const created = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: CATEGORY_NAME, displayName: "Undeletable" },
    });
    expect(created.status).toBe(200);
    createdCategoryId = created.json?.id;
    expect(createdCategoryId).toBeTruthy();

    // Try to delete as regular user
    const unauthorized = await request("DELETE", `/api/categories/${createdCategoryId}`, {
      token: regularUser.token,
    });
    expect(unauthorized.status, `role-user DELETE should be denied`).toBe(403);

    // Verify category still exists via GET
    const flat = await request("GET", "/api/categories/flat", { token: null });
    expect(flat.status).toBe(200);
    const found = (flat.json ?? []).find((c: any) => c.id === createdCategoryId);
    expect(found, `category should still exist after unauthorized delete`).toBeTruthy();
    expect(found.name).toBe(CATEGORY_NAME);
  });
});
