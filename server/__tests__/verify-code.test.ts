import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import {
  registerVerifyCodeRoute,
  type VerifyCodeStorage,
} from "../auth-handler";

function buildApp(storage: VerifyCodeStorage, rateLimiter?: RequestHandler) {
  const app = express();
  app.use(express.json());
  registerVerifyCodeRoute(app, storage, rateLimiter ? { rateLimiter } : {});
  return app;
}

describe("POST /api/auth/verify-code", () => {
  let mockStorage: VerifyCodeStorage;

  beforeEach(() => {
    mockStorage = {
      getValidVerificationCode: vi.fn(),
      markCodeAsUsed: vi.fn(),
    };
  });

  it("returns 200 with { success: true, verified: true } for a valid code", async () => {
    vi.mocked(mockStorage.getValidVerificationCode).mockResolvedValue({ id: "code-1" });
    vi.mocked(mockStorage.markCodeAsUsed).mockResolvedValue(undefined);

    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: "alice@example.com", code: "123456" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, verified: true });
    expect(mockStorage.markCodeAsUsed).toHaveBeenCalledWith("code-1");
  });

  it("returns 400 when email is missing", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ code: "123456" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email and code are required");
    expect(mockStorage.getValidVerificationCode).not.toHaveBeenCalled();
  });

  it("returns 400 when code is missing", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: "alice@example.com" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email and code are required");
    expect(mockStorage.getValidVerificationCode).not.toHaveBeenCalled();
  });

  it("returns 400 when both fields are missing", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email and code are required");
  });

  it("returns 400 with 'Invalid or expired code' when code does not exist", async () => {
    vi.mocked(mockStorage.getValidVerificationCode).mockResolvedValue(undefined);

    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: "alice@example.com", code: "000000" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid or expired code");
    expect(mockStorage.markCodeAsUsed).not.toHaveBeenCalled();
  });

  it("returns 400 with 'Invalid or expired code' when code is expired", async () => {
    // Expired codes are filtered out in storage, so getValidVerificationCode returns undefined
    vi.mocked(mockStorage.getValidVerificationCode).mockResolvedValue(undefined);

    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: "alice@example.com", code: "654321" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid or expired code");
    expect(mockStorage.markCodeAsUsed).not.toHaveBeenCalled();
  });

  it("returns 400 with 'Invalid or expired code' when code has already been used", async () => {
    // Already-used codes are filtered out in storage (used: true), so returns undefined
    vi.mocked(mockStorage.getValidVerificationCode).mockResolvedValue(undefined);

    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: "alice@example.com", code: "111111" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid or expired code");
    expect(mockStorage.markCodeAsUsed).not.toHaveBeenCalled();
  });

  it("does not call markCodeAsUsed when the code is invalid", async () => {
    vi.mocked(mockStorage.getValidVerificationCode).mockResolvedValue(undefined);

    const app = buildApp(mockStorage);
    await request(app)
      .post("/api/auth/verify-code")
      .send({ email: "alice@example.com", code: "999999" });

    expect(mockStorage.markCodeAsUsed).not.toHaveBeenCalled();
  });

  it("calls markCodeAsUsed with the correct code id on success", async () => {
    vi.mocked(mockStorage.getValidVerificationCode).mockResolvedValue({ id: "code-abc-123" });
    vi.mocked(mockStorage.markCodeAsUsed).mockResolvedValue(undefined);

    const app = buildApp(mockStorage);
    await request(app)
      .post("/api/auth/verify-code")
      .send({ email: "bob@example.com", code: "987654" });

    expect(mockStorage.markCodeAsUsed).toHaveBeenCalledTimes(1);
    expect(mockStorage.markCodeAsUsed).toHaveBeenCalledWith("code-abc-123");
  });

  it("returns 429 after the rate limit threshold is crossed", async () => {
    const MAX_ATTEMPTS = 1;
    let attemptCount = 0;
    const rateLimiter: RequestHandler = (_req, res, next) => {
      attemptCount += 1;
      if (attemptCount > MAX_ATTEMPTS) {
        return res.status(429).json({ error: "Too many attempts, please try again later." });
      }
      return next();
    };

    vi.mocked(mockStorage.getValidVerificationCode).mockResolvedValue({ id: "code-1" });
    vi.mocked(mockStorage.markCodeAsUsed).mockResolvedValue(undefined);

    const app = buildApp(mockStorage, rateLimiter);

    const firstRes = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: "victim@example.com", code: "123456" });

    expect(firstRes.status).toBe(200);
    expect(firstRes.body).toEqual({ success: true, verified: true });

    const secondRes = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: "victim@example.com", code: "123456" });

    expect(secondRes.status).toBe(429);
    expect(secondRes.body).toHaveProperty("error");
  });

  it("returns 400 when storage throws an unexpected error", async () => {
    vi.mocked(mockStorage.getValidVerificationCode).mockRejectedValue(
      new Error("Database connection failed"),
    );

    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/verify-code")
      .send({ email: "alice@example.com", code: "123456" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Database connection failed");
  });
});
