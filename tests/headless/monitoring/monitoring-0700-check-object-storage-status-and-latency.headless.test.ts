// qa-id: monitoring-0700
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: Site-admin GET /api/admin/stats returns integrations.objectStorage with status and latencyMs shape (UC 104)
//
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

describe("monitoring-0700 check object storage status and latency (UC 104)", () => {
  it("role-site-admin GET /api/admin/stats returns integrations.objectStorage with valid shape", async () => {
    const result = await request("GET", "/api/admin/stats", { token: siteAdmin.token });
    expect(result.status, `GET /api/admin/stats → ${result.status} ${result.text.slice(0, 200)}`).toBe(200);

    const integrations = result.json?.integrations;
    expect(integrations, "response should contain integrations object").toBeTruthy();

    const objectStorage = integrations?.objectStorage;
    expect(objectStorage, "integrations should contain objectStorage object").toBeTruthy();

    expect(
      ["ok", "error"].includes(objectStorage?.status),
      `objectStorage.status should be one of ["ok", "error"], got ${objectStorage?.status}`,
    ).toBe(true);

    expect(
      objectStorage?.latencyMs === null || typeof objectStorage?.latencyMs === "number",
      `objectStorage.latencyMs should be null or number, got ${typeof objectStorage?.latencyMs}`,
    ).toBe(true);

    expect(
      objectStorage?.error === null || typeof objectStorage?.error === "string",
      `objectStorage.error should be null or string, got ${typeof objectStorage?.error}`,
    ).toBe(true);
  });
});
