// qa-id: auth-1000
// qa-tags: auth, headless, role-user, security
// qa-reason: Authed user can export their personal data and receives non-empty profile and exportedAt timestamp (UC 191)
//
// Positive test for UC 191: export personal data. A logged-in user makes a GET request
// to /api/users/me/export and receives 200 with exportedAt, profile (containing id, email,
// name, etc.), and other user data. Verifies the user can retrieve a complete snapshot
// of their own data.
import { describe, it, expect } from "vitest";
import { loginAs, request } from "../lib/auth.js";
import { roleCreds } from "../lib/auth.js";

describe("auth-1000 export personal data (positive)", () => {
  it("authed user can export their personal data", async () => {
    const user = await loginAs("role-user");
    const { email } = roleCreds("role-user");

    const res = await request("GET", "/api/users/me/export", {
      token: user.token,
    });

    expect(res.status, `export → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.exportedAt, "exportedAt must be a non-empty string").toBeTruthy();
    expect(typeof res.json?.exportedAt).toBe("string");
    expect(res.json?.profile?.email, "profile.email must match the user's email").toBe(email);
    expect(res.json?.profile?.id, "profile.id must be present").toBeTruthy();
  });
});
