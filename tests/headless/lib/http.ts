/** Minimal black-box HTTP helpers for headless tests. Targets QA_BASE_URL (set by the runner). */

export function baseUrl(): string {
  return process.env.QA_BASE_URL ?? "http://localhost:3000";
}

export interface JsonResponse {
  status: number;
  json: any;
  text: string;
}

export async function postJson(path: string, body: unknown): Promise<JsonResponse> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
