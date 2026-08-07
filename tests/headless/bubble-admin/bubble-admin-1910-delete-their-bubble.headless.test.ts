// qa-id: bubble-admin-1910
// qa-tags: bubble-admin, headless, role-bubble-admin
// qa-reason: Verify non-owner cannot delete another's bubble (UC 27)
//
// Negative path: role-bubble-admin creates a bubble, then role-user (non-owner)
// attempts to delete it. The delete is denied (403 "Not authorized to delete this bubble")
// and the bubble remains unchanged (GET returns 200, still exists).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let siteAdmin!: RoleSession;
let nonOwner!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Del Other ${Date.now()}`;

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  nonOwner = await loginAs("role-user");
  bubbleId = await createApprovedBubble(owner, siteAdmin, {
    title: TITLE,
    privacy: "Public",
  });
});

afterAll(async () => {
  // Cleanup: owner deletes the bubble they created.
  await deleteBubble(bubbleId, owner.token);
});

describe("bubble-admin-1910 non-owner cannot delete", () => {
  it("non-owner delete attempt → 403 'Not authorized to delete this bubble'", async () => {
    const res = await request("DELETE", `/api/bubbles/${bubbleId}`, { token: nonOwner.token });
    expect(res.status, `DELETE by non-owner → ${res.status}, expected 403`).toBe(403);
    expect(res.json?.error).toContain("Not authorized to delete this bubble");
  });

  it("bubble still exists, unchanged", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}`);
    expect(res.status, `GET after failed delete → ${res.status}`).toBe(200);
    expect(res.json?.id).toBe(bubbleId);
    expect(res.json?.title).toBe(TITLE);
  });
});
