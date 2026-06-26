// qa-id: infra-0510
// qa-tags: infra, smoke, headless, security, deploy, role-any
// qa-reason: A single malformed SPA-route request must not crash the server (DoS regression guard)
//
// Regression guard for the Vite dev-logger process.exit(1) DoS (Trello OXamtwL8). The SPA catch-all
// hands unknown paths to Vite; a non-JS file (e.g. /.DS_Store) makes import-analysis throw. The old
// custom logger called process.exit(1) on that error, killing the WHOLE server — an unauthenticated,
// single-request DoS. The fix (server/vite.ts) logs instead of exiting.
//
// This test sends that exact request, then confirms the server is STILL ALIVE. It is meaningful on
// BOTH a dev/Vite target (the path it exercises) and a prod/static target (where the junk path is a
// plain 404). If the server dies, the post-check connection is refused and this test fails with the
// honest signal "the malformed request took the server down".
import { describe, it, expect } from "vitest";
import { baseUrl, getStatus } from "../lib/http.js";

// A path the SPA catch-all forwards to Vite's import-analysis on a dev server. macOS junk that ZAP's
// forced-browse wordlist requests in the wild — i.e. a realistic, unauthenticated trigger.
const MALFORMED_PATHS = ["/.DS_Store", "/src/.DS_Store"];
const HEALTH = `${baseUrl()}/api/v1/health`;

describe("infra-0510 server survives a malformed SPA-route request", () => {
  it("stays up after junk paths hit the SPA catch-all", async () => {
    // Confirm liveness first so a pre-existing outage isn't misattributed to this request.
    const before = await getStatus(HEALTH).catch(() => 0);
    expect(before, `server not reachable at ${HEALTH} before the test`).toBeGreaterThan(0);

    // Fire the malformed requests. We don't care what they return (500 on dev, 404 on prod) — and a
    // vulnerable server may drop the connection mid-request, so swallow errors here. The verdict is
    // the post-check below.
    for (const p of MALFORMED_PATHS) {
      await getStatus(`${baseUrl()}${p}`).catch(() => 0);
    }

    // The real assertion: the process is still serving.
    let after: number;
    try {
      after = await getStatus(HEALTH);
    } catch (err: any) {
      throw new Error(
        `Server stopped responding after a malformed SPA-route request (${err?.cause?.code ?? err?.message}). ` +
          `This is the Vite-logger process.exit(1) DoS — a single unauthenticated request crashed the server.`,
      );
    }
    expect(after, `expected the server to still answer ${HEALTH}`).toBeLessThan(500);
  });
});
