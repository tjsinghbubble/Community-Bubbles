// qa-id: auth-0400
// qa-tags: auth, social, smoke, headless, role-any
// qa-reason: QA stub-token seam exercises the social-auth pipeline (vendor signature is the only faked step)
//
// Real Google/Apple sign-in cannot be automated (vendor bot detection, external
// system UI). The server accepts a `qa-social-stub.<provider>.<json>` token in
// BUBBLE_SERVER_MODE=qa only (server/social-auth-handler.ts) — everything after
// signature verification runs the production path: account creation with
// socialAuthPending, provider-ID linking, JWT issuance, complete-social-profile.
// This suite proves the seam end-to-end over HTTP and pins its guardrails
// (provider mismatch, malformed payload, unverified email).
import { describe, it, expect } from "vitest";
import { request } from "../lib/auth.js";

const runId = process.pid; // unique-enough per run; accounts are throwaway in bubble_test
const stub = (provider: "google" | "apple", payload: Record<string, unknown>) =>
  `qa-social-stub.${provider}.${JSON.stringify(payload)}`;

describe("auth-0400 social-login stub seam", () => {
  const gEmail = `qa-social-g-${runId}@bubble.test`;
  const gSub = `qa-g-${runId}`;

  it("google stub: creates a pending social account, then logs the same identity back in", async () => {
    // First sign-in → new user, socialAuthPending, real JWT.
    const first = await request("POST", "/api/auth/google", {
      body: { idToken: stub("google", { sub: gSub, email: gEmail, email_verified: true, name: "QA Social" }) },
    });
    expect(first.status, JSON.stringify(first.json)).toBe(200);
    expect(first.json.isNewUser).toBe(true);
    expect(first.json.user.socialAuthPending).toBe(true);
    expect(first.json.token.split(".")).toHaveLength(3);

    // The issued JWT is a real session: complete-social-profile accepts it.
    const complete = await request("POST", "/api/auth/complete-social-profile", {
      token: first.json.token,
      body: { name: "QA Social", gender: "Prefer not to say", dateOfBirth: "1990-01-01" },
    });
    expect(complete.status, JSON.stringify(complete.json)).toBe(200);

    // Second sign-in with the same sub → same account, no longer new/pending.
    const second = await request("POST", "/api/auth/google", {
      body: { idToken: stub("google", { sub: gSub, email: gEmail, email_verified: true }) },
    });
    expect(second.status).toBe(200);
    expect(second.json.isNewUser).toBe(false);
    expect(second.json.user.id).toBe(first.json.user.id);
    expect(second.json.user.socialAuthPending).toBe(false);
  });

  it("google stub: unverified email is rejected by the production validation path", async () => {
    const res = await request("POST", "/api/auth/google", {
      body: { idToken: stub("google", { sub: `qa-g-unv-${runId}`, email: `unv-${runId}@bubble.test`, email_verified: false }) },
    });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/not verified/i);
  });

  it("apple stub: first sign-in uses fullName; second sign-in works with sub only (Apple drops email after first)", async () => {
    const aEmail = `qa-social-a-${runId}@bubble.test`;
    const aSub = `qa-a-${runId}`;
    const first = await request("POST", "/api/auth/apple", {
      body: {
        identityToken: stub("apple", { sub: aSub, email: aEmail }),
        fullName: { givenName: "QA", familyName: "Apple" },
      },
    });
    expect(first.status, JSON.stringify(first.json)).toBe(200);
    expect(first.json.isNewUser).toBe(true);
    expect(first.json.user.name).toBe("QA Apple");

    const second = await request("POST", "/api/auth/apple", {
      body: { identityToken: stub("apple", { sub: aSub }) }, // no email — the documented Apple behavior
    });
    expect(second.status, JSON.stringify(second.json)).toBe(200);
    expect(second.json.user.id).toBe(first.json.user.id);
  });

  it("guardrails: provider mismatch and malformed payload are 400, not accepted", async () => {
    const mismatch = await request("POST", "/api/auth/google", {
      body: { idToken: stub("apple", { sub: "x", email: "x@bubble.test", email_verified: true }) },
    });
    expect(mismatch.status).toBe(400);

    const malformed = await request("POST", "/api/auth/google", {
      body: { idToken: "qa-social-stub.google.{not json" },
    });
    expect(malformed.status).toBe(400);
  });

  // The strongest guardrail — stub rejected when the server is NOT in qa mode —
  // cannot be probed over HTTP here (this suite's server IS in qa mode by
  // definition). It is pinned by the mode check in social-auth-handler.ts
  // (qaStubEnabled: BUBBLE_SERVER_MODE=qa AND NODE_ENV!=production → otherwise
  // 401 before any parsing). Verify manually: run the server without
  // BUBBLE_SERVER_MODE and POST any qa-social-stub.* token — expect 401.
});
