import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { registerNotificationsRoutes, type NotificationsStorage } from "../notifications-handler";

const JWT_SECRET = "test-jwt-secret";

function makeToken(userId: string, tokenVersion = 0) {
  return jwt.sign({ userId, tokenVersion }, JWT_SECRET, { expiresIn: "1h" });
}

function buildApp(storage: NotificationsStorage) {
  const app = express();
  app.use(express.json());
  registerNotificationsRoutes(app, storage, JWT_SECRET);
  return app;
}

const ACTIVE_USER = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  tokenVersion: 0,
  isActive: true,
};

function makeStorage(overrides: Partial<NotificationsStorage> = {}): NotificationsStorage {
  return {
    getUser: vi.fn().mockResolvedValue(ACTIVE_USER),
    getUnreadNotificationCount: vi.fn().mockResolvedValue(3),
    markNotificationRead: vi.fn().mockResolvedValue({ id: "notif-1", read: true }),
    markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
    upsertDevicePushToken: vi.fn().mockResolvedValue({ id: "token-1" }),
    deleteDevicePushToken: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("GET /api/notifications/unread-count", () => {
  it("returns 401 when no auth token provided", async () => {
    const app = buildApp(makeStorage());
    const res = await request(app).get("/api/notifications/unread-count");
    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid token", async () => {
    const app = buildApp(makeStorage());
    const res = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", "Bearer bad-token");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "Invalid token");
  });

  it("returns 401 when token version is revoked", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, tokenVersion: 99 });
    const app = buildApp(storage);
    const res = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${makeToken("user-1", 0)}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "Token revoked");
  });

  it("returns 403 when account is deactivated", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, isActive: false });
    const app = buildApp(storage);
    const res = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
  });

  it("returns the unread count for an authenticated user", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUnreadNotificationCount).mockResolvedValue(7);
    const app = buildApp(storage);
    const res = await request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 7 });
    expect(storage.getUnreadNotificationCount).toHaveBeenCalledWith("user-1");
  });
});

describe("PUT /api/notifications/:id/read", () => {
  it("marks the notification read and returns it", async () => {
    const notif = { id: "notif-42", read: true, userId: "user-1" };
    const storage = makeStorage();
    vi.mocked(storage.markNotificationRead).mockResolvedValue(notif);
    const app = buildApp(storage);
    const res = await request(app)
      .put("/api/notifications/notif-42/read")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "notif-42", read: true });
    expect(storage.markNotificationRead).toHaveBeenCalledWith("notif-42", "user-1");
  });

  it("returns 404 when the notification does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.markNotificationRead).mockResolvedValue(null);
    const app = buildApp(storage);
    const res = await request(app)
      .put("/api/notifications/missing/read")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Notification not found");
  });
});

describe("POST /api/notifications/read-all", () => {
  it("marks all notifications read and returns success", async () => {
    const storage = makeStorage();
    const app = buildApp(storage);
    const res = await request(app)
      .post("/api/notifications/read-all")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(storage.markAllNotificationsRead).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/device-push-tokens", () => {
  it("returns 400 when token is missing", async () => {
    const app = buildApp(makeStorage());
    const res = await request(app)
      .post("/api/device-push-tokens")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ platform: "ios" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "token and platform required");
  });

  it("returns 400 when platform is missing", async () => {
    const app = buildApp(makeStorage());
    const res = await request(app)
      .post("/api/device-push-tokens")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ token: "ExponentPushToken[abc123]" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "token and platform required");
  });

  it("upserts the push token and returns the result", async () => {
    const storage = makeStorage();
    vi.mocked(storage.upsertDevicePushToken).mockResolvedValue({ id: "pt-1", userId: "user-1" });
    const app = buildApp(storage);
    const res = await request(app)
      .post("/api/device-push-tokens")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ token: "ExponentPushToken[abc123]", platform: "ios" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "pt-1" });
    expect(storage.upsertDevicePushToken).toHaveBeenCalledWith(
      "user-1",
      "ExponentPushToken[abc123]",
      "ios",
    );
  });
});

describe("DELETE /api/device-push-tokens", () => {
  it("returns 400 when token is missing", async () => {
    const app = buildApp(makeStorage());
    const res = await request(app)
      .delete("/api/device-push-tokens")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "token required");
  });

  it("deletes the push token and returns success", async () => {
    const storage = makeStorage();
    const app = buildApp(storage);
    const res = await request(app)
      .delete("/api/device-push-tokens")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ token: "ExponentPushToken[abc123]" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(storage.deleteDevicePushToken).toHaveBeenCalledWith("user-1", "ExponentPushToken[abc123]");
  });
});
