// qa-id: sec-0110
// qa-tags: security, headless, unverified, role-any
// qa-reason: Signup must not leak which emails are already registered (enumeration)
//
// Account-enumeration resistance on the signup verification endpoint. An attacker must not be
// able to tell whether an email is already registered from the response.
//
// Prediction: very likely FAIL today. server/auth-handler.ts:133-172 returns 400
// "Email already exists" for a registered email but 200 for a fresh one — a clear enumeration
// oracle. This test is tagged `unverified`: its failure is an EXPECTED FINDING that documents
// the leak, not a regression. It will pass once send-verification returns a uniform response.
import { describe, it, expect } from "vitest";
import { postJson, randomEmail } from "../lib/http.js";

const EXISTING_EMAIL = "member@bubble.test"; // seeded role-user

describe("sec-0110 signup verification resists email enumeration", () => {
  it("returns an identical status for a registered vs a fresh email", async () => {
    const existing = await postJson("/api/auth/send-verification", { email: EXISTING_EMAIL });
    const fresh = await postJson("/api/auth/send-verification", { email: randomEmail() });

    expect(
      existing.status,
      `enumeration oracle: registered email -> ${existing.status} (${existing.json?.message ?? existing.text}); ` +
        `fresh email -> ${fresh.status} (${fresh.json?.message ?? fresh.text})`,
    ).toBe(fresh.status);
  });
});
