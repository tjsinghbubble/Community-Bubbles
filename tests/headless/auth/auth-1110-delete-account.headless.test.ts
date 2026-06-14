// qa-id: auth-1110
// qa-tags: auth, headless, role-user, security
// qa-reason: Unauthenticated delete request is rejected with 401 and a seeded account remains loginable (UC 192)
//
// Negative test for UC 192: delete account without auth. A DELETE request to
// /api/auth/delete-account without a token must be rejected with 401. Verifies
// no collateral damage: a seeded account (role-user) remains loginable after
// the failed delete attempt.
import { describe, it, expect } from "vitest";
import { request, loginAs } from "../lib/auth.js";

describe("auth-1110 delete account without auth (negative)", () => {
  it("delete without token → 401", async () => {
    const res = await request("DELETE", "/api/auth/delete-account", {
      token: null,
    });

    expect(res.status, `delete-account without token → ${res.status}`).toBe(401);
  });

  it("seeded account is still loginable after failed delete", async () => {
    // Verify that the failed delete attempt did not corrupt the seeded account.
    const user = await loginAs("role-user");

    expect(user.token, "role-user must still be loginable").toBeTruthy();
    expect(user.userId, "role-user userId must be present").toBeTruthy();
  });
});
