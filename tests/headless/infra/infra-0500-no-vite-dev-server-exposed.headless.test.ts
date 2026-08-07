// qa-id: infra-0500
// qa-tags: infra, smoke, headless, security, deploy, role-any
// qa-reason: A deployed server must serve the prebuilt static bundle, not the Vite dev middleware
//
// Deployment-safety fingerprint. The Vite dev server must never run on a deployed host: it serves
// the SPA in-process, exposes the dev surface (/@vite/client, HMR), and — until the process.exit
// footgun was removed — a single bad request could crash it (see infra-0510 and the Vite logger in
// server/vite.ts). This test asserts a deployed target is NOT running Vite by two harmless GETs:
//   - GET /@vite/client  -> must be 404 in prod (it's a live JS asset only under the dev middleware)
//   - GET /              -> prod HTML references hashed /assets/*.js, NOT /src/main.tsx (dev) or @vite
//
// Skipped on local loopback: `npm run qa:server` runs NODE_ENV=development on purpose, so locally
// Vite IS expected. Point QA_BASE_URL at a staging/release host to enforce this.
import { describe, it, expect } from "vitest";
import { baseUrl, getStatus, isLoopbackBase } from "../lib/http.js";

const probe = isLoopbackBase() ? it.skip : it;

describe("infra-0500 Vite dev server not exposed on a deployed host", () => {
  probe("GET /@vite/client returns 404 (no dev middleware)", async () => {
    const url = `${baseUrl()}/@vite/client`;
    const status = await getStatus(url);
    expect(
      status,
      `${url} answered ${status}; a 200 means the Vite DEV middleware is running on a deployed ` +
        `host. Build the client and serve the static bundle with NODE_ENV=production.`,
    ).toBe(404);
  });

  probe("index.html references a built bundle, not dev source", async () => {
    // Send an HTML Accept so the SPA-document gate serves index.html (non-HTML clients now 404).
    const res = await fetch(`${baseUrl()}/`, {
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();
    expect(
      /src=["']\/src\/main\.tsx/.test(html),
      `/ served dev source (/src/main.tsx) — this is the Vite dev server, not a production build.`,
    ).toBe(false);
    expect(
      /@vite\/client/.test(html),
      `/ injected @vite/client — this is the Vite dev server, not a production build.`,
    ).toBe(false);
  });
});
