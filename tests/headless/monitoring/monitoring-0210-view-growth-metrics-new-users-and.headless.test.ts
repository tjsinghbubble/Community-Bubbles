// qa-id: monitoring-0210
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: A non-super-admin (role-user) is denied growth metrics — GET /api/admin/stats returns 403 (UC 99 negative)
//
// UC 99 — View growth metrics. Negative: a lower-privilege role is refused.
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let member!: RoleSession;

beforeAll(async () => {
  member = await loginAs("role-user");
});

describe("monitoring-0210 view growth metrics — authz denial (UC 99)", () => {
  it("role-user GET /api/admin/stats is rejected with 403", async () => {
    const result = await request("GET", "/api/admin/stats", { token: member.token });
    expect(result.status, `GET /api/admin/stats as role-user → ${result.status}, expected 403`).toBe(403);
  });
});
