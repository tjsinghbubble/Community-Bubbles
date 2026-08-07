// qa-id: site-admin-0210
// qa-tags: site-admin, headless, role-site-admin, unverified
// qa-reason: Non-super-admin denied rejection of pending bubble, no state change (UC 10 authz)
//
// Proves authz boundary: role-bubble-admin submits a bubble → pending,
// role-user (non-super-admin) attempts POST /api/admin/bubbles/:id/reject
// → 403 "Super admin access required", and status remains 'pending'.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let nonAdmin!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Reject Authz Bubble ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  nonAdmin = await loginAs("role-user");
  siteAdmin = await loginAs("role-site-admin");
});

afterAll(async () => {
  // Best-effort cleanup: super admin may delete any bubble (soft delete).
  if (bubbleId) await deleteBubble(bubbleId, siteAdmin.token);
});

describe("site-admin-0210 non-super rejects denied", () => {
  it("bubble admin submits a new bubble → created as 'pending'", async () => {
    const res = await request("POST", "/api/bubbles", {
      token: creator.token,
      body: {
        title: TITLE,
        tagline: "awaiting super-admin review",
        category: "General",
        description: "Created by site-admin-0210 to exercise the rejection authz boundary.",
      },
    });
    expect(res.status, `POST /api/bubbles → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.status).toBe("pending");
    bubbleId = res.json.id;
  });

  it("non-super-admin attempts rejection → 403 Super admin access required", async () => {
    const res = await request("POST", `/api/admin/bubbles/${bubbleId}/reject`, {
      token: nonAdmin.token,
      body: {
        reason: "Attempted violation",
      },
    });
    expect(res.status, `reject with non-super token → ${res.status}`).toBe(403);
    expect(res.json?.error).toContain("Super admin access required");
  });

  it("bubble status remains 'pending' (no state change)", async () => {
    const res = await request("GET", `/api/bubbles/${bubbleId}`);
    expect(res.status).toBe(200);
    expect(res.json?.status, "status must remain pending after denied rejection").toBe("pending");
  });
});
