// qa-id: categories-0300
// qa-tags: categories, headless, role-site-admin
// qa-reason: Site admin POST /api/categories {name,parentId} creates child nested in parent (UC 91)
//
// UC 91 — Create a subcategory under a parent. Positive path.
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

describe("categories-0300 create a subcategory under a parent (UC 91)", () => {
  it("site-admin POST /api/categories {name, parentId} creates child and appears nested in parent", async () => {
    // Create parent
    const parentRes = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: PARENT_NAME },
    });
    expect(parentRes.status, `POST /api/categories (parent) → ${parentRes.status} ${parentRes.text.slice(0, 200)}`).toBe(
      200,
    );
    createdParentId = parentRes.json?.id;
    expect(createdParentId, "POST should return parent id").toBeTruthy();

    // Create child with parentId set to parent
    const childRes = await request("POST", "/api/categories", {
      token: siteAdmin.token,
      body: { name: CHILD_NAME, parentId: createdParentId },
    });
    expect(childRes.status, `POST /api/categories (child) → ${childRes.status} ${childRes.text.slice(0, 200)}`).toBe(
      200,
    );
    createdChildId = childRes.json?.id;
    expect(createdChildId, "POST should return child id").toBeTruthy();
    expect(childRes.json?.parentId, "returned child should have parentId set to parent").toBe(createdParentId);

    // GET the nested hierarchy and verify child appears under parent
    const list = await request("GET", "/api/categories", { token: siteAdmin.token });
    expect(list.status, `GET /api/categories → ${list.status}`).toBe(200);
    expect(Array.isArray(list.json), "response should be an array").toBe(true);

    const foundParent = (list.json ?? []).find((c: any) => c.id === createdParentId);
    expect(foundParent, `parent category should appear at top level`).toBeTruthy();

    const parentChildren = foundParent?.children ?? [];
    expect(Array.isArray(parentChildren), "parent should have a children array").toBe(true);
    const foundChild = parentChildren.find((c: any) => c.id === createdChildId);
    expect(foundChild, `child category should appear in parent's children[]`).toBeTruthy();
    expect(foundChild?.name, "child's name should match").toBe(CHILD_NAME);
    expect(foundChild?.parentId, "child's parentId should match parent").toBe(createdParentId);
  });
});
