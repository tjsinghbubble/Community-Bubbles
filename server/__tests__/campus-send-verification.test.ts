import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import {
  registerCampusSendVerificationRoute,
  type CampusSendVerificationStorage,
} from "../campus-handler";

const noopAuthMiddleware: RequestHandler = (_req, _res, next) => next();

function buildApp(storage: CampusSendVerificationStorage) {
  const app = express();
  app.use(express.json());
  registerCampusSendVerificationRoute(app, storage, noopAuthMiddleware, {
    generateCode: () => "123456",
    sendEmail: vi.fn().mockResolvedValue(undefined),
  });
  return app;
}

describe("POST /api/campus/send-verification", () => {
  let mockStorage: CampusSendVerificationStorage;

  beforeEach(() => {
    mockStorage = {
      getCampusByDomain: vi.fn().mockResolvedValue({ id: "c1", title: "Test University" }),
      createVerificationCode: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("returns 200 for a valid .edu email from a supported campus", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/send-verification")
      .send({ email: "alice@state.edu" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, campusId: "c1", campusName: "Test University" });
    expect(mockStorage.createVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({ email: "alice@state.edu", code: "123456" }),
    );
  });

  it("returns 400 when email is missing", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/send-verification")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email is required");
    expect(mockStorage.createVerificationCode).not.toHaveBeenCalled();
  });

  it("returns 400 when email is an empty string", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/send-verification")
      .send({ email: "" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email is required");
    expect(mockStorage.createVerificationCode).not.toHaveBeenCalled();
  });

  it("returns 400 when email exceeds 254 characters", async () => {
    const app = buildApp(mockStorage);
    const longEmail = "a".repeat(248) + "@state.edu";
    expect(longEmail.length).toBeGreaterThan(254);

    const res = await request(app)
      .post("/api/campus/send-verification")
      .send({ email: longEmail });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email must be 254 characters or fewer");
    expect(mockStorage.createVerificationCode).not.toHaveBeenCalled();
  });

  it("accepts an email that is exactly 254 characters", async () => {
    const app = buildApp(mockStorage);
    const localPart = "a".repeat(244);
    const email = `${localPart}@state.edu`;
    expect(email.length).toBe(254);

    const res = await request(app)
      .post("/api/campus/send-verification")
      .send({ email });

    expect(res.status).toBe(200);
    expect(mockStorage.createVerificationCode).toHaveBeenCalled();
  });

  it("returns 400 when email does not have a .edu domain", async () => {
    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/send-verification")
      .send({ email: "alice@example.com" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Please use a valid .edu email address");
    expect(mockStorage.createVerificationCode).not.toHaveBeenCalled();
  });

  it("returns 400 when campus domain is not supported", async () => {
    vi.mocked(mockStorage.getCampusByDomain).mockResolvedValue(null);

    const app = buildApp(mockStorage);
    const res = await request(app)
      .post("/api/campus/send-verification")
      .send({ email: "alice@unknown.edu" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "This university is not yet supported. Check back later!");
    expect(mockStorage.createVerificationCode).not.toHaveBeenCalled();
  });
});
