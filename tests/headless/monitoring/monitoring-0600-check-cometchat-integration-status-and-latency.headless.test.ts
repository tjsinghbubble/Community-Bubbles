// qa-id: monitoring-0600
// qa-tags: monitoring, headless, role-site-admin
// qa-reason: Site-admin GET /api/admin/stats returns integrations.cometChat with status and latencyMs shape (UC 103)
//
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

describe("monitoring-0600 check CometChat integration status and latency (UC 103)", () => {
  it("role-site-admin GET /api/admin/stats returns integrations.cometChat with valid shape", async () => {
    const result = await request("GET", "/api/admin/stats", { token: siteAdmin.token });
    expect(result.status, `GET /api/admin/stats → ${result.status} ${result.text.slice(0, 200)}`).toBe(200);

    const integrations = result.json?.integrations;
    expect(integrations, "response should contain integrations object").toBeTruthy();

    const cometChat = integrations?.cometChat;
    expect(cometChat, "integrations should contain cometChat object").toBeTruthy();

    expect(
      ["ok", "error", "unconfigured"].includes(cometChat?.status),
      `cometChat.status should be one of ["ok", "error", "unconfigured"], got ${cometChat?.status}`,
    ).toBe(true);

    expect(
      cometChat?.latencyMs === null || typeof cometChat?.latencyMs === "number",
      `cometChat.latencyMs should be null or number, got ${typeof cometChat?.latencyMs}`,
    ).toBe(true);

    expect(
      cometChat?.error === null || typeof cometChat?.error === "string",
      `cometChat.error should be null or string, got ${typeof cometChat?.error}`,
    ).toBe(true);
  });
});
