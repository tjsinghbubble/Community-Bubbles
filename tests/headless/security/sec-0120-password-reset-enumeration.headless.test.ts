// qa-id: sec-0120
// qa-tags: security, smoke, headless, role-any
// qa-reason: Forgot-password returns a uniform response for any email (no enumeration)
//
// Account-enumeration resistance on the password-reset request endpoint. An attacker must not
// be able to tell whether an email is registered from the forgot-password response.
//
// Prediction: very likely PASS. server/password-reset-handler.ts:35-57 looks the user up but
// returns the SAME 200 body ("If an account with that email exists, a reset code has been
// sent.") whether or not the account exists; only a missing/invalid email field yields a 400.
// This is the uniform-response pattern that sec-0110 (signup) currently lacks.
//
// Rigor note: this is only a meaningful enumeration test when EXISTING_EMAIL actually exists in
// the database the API-under-test is connected to. Run the API via `npm run qa:server` (serves
// bubble_test, where qa-seed creates member@bubble.test). Against a DB lacking the seeded user
// the endpoint still answers uniformly, so the test passes — but it then only proves two
// unknown emails look alike, not registered-vs-fresh. See tests/README.md on qa:server.
import { describe, it, expect } from "vitest";
import { postJson, randomEmail } from "../lib/http.js";

const EXISTING_EMAIL = "member@bubble.test"; // seeded role-user (present when API runs qa:server)

describe("sec-0120 password-reset request resists email enumeration", () => {
  it("returns an identical status and body for a registered vs a fresh email", async () => {
    const existing = await postJson("/api/auth/forgot-password", { email: EXISTING_EMAIL });
    const fresh = await postJson("/api/auth/forgot-password", { email: randomEmail() });

    const detail =
      `registered email -> ${existing.status} (${existing.json?.message ?? existing.text}); ` +
      `fresh email -> ${fresh.status} (${fresh.json?.message ?? fresh.text})`;

    // Positive control: the uniform response is a success, not an error path that happens to match.
    expect(existing.status, `expected 200 from forgot-password; ${detail}`).toBe(200);
    // Enumeration oracle checks: status AND body must not differ by registration state.
    expect(existing.status, `status enumeration oracle: ${detail}`).toBe(fresh.status);
    expect(existing.json?.message, `body enumeration oracle: ${detail}`).toBe(fresh.json?.message);
  });
});
