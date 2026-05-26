import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  registerSuspendUserRoutes,
  type SuspendUserStorage,
} from "../suspend-user-handler";

const JWT_SECRET = "test-secret";

function makeToken(userId: string, tokenVersion = 0) {
  return jwt.sign({ userId, tokenVersion }, JWT_SECRET, { expiresIn: "1h" });
}

function makeStorage(overrides: Partial<SuspendUserStorage> = {}): SuspendUserStorage {
  return {
    getUser: vi.fn().mockResolvedValue({ id: "admin-1", tokenVersion: 0, isActive: true, isSuperAdmin: true }),
    suspendUser: vi.fn().mockResolvedValue(undefined),
    unsuspendUser: vi.fn().mockResolvedValue(undefined),
    searchUsers: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function buildApp(storage: SuspendUserStorage, auditLog?: (...args: any[]) => void) {
  const app = express();
  app.use(express.json());
  registerSuspendUserRoutes(app, storage, JWT_SECRET, auditLog ? { auditLog } : {});
  return app;
}

// ── suspend ────────────────────────────────────────────────────────────────

describe("POST /api/admin/users/:id/suspend", () => {
  it("returns 401 when no auth token is provided", async () => {
    const res = await request(buildApp(makeStorage()))
      .post("/api/admin/users/user-1/suspend")
      .send({ reason: "Violated community guidelines" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller is not a super admin", async () => {
    const storage = makeStorage({
      getUser: vi.fn().mockResolvedValue({ id: "user-99", tokenVersion: 0, isActive: true, isSuperAdmin: false }),
    });
    const res = await request(buildApp(storage))
      .post("/api/admin/users/user-1/suspend")
      .set("Authorization", `Bearer ${makeToken("user-99")}`)
      .send({ reason: "Violated community guidelines" });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the target user does not exist", async () => {
    const admin = { id: "admin-1", tokenVersion: 0, isActive: true, isSuperAdmin: true };
    const storage = makeStorage({
      getUser: vi.fn()
        .mockResolvedValueOnce(admin)  // auth middleware
        .mockResolvedValueOnce(admin)  // super-admin check
        .mockResolvedValueOnce(null),  // target lookup
    });
    const res = await request(buildApp(storage))
      .post("/api/admin/users/ghost-user/suspend")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send({ reason: "Violated community guidelines" });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "User not found");
  });

  it("returns 400 when reason is missing", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/admin/users/user-1/suspend")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Reason is required");
    expect(storage.suspendUser).not.toHaveBeenCalled();
  });

  it("returns 400 when reason exceeds 500 characters", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/admin/users/user-1/suspend")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send({ reason: "x".repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Reason must be 500 characters or fewer");
    expect(storage.suspendUser).not.toHaveBeenCalled();
  });

  it("returns 400 when trying to suspend another super admin", async () => {
    const admin = { id: "admin-1", tokenVersion: 0, isActive: true, isSuperAdmin: true };
    const storage = makeStorage({
      getUser: vi.fn()
        .mockResolvedValueOnce(admin)   // auth middleware
        .mockResolvedValueOnce(admin)   // super-admin check
        .mockResolvedValueOnce({ id: "admin-2", tokenVersion: 0, isActive: true, isSuperAdmin: true }),
    });
    const res = await request(buildApp(storage))
      .post("/api/admin/users/admin-2/suspend")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send({ reason: "Testing" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Cannot suspend a super admin");
    expect(storage.suspendUser).not.toHaveBeenCalled();
  });

  it("returns 400 when trying to suspend yourself", async () => {
    const storage = makeStorage({
      getUser: vi.fn().mockResolvedValue({ id: "admin-1", tokenVersion: 0, isActive: true, isSuperAdmin: true }),
    });
    const res = await request(buildApp(storage))
      .post("/api/admin/users/admin-1/suspend")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send({ reason: "Testing" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Cannot suspend your own account");
    expect(storage.suspendUser).not.toHaveBeenCalled();
  });

  it("returns 200, calls suspendUser, and writes audit log", async () => {
    const admin = { id: "admin-1", tokenVersion: 0, isActive: true, isSuperAdmin: true };
    const storage = makeStorage({
      getUser: vi.fn()
        .mockResolvedValueOnce(admin)  // auth middleware
        .mockResolvedValueOnce(admin)  // super-admin check
        .mockResolvedValueOnce({ id: "user-1", tokenVersion: 0, isActive: true, isSuperAdmin: false }),
    });
    const auditLog = vi.fn();

    const res = await request(buildApp(storage, auditLog))
      .post("/api/admin/users/user-1/suspend")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send({ reason: "Violated community guidelines" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(storage.suspendUser).toHaveBeenCalledWith("user-1", "Violated community guidelines");
    expect(auditLog).toHaveBeenCalledWith(
      "user_suspended", "admin-1", "user-1", expect.any(String),
      { reason: "Violated community guidelines" },
    );
  });
});

// ── unsuspend ──────────────────────────────────────────────────────────────

describe("POST /api/admin/users/:id/unsuspend", () => {
  it("returns 401 when no auth token is provided", async () => {
    const res = await request(buildApp(makeStorage()))
      .post("/api/admin/users/user-1/unsuspend");
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller is not a super admin", async () => {
    const storage = makeStorage({
      getUser: vi.fn().mockResolvedValue({ id: "user-99", tokenVersion: 0, isActive: true, isSuperAdmin: false }),
    });
    const res = await request(buildApp(storage))
      .post("/api/admin/users/user-1/unsuspend")
      .set("Authorization", `Bearer ${makeToken("user-99")}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 when the target user does not exist", async () => {
    const admin = { id: "admin-1", tokenVersion: 0, isActive: true, isSuperAdmin: true };
    const storage = makeStorage({
      getUser: vi.fn()
        .mockResolvedValueOnce(admin)  // auth middleware
        .mockResolvedValueOnce(admin)  // super-admin check
        .mockResolvedValueOnce(null),  // target lookup
    });
    const res = await request(buildApp(storage))
      .post("/api/admin/users/ghost-user/unsuspend")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "User not found");
  });

  it("returns 200, calls unsuspendUser, and writes audit log", async () => {
    const admin = { id: "admin-1", tokenVersion: 0, isActive: true, isSuperAdmin: true };
    const storage = makeStorage({
      getUser: vi.fn()
        .mockResolvedValueOnce(admin)  // auth middleware
        .mockResolvedValueOnce(admin)  // super-admin check
        .mockResolvedValueOnce({ id: "user-1", tokenVersion: 0, isActive: false, isSuperAdmin: false }),
    });
    const auditLog = vi.fn();

    const res = await request(buildApp(storage, auditLog))
      .post("/api/admin/users/user-1/unsuspend")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(storage.unsuspendUser).toHaveBeenCalledWith("user-1");
    expect(auditLog).toHaveBeenCalledWith(
      "user_unsuspended", "admin-1", "user-1", expect.any(String), undefined,
    );
  });
});

// ── search ─────────────────────────────────────────────────────────────────

describe("GET /api/admin/users/search", () => {
  it("returns 401 when no auth token is provided", async () => {
    const res = await request(buildApp(makeStorage()))
      .get("/api/admin/users/search?q=alice");
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller is not a super admin", async () => {
    const storage = makeStorage({
      getUser: vi.fn().mockResolvedValue({ id: "user-99", tokenVersion: 0, isActive: true, isSuperAdmin: false }),
    });
    const res = await request(buildApp(storage))
      .get("/api/admin/users/search?q=alice")
      .set("Authorization", `Bearer ${makeToken("user-99")}`);
    expect(res.status).toBe(403);
  });

  it("returns 400 when q is missing", async () => {
    const res = await request(buildApp(makeStorage()))
      .get("/api/admin/users/search")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Query parameter q is required");
  });

  it("returns 400 when q is shorter than 2 characters", async () => {
    const res = await request(buildApp(makeStorage()))
      .get("/api/admin/users/search?q=a")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Query must be at least 2 characters");
  });

  it("returns 200 with results from searchUsers", async () => {
    const storage = makeStorage({
      searchUsers: vi.fn().mockResolvedValue([
        { id: "user-1", name: "Alice", email: "alice@example.com", isActive: true, suspendedAt: null, suspendedReason: null, createdAt: new Date("2024-01-01") },
      ]),
    });
    const res = await request(buildApp(storage))
      .get("/api/admin/users/search?q=alice")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: "user-1", name: "Alice", email: "alice@example.com" });
  });

  it("does not include password or emailHash in the response", async () => {
    const storage = makeStorage({
      searchUsers: vi.fn().mockResolvedValue([
        { id: "user-1", name: "Alice", email: "alice@example.com", password: "hashed", emailHash: "abc123", isActive: true, suspendedAt: null, suspendedReason: null, createdAt: new Date() },
      ]),
    });
    const res = await request(buildApp(storage))
      .get("/api/admin/users/search?q=alice")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);

    expect(res.status).toBe(200);
    expect(res.body[0]).not.toHaveProperty("password");
    expect(res.body[0]).not.toHaveProperty("emailHash");
  });

  it("returns 200 with an empty array when no users match", async () => {
    const res = await request(buildApp(makeStorage()))
      .get("/api/admin/users/search?q=nomatch")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
