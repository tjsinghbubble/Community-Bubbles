// qa-id: site-admin-1200
// qa-tags: site-admin, headless, role-site-admin
// qa-reason: Site admin can access all seven admin endpoints (UC 20)
//
// Positive test for admin page access: a site admin must be able to read all admin
// dashboard endpoints. This proves the super admin role grants access to every admin
// page endpoint via 200 status on each GET.
import { describe, it, expect, beforeAll } from "vitest";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

let siteAdmin!: RoleSession;

const ADMIN_ENDPOINTS = [
  "/api/admin/pending-bubbles",
  "/api/admin/pending-events",
  "/api/admin/stats",
  "/api/admin/reports",
  "/api/admin/waitlist",
  "/api/admin/pending-count",
  "/api/admin/audit-logs",
];

beforeAll(async () => {
  siteAdmin = await loginAs("role-site-admin");
});

describe("site-admin-1200 access all admin pages", () => {
  ADMIN_ENDPOINTS.forEach((endpoint) => {
    it(`GET ${endpoint} as site admin → 200`, async () => {
      const res = await request("GET", endpoint, { token: siteAdmin.token });
      expect(res.status, `GET ${endpoint} → ${res.status} ${res.text.slice(0, 200)}`).toBe(200);
    });
  });
});
