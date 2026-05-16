import { test, expect } from "@playwright/test";
import { ctx, authHeader } from "./ctx.ts";

// Endpoints that only super admins may access (regular users get 403)
const SUPER_ADMIN_ONLY_ENDPOINTS = [
  { method: "GET", path: "/api/admin/stats" },
  { method: "GET", path: "/api/admin/pending-bubbles" },
  { method: "GET", path: "/api/admin/audit-logs" },
  { method: "GET", path: "/api/admin/error-logs" },
  { method: "GET", path: "/api/admin/slow-calls" },
  { method: "GET", path: "/api/admin/latency" },
];

// All admin endpoints (including bubble-admin accessible ones) require auth
const ALL_ADMIN_ENDPOINTS = [
  ...SUPER_ADMIN_ONLY_ENDPOINTS,
  { method: "GET", path: "/api/admin/pending-events" },
  { method: "GET", path: "/api/admin/pending-count" },
];

test.describe("Admin access control", () => {
  test("unauthenticated requests get 401 on all admin endpoints", async ({
    request,
  }) => {
    for (const { method, path } of ALL_ADMIN_ENDPOINTS) {
      const res = await request.fetch(path, { method });
      expect(
        res.status(),
        `${method} ${path} should return 401 for unauthenticated`
      ).toBe(401);
    }
  });

  test("regular user gets 403 on super-admin-only endpoints", async ({ request }) => {
    const { userToken } = ctx();
    for (const { method, path } of SUPER_ADMIN_ONLY_ENDPOINTS) {
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
    expect(body).toHaveProperty("stats");
    expect(body.stats).toHaveProperty("users");
  });

  test("super admin can see pending counts", async ({ request }) => {
    const { adminToken } = ctx();
    const res = await request.get("/api/admin/pending-count", {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("count");
    expect(typeof body.count).toBe("number");
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
