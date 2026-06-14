// qa-id: auth-1100
// qa-tags: auth, headless, role-user, security
// qa-reason: Disposable account deletion succeeds (200, success=true) and the deleted account becomes unloginable (UC 192)
//
// Positive test for UC 192: delete account. A freshly created disposable user account
// is deleted via DELETE /api/auth/delete-account and returns 200 with success=true.
// The deletion is verified by attempting to login with the same credentials. Note
// deleteUser is a SOFT delete (server/storage.ts:529 sets isActive=false and bumps
// tokenVersion), so the login handler refuses with 403 "account has been deactivated"
// (routes.ts:248), not 401 — either way the account is no longer loginable. A new
// disposable account is created per run and NOT reused from seeded fixtures.
import { describe, it, expect, afterAll } from "vitest";
import { request } from "../lib/auth.js";
import { randomEmail } from "../lib/http.js";

let createdEmail: string;
let createdToken: string;

describe("auth-1100 delete account (positive)", () => {
  it("create a disposable account for deletion", async () => {
    createdEmail = randomEmail("qa-del");
    const password = "ValidPassw0rd!";

    const signup = await request("POST", "/api/auth/signup", {
      body: {
        name: "QA Delete Test",
        email: createdEmail,
        password,
      },
    });

    expect(signup.status, `signup → ${signup.status}`).toBe(200);
    expect(signup.json?.token, "signup must return a token").toBeTruthy();
    createdToken = signup.json?.token;
  });

  it("delete the disposable account", async () => {
    const res = await request("DELETE", "/api/auth/delete-account", {
      token: createdToken,
    });

    expect(res.status, `delete-account → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    expect(res.json?.success).toBe(true);
    expect(res.json?.message).toMatch(/deleted/i);
  });

  it("deleted account is not loginable", async () => {
    const login = await request("POST", "/api/auth/login", {
      body: {
        email: createdEmail,
        password: "ValidPassw0rd!",
      },
    });

    expect(login.status, "soft-deleted account is refused at login (403 deactivated)").toBe(403);
    expect(login.json?.token, "no session for a deleted account").toBeUndefined();
  });
});

afterAll(async () => {
  // Cleanup is implicit: the deleted account cannot be accessed, so no teardown needed.
});
