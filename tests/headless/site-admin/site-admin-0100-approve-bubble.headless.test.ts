// qa-id: site-admin-0100
// qa-tags: site-admin, smoke, headless, role-site-admin
// qa-reason: Site admin approves a submitted bubble, making it publicly visible (UC 68 + 135)
//
// Positive counterpart to sec-0200's deny matrix: /api/admin/pending-bubbles and
// /api/admin/bubbles/:id/approve are proven to 403 non-super tokens there; this proves
// the whole submit→approve pipeline WORKS for the site admin:
//   1. role-bubble-admin submits a new bubble → created with status 'pending' (UC 135)
//   2. the pending bubble is NOT in the public list (gate on getPublicBubbles)
//   3. role-site-admin sees it in /api/admin/pending-bubbles
//   4. approve → 200, status 'approved' (UC 68)
//   5. the bubble now appears in the public list
//
// The title is unique per run so re-runs without reseeding never collide; cleanup
// soft-deletes the bubble as the site admin (delete-any-bubble, UC 73). The qa seed
// truncates the disposable bubble_test DB on the next run regardless.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let bubbleId!: string;

const TITLE = `QA Approval Flow Bubble ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
});

afterAll(async () => {
  // Best-effort cleanup: super admin may delete any bubble (soft delete).
  if (bubbleId) await request("DELETE", `/api/bubbles/${bubbleId}`, { token: siteAdmin.token });
});

describe("site-admin-0100 approve a submitted bubble", () => {
  it("bubble admin submits a new bubble → created as 'pending'", async () => {
    const res = await request("POST", "/api/bubbles", {
      token: creator.token,
      body: {
        title: TITLE,
        tagline: "awaiting super-admin approval",
        category: "General",
        description: "Created by site-admin-0100 to exercise the approval pipeline.",
      },
    });
    expect(res.status, `POST /api/bubbles → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.status).toBe("pending");
    bubbleId = res.json.id;
  });

  it("the pending bubble is not publicly visible", async () => {
    const res = await request("GET", "/api/bubbles");
    expect(res.status).toBe(200);
    const titles = (res.json ?? []).map((b: any) => b.title);
    expect(titles, "pending bubble must not leak into the public list").not.toContain(TITLE);
  });

  it("site admin sees it in the pending queue", async () => {
    const res = await request("GET", "/api/admin/pending-bubbles", { token: siteAdmin.token });
    expect(res.status, res.text.slice(0, 200)).toBe(200);
    const pending = (res.json ?? []).find((b: any) => b.id === bubbleId);
    expect(pending, `bubble ${bubbleId} missing from pending-bubbles`).toBeTruthy();
  });

  it("site admin approves it → status 'approved'", async () => {
    const res = await request("POST", `/api/admin/bubbles/${bubbleId}/approve`, { token: siteAdmin.token });
    expect(res.status, `approve → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.status).toBe("approved");
  });

  it("the approved bubble is now publicly visible", async () => {
    const res = await request("GET", "/api/bubbles");
    expect(res.status).toBe(200);
    const found = (res.json ?? []).find((b: any) => b.id === bubbleId);
    expect(found, "approved bubble must appear in the public list").toBeTruthy();
  });
});
