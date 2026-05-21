import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  registerDeleteAccountRoute,
  type DeleteAccountStorage,
} from "../delete-account-handler";

const JWT_SECRET = "test-secret";

function makeToken(userId: string, tokenVersion = 0) {
  return jwt.sign({ userId, tokenVersion }, JWT_SECRET, { expiresIn: "1h" });
}

function makeStorage(overrides: Partial<DeleteAccountStorage> = {}): DeleteAccountStorage {
  return {
    getUser: vi.fn().mockResolvedValue({ id: "user-1", name: "Alice", tokenVersion: 0, isActive: true, profilePhoto: null }),
    deleteUser: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildApp(storage: DeleteAccountStorage, deleteProfilePhoto?: (key: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  registerDeleteAccountRoute(app, storage, JWT_SECRET, deleteProfilePhoto ? { deleteProfilePhoto } : {});
  return app;
}

describe("DELETE /api/auth/delete-account", () => {
  it("returns 401 when no auth token is provided", async () => {
    const res = await request(buildApp(makeStorage())).delete("/api/auth/delete-account");
    expect(res.status).toBe(401);
    expect(makeStorage().deleteUser).not.toHaveBeenCalled();
  });

  it("returns 401 when token is invalid", async () => {
    const res = await request(buildApp(makeStorage()))
      .delete("/api/auth/delete-account")
      .set("Authorization", "Bearer not-a-token");
    expect(res.status).toBe(401);
  });

  it("returns 200 and calls deleteUser with the authenticated userId", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .delete("/api/auth/delete-account")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Account deleted successfully" });
    expect(storage.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("calls deleteProfilePhoto with the photo key when user has a profile photo", async () => {
    const storage = makeStorage({
      getUser: vi.fn().mockResolvedValue({
        id: "user-1", name: "Alice", tokenVersion: 0, isActive: true,
        profilePhoto: "photos/alice-avatar.jpg",
      }),
    });
    const deleteProfilePhoto = vi.fn().mockResolvedValue(undefined);

    const res = await request(buildApp(storage, deleteProfilePhoto))
      .delete("/api/auth/delete-account")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);

    expect(res.status).toBe(200);
    expect(deleteProfilePhoto).toHaveBeenCalledWith("photos/alice-avatar.jpg");
  });

  it("still deletes the account and returns 200 when deleteProfilePhoto throws", async () => {
    const storage = makeStorage({
      getUser: vi.fn().mockResolvedValue({
        id: "user-1", name: "Alice", tokenVersion: 0, isActive: true,
        profilePhoto: "photos/alice-avatar.jpg",
      }),
    });
    const deleteProfilePhoto = vi.fn().mockRejectedValue(new Error("Storage unavailable"));

    const res = await request(buildApp(storage, deleteProfilePhoto))
      .delete("/api/auth/delete-account")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);

    expect(res.status).toBe(200);
    expect(storage.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("does not call deleteProfilePhoto when user has no profile photo", async () => {
    const storage = makeStorage();
    const deleteProfilePhoto = vi.fn();

    await request(buildApp(storage, deleteProfilePhoto))
      .delete("/api/auth/delete-account")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);

    expect(deleteProfilePhoto).not.toHaveBeenCalled();
  });

  it("returns 400 when storage.deleteUser throws", async () => {
    const storage = makeStorage({
      deleteUser: vi.fn().mockRejectedValue(new Error("Archive insert failed")),
    });

    const res = await request(buildApp(storage))
      .delete("/api/auth/delete-account")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Archive insert failed");
  });

  it("returns 401 when token version is revoked", async () => {
    const storage = makeStorage({
      getUser: vi.fn().mockResolvedValue({
        id: "user-1", name: "Alice", tokenVersion: 99, isActive: true, profilePhoto: null,
      }),
    });

    const res = await request(buildApp(storage))
      .delete("/api/auth/delete-account")
      .set("Authorization", `Bearer ${makeToken("user-1", 0)}`);

    expect(res.status).toBe(401);
    expect(storage.deleteUser).not.toHaveBeenCalled();
  });
});
