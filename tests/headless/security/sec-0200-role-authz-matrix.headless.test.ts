// qa-id: sec-0200
// qa-tags: security, smoke, headless, role-user, role-bubble-admin
// qa-reason: Role-authz matrix: lower-privilege tokens are denied on every role-gated API route
//
// Negative role coverage, exhaustive by construction:
//   - SUPER_ONLY: every isSuperAdmin-gated route, probed as role-user AND role-bubble-admin
//     (a bubble admin is NOT a site admin) — strict 403 expected, never 2xx.
//   - BUBBLE_ADMIN_ONLY: per-bubble management routes on the seeded "QA Test Bubble",
//     probed as role-user (who is not a member of it) — strict 403.
//   - CROSS_USER: role-user touching another user's resources (bubble-admin's bulletin
//     post / event) — strict 403.
//   - SCOPED_EMPTY: /api/admin/* routes that intentionally scope-by-role instead of
//     denying (member gets 200 + EMPTY data) — asserted empty, so a future change that
//     starts leaking other admins' data fails here.
//   - COVERAGE GUARD: parses server/routes.ts and fails if any isSuperAdmin-gated route
//     is neither probed above nor explicitly exempted with a reason. Adding a new
//     admin route without classifying it here is a test failure by design.
//
// Setup writes (as role-bubble-admin, against the disposable bubble_test DB): one event
// and one bulletin post in QA Test Bubble, used as the cross-user / bubble-admin targets.
// The qa seed truncates everything on the next run.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loginAs, request, type RoleSession } from "../lib/auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_FILE = join(__dirname, "..", "..", "..", "server", "routes.ts");

// Random UUID for routes whose role gate fires before any resource lookup.
const FAKE_ID = "00000000-0000-4000-8000-000000000000";

// Definite-assignment (!): all are set in beforeAll, which vitest guarantees runs first.
let member!: RoleSession;
let bubbleAdmin!: RoleSession;
let bubbleId!: string;
let eventId!: string;
let postId!: string;
let categoryId!: string;

beforeAll(async () => {
  member = await loginAs("role-user");
  bubbleAdmin = await loginAs("role-bubble-admin");

  // Seeded bubble owned by the bubble-admin role (public, approved).
  const bubbles = await request("GET", "/api/bubbles");
  const qaBubble = (bubbles.json ?? []).find((b: any) => b.title === "QA Test Bubble");
  if (!qaBubble) throw new Error("seeded 'QA Test Bubble' not found — run npm run qa:seed");
  bubbleId = qaBubble.id;

  // The BUBBLE_ADMIN_ONLY matrix below assumes role-user is NOT a member of this bubble, so
  // the member-gated routes (photos / sync-chat-members / bulletin) deny with 403. The seed
  // honors that, BUT in a full `--all` run the e2e layer runs first and joining-0400 joins
  // role-user to this public bubble — leaking an approved membership into this headless run,
  // which then sees those routes return 200/400 instead of 403 (false authz failure). Force
  // non-membership defensively; best-effort (a 4xx when already a non-member is fine).
  await request("POST", `/api/bubbles/${bubbleId}/leave`, { token: member.token });

  // A category id for the super-only category routes (public list; any id works —
  // the super gate must fire before the resource is touched).
  const cats = await request("GET", "/api/categories/flat");
  categoryId = cats.json?.[0]?.id ?? FAKE_ID;

  // Cross-user targets, created by the bubble admin.
  const ev = await request("POST", "/api/events", {
    token: bubbleAdmin.token,
    body: { bubbleId, title: "QA Authz Probe Event", date: "2027-01-01", startTime: "18:00" },
  });
  if (!ev.json?.id) throw new Error(`setup: event create as bubble-admin failed: ${ev.status} ${ev.text}`);
  eventId = ev.json.id;

  const types = await request("GET", "/api/bulletin/post-types", { token: bubbleAdmin.token });
  const postType = (types.json ?? []).find((t: any) => !t.adminOnly) ?? types.json?.[0];
  if (!postType) throw new Error(`setup: no bulletin post types: ${types.status} ${types.text}`);
  const post = await request("POST", `/api/bubbles/${bubbleId}/bulletin/posts`, {
    token: bubbleAdmin.token,
    body: { postTypeId: postType.id, title: "QA Authz Probe Post", body: "authz matrix target" },
  });
  if (!post.json?.id) throw new Error(`setup: bulletin post create failed: ${post.status} ${post.text}`);
  postId = post.json.id;
});

// Path is always lazy and body may be (both can reference ids resolved in beforeAll).
type Probe = [method: string, path: () => string, body?: unknown | (() => unknown)];

const resolveBody = (body: Probe[2]) => (typeof body === "function" ? (body as () => unknown)() : body);

// ── Site-admin-only routes (inline `isSuperAdmin` gate → 403). Paths are lazy so they
// can reference ids resolved in beforeAll. Keep the template comment in sync with the
// coverage guard's `covered` list below.
const SUPER_ONLY: Probe[] = [
  ["GET", () => "/api/admin/pending-bubbles"],
  ["POST", () => `/api/admin/bubbles/${bubbleId}/approve`],
  ["POST", () => `/api/admin/bubbles/${bubbleId}/reject`, { reason: "qa probe" }],
  ["POST", () => `/api/admin/users/${member.userId}/unlock`],
  ["GET", () => "/api/admin/stats"],
  ["GET", () => "/api/admin/maintenance-mode"],
  ["PATCH", () => "/api/admin/maintenance-mode", { enabled: false }],
  ["GET", () => "/api/admin/audit-logs"],
  ["GET", () => "/api/admin/error-logs/count"],
  ["GET", () => "/api/admin/error-logs"],
  ["DELETE", () => "/api/admin/error-logs"],
  ["GET", () => "/api/admin/latency"],
  ["DELETE", () => "/api/admin/latency"],
  ["GET", () => "/api/admin/latency/trends"],
  ["GET", () => "/api/admin/slow-calls"],
  ["DELETE", () => "/api/admin/slow-calls"],
  ["GET", () => "/api/admin/slow-call-config"],
  ["PATCH", () => "/api/admin/slow-call-config", {}],
  ["POST", () => "/api/admin/repair-member-counts"],
  ["POST", () => "/api/admin/repair-event-dates"],
  ["POST", () => "/api/admin/seed-staging"],
  ["GET", () => "/api/crash-reports"],
  ["POST", () => `/api/admin/events/${eventId}/approve`],
  ["POST", () => `/api/admin/events/${eventId}/reject`, { reason: "qa probe" }],
  ["POST", () => "/api/admin/push-tokens/cleanup"],
  ["GET", () => "/api/admin/reports"],
  ["GET", () => "/api/analytics/metrics"],
  ["POST", () => "/api/categories", { name: "QA Unauthorized Category" }],
  ["PUT", () => `/api/categories/${categoryId}`, { name: "QA Unauthorized Rename" }],
  ["DELETE", () => `/api/categories/${categoryId}`],
  ["GET", () => "/api/category-placeholders"],
  ["POST", () => `/api/categories/${categoryId}/placeholders`, { title: "x" }],
  ["PUT", () => `/api/category-placeholders/${FAKE_ID}`, { title: "x" }],
  ["DELETE", () => `/api/category-placeholders/${FAKE_ID}`],
  ["POST", () => "/api/rules/app", { text: "qa probe rule" }],
  ["PUT", () => "/api/rules/app/reorder", { ruleIds: [] }],
  ["PUT", () => `/api/rules/app/${FAKE_ID}`, { text: "x" }],
  ["DELETE", () => `/api/rules/app/${FAKE_ID}`],
  ["POST", () => `/api/rules/category/${categoryId}`, { text: "qa probe rule" }],
  ["PUT", () => `/api/rules/category/${categoryId}/reorder`, { ruleIds: [] }],
  ["PUT", () => `/api/rules/category/${categoryId}/${FAKE_ID}`, { text: "x" }],
  ["DELETE", () => `/api/rules/category/${categoryId}/${FAKE_ID}`],
];

// ── Bubble-admin-only routes on QA Test Bubble; role-user is not a member of it.
const BUBBLE_ADMIN_ONLY: Probe[] = [
  ["PUT", () => `/api/bubbles/${bubbleId}`, { title: "QA Unauthorized Rename" }],
  ["DELETE", () => `/api/bubbles/${bubbleId}`],
  ["POST", () => `/api/bubbles/${bubbleId}/photos`, { imageUrl: "https://example.com/x.png" }],
  ["PUT", () => `/api/bubbles/${bubbleId}/members/${bubbleAdmin.userId}/role`, { role: "member" }],
  ["DELETE", () => `/api/bubbles/${bubbleId}/members/${bubbleAdmin.userId}`],
  ["GET", () => `/api/bubbles/${bubbleId}/join-requests`],
  ["POST", () => `/api/bubbles/${bubbleId}/join-requests/${FAKE_ID}/approve`],
  ["POST", () => `/api/bubbles/${bubbleId}/join-requests/${FAKE_ID}/reject`],
  ["GET", () => `/api/bubbles/${bubbleId}/waitlist`],
  ["POST", () => `/api/bubbles/${bubbleId}/waitlist/${FAKE_ID}/approve`],
  ["POST", () => `/api/bubbles/${bubbleId}/waitlist/${FAKE_ID}/hold`],
  ["POST", () => `/api/bubbles/${bubbleId}/waitlist/${FAKE_ID}/reject`],
  ["POST", () => `/api/bubbles/${bubbleId}/sync-chat-members`],
  ["POST", () => `/api/bubbles/${bubbleId}/admin-dm/${bubbleAdmin.userId}`],
  ["GET", () => `/api/bubbles/${bubbleId}/reports`],
  ["POST", () => `/api/rules/bubble/${bubbleId}`, { text: "qa probe rule" }],
  ["PUT", () => `/api/rules/bubble/${bubbleId}/reorder`, { ruleIds: [] }],
  ["PUT", () => `/api/rules/bubble/${bubbleId}/${FAKE_ID}`, { text: "x" }],
  ["DELETE", () => `/api/rules/bubble/${bubbleId}/${FAKE_ID}`],
  ["POST", () => `/api/rules/bubble/${bubbleId}/override`, {}],
  // Non-admin member of a PUBLIC bubble may not create events in it (route gate).
  ["POST", () => "/api/events", () => ({ bubbleId, title: "QA Unauthorized Event", date: "2027-01-01", startTime: "18:00" })],
  ["POST", () => `/api/events/${eventId}/signup-tasks`, { title: "qa probe task" }],
  ["PATCH", () => `/api/events/${eventId}/signup-tasks/reorder`, { taskIds: [] }],
  // Non-member may not post on the bubble's bulletin board (isMember gate fires first).
  ["POST", () => `/api/bubbles/${bubbleId}/bulletin/posts`, { postTypeId: FAKE_ID, title: "x", body: "x" }],
];

// ── role-user touching ANOTHER user's resources (owner / author / admin gates).
const CROSS_USER: Probe[] = [
  ["PUT", () => `/api/events/${eventId}`, { title: "QA Hijacked Event" }],
  ["DELETE", () => `/api/events/${eventId}`],
  ["PUT", () => `/api/bulletin/posts/${postId}`, { title: "QA Hijacked Post" }],
  ["DELETE", () => `/api/bulletin/posts/${postId}`],
  ["PATCH", () => `/api/bulletin/posts/${postId}/pin`, { pinned: true }],
];

describe("sec-0200 role-authz matrix", () => {
  describe("super-admin routes deny role-user", () => {
    for (const [method, lazyPath, body] of SUPER_ONLY) {
      it(`${method} (super-only) → 403 for role-user`, async () => {
        const path = lazyPath();
        const res = await request(method, path, { token: member.token, body: resolveBody(body) });
        expect(res.status, `${method} ${path} as role-user → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);
      });
    }
  });

  describe("super-admin routes deny role-bubble-admin", () => {
    for (const [method, lazyPath, body] of SUPER_ONLY) {
      it(`${method} (super-only) → 403 for role-bubble-admin`, async () => {
        const path = lazyPath();
        const res = await request(method, path, { token: bubbleAdmin.token, body: resolveBody(body) });
        expect(res.status, `${method} ${path} as role-bubble-admin → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);
      });
    }
  });

  describe("bubble-admin routes deny role-user", () => {
    for (const [method, lazyPath, body] of BUBBLE_ADMIN_ONLY) {
      it(`${method} (bubble-admin-only) → 403 for role-user`, async () => {
        const path = lazyPath();
        const res = await request(method, path, { token: member.token, body: resolveBody(body) });
        expect(res.status, `${method} ${path} as role-user → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);
      });
    }
  });

  describe("another user's resources deny role-user", () => {
    for (const [method, lazyPath, body] of CROSS_USER) {
      it(`${method} (cross-user) → 403 for role-user`, async () => {
        const path = lazyPath();
        const res = await request(method, path, { token: member.token, body: resolveBody(body) });
        expect(res.status, `${method} ${path} as role-user → ${res.status} ${res.text.slice(0, 200)}`).toBe(403);
      });
    }
  });

  describe("scope-by-role admin reads return EMPTY data for role-user", () => {
    // These intentionally 200 for everyone but must scope to bubbles the requester
    // administers — for role-user (no admin bubbles) that is exactly nothing.
    it("GET /api/admin/pending-events → empty list", async () => {
      const res = await request("GET", "/api/admin/pending-events", { token: member.token });
      expect(res.status).toBe(200);
      expect(res.json, res.text.slice(0, 200)).toEqual([]);
    });
    it("GET /api/admin/waitlist → empty list", async () => {
      const res = await request("GET", "/api/admin/waitlist", { token: member.token });
      expect(res.status).toBe(200);
      expect(res.json, res.text.slice(0, 200)).toEqual([]);
    });
    it("GET /api/admin/pending-count → zero", async () => {
      const res = await request("GET", "/api/admin/pending-count", { token: member.token });
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.json), res.text.slice(0, 200)).toMatch(/(:|\s)0[,}]|"count":0/);
    });
  });

  describe("coverage guard: every isSuperAdmin-gated route in routes.ts is classified", () => {
    // Template-form paths probed above (params in :name form, matching the source).
    const covered = new Set([
      "GET /api/admin/pending-bubbles",
      "POST /api/admin/bubbles/:id/approve",
      "POST /api/admin/bubbles/:id/reject",
      "POST /api/admin/users/:id/unlock",
      "GET /api/admin/stats",
      "GET /api/admin/maintenance-mode",
      "PATCH /api/admin/maintenance-mode",
      "GET /api/admin/audit-logs",
      "GET /api/admin/error-logs/count",
      "GET /api/admin/error-logs",
      "DELETE /api/admin/error-logs",
      "GET /api/admin/latency",
      "DELETE /api/admin/latency",
      "GET /api/admin/latency/trends",
      "GET /api/admin/slow-calls",
      "DELETE /api/admin/slow-calls",
      "GET /api/admin/slow-call-config",
      "PATCH /api/admin/slow-call-config",
      "POST /api/admin/repair-member-counts",
      "POST /api/admin/repair-event-dates",
      "POST /api/admin/seed-staging",
      "GET /api/crash-reports",
      "POST /api/admin/events/:id/approve",
      "POST /api/admin/events/:id/reject",
      "POST /api/admin/push-tokens/cleanup",
      "GET /api/admin/reports",
      "GET /api/analytics/metrics",
      "POST /api/categories",
      "PUT /api/categories/:id",
      "DELETE /api/categories/:id",
      "GET /api/category-placeholders",
      "POST /api/categories/:id/placeholders",
      "PUT /api/category-placeholders/:placeholderId",
      "DELETE /api/category-placeholders/:placeholderId",
      "POST /api/rules/app",
      "PUT /api/rules/app/reorder",
      "PUT /api/rules/app/:ruleId",
      "DELETE /api/rules/app/:ruleId",
      "POST /api/rules/category/:categoryId",
      "PUT /api/rules/category/:categoryId/reorder",
      "PUT /api/rules/category/:categoryId/:ruleId",
      "DELETE /api/rules/category/:categoryId/:ruleId",
      "POST /api/rules/bubble/:bubbleId",
      "PUT /api/rules/bubble/:bubbleId/reorder",
      "PUT /api/rules/bubble/:bubbleId/:ruleId",
      "DELETE /api/rules/bubble/:bubbleId/:ruleId",
      "POST /api/rules/bubble/:bubbleId/override",
      "PUT /api/bubbles/:id",
      "DELETE /api/bubbles/:id",
      "DELETE /api/bubbles/:bubbleId/members/:userId",
      "GET /api/bubbles/:bubbleId/join-requests",
      "POST /api/bubbles/:bubbleId/join-requests/:userId/approve",
      "POST /api/bubbles/:bubbleId/join-requests/:userId/reject",
      "GET /api/bubbles/:bubbleId/waitlist",
      "POST /api/bubbles/:bubbleId/waitlist/:userId/approve",
      "POST /api/bubbles/:bubbleId/waitlist/:userId/hold",
      "POST /api/bubbles/:bubbleId/waitlist/:userId/reject",
      "POST /api/events",
      "PUT /api/events/:id",
      "DELETE /api/events/:id",
      "POST /api/events/:id/signup-tasks",
      "PATCH /api/events/:id/signup-tasks/reorder",
      "POST /api/bubbles/:bubbleId/bulletin/posts",
      "DELETE /api/bulletin/posts/:postId",
      "PATCH /api/bulletin/posts/:postId/pin",
      "GET /api/admin/pending-events",
      "GET /api/admin/waitlist",
      "GET /api/admin/pending-count",
    ]);
    // Routes that mention isSuperAdmin but are deliberately NOT probed — each needs a reason.
    const exempt = new Map<string, string>([
      ["GET /api/auth/me", "echoes the caller's own isSuperAdmin flag; not a gate"],
      ["GET /api/bubbles/:id/members", "public/privacy-scoped read; isSuperAdmin only broadens visibility"],
      ["PATCH /api/reports/:id/status", "needs a seeded report to reach the role gate (404-first for non-super); cover when reports are seeded"],
      ["PATCH /api/events/:id/signup-tasks/:taskId", "task lookup 404s before the role gate on a synthetic id; POST + reorder cover the gate"],
      ["DELETE /api/events/:id/signup-tasks/:taskId", "task lookup 404s before the role gate on a synthetic id; POST + reorder cover the gate"],
    ]);

    it("no unclassified isSuperAdmin-gated routes", () => {
      const src = readFileSync(ROUTES_FILE, "utf8");
      const re = /app\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g;
      const defs: { key: string; start: number }[] = [];
      for (let m = re.exec(src); m; m = re.exec(src)) {
        defs.push({ key: `${m[1].toUpperCase()} ${m[2]}`, start: m.index });
      }
      const unclassified: string[] = [];
      for (let i = 0; i < defs.length; i++) {
        const body = src.slice(defs[i].start, defs[i + 1]?.start ?? src.length);
        if (!body.includes("isSuperAdmin")) continue;
        if (covered.has(defs[i].key) || exempt.has(defs[i].key)) continue;
        unclassified.push(defs[i].key);
      }
      expect(
        unclassified,
        `role-gated routes not in sec-0200's matrix or exempt list (add them): ${unclassified.join(", ")}`,
      ).toEqual([]);
    });
  });
});
