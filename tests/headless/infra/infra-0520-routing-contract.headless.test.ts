// qa-id: infra-0520
// qa-tags: infra, smoke, headless, security, deploy, role-any
// qa-reason: Unmatched routes return the correct status/shape — /api is JSON, never the SPA page
//
// Routing-contract guard. Before the fix, the SPA catch-all answered EVERY unmatched request with
// index.html + 200 — including /api/* and non-GET verbs (proof: ZAP saw /api/v1/.env -> 200). That
// corrupts the API contract and makes every forced-browse probe look like a live endpoint. This
// test pins the corrected behavior:
//   - unmatched GET /api/*            -> 404 JSON (not 200, not HTML)
//   - unmatched modifying verb /api/* without a valid token -> 401 (don't reveal existence to
//     anonymous writers)
//   - unknown non-/api GET that accepts HTML -> SPA shell (200 html) so client deep links work
//   - unknown non-/api GET that accepts JSON -> NOT the SPA page (no HTML/200 shell)
// Runs on both dev and prod targets (the contract is identical in both).
import { describe, it, expect } from "vitest";
import { baseUrl } from "../lib/http.js";

const B = baseUrl();
const UNKNOWN_API = `${B}/api/v1/does-not-exist-${Date.now()}`;
const UNKNOWN_PAGE = `${B}/no-such-client-route-${Date.now()}`;
const t = () => AbortSignal.timeout(5000);

describe("infra-0520 unmatched-route routing contract", () => {
  it("unmatched GET /api/* is a JSON 404, not the SPA page", async () => {
    const res = await fetch(UNKNOWN_API, { headers: { accept: "application/json" }, signal: t() });
    const body = await res.text();
    expect(res.status, `expected 404 for ${UNKNOWN_API}, got ${res.status}`).toBe(404);
    expect(
      res.headers.get("content-type") ?? "",
      `unmatched /api should return JSON, not HTML (got ${res.headers.get("content-type")})`,
    ).toContain("application/json");
    expect(/<!doctype html|<html/i.test(body), `unmatched /api returned the SPA HTML page`).toBe(false);
  });

  it("unmatched modifying verb on /api/* without a token is 401", async () => {
    const res = await fetch(UNKNOWN_API, { method: "DELETE", signal: t() });
    expect(
      res.status,
      `anonymous DELETE to an unknown /api path should be 401 (auth required), got ${res.status}`,
    ).toBe(401);
  });

  it("unknown non-/api GET accepting HTML returns the SPA shell", async () => {
    const res = await fetch(UNKNOWN_PAGE, { headers: { accept: "text/html" }, signal: t() });
    const body = await res.text();
    expect(res.status, `SPA deep link ${UNKNOWN_PAGE} should serve the shell`).toBe(200);
    expect(/<!doctype html|<html/i.test(body), `expected the SPA HTML shell`).toBe(true);
  });

  it("unknown non-/api GET accepting JSON gets a JSON 404, not the SPA page", async () => {
    const res = await fetch(UNKNOWN_PAGE, { headers: { accept: "application/json" }, signal: t() });
    const body = await res.text();
    expect(res.status, `expected 404 for a JSON client at ${UNKNOWN_PAGE}, got ${res.status}`).toBe(404);
    expect(
      res.headers.get("content-type") ?? "",
      `expected a JSON 404 body (got ${res.headers.get("content-type")})`,
    ).toContain("application/json");
    expect(/<!doctype html|<html/i.test(body), `a JSON client got the SPA HTML page`).toBe(false);
  });
});
