// qa-id: auth-1010
// qa-tags: auth, headless, role-user, security
// qa-reason: Unauthenticated request to export data is rejected with 401 and no profile is returned (UC 191)
//
// Negative test for UC 191: export personal data without auth. A request to
// /api/users/me/export without a token must be rejected with 401 and no profile
// or export data is returned.
import { describe, it, expect } from "vitest";
import { request } from "../lib/auth.js";

describe("auth-1010 export personal data without auth (negative)", () => {
  it("request without token → 401, no export payload", async () => {
    const res = await request("GET", "/api/users/me/export", {
      token: null,
    });

    expect(res.status, `export without token → ${res.status}`).toBe(401);
    expect(res.json?.profile, "profile must not be present for unauthed request").toBeUndefined();
    expect(res.json?.exportedAt, "exportedAt must not be present for unauthed request").toBeUndefined();
  });
});
