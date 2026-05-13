import { test, expect } from "@playwright/test";

// @prod-safe — these tests only read, never write to the database
test.describe("Health endpoints", () => {
  test("GET /api/v1/ping returns pong", async ({ request }) => {
    const res = await request.get("/api/v1/ping");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/pong/i);
  });

  test("GET /api/v1/status returns server status", async ({ request }) => {
    const res = await request.get("/api/v1/status");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("uptime");
  });

  test("GET /api/v1/health returns healthy db", async ({ request }) => {
    const res = await request.get("/api/v1/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("db");
    expect(body.db).toBe("ok");
  });

  test("unknown route returns 404 not 500", async ({ request }) => {
    const res = await request.get("/api/does-not-exist-xyz");
    expect(res.status()).toBe(404);
  });
});
