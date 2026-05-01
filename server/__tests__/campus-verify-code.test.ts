import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import {
  registerCampusVerifyCodeRoute,
  type CampusVerifyCodeStorage,
} from "../campus-handler";
import { AUTH_PAYLOAD_LIMIT_BYTES, authEntityTooLargeHandler } from "../auth-handler";

const noopAuthMiddleware: RequestHandler = (req: any, _res, next) => {
  req.userId = "user-1";
  next();
};

function buildApp(storage: CampusVerifyCodeStorage) {
  const app = express();
  app.use(
    "/api/campus/verify-code",
    express.json({ limit: AUTH_PAYLOAD_LIMIT_BYTES }),
    authEntityTooLargeHandler,
  );
  app.use(express.json({ limit: "50kb" }));
  registerCampusVerifyCodeRoute(app, storage, noopAuthMiddleware);
  return app;
}

describe("POST /api/campus/verify-code", () => {
  let mockStorage: CampusVerifyCodeStorage;

  beforeEach(() => {
    mockStorage = {
      getValidVerificationCode: vi.fn().mockResolvedValue({ id: "code-1" }),
      getCampusByDomain: vi.fn().mockResolvedValue({
        id: "campus-1",
        title: "State University",
        domain: "state.edu",
      }),
      markCodeAsUsed: vi.fn().mockResolvedValue(undefined),
      updateUserCampus: vi.fn().mockResolvedValue(undefined),
      getUser: vi.fn().mockResolvedValue({
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        campusId: "campus-1",
        campusEmail: "alice@state.edu",
        campusVerified: true,
      }),
    };
  });

  it("returns 200 with campus and user info for valid email and code", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/verify-code")
      .send({ email: "alice@state.edu", code: "123456" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      campus: { id: "campus-1", name: "State University", domain: "state.edu" },
      user: { id: "user-1", campusId: "campus-1", campusVerified: true },
    });
    expect(mockStorage.markCodeAsUsed).toHaveBeenCalledWith("code-1");
    expect(mockStorage.updateUserCampus).toHaveBeenCalledWith(
      "user-1",
      "campus-1",
      "alice@state.edu",
      true,
    );
  });

  it("returns 400 when email is missing", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/verify-code")
      .send({ code: "123456" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email and code are required");
    expect(mockStorage.getValidVerificationCode).not.toHaveBeenCalled();
  });

  it("returns 400 when code is missing", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/verify-code")
      .send({ email: "alice@state.edu" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email and code are required");
    expect(mockStorage.getValidVerificationCode).not.toHaveBeenCalled();
  });

  it("returns 400 when both fields are missing", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/verify-code")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email and code are required");
  });

  it("returns 400 when email exceeds 254 characters", async () => {
    const app = buildApp(mockStorage);
    const longEmail = "a".repeat(248) + "@state.edu";
    expect(longEmail.length).toBeGreaterThan(254);

    const res = await request(app)
      .post("/api/campus/verify-code")
      .send({ email: longEmail, code: "123456" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email must be 254 characters or fewer");
  });

  it("returns 400 when code exceeds 10 characters", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/verify-code")
      .send({ email: "alice@state.edu", code: "12345678901" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Code must be 10 characters or fewer");
  });

  it("returns 400 when code is invalid or expired", async () => {
    vi.mocked(mockStorage.getValidVerificationCode).mockResolvedValue(null);

    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/verify-code")
      .send({ email: "alice@state.edu", code: "000000" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid or expired code");
    expect(mockStorage.markCodeAsUsed).not.toHaveBeenCalled();
  });

  it("returns 400 when campus is not found for the email domain", async () => {
    vi.mocked(mockStorage.getCampusByDomain).mockResolvedValue(null);

    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/verify-code")
      .send({ email: "alice@unknown.edu", code: "123456" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Campus not found");
    expect(mockStorage.markCodeAsUsed).not.toHaveBeenCalled();
  });

  it("normalizes email to lowercase before looking up code and campus", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/verify-code")
      .send({ email: "Alice@STATE.EDU", code: "123456" });

    expect(res.status).toBe(200);
    expect(mockStorage.getValidVerificationCode).toHaveBeenCalledWith("alice@state.edu", "123456");
    expect(mockStorage.getCampusByDomain).toHaveBeenCalledWith("state.edu");
    expect(mockStorage.updateUserCampus).toHaveBeenCalledWith("user-1", "campus-1", "alice@state.edu", true);
  });

  it("returns 413 when the request body exceeds 10 KB", async () => {
    const app = buildApp(mockStorage);
    const oversizedBody = JSON.stringify({
      email: "alice@state.edu",
      code: "a".repeat(AUTH_PAYLOAD_LIMIT_BYTES + 1),
    });

    const res = await request(app)
      .post("/api/campus/verify-code")
      .set("Content-Type", "application/json")
      .send(oversizedBody);

    expect(res.status).toBe(413);
    expect(res.body).toHaveProperty("error", "Request payload too large");
    expect(mockStorage.getValidVerificationCode).not.toHaveBeenCalled();
  });
});
