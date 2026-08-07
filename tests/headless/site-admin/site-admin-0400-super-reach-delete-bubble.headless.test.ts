// qa-id: site-admin-0400
// qa-tags: site-admin, headless, role-site-admin, unverified
// qa-reason: Site admin deletes any approved bubble (super-reach beyond ownership), removing from public list (UC 12)
//
// Proves super-reach: role-bubble-admin creates and gets approval for a bubble (owned by them),
// role-site-admin (NOT the owner) DELETE /api/bubbles/:id → 200 success,
// bubble is gone from the public list.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;

const TITLE = `QA SuperReach Bubble ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
});

afterAll(async () => {
  // Best-effort cleanup in case the delete did not happen or failed.
  if (bubbleId) await deleteBubble(bubbleId, siteAdmin.token);
});

describe("site-admin-0400 super-reach delete any bubble", () => {
  it("bubble admin creates and gets approval for a new bubble", async () => {
    bubbleId = await createApprovedBubble(creator, siteAdmin, {
      title: TITLE,
      privacy: "Public",
    });
    expect(bubbleId, "fixture bubble id required").toBeTruthy();
  });

  it("site admin (not the owner) deletes the bubble → 200 success", async () => {
    const res = await request("DELETE", `/api/bubbles/${bubbleId}`, {
      token: siteAdmin.token,
    });
    expect(res.status, `DELETE /api/bubbles/${bubbleId} → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.success).toBe(true);
  });

  it("the deleted bubble no longer appears in the public list", async () => {
    const res = await request("GET", "/api/bubbles");
    expect(res.status).toBe(200);
    const found = (res.json ?? []).find((b: any) => b.id === bubbleId);
    expect(found, "deleted bubble must not appear in the public list").toBeFalsy();
  });
});
