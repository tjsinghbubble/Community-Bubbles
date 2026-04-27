import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import bcrypt from "bcrypt";
import {
  registerAuthRoutes,
  resetAllLoginFailures,
  LOGIN_MAX_ATTEMPTS,
  type AuthStorage,
} from "../auth-handler";

const JWT_SECRET = "test-jwt-secret";

function buildApp(storage: AuthStorage) {
  const app = express();
  app.use(express.json());
  registerAuthRoutes(app, storage, JWT_SECRET);
  return app;
}

describe("POST /api/auth/login", () => {
  let mockStorage: AuthStorage;
  let app: ReturnType<typeof buildApp>;
  let hashedPassword: string;

  beforeEach(async () => {
    resetAllLoginFailures();
    hashedPassword = await bcrypt.hash("correct-password", 10);

    mockStorage = {
      getUserByEmail: vi.fn(),
      createUser: vi.fn(),
      getUser: vi.fn(),
    };

    app = buildApp(mockStorage);
  });

  it("returns 200 with user and token for valid credentials", async () => {
    const fakeUser = {
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      password: hashedPassword,
      interests: [],
      tokenVersion: 0,
      isActive: true,
      campusId: null,
      campusEmail: null,
      campusVerified: false,
      dismissedCampusPrompt: false,
      isSuperAdmin: false,
      profilePhoto: null,
    };
    vi.mocked(mockStorage.getUserByEmail).mockResolvedValue(fakeUser);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "correct-password" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user).toMatchObject({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
    });
  });

  it("returns 401 when user does not exist", async () => {
    vi.mocked(mockStorage.getUserByEmail).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "any-password" });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "Invalid credentials");
  });

  it("returns 401 when password is wrong", async () => {
    const fakeUser = {
      id: "user-1",
      email: "alice@example.com",
      password: hashedPassword,
      tokenVersion: 0,
      isActive: true,
    };
    vi.mocked(mockStorage.getUserByEmail).mockResolvedValue(fakeUser);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "Invalid credentials");
  });

  it("returns 403 when account is deactivated", async () => {
    const fakeUser = {
      id: "user-1",
      email: "alice@example.com",
      password: hashedPassword,
      tokenVersion: 0,
      isActive: false,
    };
    vi.mocked(mockStorage.getUserByEmail).mockResolvedValue(fakeUser);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "correct-password" });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "This account has been deactivated.");
  });

  it(`locks out after ${LOGIN_MAX_ATTEMPTS} failed attempts`, async () => {
    vi.mocked(mockStorage.getUserByEmail).mockResolvedValue(null);

    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
      await request(app)
        .post("/api/auth/login")
        .send({ email: "victim@example.com", password: "wrong" });
    }

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "victim@example.com", password: "wrong" });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/Account temporarily locked/);
  });

  it("returns 4xx when request body is malformed JSON", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{not: valid json}");

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("returns 400 when body is completely empty", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when email is missing from body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: "some-password" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when password is missing from body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when email is a number instead of a string", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: 12345, password: "some-password" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when password is a number instead of a string", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: 99999 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when email is null", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: null, password: "some-password" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("does not lock out a different email that hasn't failed", async () => {
    const fakeUser = {
      id: "user-2",
      name: "Bob",
      email: "bob@example.com",
      password: hashedPassword,
      interests: [],
      tokenVersion: 0,
      isActive: true,
      campusId: null,
      campusEmail: null,
      campusVerified: false,
      dismissedCampusPrompt: false,
      isSuperAdmin: false,
      profilePhoto: null,
    };

    vi.mocked(mockStorage.getUserByEmail).mockImplementation(async (email) => {
      if (email === "victim2@example.com") return null;
      return fakeUser;
    });

    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
      await request(app)
        .post("/api/auth/login")
        .send({ email: "victim2@example.com", password: "wrong" });
    }

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "bob@example.com", password: "correct-password" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });
});

describe("POST /api/auth/signup", () => {
  let mockStorage: AuthStorage;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    mockStorage = {
      getUserByEmail: vi.fn(),
      createUser: vi.fn(),
      getUser: vi.fn(),
    };
    app = buildApp(mockStorage);
  });

  it("returns 200 with user and token for valid registration", async () => {
    vi.mocked(mockStorage.getUserByEmail).mockResolvedValue(null);
    vi.mocked(mockStorage.createUser).mockResolvedValue({
      id: "new-user-1",
      name: "Carol",
      email: "carol@example.com",
      interests: [],
      tokenVersion: 0,
      profilePhoto: null,
    });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Carol",
        email: "carol@example.com",
        password: "securepass123",
        interests: [],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user).toMatchObject({
      id: "new-user-1",
      name: "Carol",
      email: "carol@example.com",
    });
  });

  it("returns 400 when email is already registered", async () => {
    vi.mocked(mockStorage.getUserByEmail).mockResolvedValue({
      id: "existing-user",
      email: "carol@example.com",
    });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Carol",
        email: "carol@example.com",
        password: "securepass123",
        interests: [],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Email already exists");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "missing@example.com" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when name is empty", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "",
        email: "test@example.com",
        password: "securepass123",
        interests: [],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 4xx when request body is malformed JSON", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .set("Content-Type", "application/json")
      .send("{not: valid json}");

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("returns 400 when email is not a valid email format", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Eve",
        email: "not-an-email",
        password: "securepass123",
        interests: [],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when email has no domain", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Eve",
        email: "eve@",
        password: "securepass123",
        interests: [],
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("stores a hashed password, not the plaintext", async () => {
    vi.mocked(mockStorage.getUserByEmail).mockResolvedValue(null);
    vi.mocked(mockStorage.createUser).mockResolvedValue({
      id: "new-user-2",
      name: "Dave",
      email: "dave@example.com",
      interests: [],
      tokenVersion: 0,
      profilePhoto: null,
    });

    await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Dave",
        email: "dave@example.com",
        password: "plaintext-secret",
        interests: [],
      });

    const createUserCall = vi.mocked(mockStorage.createUser).mock.calls[0][0];
    expect(createUserCall.password).not.toBe("plaintext-secret");
    const isHashed = await bcrypt.compare("plaintext-secret", createUserCall.password);
    expect(isHashed).toBe(true);
  });
});
