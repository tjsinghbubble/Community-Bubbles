// qa-id: monitoring-0100
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: Site admin can view platform stats (users, bubbles, events, memberships totals) via GET /api/admin/stats (UC 98)
//
// UC 98 — View platform stats (users, bubbles, events, memberships). Positive path.
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

describe("monitoring-0100 view platform stats (UC 98)", () => {
  it("role-site-admin GET /api/admin/stats returns user, bubble, event, membership totals", async () => {
    const result = await request("GET", "/api/admin/stats", { token: siteAdmin.token });
    expect(result.status, `GET /api/admin/stats → ${result.status} ${result.text.slice(0, 200)}`).toBe(200);

    const stats = result.json?.stats;
    expect(stats, "response should have stats object").toBeTruthy();
    expect(typeof stats.users?.total, "stats.users.total should be a number").toBe("number");
    expect(stats.users.total, "stats.users.total should be > 0 (seeded roles exist)").toBeGreaterThan(0);
    expect(typeof stats.bubbles?.total, "stats.bubbles.total should be a number").toBe("number");
    expect(typeof stats.events?.total, "stats.events.total should be a number").toBe("number");
    expect(typeof stats.memberships?.total, "stats.memberships.total should be a number").toBe("number");
  });
});
