// qa-id: monitoring-0300
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: Site admin can view content-health metrics (orphan bubbles, avg members, rejected count) (UC 100)
//
// UC 100 — View content health (orphan bubbles, avg members, rejected count). Positive path.
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

describe("monitoring-0300 view content health metrics (UC 100)", () => {
  it("role-site-admin GET /api/admin/stats returns orphan, avgMembers, rejected", async () => {
    const result = await request("GET", "/api/admin/stats", { token: siteAdmin.token });
    expect(result.status, `GET /api/admin/stats → ${result.status} ${result.text.slice(0, 200)}`).toBe(200);

    const bubbles = result.json?.stats?.bubbles;
    expect(bubbles, "stats.bubbles should exist").toBeTruthy();
    for (const v of [bubbles.orphan, bubbles.avgMembers, bubbles.rejected]) {
      expect(typeof v, "content-health metric should be a number").toBe("number");
      expect(v, "content-health metric should be >= 0").toBeGreaterThanOrEqual(0);
    }
  });
});
