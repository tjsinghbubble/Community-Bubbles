import { describe, it, expect, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { patchUserSchema } from "@shared/schema";
import { AUTH_PAYLOAD_LIMIT_BYTES, authEntityTooLargeHandler } from "../auth-handler";

const noopAuthMiddleware: RequestHandler = (req: any, _res, next) => {
  req.userId = "user-1";
  next();
};

interface PatchUserStorage {
  updateUserProfile(userId: string, data: {
    name?: string;
    aboutMe?: string;
    interests?: string[];
    profilePhoto?: string;
  }): Promise<{ id: string; name: string; email: string; interests: string[] | null; profilePhoto: string | null; aboutMe: string | null } | null>;
}

function buildApp(storage: PatchUserStorage) {
  const app = express();
  app.use(
    "/api/users/me",
    express.json({ limit: AUTH_PAYLOAD_LIMIT_BYTES }),
    authEntityTooLargeHandler,
  );
  app.use(express.json({ limit: "50kb" }));

  app.patch("/api/users/me", noopAuthMiddleware, async (req: any, res: any) => {
    try {
      const parsed = patchUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const { profilePhoto, name, aboutMe, interests } = parsed.data;
      const updated = await storage.updateUserProfile(req.userId, {
        profilePhoto: profilePhoto ?? undefined,
        name,
        aboutMe: aboutMe ?? undefined,
        interests,
      });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        interests: updated.interests,
        profilePhoto: updated.profilePhoto,
        aboutMe: updated.aboutMe,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return app;
}

describe("PATCH /api/users/me", () => {
  const mockUser = {
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
    interests: ["hiking"],
    profilePhoto: null,
    aboutMe: "Hello",
  };

  it("returns 200 with updated user when the request is valid", async () => {
    const storage: PatchUserStorage = {
      updateUserProfile: vi.fn().mockResolvedValue(mockUser),
    };
    const app = buildApp(storage);

    const res = await request(app)
      .patch("/api/users/me")
      .send({ name: "Alice", aboutMe: "Hello", interests: ["hiking"] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "user-1", name: "Alice" });
  });

  it("returns 400 when name is an empty string", async () => {
    const storage: PatchUserStorage = {
      updateUserProfile: vi.fn(),
    };
    const app = buildApp(storage);

    const res = await request(app)
      .patch("/api/users/me")
      .send({ name: "" });

    expect(res.status).toBe(400);
    expect(storage.updateUserProfile).not.toHaveBeenCalled();
  });

  it("returns 404 when the user does not exist", async () => {
    const storage: PatchUserStorage = {
      updateUserProfile: vi.fn().mockResolvedValue(null),
    };
    const app = buildApp(storage);

    const res = await request(app)
      .patch("/api/users/me")
      .send({ name: "Alice" });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "User not found");
  });

  it("returns 413 when the request body exceeds 10 KB", async () => {
    const storage: PatchUserStorage = {
      updateUserProfile: vi.fn(),
    };
    const app = buildApp(storage);
    const oversizedBody = JSON.stringify({ name: "a".repeat(AUTH_PAYLOAD_LIMIT_BYTES + 1) });

    const res = await request(app)
      .patch("/api/users/me")
      .set("Content-Type", "application/json")
      .send(oversizedBody);

    expect(res.status).toBe(413);
    expect(res.body).toHaveProperty("error", "Request payload too large");
    expect(storage.updateUserProfile).not.toHaveBeenCalled();
  });
});
