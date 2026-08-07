// qa-id: categories-0500
// qa-tags: categories, headless, role-site-admin
// qa-reason: Site admin DELETE /api/categories/:id → {success:true}, GET /api/categories/flat no longer contains it (UC 93)
//
// UC 93 — Delete a category. Positive path.
//
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

describe("categories-0500 delete a category (UC 93)", () => {
  it("site-admin DELETE /api/categories/:id removes it, GET confirms", async () => {
    // Create a category
    const categoryName = `QA Category to Delete ${Date.now()}`;
    const created = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: categoryName, displayName: "Deletable" },
    });
    expect(created.status).toBe(200);
    const categoryId = created.json?.id;
    expect(categoryId).toBeTruthy();

    // Delete it
    const deleted = await request("DELETE", `/api/categories/${categoryId}`, {
      token: siteAdmin.token,
    });
    expect(deleted.status).toBe(200);
    expect(deleted.json?.success).toBe(true);

    // Verify it's gone via GET /api/categories/flat
    const flat = await request("GET", "/api/categories/flat", { token: null });
    expect(flat.status).toBe(200);
    const found = (flat.json ?? []).find((c: any) => c.id === categoryId);
    expect(found, `deleted category should no longer exist in flat list`).toBeFalsy();
  });
});
