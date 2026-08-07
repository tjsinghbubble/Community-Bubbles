// qa-id: categories-0400
// qa-tags: categories, headless, role-site-admin
// qa-reason: Site admin PUT /api/categories/:id {name, icon} changes category, GET /api/categories/flat confirms (UC 92)
//
// UC 92 — Edit a category name or icon. Positive path.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let createdCategoryId: string | undefined;
const ORIGINAL_NAME = `QA Category Original ${Date.now()}`;
const NEW_NAME = `QA Category Updated ${Date.now()}`;

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

describe("categories-0400 edit a category name or icon (UC 92)", () => {
  it("site-admin PUT /api/categories/:id changes name and icon, GET confirms", async () => {
    // Create a category
    const created = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: ORIGINAL_NAME, displayName: "Original Display" },
    });
    expect(created.status).toBe(200);
    createdCategoryId = created.json?.id;
    expect(createdCategoryId).toBeTruthy();

    // Edit it with new name and icon
    const updated = await request("PUT", `/api/categories/${createdCategoryId}`, {
      token: siteAdmin.token,
      body: { name: NEW_NAME, icon: "star" },
    });
    expect(updated.status, `PUT /api/categories/${createdCategoryId} → ${updated.status}`).toBe(200);

    // Verify the change via GET /api/categories/flat
    const flat = await request("GET", "/api/categories/flat", { token: null });
    expect(flat.status).toBe(200);
    const found = (flat.json ?? []).find((c: any) => c.id === createdCategoryId);
    expect(found, `category with id ${createdCategoryId} should still exist`).toBeTruthy();
    expect(found.name, `category name should be updated to ${NEW_NAME}`).toBe(NEW_NAME);
    expect(found.icon, `category icon should be updated to 'star'`).toBe("star");
  });
});
