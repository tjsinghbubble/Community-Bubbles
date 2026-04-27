import { describe, it, expect, beforeAll } from "vitest";
import express from "express";
import request from "supertest";
import { registerCrashReportRoute, CRASH_REPORT_MAX_MESSAGE_CHARS, CRASH_REPORT_MAX_STACK_CHARS, CRASH_REPORT_MAX_CONTEXT_CHARS } from "../crash-report-handler";

function buildApp() {
  const app = express();
  app.use(express.json());
  registerCrashReportRoute(app);
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
});
