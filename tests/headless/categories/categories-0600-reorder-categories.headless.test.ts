// qa-id: categories-0600
// qa-tags: categories, headless, role-site-admin
// qa-reason: Site admin creates two categories with displayOrder, swaps their order via PUT, GET confirms swap (UC 94)
//
// UC 94 — Reorder categories. Positive path.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let categoryAId: string | undefined;
let categoryBId: string | undefined;
const NAME_A = `QA Category A ${Date.now()}`;
const NAME_B = `QA Category B ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

afterAll(async () => {
  if (categoryAId != null) {
    await request("DELETE", `/api/categories/${categoryAId}`, { token: siteAdmin.token }).catch(
      () => undefined,
    );
  }
  if (categoryBId != null) {
    await request("DELETE", `/api/categories/${categoryBId}`, { token: siteAdmin.token }).catch(
      () => undefined,
    );
  }
});

describe("categories-0600 reorder categories (UC 94)", () => {
  it("site-admin creates two categories with displayOrder, swaps order, GET confirms", async () => {
    // Create category A with displayOrder 0
    const createdA = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: NAME_A, displayName: "Category A", displayOrder: 0 },
    });
    expect(createdA.status).toBe(200);
    categoryAId = createdA.json?.id;
    expect(categoryAId).toBeTruthy();

    // Create category B with displayOrder 1
    const createdB = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: NAME_B, displayName: "Category B", displayOrder: 1 },
    });
    expect(createdB.status).toBe(200);
    categoryBId = createdB.json?.id;
    expect(categoryBId).toBeTruthy();

    // Get current order to find their indices
    let flat = await request("GET", "/api/categories/flat", { token: null });
    expect(flat.status).toBe(200);
    const before = (flat.json ?? []).filter((c: any) => [categoryAId, categoryBId].includes(c.id));
    const indexABefore = before.findIndex((c: any) => c.id === categoryAId);
    const indexBBefore = before.findIndex((c: any) => c.id === categoryBId);
    expect(indexABefore).toBeGreaterThanOrEqual(0);
    expect(indexBBefore).toBeGreaterThanOrEqual(0);

    // Swap their displayOrder: A was 0 → 1, B was 1 → 0
    const updateA = await request("PUT", `/api/categories/${categoryAId}`, {
      token: siteAdmin.token,
      body: { displayOrder: 1 },
    });
    expect(updateA.status).toBe(200);

    const updateB = await request("PUT", `/api/categories/${categoryBId}`, {
      token: siteAdmin.token,
      body: { displayOrder: 0 },
    });
    expect(updateB.status).toBe(200);

    // Get the flat list again and verify the order flipped
    flat = await request("GET", "/api/categories/flat", { token: null });
    expect(flat.status).toBe(200);
    const after = (flat.json ?? []).filter((c: any) => [categoryAId, categoryBId].includes(c.id));
    const indexAAfter = after.findIndex((c: any) => c.id === categoryAId);
    const indexBAfter = after.findIndex((c: any) => c.id === categoryBId);

    // B should now come before A in the sorted list
    expect(
      indexBAfter < indexAAfter,
      `After reorder, B (index ${indexBAfter}) should come before A (index ${indexAAfter})`,
    ).toBe(true);
  });
});
