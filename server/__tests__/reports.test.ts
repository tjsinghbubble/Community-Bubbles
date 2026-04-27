import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  registerReportsRoute,
  type ReportsStorage,
} from "../reports-handler";

const JWT_SECRET = "test-jwt-secret";

function makeToken(userId: string, tokenVersion = 0) {
  return jwt.sign({ userId, tokenVersion }, JWT_SECRET, { expiresIn: "1h" });
}

function buildApp(storage: ReportsStorage) {
  const app = express();
  app.use(express.json());
  registerReportsRoute(app, storage, JWT_SECRET);
  return app;
}

const ACTIVE_USER = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  tokenVersion: 0,
  isActive: true,
};

const VALID_REPORT_BODY = {
  reportType: "admin",
  reason: "rule_violation",
  bubbleId: "bubble-1",
  freeText: "This bubble violates the rules.",
};

describe("POST /api/reports", () => {
  let mockStorage: ReportsStorage;
  let app: ReturnType<typeof buildApp>;
  let token: string;

  beforeEach(() => {
    mockStorage = {
      getUser: vi.fn(),
      getMemberRole: vi.fn(),
      createReport: vi.fn(),
    };

    vi.mocked(mockStorage.getUser).mockResolvedValue(ACTIVE_USER);
    vi.mocked(mockStorage.getMemberRole).mockResolvedValue("member");
    vi.mocked(mockStorage.createReport).mockResolvedValue({
      id: "report-1",
      ...VALID_REPORT_BODY,
      reporterUserId: ACTIVE_USER.id,
      visibleTo: "superadmin",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    token = makeToken(ACTIVE_USER.id, 0);
    app = buildApp(mockStorage);
  });

  it("returns 401 when no auth token is provided", async () => {
    const res = await request(app).post("/api/reports").send(VALID_REPORT_BODY);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 401 when token is invalid", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", "Bearer invalid-token")
      .send(VALID_REPORT_BODY);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "Invalid token");
  });

  it("returns 401 when token version is revoked", async () => {
    vi.mocked(mockStorage.getUser).mockResolvedValue({ ...ACTIVE_USER, tokenVersion: 99 });
    const staleToken = makeToken(ACTIVE_USER.id, 0);

    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${staleToken}`)
      .send(VALID_REPORT_BODY);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "Token revoked");
  });

  it("returns 201 with the created report for a valid admin report", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_REPORT_BODY);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id", "report-1");
    expect(mockStorage.createReport).toHaveBeenCalledOnce();
  });

  it("sets visibleTo=superadmin for admin reportType", async () => {
    await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_REPORT_BODY, reportType: "admin" });

    const createCall = vi.mocked(mockStorage.createReport).mock.calls[0][0];
    expect(createCall.visibleTo).toBe("superadmin");
  });

  it("returns 400 when reason is missing", async () => {
    const { reason: _reason, ...bodyWithoutReason } = VALID_REPORT_BODY;

    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send(bodyWithoutReason);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when bubbleId is missing", async () => {
    const { bubbleId: _bubbleId, ...bodyWithoutBubble } = VALID_REPORT_BODY;

    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send(bodyWithoutBubble);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when reportType is missing", async () => {
    const { reportType: _reportType, ...bodyWithoutType } = VALID_REPORT_BODY;

    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send(bodyWithoutType);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when freeText exceeds 2000 characters", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_REPORT_BODY, freeText: "x".repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 201 when freeText is exactly 2000 characters", async () => {
    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...VALID_REPORT_BODY, freeText: "x".repeat(2000) });

    expect(res.status).toBe(201);
  });

  it("sets visibleTo=bubble_admin for individual report with non-admin user", async () => {
    vi.mocked(mockStorage.getMemberRole).mockResolvedValue("member");

    await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reportType: "individual",
        reason: "harassment",
        bubbleId: "bubble-1",
        reportedUserId: "other-user",
      });

    const createCall = vi.mocked(mockStorage.createReport).mock.calls[0][0];
    expect(createCall.visibleTo).toBe("bubble_admin");
  });

  it("sets visibleTo=both for individual report when reported user is an admin", async () => {
    vi.mocked(mockStorage.getMemberRole).mockResolvedValue("admin");

    await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({
        reportType: "individual",
        reason: "harassment",
        bubbleId: "bubble-1",
        reportedUserId: "admin-user",
      });

    const createCall = vi.mocked(mockStorage.createReport).mock.calls[0][0];
    expect(createCall.visibleTo).toBe("both");
  });

  it("returns 403 when account is deactivated", async () => {
    vi.mocked(mockStorage.getUser).mockResolvedValue({ ...ACTIVE_USER, isActive: false });

    const res = await request(app)
      .post("/api/reports")
      .set("Authorization", `Bearer ${token}`)
      .send(VALID_REPORT_BODY);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "This account has been deactivated.");
  });
});
