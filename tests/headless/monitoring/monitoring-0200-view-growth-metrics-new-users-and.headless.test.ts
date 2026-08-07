// qa-id: monitoring-0200
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: Site admin can view growth metrics for new users and bubbles over 7 and 30 days (UC 99)
//
// UC 99 — View growth metrics (new users/bubbles over 7 and 30 days). Positive path.
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

describe("monitoring-0200 view growth metrics (UC 99)", () => {
  it("role-site-admin GET /api/admin/stats returns 7d/30d growth for users and bubbles", async () => {
    const result = await request("GET", "/api/admin/stats", { token: siteAdmin.token });
    expect(result.status, `GET /api/admin/stats → ${result.status} ${result.text.slice(0, 200)}`).toBe(200);

    const stats = result.json?.stats;
    expect(stats, "response should have stats object").toBeTruthy();
    for (const path of [stats.users?.new7d, stats.users?.new30d, stats.bubbles?.new7d, stats.bubbles?.new30d]) {
      expect(typeof path, "growth metric should be a number").toBe("number");
      expect(path, "growth metric should be >= 0").toBeGreaterThanOrEqual(0);
    }
  });
});
