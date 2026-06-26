// qa-id: auth-0140
// qa-tags: auth, smoke, headless, role-user
// qa-reason: Logs in a seeded user and surfaces the issued JWT (raw + decoded claims) for inspection (UC 170)
//
// Diagnostic/demonstration test: authenticate as the seeded role-user, then print the
// raw JWT plus its decoded header & payload. The app signs HS256 tokens carrying
// { userId, tokenVersion } with expiresIn "7d" (server/auth-handler.ts), so this also
// asserts the exp claim is ~7 days out — a regression guard on the token lifetime.
//
// The signature is NOT verified here (the JWT_SECRET is server-side only); we base64url-
// decode the payload, which is all that's needed to display the claims.
import { describe, it, expect } from "vitest";
import { loginAs, request } from "../lib/auth.js";

/** Decode a JWT's header/payload without verifying the signature (segments are base64url JSON). */
function decodeJwt(token: string): { header: any; payload: any } {
  const [h, p] = token.split(".");
  const b64urlToJson = (s: string) =>
    JSON.parse(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  return { header: b64urlToJson(h), payload: b64urlToJson(p) };
}

describe("auth-0140 login surfaces the issued JWT", () => {
  it("logs in role-user and displays the raw + decoded token", async () => {
    const session = await loginAs("role-user");
    expect(session.token, "login must return a token").toBeTruthy();

    const { header, payload } = decodeJwt(session.token);

    // ---- display ----
    /* eslint-disable no-console */
    console.log("\n===== JWT for", session.email, "=====");
    console.log("raw token :", session.token);
    console.log("header    :", JSON.stringify(header));
    console.log("payload   :", JSON.stringify(payload));
    if (payload.iat) console.log("issued at :", new Date(payload.iat * 1000).toISOString());
    if (payload.exp) {
      console.log("expires at:", new Date(payload.exp * 1000).toISOString());
      console.log("lifetime  :", ((payload.exp - payload.iat) / 86400).toFixed(2), "days");
    }
    console.log("====================================\n");
    /* eslint-enable no-console */

    // ---- structure / lifetime assertions ----
    expect(session.token.split("."), "JWT must have 3 segments").toHaveLength(3);
    expect(header.alg, "app signs HS256").toBe("HS256");
    expect(payload.userId, "payload carries userId").toBe(session.userId);
    expect(payload.tokenVersion, "payload carries tokenVersion").toEqual(expect.any(Number));

    // Default lifetime is "7d" (604800s). Allow a minute of clock slack on either side.
    const lifetime = payload.exp - payload.iat;
    expect(lifetime, `token lifetime ${lifetime}s should be ~7 days`).toBeGreaterThan(7 * 86400 - 60);
    expect(lifetime).toBeLessThan(7 * 86400 + 60);
  });

  it("the displayed token authenticates a request to /api/auth/me", async () => {
    const session = await loginAs("role-user");
    const me = await request("GET", "/api/auth/me", { token: session.token });
    expect(me.status, `me → ${me.status} ${me.text.slice(0, 200)}`).toBe(200);
    expect(me.json?.email).toBe(session.email);
  });
});
