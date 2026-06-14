// qa-id: reports-0200
// qa-tags: reports, headless, role-site-admin
// qa-reason: Site admin reviews reported concerns and can resolve them (UC 111)
//
// Positive path: role-user POSTs a bubble report → 201 with id and status "pending".
// Site admin then retrieves the report in GET /api/admin/reports, finds it, and PATCHes
// its status to "resolved" → returns 200 with updated status.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";
import { createApprovedBubble, deleteBubble } from "../lib/fixtures.js";

let creator!: RoleSession;
let siteAdmin!: RoleSession;
let member!: RoleSession;
let bubbleId!: string;
let reportId!: string;

const TITLE = `QA Report Concern Bubble ${Date.now()}`;

beforeAll(async () => {
  creator = await loginAs("role-bubble-admin");
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
  bubbleId = await createApprovedBubble(creator, siteAdmin, {
    title: TITLE,
    privacy: "Public",
  });
});

afterAll(async () => {
  await deleteBubble(bubbleId, creator.token);
});

describe("reports-0200 review reported concerns submitted by members", () => {
  it("member submits a bubble report → 201 with id and status pending", async () => {
    const reportReason = "This bubble violates community guidelines";
    const res = await request("POST", "/api/reports", {
      token: member.token,
      body: {
        reportType: "bubble",
        reason: reportReason,
        bubbleId,
      },
    });
    expect(res.status, `POST /api/reports → ${res.status} ${res.text.slice(0, 200)}`).toBe(201);
    expect(res.json?.id, "report should have an id").toBeTruthy();
    expect(res.json?.status).toBe("pending");
    expect(res.json?.reason).toBe(reportReason);
    reportId = res.json.id;
  });

  it("site admin retrieves the report in the review queue", async () => {
    const res = await request("GET", "/api/admin/reports", { token: siteAdmin.token });
    expect(res.status, `GET /api/admin/reports → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(Array.isArray(res.json), "reports should be an array").toBe(true);
    const report = (res.json ?? []).find((r: any) => r.id === reportId);
    expect(report, `report ${reportId} should appear in admin review queue`).toBeTruthy();
    expect(report?.status).toBe("pending");
  });

  it("site admin resolves the report → status changed to resolved", async () => {
    const res = await request("PATCH", `/api/reports/${reportId}/status`, {
      token: siteAdmin.token,
      body: { status: "resolved" },
    });
    expect(res.status, `PATCH /api/reports/:id/status → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.id).toBe(reportId);
    expect(res.json?.status).toBe("resolved");
  });
});
