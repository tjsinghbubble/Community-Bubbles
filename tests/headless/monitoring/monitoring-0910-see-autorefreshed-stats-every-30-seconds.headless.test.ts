// qa-id: monitoring-0910
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: Endpoint is poll-safe; 3 rapid sequential GETs all return 200, no errors under repeated polling (UC 106)
//
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

describe("monitoring-0910 see auto-refreshed stats every 30 seconds, poll-safety (UC 106)", () => {
  it("3 rapid sequential GETs all return 200; endpoint is stable under repeated polling", async () => {
    const results = await Promise.all([
      request("GET", "/api/admin/stats", { token: siteAdmin.token }),
      request("GET", "/api/admin/stats", { token: siteAdmin.token }),
      request("GET", "/api/admin/stats", { token: siteAdmin.token }),
    ]);

    for (let i = 0; i < results.length; i++) {
      expect(
        results[i].status,
        `rapid GET ${i + 1} /api/admin/stats → ${results[i].status}, expected 200`,
      ).toBe(200);
      expect(results[i].json, `rapid GET ${i + 1} should return valid JSON`).toBeTruthy();
    }
  });
});
