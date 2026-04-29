import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import {
  registerSendVerificationRoute,
  AUTH_PAYLOAD_LIMIT_BYTES,
  authEntityTooLargeHandler,
  type SendVerificationStorage,
} from "../auth-handler";

function buildApp(storage: SendVerificationStorage, rateLimiter?: RequestHandler) {
  const app = express();
  app.use(
    "/api/auth",
    express.json({ limit: AUTH_PAYLOAD_LIMIT_BYTES }),
    authEntityTooLargeHandler,
  );
  app.use(express.json());
  registerSendVerificationRoute(app, storage, {
    rateLimiter,
    generateCode: () => "123456",
    sendEmail: vi.fn().mockResolvedValue(undefined),
  });
  return app;
}

describe("POST /api/auth/send-verification", () => {
  let mockStorage: SendVerificationStorage;

  beforeEach(() => {
    mockStorage = {
      getUserByEmail: vi.fn().mockResolvedValue(null),
      createVerificationCode: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("returns 200 with success message for a valid email", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/send-verification")
      .send({ email: "alice@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "Verification code sent" });
    expect(mockStorage.createVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({ email: "alice@example.com", code: "123456" }),
    );
  });

  it("returns 400 when email is missing", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/send-verification")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email is required");
    expect(mockStorage.getUserByEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when email is an empty string", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/send-verification")
      .send({ email: "" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email is required");
    expect(mockStorage.getUserByEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when email already exists", async () => {
    vi.mocked(mockStorage.getUserByEmail).mockResolvedValue({ id: "user-1", email: "alice@example.com" });

    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/send-verification")
      .send({ email: "alice@example.com" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email already exists");
    expect(mockStorage.createVerificationCode).not.toHaveBeenCalled();
  });

  it("returns 400 when email exceeds 254 characters", async () => {
    const app = buildApp(mockStorage);
    const longEmail = "a".repeat(246) + "@test.com";
    expect(longEmail.length).toBeGreaterThan(254);

    const res = await request(app)
      .post("/api/auth/send-verification")
      .send({ email: longEmail });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email must be 254 characters or fewer");
    expect(mockStorage.getUserByEmail).not.toHaveBeenCalled();
  });

  it("accepts an email that is exactly 254 characters", async () => {
    const app = buildApp(mockStorage);
    const localPart = "a".repeat(245);
    const email = `${localPart}@test.com`;
    expect(email.length).toBe(254);

    const res = await request(app)
      .post("/api/auth/send-verification")
      .send({ email });

    expect(res.status).toBe(200);
    expect(mockStorage.createVerificationCode).toHaveBeenCalled();
  });

  it("returns 400 when storage throws an unexpected error", async () => {
    vi.mocked(mockStorage.getUserByEmail).mockRejectedValue(new Error("Database connection failed"));

    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/auth/send-verification")
      .send({ email: "alice@example.com" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Database connection failed");
  });

  it("returns 429 after the rate limit threshold is crossed", async () => {
    const MAX_ATTEMPTS = 1;
    let attemptCount = 0;
    const rateLimiter: RequestHandler = (_req, res, next) => {
      attemptCount += 1;
      if (attemptCount > MAX_ATTEMPTS) {
        return res.status(429).json({ error: "Too many requests, please try again later." });
      }
      return next();
    };

    const app = buildApp(mockStorage, rateLimiter);

    const firstRes = await request(app)
      .post("/api/auth/send-verification")
      .send({ email: "alice@example.com" });

    expect(firstRes.status).toBe(200);

    const secondRes = await request(app)
      .post("/api/auth/send-verification")
      .send({ email: "bob@example.com" });

    expect(secondRes.status).toBe(429);
    expect(secondRes.body).toHaveProperty("error");
  });

  it("returns 413 when the request payload exceeds the 10kb limit", async () => {
    const app = buildApp(mockStorage);
    const oversizedPayload = { email: "a".repeat(AUTH_PAYLOAD_LIMIT_BYTES + 1) + "@test.com" };
    const res = await request(app)
      .post("/api/auth/send-verification")
      .send(oversizedPayload);

    expect(res.status).toBe(413);
    expect(res.body).toHaveProperty("error", "Request payload too large");
  });
});
