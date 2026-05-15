import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  registerAdminBubbleRoutes,
  type AdminStorage,
  type AdminHandlerOptions,
} from "../admin-handler";

const JWT_SECRET = "test-jwt-secret";

function makeToken(userId: string, tokenVersion = 0) {
  return jwt.sign({ userId, tokenVersion }, JWT_SECRET, { expiresIn: "1h" });
}

function buildApp(storage: AdminStorage, options: AdminHandlerOptions = {}) {
  const app = express();
  app.use(express.json());
  registerAdminBubbleRoutes(app, storage, JWT_SECRET, options);
  return app;
}

const SUPER_ADMIN = {
  id: "admin-1",
  name: "Admin",
  email: "admin@example.com",
  tokenVersion: 0,
  isActive: true,
  isSuperAdmin: true,
};

const REGULAR_USER = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  tokenVersion: 0,
  isActive: true,
  isSuperAdmin: false,
};

const PENDING_BUBBLE = {
  id: "bubble-1",
  title: "Test Bubble",
  tagline: "A test bubble",
  privacy: "Public",
  status: "pending",
  createdBy: "user-1",
};

function makeStorage(overrides: Partial<AdminStorage> = {}): AdminStorage {
  return {
    getUser: vi.fn().mockResolvedValue(SUPER_ADMIN),
    approveBubble: vi.fn().mockResolvedValue({ ...PENDING_BUBBLE, status: "approved" }),
    rejectBubble: vi.fn().mockResolvedValue({ ...PENDING_BUBBLE, status: "rejected" }),
    getBubbleChat: vi.fn().mockResolvedValue(null),
    createBubbleChat: vi.fn().mockResolvedValue({ id: "chat-1" }),
    hasAnyMembership: vi.fn().mockResolvedValue(false),
    createMembershipWithRole: vi.fn().mockResolvedValue({ id: "mem-1" }),
    ...overrides,
  };
}

describe("POST /api/admin/bubbles/:id/approve", () => {
  it("returns 401 when no auth token provided", async () => {
    const app = buildApp(makeStorage());
    const res = await request(app).post("/api/admin/bubbles/bubble-1/approve");
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not a super admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUser).mockResolvedValue(REGULAR_USER);
    const app = buildApp(storage);
    const res = await request(app)
      .post("/api/admin/bubbles/bubble-1/approve")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "Super admin access required");
  });

  it("returns 404 when bubble does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.approveBubble).mockResolvedValue(null);
    const app = buildApp(storage);
    const res = await request(app)
      .post("/api/admin/bubbles/missing/approve")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Bubble not found");
  });

  it("approves the bubble and returns it", async () => {
    const storage = makeStorage();
    const app = buildApp(storage);
    const res = await request(app)
      .post("/api/admin/bubbles/bubble-1/approve")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "bubble-1", status: "approved" });
    expect(storage.approveBubble).toHaveBeenCalledWith("bubble-1");
  });

  it("calls auditLog with bubble_approved action", async () => {
    const auditLog = vi.fn();
    const storage = makeStorage();
    const app = buildApp(storage, { auditLog });
    await request(app)
      .post("/api/admin/bubbles/bubble-1/approve")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(auditLog).toHaveBeenCalledWith(
      "bubble_approved",
      "admin-1",
      "bubble-1",
      expect.any(String),
    );
  });

  it("sends approval notification to bubble creator", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    const app = buildApp(storage, { sendNotification });
    await request(app)
      .post("/api/admin/bubbles/bubble-1/approve")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-1",
        type: "bubble_approved",
      }),
    );
  });

  it("auto-adds creator as admin member when no existing membership", async () => {
    const storage = makeStorage();
    vi.mocked(storage.hasAnyMembership).mockResolvedValue(false);
    const app = buildApp(storage);
    await request(app)
      .post("/api/admin/bubbles/bubble-1/approve")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(storage.createMembershipWithRole).toHaveBeenCalledWith(
      { userId: "user-1", bubbleId: "bubble-1" },
      "admin",
    );
  });

  it("skips creator membership when one already exists", async () => {
    const storage = makeStorage();
    vi.mocked(storage.hasAnyMembership).mockResolvedValue(true);
    const app = buildApp(storage);
    await request(app)
      .post("/api/admin/bubbles/bubble-1/approve")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(storage.createMembershipWithRole).not.toHaveBeenCalled();
  });

  it("swallows CometChat errors and still returns 200", async () => {
    const storage = makeStorage();
    const app = buildApp(storage, {
      ensureCometChatGroup: vi.fn().mockRejectedValue(new Error("CometChat down")),
    });
    const res = await request(app)
      .post("/api/admin/bubbles/bubble-1/approve")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/bubbles/:id/reject", () => {
  it("returns 401 when no auth token provided", async () => {
    const app = buildApp(makeStorage());
    const res = await request(app).post("/api/admin/bubbles/bubble-1/reject").send({});
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not a super admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUser).mockResolvedValue(REGULAR_USER);
    const app = buildApp(storage);
    const res = await request(app)
      .post("/api/admin/bubbles/bubble-1/reject")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it("returns 404 when bubble does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.rejectBubble).mockResolvedValue(null);
    const app = buildApp(storage);
    const res = await request(app)
      .post("/api/admin/bubbles/missing/reject")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it("returns 400 when reason exceeds 500 characters", async () => {
    const app = buildApp(makeStorage());
    const res = await request(app)
      .post("/api/admin/bubbles/bubble-1/reject")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send({ reason: "x".repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Reason must be 500 characters or fewer");
  });

  it("accepts a reason of exactly 500 characters", async () => {
    const storage = makeStorage();
    const app = buildApp(storage);
    const res = await request(app)
      .post("/api/admin/bubbles/bubble-1/reject")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send({ reason: "x".repeat(500) });
    expect(res.status).toBe(200);
  });

  it("rejects the bubble without a reason", async () => {
    const storage = makeStorage();
    const app = buildApp(storage);
    const res = await request(app)
      .post("/api/admin/bubbles/bubble-1/reject")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "bubble-1", status: "rejected" });
    expect(storage.rejectBubble).toHaveBeenCalledWith("bubble-1", undefined);
  });

  it("passes reason to rejectBubble and notification", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    const app = buildApp(storage, { sendNotification });
    await request(app)
      .post("/api/admin/bubbles/bubble-1/reject")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send({ reason: "Off topic" });
    expect(storage.rejectBubble).toHaveBeenCalledWith("bubble-1", "Off topic");
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-1",
        type: "bubble_rejected",
        body: expect.stringContaining("Off topic"),
      }),
    );
  });

  it("calls auditLog with bubble_rejected action", async () => {
    const auditLog = vi.fn();
    const storage = makeStorage();
    const app = buildApp(storage, { auditLog });
    await request(app)
      .post("/api/admin/bubbles/bubble-1/reject")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send({ reason: "Spam" });
    expect(auditLog).toHaveBeenCalledWith(
      "bubble_rejected",
      "admin-1",
      "bubble-1",
      expect.any(String),
      { reason: "Spam" },
    );
  });
});
