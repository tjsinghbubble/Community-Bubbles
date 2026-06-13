// qa-id: rules-0110
// qa-tags: rules, headless, role-site-admin
// qa-reason: GET /api/rules/app without token is denied with 401 (UC 79 auth boundary)
//
// UC 79 — View all app-wide rules. Negative path: auth boundary.
//
import { describe, it, expect } from "vitest";
import { request } from "../lib/auth.js";

describe("rules-0110 view all app-wide rules, no token (UC 79)", () => {
  it("GET /api/rules/app with no token is rejected with 401", async () => {
    const result = await request("GET", "/api/rules/app", { token: undefined });
    expect(result.status, `GET /api/rules/app with no token → ${result.status}, expected 401`).toBe(
      401,
    );
    // No state to verify changed (read-only operation), only that auth is enforced
  });
});
