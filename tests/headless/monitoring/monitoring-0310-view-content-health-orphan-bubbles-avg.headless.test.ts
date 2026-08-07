// qa-id: monitoring-0310
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: A non-super-admin (role-user) is denied content-health metrics — GET /api/admin/stats returns 403 (UC 100 negative)
//
// UC 100 — View content health. Negative: a lower-privilege role is refused.
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let member!: RoleSession;

beforeAll(async () => {
  member = await loginAs("role-user");
});

describe("monitoring-0310 view content health — authz denial (UC 100)", () => {
  it("role-user GET /api/admin/stats is rejected with 403", async () => {
    const result = await request("GET", "/api/admin/stats", { token: member.token });
    expect(result.status, `GET /api/admin/stats as role-user → ${result.status}, expected 403`).toBe(403);
  });
});
