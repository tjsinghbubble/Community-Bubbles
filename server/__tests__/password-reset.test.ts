import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import {
  registerPasswordResetRoutes,
  type PasswordResetStorage,
} from "../password-reset-handler";

function makeStorage(): PasswordResetStorage {
  return {
    getUserByEmail: vi.fn(),
    createVerificationCode: vi.fn().mockResolvedValue(undefined),
    getValidVerificationCode: vi.fn(),
    markCodeAsUsedAtomic: vi.fn().mockResolvedValue(true),
    updateUserPassword: vi.fn().mockResolvedValue(undefined),
    incrementTokenVersion: vi.fn().mockResolvedValue(undefined),
  };
}

function makeLimiter(maxRequests: number): RequestHandler {
  let count = 0;
  return (_req, res, next) => {
    count += 1;
    if (count > maxRequests) return res.status(429).json({ error: "Too many requests" });
    return next();
  };
}

function buildApp(
  storage: PasswordResetStorage,
  opts: { forgotPasswordRateLimiter?: RequestHandler; resetPasswordRateLimiter?: RequestHandler } = {},
) {
  const app = express();
  app.use(express.json());
  registerPasswordResetRoutes(app, storage, opts);
  return app;
}

describe("POST /api/auth/forgot-password", () => {
  it("returns 400 when email is missing", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/auth/forgot-password")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email is required");
    expect(storage.getUserByEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when email is not a string", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/auth/forgot-password")
      .send({ email: 12345 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email is required");
  });

  it("returns 200 with generic message when user is not found (no user enumeration)", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUserByEmail).mockResolvedValue(null);

    const res = await request(buildApp(storage))
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "If an account with that email exists, a reset code has been sent.",
    });
    expect(storage.createVerificationCode).not.toHaveBeenCalled();
  });

  it("returns 200, creates code, and calls sendEmail when user exists", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUserByEmail).mockResolvedValue({ id: "user-1", email: "alice@example.com" });

    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const generateCode = vi.fn().mockReturnValue("123456");

    const app = express();
    app.use(express.json());
    registerPasswordResetRoutes(app, storage, { generateCode, sendEmail });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "alice@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(storage.createVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({ email: "alice@example.com", code: "123456" }),
    );
    expect(sendEmail).toHaveBeenCalledWith("alice@example.com", "123456");
  });

  it("returns 200 even when sendEmail throws (graceful degradation), and code is still created", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUserByEmail).mockResolvedValue({ id: "user-1", email: "alice@example.com" });

    const sendEmail = vi.fn().mockRejectedValue(new Error("SMTP unavailable"));
    const generateCode = vi.fn().mockReturnValue("654321");

    const app = express();
    app.use(express.json());
    registerPasswordResetRoutes(app, storage, { generateCode, sendEmail });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "alice@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(storage.createVerificationCode).toHaveBeenCalled();
  });

  it("normalizes email to lowercase before lookup and storage", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUserByEmail).mockResolvedValue({ id: "user-1", email: "alice@example.com" });

    const sendEmail = vi.fn().mockResolvedValue(undefined);

    const app = express();
    app.use(express.json());
    registerPasswordResetRoutes(app, storage, { sendEmail });

    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "  ALICE@Example.COM  " });

    expect(storage.getUserByEmail).toHaveBeenCalledWith("alice@example.com");
    expect(storage.createVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({ email: "alice@example.com" }),
    );
    expect(sendEmail).toHaveBeenCalledWith("alice@example.com", expect.any(String));
  });
});

describe("POST /api/auth/reset-password", () => {
  it("returns 400 when email is missing", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/auth/reset-password")
      .send({ code: "123456", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email, code, and new password are required");
  });

  it("returns 400 when code is missing", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/auth/reset-password")
      .send({ email: "alice@example.com", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email, code, and new password are required");
  });

  it("returns 400 when newPassword is missing", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/auth/reset-password")
      .send({ email: "alice@example.com", code: "123456" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email, code, and new password are required");
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/auth/reset-password")
      .send({ email: "alice@example.com", code: "123456", newPassword: "short" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Password must be at least 8 characters");
  });

  it("returns 400 when code is invalid or expired", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getValidVerificationCode).mockResolvedValue(undefined);

    const res = await request(buildApp(storage))
      .post("/api/auth/reset-password")
      .send({ email: "alice@example.com", code: "000000", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid or expired code");
    expect(storage.markCodeAsUsedAtomic).not.toHaveBeenCalled();
    expect(storage.updateUserPassword).not.toHaveBeenCalled();
  });

  it("returns 400 when user is not found for given email", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getValidVerificationCode).mockResolvedValue({ id: "code-1" });
    vi.mocked(storage.getUserByEmail).mockResolvedValue(null);

    const res = await request(buildApp(storage))
      .post("/api/auth/reset-password")
      .send({ email: "ghost@example.com", code: "123456", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "User not found");
    expect(storage.markCodeAsUsedAtomic).not.toHaveBeenCalled();
    expect(storage.updateUserPassword).not.toHaveBeenCalled();
  });

  it("returns 200 and performs full reset on success", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getValidVerificationCode).mockResolvedValue({ id: "code-1" });
    vi.mocked(storage.getUserByEmail).mockResolvedValue({ id: "user-1", email: "alice@example.com" });
    vi.mocked(storage.markCodeAsUsedAtomic).mockResolvedValue(true);

    const res = await request(buildApp(storage))
      .post("/api/auth/reset-password")
      .send({ email: "alice@example.com", code: "123456", newPassword: "newpass123" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(storage.markCodeAsUsedAtomic).toHaveBeenCalledWith("code-1");
    expect(storage.updateUserPassword).toHaveBeenCalledWith("user-1", expect.any(String));
    expect(storage.incrementTokenVersion).toHaveBeenCalledWith("user-1");
  });

  it("hashes the new password before storing", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getValidVerificationCode).mockResolvedValue({ id: "code-1" });
    vi.mocked(storage.getUserByEmail).mockResolvedValue({ id: "user-1", email: "alice@example.com" });
    vi.mocked(storage.markCodeAsUsedAtomic).mockResolvedValue(true);

    await request(buildApp(storage))
      .post("/api/auth/reset-password")
      .send({ email: "alice@example.com", code: "123456", newPassword: "newpass123" });

    const [, storedHash] = vi.mocked(storage.updateUserPassword).mock.calls[0];
    expect(storedHash).not.toBe("newpass123");
    expect(storedHash).toMatch(/^\$2[ab]\$/);
  });

  it("returns 400 and does NOT update password when markCodeAsUsedAtomic returns false (concurrent claim)", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getValidVerificationCode).mockResolvedValue({ id: "code-1" });
    vi.mocked(storage.getUserByEmail).mockResolvedValue({ id: "user-1", email: "alice@example.com" });
    vi.mocked(storage.markCodeAsUsedAtomic).mockResolvedValue(false);

    const res = await request(buildApp(storage))
      .post("/api/auth/reset-password")
      .send({ email: "alice@example.com", code: "123456", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid or expired code");
    expect(storage.updateUserPassword).not.toHaveBeenCalled();
    expect(storage.incrementTokenVersion).not.toHaveBeenCalled();
  });

  it("calls markCodeAsUsedAtomic before updateUserPassword (correct race-safe order)", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getValidVerificationCode).mockResolvedValue({ id: "code-1" });
    vi.mocked(storage.getUserByEmail).mockResolvedValue({ id: "user-1", email: "alice@example.com" });
    vi.mocked(storage.markCodeAsUsedAtomic).mockResolvedValue(true);

    const callOrder: string[] = [];
    vi.mocked(storage.markCodeAsUsedAtomic).mockImplementation(async () => {
      callOrder.push("markCodeAsUsedAtomic");
      return true;
    });
    vi.mocked(storage.updateUserPassword).mockImplementation(async () => {
      callOrder.push("updateUserPassword");
    });

    await request(buildApp(storage))
      .post("/api/auth/reset-password")
      .send({ email: "alice@example.com", code: "123456", newPassword: "newpass123" });

    expect(callOrder).toEqual(["markCodeAsUsedAtomic", "updateUserPassword"]);
  });

  it("returns 400 when storage throws an unexpected error", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getValidVerificationCode).mockRejectedValue(new Error("DB connection lost"));

    const res = await request(buildApp(storage))
      .post("/api/auth/reset-password")
      .send({ email: "alice@example.com", code: "123456", newPassword: "newpass123" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "DB connection lost");
  });

  it("returns 429 when the reset-password rate limiter is exceeded", async () => {
    const storage = makeStorage();
    const app = buildApp(storage, { resetPasswordRateLimiter: makeLimiter(1) });

    await request(app)
      .post("/api/auth/reset-password")
      .send({ email: "alice@example.com", code: "123456", newPassword: "newpass123" });

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ email: "alice@example.com", code: "123456", newPassword: "newpass123" });

    expect(res.status).toBe(429);
  });
});

describe("rate limiting", () => {
  it("returns 429 when the forgot-password rate limiter is exceeded", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUserByEmail).mockResolvedValue(null);
    const app = buildApp(storage, { forgotPasswordRateLimiter: makeLimiter(1) });

    await request(app).post("/api/auth/forgot-password").send({ email: "alice@example.com" });

    const res = await request(app).post("/api/auth/forgot-password").send({ email: "alice@example.com" });

    expect(res.status).toBe(429);
  });
});
