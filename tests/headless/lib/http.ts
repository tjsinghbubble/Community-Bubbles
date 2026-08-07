/** Minimal black-box HTTP helpers for headless tests. Targets QA_BASE_URL (set by the runner). */

export function baseUrl(): string {
  return process.env.QA_BASE_URL ?? "http://localhost:3000";
}

export interface JsonResponse {
  status: number;
  json: any;
  text: string;
}

const PID = process.pid;

/** Best-effort current test id (e.g. "auth-0100") from the running vitest file path.
 *  Uses the global `expect` (config has globals:true) so http.ts stays import-decoupled
 *  from vitest. Falls back to QA_TEST_ID or "unknown" outside a test. */
export function currentTestId(): string {
  try {
    const st = (globalThis as any).expect?.getState?.();
    const p: string | undefined = st?.testPath;
    if (p) {
      const m = p.match(/([a-z]+-\d{4})/);
      if (m) return m[1];
      const base = p.split("/").pop()?.replace(/\.headless\.test\.ts$/, "");
      if (base) return base;
    }
  } catch {
    /* not running inside a vitest test */
  }
  return process.env.QA_TEST_ID ?? "unknown";
}

/** Per-test identifier sent on every headless request in the dedicated `X-Bubble-Test`
 *  header so the server access log can be synced back to the originating test, e.g.
 *  `test(auth-0100,r=u,pid=1234)`. A dedicated header (not User-Agent) is used so this is
 *  engine-agnostic: web/browser tests can inject the same header (Playwright
 *  setExtraHTTPHeaders) WITHOUT clobbering the browser's real User-Agent. */
export const QA_TEST_HEADER = "x-bubble-test";
export function qaTestTag(roleCode = "anon"): string {
  return `test(${currentTestId()},r=${roleCode},pid=${PID})`;
}

export async function postJson(path: string, body: unknown): Promise<JsonResponse> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", [QA_TEST_HEADER]: qaTestTag() },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json, text };
}

export function randomEmail(prefix = "qa-enum"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@bb.org`;
}

/** True when QA_BASE_URL points at the local loopback (so address-family tests are meaningful). */
export function isLoopbackBase(): boolean {
  try {
    const h = new URL(baseUrl()).hostname;
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(h);
  } catch {
    return false;
  }
}

/** Build an http URL on a specific loopback address family, reusing the port from QA_BASE_URL.
 *  IPv6 literals are bracketed. e.g. loopbackUrl("::1") -> "http://[::1]:3000/api/v1/health". */
export function loopbackUrl(host: string, path = "/api/v1/health"): string {
  const port = new URL(baseUrl()).port || "3000";
  const h = host.includes(":") ? `[${host}]` : host;
  return `http://${h}:${port}${path}`;
}

/** GET a URL and resolve to its HTTP status; the fetch rejects (throws) on a connection failure. */
export async function getStatus(url: string, timeoutMs = 4000): Promise<number> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  return res.status;
}
