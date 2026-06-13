// qa-id: categories-0100
// qa-tags: categories, headless, role-site-admin
// qa-reason: Site admin GET /api/categories returns nested hierarchy with parents and children (UC 89)
//
// UC 89 — View the full category hierarchy. Positive path.
//
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let createdParentId: number | undefined;
let createdChildId: number | undefined;
const PARENT_NAME = `QA Parent Category ${Date.now()}`;
const CHILD_NAME = `QA Child Category ${Date.now()}`;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

afterAll(async () => {
  if (createdChildId != null) {
    await request("DELETE", `/api/categories/${createdChildId}`, { token: siteAdmin.token }).catch(
      () => undefined,
    );
  }
  if (createdParentId != null) {
    await request("DELETE", `/api/categories/${createdParentId}`, { token: siteAdmin.token }).catch(
      () => undefined,
    );
  }
});

describe("categories-0100 view the full category hierarchy (UC 89)", () => {
  it("site-admin GET /api/categories returns nested structure with parent at top level and child in parent's children[]", async () => {
    // Create a parent category
    const parentRes = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: PARENT_NAME },
    });
    expect(parentRes.status, `POST /api/categories (parent) → ${parentRes.status} ${parentRes.text.slice(0, 200)}`).toBe(
      200,
    );
    createdParentId = parentRes.json?.id;
    expect(createdParentId, "POST should return parent id").toBeTruthy();

    // Create a child category under the parent
    const childRes = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: CHILD_NAME, parentId: createdParentId },
    });
    expect(childRes.status, `POST /api/categories (child) → ${childRes.status} ${childRes.text.slice(0, 200)}`).toBe(
      200,
    );
    createdChildId = childRes.json?.id;
    expect(createdChildId, "POST should return child id").toBeTruthy();
    expect(childRes.json?.parentId, "child's parentId should match parent").toBe(createdParentId);

    // GET the hierarchy
    const list = await request("GET", "/api/categories", { token: siteAdmin.token });
    expect(list.status, `GET /api/categories → ${list.status}`).toBe(200);
    expect(Array.isArray(list.json), "response should be an array").toBe(true);

    // Find the parent in top-level entries (parentId null or undefined)
    const foundParent = (list.json ?? []).find((c: any) => c.id === createdParentId);
    expect(foundParent, `parent category '${PARENT_NAME}' should appear at top level`).toBeTruthy();
    expect(foundParent?.parentId, "parent's parentId should be null").toBeNull();

    // Find the child in the parent's children array
    const parentChildren = foundParent?.children ?? [];
    expect(Array.isArray(parentChildren), "parent should have a children array").toBe(true);
    const foundChild = parentChildren.find((c: any) => c.id === createdChildId);
    expect(foundChild, `child category '${CHILD_NAME}' should appear in parent's children[]`).toBeTruthy();
    expect(foundChild?.parentId, "child's parentId should match parent").toBe(createdParentId);
  });
});
