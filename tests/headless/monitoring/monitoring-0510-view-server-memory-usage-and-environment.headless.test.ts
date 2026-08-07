// qa-id: monitoring-0510
// qa-tags: monitoring, headless, role-user
// qa-reason: Non-super-admin role-user GET /api/admin/stats is rejected with 403; sensitive data gated (UC 102)
//
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let member!: RoleSession;

beforeAll(async () => {
  member = await loginAs("role-user");
});

describe("monitoring-0510 view server memory usage and environment, negative (UC 102)", () => {
  it("role-user GET /api/admin/stats is rejected with 403", async () => {
    const result = await request("GET", "/api/admin/stats", { token: member.token });
    expect(result.status, `GET /api/admin/stats as role-user → ${result.status}, expected 403`).toBe(403);
  });
});
