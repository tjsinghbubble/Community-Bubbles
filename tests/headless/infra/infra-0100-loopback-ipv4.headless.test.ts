// qa-id: infra-0100
// qa-tags: infra, smoke, headless, role-any
// qa-reason: API is reachable over IPv4 loopback (127.0.0.1)
//
// Connectivity smoke test, paired with infra-0110 (IPv6). It forces the address family by
// connecting to an explicit literal rather than `localhost`. We use Node `fetch` (the same undici
// stack the qa runner uses) and NOT curl on purpose: curl/iOS do Happy Eyeballs and would fall
// back to the working family, masking a single-family server — exactly the defect these tests
// exist to catch. A passing IPv4 test + failing IPv6 test pinpoints an IPv4-only bind.
//
// Skipped automatically when QA_BASE_URL is not local loopback (a remote API can't be probed this way).
import { describe, it, expect } from "vitest";
import { loopbackUrl, getStatus, isLoopbackBase } from "../lib/http.js";

const probe = isLoopbackBase() ? it : it.skip;

describe("infra-0100 API reachable over IPv4 loopback", () => {
  probe("GET /api/v1/health on 127.0.0.1 connects and answers (status < 500)", async () => {
    const url = loopbackUrl("127.0.0.1");
    let status: number;
    try {
      status = await getStatus(url);
    } catch (err: any) {
      throw new Error(`IPv4 loopback unreachable at ${url}: ${err?.message ?? err} (${err?.cause?.code ?? "?"})`);
    }
    expect(status, `expected an HTTP response from ${url}`).toBeLessThan(500);
  });
});
