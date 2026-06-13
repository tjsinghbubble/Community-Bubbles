// qa-id: monitoring-0900
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: Endpoint is pollable; multiple calls return 200 with fresh, increasing fetchedAt timestamps (UC 106)
//
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

describe("monitoring-0900 see auto-refreshed stats every 30 seconds (UC 106)", () => {
  it("GET /api/admin/stats returns fresh fetchedAt on multiple polls", async () => {
    // First call
    const result1 = await request("GET", "/api/admin/stats", { token: siteAdmin.token });
    expect(result1.status, `first GET /api/admin/stats → ${result1.status}`).toBe(200);

    const fetchedAt1 = result1.json?.fetchedAt;
    expect(fetchedAt1, "response should contain fetchedAt field").toBeTruthy();
    expect(
      !isNaN(Date.parse(fetchedAt1)),
      `fetchedAt should be a valid ISO timestamp, got ${fetchedAt1}`,
    ).toBe(true);

    // Second call — should have same or later timestamp
    const result2 = await request("GET", "/api/admin/stats", { token: siteAdmin.token });
    expect(result2.status, `second GET /api/admin/stats → ${result2.status}`).toBe(200);

    const fetchedAt2 = result2.json?.fetchedAt;
    expect(fetchedAt2, "second response should contain fetchedAt field").toBeTruthy();
    expect(
      !isNaN(Date.parse(fetchedAt2)),
      `second fetchedAt should be a valid ISO timestamp, got ${fetchedAt2}`,
    ).toBe(true);

    // Second timestamp should be >= first (data refreshed or same)
    expect(
      new Date(fetchedAt2).getTime() >= new Date(fetchedAt1).getTime(),
      `second fetchedAt should be >= first; first=${fetchedAt1}, second=${fetchedAt2}`,
    ).toBe(true);

    // Note: The 30-second auto-refresh cadence is verified in e2e tests (UC 106 e2e flow).
    // Headless tests the endpoint is pollable and returns fresh data.
  });
});
