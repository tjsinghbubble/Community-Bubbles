import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { registerBubblesRoutes, type BubblesStorage } from "../bubbles-handler";

const JWT_SECRET = "test-jwt-secret";

function makeToken(userId: string, tokenVersion = 0) {
  return jwt.sign({ userId, tokenVersion }, JWT_SECRET, { expiresIn: "1h" });
}

function buildApp(storage: BubblesStorage) {
  const app = express();
  app.use(express.json());
  registerBubblesRoutes(app, storage, JWT_SECRET);
  return app;
}

const ACTIVE_USER = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  tokenVersion: 0,
  isActive: true,
};

const PUBLIC_BUBBLE = {
  id: "bubble-1",
  title: "Book Club",
  tagline: "We read books",
  category: "Education",
  description: "Monthly book club",
  privacy: "Public",
  campusId: null,
  members: 5,
  createdBy: "user-1",
};

function makeStorage(overrides: Partial<BubblesStorage> = {}): BubblesStorage {
  return {
    getUser: vi.fn().mockResolvedValue(ACTIVE_USER),
    getBubble: vi.fn().mockResolvedValue(PUBLIC_BUBBLE),
    createBubble: vi.fn().mockResolvedValue({ ...PUBLIC_BUBBLE, id: "bubble-new" }),
    createMembershipWithRole: vi.fn().mockResolvedValue({ id: "mem-1" }),
    getRealMemberCount: vi.fn().mockResolvedValue(5),
    ...overrides,
  };
}

describe("GET /api/bubbles/:id", () => {
  it("returns the bubble with real member count", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getRealMemberCount).mockResolvedValue(12);
    const app = buildApp(storage);
    const res = await request(app).get("/api/bubbles/bubble-1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "bubble-1", members: 12 });
    expect(storage.getRealMemberCount).toHaveBeenCalledWith("bubble-1");
  });

  it("returns 404 when bubble does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue(null);
    const app = buildApp(storage);
    const res = await request(app).get("/api/bubbles/missing");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Bubble not found");
  });

  it("returns 403 for a campus bubble with no auth header", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue({ ...PUBLIC_BUBBLE, campusId: "campus-1" });
    const app = buildApp(storage);
    const res = await request(app).get("/api/bubbles/bubble-1");
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "Campus verification required");
  });

  it("returns 403 for campus bubble when user is not campus-verified", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue({ ...PUBLIC_BUBBLE, campusId: "campus-1" });
    vi.mocked(storage.getUser).mockResolvedValue({
      ...ACTIVE_USER,
      campusVerified: false,
      campusId: "campus-1",
    });
    const app = buildApp(storage);
    const res = await request(app)
      .get("/api/bubbles/bubble-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
  });

  it("returns 403 for campus bubble when user belongs to a different campus", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue({ ...PUBLIC_BUBBLE, campusId: "campus-1" });
    vi.mocked(storage.getUser).mockResolvedValue({
      ...ACTIVE_USER,
      campusVerified: true,
      campusId: "campus-99",
    });
    const app = buildApp(storage);
    const res = await request(app)
      .get("/api/bubbles/bubble-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
  });

  it("returns the campus bubble when user is verified for that campus", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue({ ...PUBLIC_BUBBLE, campusId: "campus-1" });
    vi.mocked(storage.getUser).mockResolvedValue({
      ...ACTIVE_USER,
      campusVerified: true,
      campusId: "campus-1",
    });
    const app = buildApp(storage);
    const res = await request(app)
      .get("/api/bubbles/bubble-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "bubble-1" });
  });
});

describe("POST /api/bubbles", () => {
  const VALID_BODY = {
    title: "Book Club",
    tagline: "We read books",
    category: "Education",
    description: "Monthly book club",
  };

  it("returns 401 when no auth token provided", async () => {
    const app = buildApp(makeStorage());
    const res = await request(app).post("/api/bubbles").send(VALID_BODY);
    expect(res.status).toBe(401);
  });

  it("creates the bubble and returns it", async () => {
    const storage = makeStorage();
    const app = buildApp(storage);
    const res = await request(app)
      .post("/api/bubbles")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "bubble-new" });
    expect(storage.createBubble).toHaveBeenCalledOnce();
  });

  it("sets createdBy to the authenticated user", async () => {
    const storage = makeStorage();
    const app = buildApp(storage);
    await request(app)
      .post("/api/bubbles")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_BODY);
    const callArg = vi.mocked(storage.createBubble).mock.calls[0][0];
    expect(callArg.createdBy).toBe("user-1");
  });

  it("auto-adds the creator as an admin member", async () => {
    const storage = makeStorage();
    vi.mocked(storage.createBubble).mockResolvedValue({ ...PUBLIC_BUBBLE, id: "bubble-new" });
    const app = buildApp(storage);
    await request(app)
      .post("/api/bubbles")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_BODY);
    expect(storage.createMembershipWithRole).toHaveBeenCalledWith(
      { userId: "user-1", bubbleId: "bubble-new" },
      "admin",
    );
  });

  it("returns 400 when title is missing", async () => {
    const { title: _t, ...noTitle } = VALID_BODY;
    const app = buildApp(makeStorage());
    const res = await request(app)
      .post("/api/bubbles")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(noTitle);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when title contains profanity", async () => {
    const app = buildApp(makeStorage());
    const res = await request(app)
      .post("/api/bubbles")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ ...VALID_BODY, title: "shit bubble" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inappropriate language/i);
  });

  it("still creates bubble when membership creation fails", async () => {
    const storage = makeStorage();
    vi.mocked(storage.createMembershipWithRole).mockRejectedValue(new Error("DB error"));
    const app = buildApp(storage);
    const res = await request(app)
      .post("/api/bubbles")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_BODY);
    expect(res.status).toBe(200);
  });
});
