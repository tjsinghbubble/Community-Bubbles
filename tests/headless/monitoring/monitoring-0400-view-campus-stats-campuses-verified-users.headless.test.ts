// qa-id: monitoring-0400
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: Site-admin GET /api/admin/stats returns campus counts: total, verifiedUsers, campusBubbles (UC 101)
//
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

describe("monitoring-0400 view campus stats (UC 101)", () => {
  it("role-site-admin GET /api/admin/stats returns campus stats object with expected fields", async () => {
    const result = await request("GET", "/api/admin/stats", { token: siteAdmin.token });
    expect(result.status, `GET /api/admin/stats → ${result.status} ${result.text.slice(0, 200)}`).toBe(200);

    const stats = result.json?.stats;
    expect(stats, "response should contain stats object").toBeTruthy();

    const campuses = stats?.campuses;
    expect(campuses, "stats should contain campuses object").toBeTruthy();

    expect(typeof campuses.total, "campuses.total should be a number").toBe("number");
    expect(campuses.total >= 0, "campuses.total should be >= 0").toBe(true);

    expect(typeof campuses.verifiedUsers, "campuses.verifiedUsers should be a number").toBe("number");
    expect(campuses.verifiedUsers >= 0, "campuses.verifiedUsers should be >= 0").toBe(true);

    expect(typeof campuses.campusBubbles, "campuses.campusBubbles should be a number").toBe("number");
    expect(campuses.campusBubbles >= 0, "campuses.campusBubbles should be >= 0").toBe(true);
  });
});
