// qa-id: bubble-admin-2800
// qa-tags: bubble-admin, headless, role-bubble-admin
// qa-reason: Verify owner can set a member limit on their bubble (UC 36)
//
// Positive path: role-bubble-admin creates a bubble, then sets memberLimit=5.
// The PUT succeeds (200) and a subsequent GET confirms memberLimit is 5.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let owner!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Member Limit ${Date.now()}`;

beforeAll(async () => {
  owner = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  bubbleId = await createApprovedBubble(owner, siteAdmin, {
    title: TITLE,
    privacy: "Public",
  });
});

afterAll(async () => {
  await deleteBubble(bubbleId, owner.token);
});

describe("bubble-admin-2800 set a member limit", () => {
  it("owner sets memberLimit=5 → 200", async () => {
    const res = await request("PUT", `/api/bubbles/${bubbleId}`, {
      token: owner.token,
      body: { memberLimit: 5 },
    });
    expect(res.status, `PUT /api/bubbles/${bubbleId} → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
  });

  it("bubble memberLimit reads back as 5", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}`);
    expect(res.status).toBe(200);
    expect(res.json?.memberLimit, "memberLimit must be set to 5").toBe(5);
  });
});
