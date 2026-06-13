/** Role login + authenticated request helpers for headless authz tests.
 *  Tokens are cached per role for the lifetime of one vitest process. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { baseUrl, qaTestTag, QA_TEST_HEADER, type JsonResponse } from "./http.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROLES_PATH = join(__dirname, "..", "..", "config", "roles.json");

export type RoleKey = "role-user" | "role-bubble-admin" | "role-site-admin";

/** Short role codes for the per-test User-Agent (test(<id>,r=<code>,pid=<n>)). */
const ROLE_CODE: Record<RoleKey, string> = {
  "role-user": "u",
  "role-bubble-admin": "ba",
  "role-site-admin": "sa",
};
/** token -> role code, so request() can stamp the acting role onto each call's UA. */
const tokenRole = new Map<string, string>();

export interface RoleSession {
  token: string;
  userId: string;
  email: string;
}

const cache = new Map<RoleKey, RoleSession>();

export function roleCreds(role: RoleKey): { email: string; password: string } {
  const cfg = JSON.parse(readFileSync(ROLES_PATH, "utf8"));
  const r = cfg.roles[role];
  if (!r) throw new Error(`unknown role '${role}' in roles.json`);
  return { email: r.email, password: r.password };
}

export async function loginAs(role: RoleKey): Promise<RoleSession> {
  const hit = cache.get(role);
  if (hit) return hit;
  const { email, password } = roleCreds(role);
  const res = await fetch(`${baseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", [QA_TEST_HEADER]: qaTestTag(ROLE_CODE[role]) },
    body: JSON.stringify({ email, password }),
  });
  const json: any = await res.json().catch(() => null);
  if (res.status !== 200 || !json?.token) {
    throw new Error(
      `login as ${role} (${email}) failed: ${res.status} ${JSON.stringify(json)} — is the qa:server up and the DB seeded?`,
    );
  }
  const session: RoleSession = { token: json.token, userId: json.user?.id, email };
  tokenRole.set(session.token, ROLE_CODE[role]);
  cache.set(role, session);
  return session;
}

/** Generic authenticated (or anonymous, token=null) JSON request. */
export async function request(
  method: string,
  path: string,
  opts: { token?: string | null; body?: unknown } = {},
): Promise<JsonResponse> {
  const roleCode = opts.token ? tokenRole.get(opts.token) ?? "auth" : "anon";
  const headers: Record<string, string> = {
    "content-type": "application/json",
    [QA_TEST_HEADER]: qaTestTag(roleCode),
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
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
