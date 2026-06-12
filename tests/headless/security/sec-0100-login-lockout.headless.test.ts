// qa-id: sec-0100
// qa-tags: security, smoke, headless, role-any
// qa-reason: Repeated bad logins must lock the account (brute-force resistance)
//
// Password-stuffing resistance: repeated wrong-password logins must be throttled (429 from
// account lockout and/or rate limiting) and must NEVER return an auth token.
// Prediction: very likely PASS — server/auth-handler.ts locks after 5 failed attempts (429),
// and routes.ts rate-limits auth at 10/15min. Either mechanism satisfies "resistance".
import { describe, it, expect } from "vitest";
import { postJson } from "../lib/http.js";

// Dedicated victim account (seeded by qa-seed) — NOT a shared role account, so locking it
// out here never breaks other tests' logins on a long-lived server.
const VICTIM_EMAIL = "lockout-victim@bubble.test";
const WRONG_PASSWORD = "definitely-the-wrong-password";

describe("sec-0100 login resists password-stuffing", () => {
  it("throttles with 429 within a few attempts and never issues a token", async () => {
    let saw429 = false;
    let sawToken = false;
    const statuses: number[] = [];

    for (let i = 0; i < 6; i++) {
      const { status, json } = await postJson("/api/auth/login", {
        email: VICTIM_EMAIL,
        password: WRONG_PASSWORD,
      });
      statuses.push(status);
      if (status === 429) saw429 = true;
      if (json?.token) sawToken = true;
    }

    expect(sawToken, `wrong password must never return a token (statuses: ${statuses})`).toBe(false);
    expect(saw429, `expected a 429 within 6 wrong-password attempts (statuses: ${statuses})`).toBe(true);
  });
});
