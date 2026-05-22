import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import {
  registerCrashReportRoute,
  type CrashReportStorage,
  CRASH_REPORT_MAX_MESSAGE_CHARS,
  CRASH_REPORT_MAX_STACK_CHARS,
  CRASH_REPORT_MAX_CONTEXT_CHARS,
  CRASH_REPORT_MAX_USER_ID_CHARS,
  CRASH_REPORT_MAX_USERNAME_CHARS,
} from "../crash-report-handler";

function makeStorage(overrides: Partial<CrashReportStorage> = {}): CrashReportStorage {
  return {
    insertCrashReport: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildApp(storage?: CrashReportStorage) {
  const app = express();
  app.use(express.json());
  registerCrashReportRoute(app, storage ?? makeStorage());
  return app;
}

const app = buildApp();

describe("POST /api/crash-report", () => {
  it("returns 200 with { received: true } for a valid payload", async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({ message: "Something went wrong" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it("returns 200 with a full valid payload", async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({
        message: "Fatal error in render",
        stack: "Error: Fatal\n  at Component.render",
        context: "HomeScreen",
        platform: "ios",
        timestamp: new Date().toISOString(),
        isFatal: true,
        appVersion: "1.2.3",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it("returns 400 when message is missing", async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({ stack: "some stack trace" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when message is an empty string", async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({ message: "" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it(`returns 400 when message exceeds ${CRASH_REPORT_MAX_MESSAGE_CHARS} chars`, async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({ message: "x".repeat(CRASH_REPORT_MAX_MESSAGE_CHARS + 1) });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it(`returns 200 when message is exactly ${CRASH_REPORT_MAX_MESSAGE_CHARS} chars`, async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({ message: "x".repeat(CRASH_REPORT_MAX_MESSAGE_CHARS) });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it(`returns 400 when stack exceeds ${CRASH_REPORT_MAX_STACK_CHARS} chars`, async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({
        message: "crash",
        stack: "s".repeat(CRASH_REPORT_MAX_STACK_CHARS + 1),
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it(`returns 200 when stack is exactly ${CRASH_REPORT_MAX_STACK_CHARS} chars`, async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({
        message: "crash",
        stack: "s".repeat(CRASH_REPORT_MAX_STACK_CHARS),
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it(`returns 400 when context exceeds ${CRASH_REPORT_MAX_CONTEXT_CHARS} chars`, async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({
        message: "crash",
        context: "c".repeat(CRASH_REPORT_MAX_CONTEXT_CHARS + 1),
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it(`returns 200 when context is exactly ${CRASH_REPORT_MAX_CONTEXT_CHARS} chars`, async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({
        message: "crash",
        context: "c".repeat(CRASH_REPORT_MAX_CONTEXT_CHARS),
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it(`returns 400 when userId exceeds ${CRASH_REPORT_MAX_USER_ID_CHARS} chars`, async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({
        message: "crash",
        userId: "u".repeat(CRASH_REPORT_MAX_USER_ID_CHARS + 1),
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it(`returns 200 when userId is exactly ${CRASH_REPORT_MAX_USER_ID_CHARS} chars`, async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({
        message: "crash",
        userId: "u".repeat(CRASH_REPORT_MAX_USER_ID_CHARS),
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it(`returns 400 when username exceeds ${CRASH_REPORT_MAX_USERNAME_CHARS} chars`, async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({
        message: "crash",
        username: "n".repeat(CRASH_REPORT_MAX_USERNAME_CHARS + 1),
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it(`returns 200 when username is exactly ${CRASH_REPORT_MAX_USERNAME_CHARS} chars`, async () => {
    const res = await request(app)
      .post("/api/crash-report")
      .send({
        message: "crash",
        username: "n".repeat(CRASH_REPORT_MAX_USERNAME_CHARS),
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });
});

describe("POST /api/crash-report — user identity surfacing", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("includes the username in the log line when userId and username are provided", async () => {
    await request(app)
      .post("/api/crash-report")
      .send({
        message: "Something went wrong",
        platform: "ios",
        isFatal: false,
        appVersion: "1.0.0",
        userId: "user-abc-123",
        username: "Jane Doe",
      });

    expect(consoleSpy).toHaveBeenCalled();
    const logLine: string = consoleSpy.mock.calls[0][0];
    expect(logLine).toContain("user=Jane Doe");
  });

  it("includes the userId in the log line when userId is provided but username is omitted", async () => {
    await request(app)
      .post("/api/crash-report")
      .send({
        message: "Crash without username",
        userId: "user-xyz-789",
      });

    expect(consoleSpy).toHaveBeenCalled();
    const logLine: string = consoleSpy.mock.calls[0][0];
    expect(logLine).toContain("user=user-xyz-789");
  });

  it("omits the user tag from the log line when no userId is provided", async () => {
    await request(app)
      .post("/api/crash-report")
      .send({ message: "Anonymous crash" });

    expect(consoleSpy).toHaveBeenCalled();
    const logLine: string = consoleSpy.mock.calls[0][0];
    expect(logLine).not.toContain("user=");
  });
});

describe("POST /api/crash-report — storage side effects", () => {
  it("persists the crash report to storage", async () => {
    const storage = makeStorage();
    const app = buildApp(storage);
    await request(app)
      .post("/api/crash-report")
      .send({ message: "Storage test", platform: "ios", isFatal: true, appVersion: "2.0.0" });
    expect(storage.insertCrashReport).toHaveBeenCalledOnce();
    expect(storage.insertCrashReport).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Storage test", isFatal: true }),
    );
  });

  it("still returns 200 when storage throws", async () => {
    const storage = makeStorage({
      insertCrashReport: vi.fn().mockRejectedValue(new Error("DB down")),
    });
    const app = buildApp(storage);
    const res = await request(app)
      .post("/api/crash-report")
      .send({ message: "Storage failure" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });
});
