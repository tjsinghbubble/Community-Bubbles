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
