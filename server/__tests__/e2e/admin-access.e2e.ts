import { test, expect } from "@playwright/test";
import { ctx, authHeader } from "./ctx.ts";

// Admin-only endpoints that regular users and unauthenticated requests must not reach
const ADMIN_ENDPOINTS = [
  { method: "GET", path: "/api/admin/stats" },
  { method: "GET", path: "/api/admin/pending-bubbles" },
  { method: "GET", path: "/api/admin/pending-events" },
  { method: "GET", path: "/api/admin/pending-count" },
  { method: "GET", path: "/api/admin/audit-logs" },
  { method: "GET", path: "/api/admin/error-logs" },
  { method: "GET", path: "/api/admin/slow-calls" },
  { method: "GET", path: "/api/admin/latency" },
];

test.describe("Admin access control", () => {
  test("unauthenticated requests get 401 on all admin endpoints", async ({
    request,
  }) => {
    for (const { method, path } of ADMIN_ENDPOINTS) {
      const res = await request.fetch(path, { method });
      expect(
        res.status(),
        `${method} ${path} should return 401 for unauthenticated`
      ).toBe(401);
    }
  });

  test("regular user gets 403 on all admin endpoints", async ({ request }) => {
    const { userToken } = ctx();
    for (const { method, path } of ADMIN_ENDPOINTS) {
      const res = await request.fetch(path, {
        method,
        headers: authHeader(userToken),
      });
      expect(
        res.status(),
        `${method} ${path} should return 403 for regular user`
      ).toBe(403);
    }
  });

  test("super admin gets 200 on admin stats", async ({ request }) => {
    const { adminToken } = ctx();
    const res = await request.get("/api/admin/stats", {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("totalUsers");
  });

  test("super admin can see pending counts", async ({ request }) => {
    const { adminToken } = ctx();
    const res = await request.get("/api/admin/pending-count", {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("bubbles");
    expect(body).toHaveProperty("events");
  });

  test("super admin flag is not exposed to regular users via /api/auth/me", async ({
    request,
  }) => {
    const { userToken } = ctx();
    const res = await request.get("/api/auth/me", {
      headers: authHeader(userToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // isSuperAdmin must be false for a regular e2e test user
    expect(body.isSuperAdmin).toBe(false);
  });
});
