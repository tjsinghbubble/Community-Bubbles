// qa-id: auth-0210
// qa-tags: auth, smoke, headless, role-user
// qa-reason: Signup rejects a duplicate email and a too-short password without creating a session (negative for UC 180)
//
// Named negative variants of auth-0200 (e2e signup happy path); the TSV flags UC 180 as
// needing negative tests. Two rejections:
//   1. duplicate email (the seeded role-user) → 400 via the email_hash unique constraint
//   2. password shorter than 8 chars → 400 via insertUserSchema, and the user must NOT
//      be creatable as a login afterwards
// Neither response may contain a token. The WORDING of the duplicate-email error is the
// enumeration leak sec-0110 documents — asserted loosely here (any 400, no session) so
// this test stays green if that leak is fixed with a uniform message.
import { describe, it, expect } from "vitest";
import { roleCreds, request } from "../lib/auth.js";
import { randomEmail } from "../lib/http.js";

describe("auth-0210 signup negatives", () => {
  it("signup with an already-registered email → 400, no token", async () => {
    const { email } = roleCreds("role-user");
    const res = await request("POST", "/api/auth/signup", {
      body: { name: "QA Dup Signup", email, password: "ValidPassw0rd!" },
    });
    expect(res.status, `duplicate-email signup → ${res.status} ${res.text.slice(0, 200)}`).toBe(400);
    expect(res.json?.token, "no session may be issued for a duplicate signup").toBeUndefined();
  });

  it("signup with a 7-char password → 400, no token, no account", async () => {
    const email = randomEmail("qa-shortpw");
    const res = await request("POST", "/api/auth/signup", {
      body: { name: "QA Short Password", email, password: "Abc123!" },
    });
    expect(res.status, `short-password signup → ${res.status} ${res.text.slice(0, 200)}`).toBe(400);
    expect(res.json?.error).toMatch(/at least 8/i);
    expect(res.json?.token).toBeUndefined();

    // The rejected signup must not have created the account.
    const login = await request("POST", "/api/auth/login", {
      body: { email, password: "Abc123!" },
    });
    expect(login.status, "rejected signup must not be loginable").toBe(401);
  });
});
