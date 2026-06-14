// qa-id: bubble-admin-3410
// qa-tags: bubble-admin, headless, role-bubble-admin
// qa-reason: Verify non-owner cannot set location on another's bubble (UC 133)
//
// Negative path: role-bubble-admin creates a bubble, then role-user (non-owner)
// attempts to set locationName. The PUT is denied (403 "Not authorized to edit this bubble")
// and locationName remains unchanged.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let siteAdmin!: RoleSession;
let nonOwner!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Location Other ${Date.now()}`;

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

describe("bubble-admin-3410 non-owner cannot set location", () => {
  it("non-owner attempts to set locationName → 403 'Not authorized to edit this bubble'", async () => {
    const res = await request("PUT", `/api/bubbles/${bubbleId}`, {
      token: nonOwner.token,
      body: { locationName: "hax" },
    });
    expect(res.status, `PUT by non-owner → ${res.status}, expected 403`).toBe(403);
    expect(res.json?.error).toContain("Not authorized to edit this bubble");
  });

  it("bubble locationName is unchanged", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}`);
    expect(res.status).toBe(200);
    expect(res.json?.locationName, "locationName must not be 'hax' (unchanged)").not.toBe("hax");
  });
});
