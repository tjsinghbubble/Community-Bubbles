// qa-id: site-admin-0200
// qa-tags: site-admin, headless, role-site-admin, unverified
// qa-reason: Site admin rejects a submitted bubble with a reason, preventing public visibility (UC 10)
//
// Proves the rejection pipeline: role-bubble-admin submits a bubble → pending,
// role-site-admin rejects it with a reason → status 'rejected', rejected bubble
// does NOT appear in the public list.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Reject Bubble ${Date.now()}`;
const REJECT_REASON = "This bubble violates community guidelines.";

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
});

afterAll(async () => {
  // Best-effort cleanup: super admin may delete any bubble (soft delete).
  if (bubbleId) await deleteBubble(bubbleId, siteAdmin.token);
});

describe("site-admin-0200 reject a submitted bubble", () => {
  it("bubble admin submits a new bubble → created as 'pending'", async () => {
    const res = await request("POST", "/api/bubbles", {
      token: creator.token,
      body: {
        title: TITLE,
        tagline: "awaiting super-admin review",
        category: "General",
        description: "Created by site-admin-0200 to exercise the rejection pipeline.",
      },
    });
    expect(res.status, `POST /api/bubbles → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.status).toBe("pending");
    bubbleId = res.json.id;
  });

  it("site admin rejects it with a reason → status 'rejected'", async () => {
    const res = await request("POST", `/api/admin/bubbles/${bubbleId}/reject`, {
      token: siteAdmin.token,
      body: {
        reason: REJECT_REASON,
      },
    });
    expect(res.status, `reject → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.status).toBe("rejected");
  });

  it("the rejected bubble is not publicly visible", async () => {
    const res = await request("GET", "/api/bubbles");
    expect(res.status).toBe(200);
    const titles = (res.json ?? []).map((b: any) => b.title);
    expect(titles, "rejected bubble must not appear in the public list").not.toContain(TITLE);
  });
});
