// qa-id: monitoring-0500
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: Site-admin GET /api/admin/stats returns server memory fields (heapUsedMb, rssMb > 0) and env info (UC 102)
//
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

describe("monitoring-0500 view server memory usage and environment (UC 102)", () => {
  it("role-site-admin GET /api/admin/stats returns server memory and environment fields", async () => {
    const result = await request("GET", "/api/admin/stats", { token: siteAdmin.token });
    expect(result.status, `GET /api/admin/stats → ${result.status} ${result.text.slice(0, 200)}`).toBe(200);

    const server = result.json?.server;
    expect(server, "response should contain server object").toBeTruthy();

    const memory = server?.memory;
    expect(memory, "server should contain memory object").toBeTruthy();

    expect(typeof memory.heapUsedMb, "memory.heapUsedMb should be a number").toBe("number");
    expect(memory.heapUsedMb > 0, "memory.heapUsedMb should be > 0").toBe(true);

    expect(typeof memory.rssMb, "memory.rssMb should be a number").toBe("number");
    expect(memory.rssMb > 0, "memory.rssMb should be > 0").toBe(true);

    expect(typeof server.environment, "server.environment should be a string").toBe("string");
    expect(server.environment.length > 0, "server.environment should be non-empty").toBe(true);

    expect(server.nodeVersion, "server.nodeVersion should be present").toBeTruthy();
  });
});
