import { describe, it, expect, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import { AUTH_PAYLOAD_LIMIT_BYTES, authEntityTooLargeHandler } from "../auth-handler";

const noopAuthMiddleware: RequestHandler = (req: any, _res, next) => {
  req.userId = "user-1";
  next();
};

function buildApp(dismissCampusPrompt: (userId: string) => Promise<void>) {
  const app = express();
  app.use(
    "/api/campus",
    express.json({ limit: AUTH_PAYLOAD_LIMIT_BYTES }),
    authEntityTooLargeHandler,
  );
  app.use(express.json({ limit: "50kb" }));

  app.post("/api/campus/dismiss-prompt", noopAuthMiddleware, async (req: any, res: any) => {
    try {
      await dismissCampusPrompt(req.userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return app;
}

describe("POST /api/campus/dismiss-prompt", () => {
  it("returns 200 when the prompt is dismissed successfully", async () => {
    const dismissCampusPrompt = vi.fn().mockResolvedValue(undefined);
    const app = buildApp(dismissCampusPrompt);

    const res = await request(app)
      .post("/api/campus/dismiss-prompt")
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(dismissCampusPrompt).toHaveBeenCalledWith("user-1");
  });

  it("returns 400 when the storage call throws", async () => {
    const dismissCampusPrompt = vi.fn().mockRejectedValue(new Error("DB error"));
    const app = buildApp(dismissCampusPrompt);

    const res = await request(app)
      .post("/api/campus/dismiss-prompt")
      .send();

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "DB error");
  });

  it("returns 413 when the request body exceeds 10 KB", async () => {
    const dismissCampusPrompt = vi.fn().mockResolvedValue(undefined);
    const app = buildApp(dismissCampusPrompt);
    const oversizedBody = JSON.stringify({ extra: "x".repeat(AUTH_PAYLOAD_LIMIT_BYTES + 1) });

    const res = await request(app)
      .post("/api/campus/dismiss-prompt")
      .set("Content-Type", "application/json")
      .send(oversizedBody);

    expect(res.status).toBe(413);
    expect(res.body).toHaveProperty("error", "Request payload too large");
    expect(dismissCampusPrompt).not.toHaveBeenCalled();
  });
});
