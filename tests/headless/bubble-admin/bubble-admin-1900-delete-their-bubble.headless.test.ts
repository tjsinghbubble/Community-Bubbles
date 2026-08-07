// qa-id: bubble-admin-1900
// qa-tags: bubble-admin, headless, role-bubble-admin
// qa-reason: Verify owner can delete their own bubble (UC 27)
//
// Positive path: role-bubble-admin creates a bubble, then deletes it. The deletion
// succeeds (200, {success:true}) and the bubble is gone (GET returns 404).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Del Own ${Date.now()}`;

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(owner, siteAdmin, {
    title: TITLE,
    privacy: "Public",
  });
});

afterAll(async () => {
  // Best-effort cleanup in case the test fails before deletion.
  try {
    await deleteBubble(bubbleId, owner.token);
  } catch {
    // Already deleted or deletion failed; ignore.
  }
});

describe("bubble-admin-1900 delete their own bubble", () => {
  it("owner deletes the bubble → 200 {success:true}", async () => {
    const res = await request("DELETE", `/api/bubbles/${bubbleId}`, { token: owner.token });
    expect(res.status, `DELETE /api/bubbles/${bubbleId} → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.success).toBe(true);
  });

  it("bubble is now gone (404 on GET)", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}`);
    expect(res.status, `GET deleted bubble → ${res.status}, expected 404 or soft-delete absent`).toBe(404);
  });
});
