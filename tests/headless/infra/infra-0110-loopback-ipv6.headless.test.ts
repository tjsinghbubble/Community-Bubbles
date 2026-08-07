// qa-id: infra-0110
// qa-tags: infra, smoke, headless, role-any
// qa-reason: API is reachable over IPv6 loopback (::1) — requires a dual-stack bind
//
// The IPv6 half of the loopback connectivity pair (see infra-0100). This is the one that catches
// the IPv4-only bind: if the server listens on 0.0.0.0 only, connecting to [::1] is refused
// (ECONNREFUSED) and this test FAILS — which is the correct, honest signal that the server is not
// dual-stack. The fix is to start the API with a dual-stack bind (qa:server sets API_BIND_HOST=::);
// once it does, this goes green. Forces IPv6 via an explicit [::1] literal so Happy Eyeballs can't
// silently fall back to IPv4 and hide the problem.
//
// Skipped automatically when QA_BASE_URL is not local loopback.
import { describe, it, expect } from "vitest";
import { loopbackUrl, getStatus, isLoopbackBase } from "../lib/http.js";

const probe = isLoopbackBase() ? it : it.skip;

describe("infra-0110 API reachable over IPv6 loopback", () => {
  probe("GET /api/v1/health on [::1] connects and answers (status < 500)", async () => {
    const url = loopbackUrl("::1");
    let status: number;
    try {
      status = await getStatus(url);
    } catch (err: any) {
      throw new Error(
        `IPv6 loopback unreachable at ${url}: ${err?.message ?? err} (${err?.cause?.code ?? "?"}). ` +
          `The API is likely bound IPv4-only — start it dual-stack (qa:server sets API_BIND_HOST=::).`,
      );
    }
    expect(status, `expected an HTTP response from ${url}`).toBeLessThan(500);
  });
});
