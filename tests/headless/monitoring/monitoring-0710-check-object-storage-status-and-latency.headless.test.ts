// qa-id: monitoring-0710
// qa-tags: monitoring, headless, role-user
// qa-reason: Non-super-admin role-user GET /api/admin/stats is rejected with 403; storage status gated (UC 104)
//
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let member!: RoleSession;

beforeAll(async () => {
  member = await loginAs("role-user");
});

describe("monitoring-0710 check object storage status and latency, negative (UC 104)", () => {
  it("role-user GET /api/admin/stats is rejected with 403", async () => {
    const result = await request("GET", "/api/admin/stats", { token: member.token });
    expect(result.status, `GET /api/admin/stats as role-user → ${result.status}, expected 403`).toBe(403);
  });
});
