// qa-id: monitoring-0110
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: A non-super-admin (role-user) is denied platform stats — GET /api/admin/stats returns 403 (UC 98 negative)
//
// UC 98 — View platform stats. Negative: a lower-privilege role is refused.
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let member!: RoleSession;

beforeAll(async () => {
  member = await loginAs("role-user");
});

describe("monitoring-0110 view platform stats — authz denial (UC 98)", () => {
  it("role-user GET /api/admin/stats is rejected with 403", async () => {
    const result = await request("GET", "/api/admin/stats", { token: member.token });
    expect(result.status, `GET /api/admin/stats as role-user → ${result.status}, expected 403`).toBe(403);
  });
});
