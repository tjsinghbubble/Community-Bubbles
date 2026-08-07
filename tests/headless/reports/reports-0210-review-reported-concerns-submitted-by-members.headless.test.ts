// qa-id: reports-0210
// qa-tags: reports, headless, role-site-admin
// qa-reason: Non-super users cannot access report review queue; invalid report id returns 404 (UC 111)
//
// Negative path (two denials):
//   (a) role-user calls GET /api/admin/reports → 403 "Super admin access required"
//   (b) role-site-admin PATCHes a non-existent report id → 404 "Report not found"
// Both prove the correct auth gates are in place.
import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "crypto";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;
let member!: RoleSession;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
  member = await loginAs("role-user");
});

describe("reports-0210 review reported concerns submitted by members (negative)", () => {
  it("non-super user gets 403 when accessing admin report queue", async () => {
    const res = await request("GET", "/api/admin/reports", { token: member.token });
    expect(res.status, `GET /api/admin/reports (non-super) → ${res.status}`).toBe(403);
    expect(res.json?.error).toContain("Super admin access required");
  });

  it("site admin gets 404 when patching a non-existent report", async () => {
    const fakeReportId = randomUUID();
    const res = await request("PATCH", `/api/reports/${fakeReportId}/status`, {
      token: siteAdmin.token,
      body: { status: "resolved" },
    });
    expect(res.status, `PATCH /api/reports/<invalid>/status → ${res.status}`).toBe(404);
    expect(res.json?.error).toContain("Report not found");
  });
});
