// qa-id: bubble-admin-2810
// qa-tags: bubble-admin, headless, role-bubble-admin
// qa-reason: Verify non-owner cannot set member limit on another's bubble (UC 36)
//
// Negative path: role-bubble-admin creates a bubble, then role-user (non-owner)
// attempts to set memberLimit=5. The PUT is denied (403 "Not authorized to edit this bubble")
// and memberLimit remains unchanged.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let siteAdmin!: RoleSession;
let nonOwner!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Limit Other ${Date.now()}`;

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
  await deleteBubble(bubbleId, owner.token);
});

describe("bubble-admin-2810 non-owner cannot set member limit", () => {
  it("non-owner attempts to set memberLimit → 403 'Not authorized to edit this bubble'", async () => {
    const res = await request("PUT", `/api/bubbles/${bubbleId}`, {
      token: nonOwner.token,
      body: { memberLimit: 5 },
    });
    expect(res.status, `PUT by non-owner → ${res.status}, expected 403`).toBe(403);
    expect(res.json?.error).toContain("Not authorized to edit this bubble");
  });

  it("bubble memberLimit is unchanged", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}`);
    expect(res.status).toBe(200);
    expect(res.json?.memberLimit, "memberLimit must not be 5 (unchanged)").not.toBe(5);
  });
});
