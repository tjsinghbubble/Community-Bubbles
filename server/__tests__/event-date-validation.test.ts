import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { isValidEventDate, isValidEventTime, insertEventSchema } from "@shared/schema";
import { registerEventsRoutes, type EventsStorage } from "../events-handler";

describe("isValidEventDate", () => {
  it("accepts real calendar dates", () => {
    expect(isValidEventDate("2026-08-15")).toBe(true);
    expect(isValidEventDate("2024-02-29")).toBe(true); // leap day
    expect(isValidEventDate("2026-12-31")).toBe(true);
  });

  it("rejects corrupt or malformed values", () => {
    expect(isValidEventDate("NaN-NaN-NaN")).toBe(false);
    expect(isValidEventDate("")).toBe(false);
    expect(isValidEventDate(null)).toBe(false);
    expect(isValidEventDate(undefined)).toBe(false);
    expect(isValidEventDate("2026/08/15")).toBe(false);
    expect(isValidEventDate("15-08-2026")).toBe(false);
  });

  it("rejects date-shaped strings that are not real calendar dates", () => {
    expect(isValidEventDate("2026-02-30")).toBe(false); // JS would normalize to Mar 2
    expect(isValidEventDate("2026-99-99")).toBe(false);
    expect(isValidEventDate("2026-13-01")).toBe(false);
    expect(isValidEventDate("2026-00-10")).toBe(false);
    expect(isValidEventDate("2025-02-29")).toBe(false); // not a leap year
  });
});

describe("isValidEventTime", () => {
  it("accepts valid HH:MM times", () => {
    expect(isValidEventTime("00:00")).toBe(true);
    expect(isValidEventTime("16:00")).toBe(true);
    expect(isValidEventTime("23:59")).toBe(true);
  });

  it("rejects corrupt or out-of-range values", () => {
    expect(isValidEventTime("NaN:NaN")).toBe(false);
    expect(isValidEventTime("24:00")).toBe(false);
    expect(isValidEventTime("12:60")).toBe(false);
    expect(isValidEventTime("24:99")).toBe(false);
    expect(isValidEventTime("9:00")).toBe(false); // must be zero-padded
    expect(isValidEventTime("")).toBe(false);
    expect(isValidEventTime(null)).toBe(false);
  });
});

describe("insertEventSchema date/time enforcement", () => {
  const base = {
    title: "Test Run",
    date: "2026-08-15",
    startTime: "16:00",
    timezone: "America/Los_Angeles",
    bubbleId: "bubble-1",
    createdBy: "user-1",
  };

  it("accepts a valid event", () => {
    expect(insertEventSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a valid endTime and null endTime", () => {
    expect(insertEventSchema.safeParse({ ...base, endTime: "18:30" }).success).toBe(true);
    expect(insertEventSchema.safeParse({ ...base, endTime: null }).success).toBe(true);
  });

  it("rejects corrupt and impossible dates", () => {
    expect(insertEventSchema.safeParse({ ...base, date: "NaN-NaN-NaN" }).success).toBe(false);
    expect(insertEventSchema.safeParse({ ...base, date: "2026-02-30" }).success).toBe(false);
    expect(insertEventSchema.safeParse({ ...base, date: "2026-99-99" }).success).toBe(false);
  });

  it("rejects corrupt and out-of-range times", () => {
    expect(insertEventSchema.safeParse({ ...base, startTime: "NaN:NaN" }).success).toBe(false);
    expect(insertEventSchema.safeParse({ ...base, startTime: "24:99" }).success).toBe(false);
    expect(insertEventSchema.safeParse({ ...base, endTime: "NaN:NaN" }).success).toBe(false);
    expect(insertEventSchema.safeParse({ ...base, endTime: "12:60" }).success).toBe(false);
  });

  it("rejects trailing junk on a date-shaped value", () => {
    expect(insertEventSchema.safeParse({ ...base, date: "2026-08-15junk" }).success).toBe(false);
    expect(isValidEventDate("2026-08-15junk")).toBe(false);
  });
});

// ─── Route-level: impossible dates must be rejected BEFORE timezone
// conversion (localToUtc would silently normalize e.g. 2026-02-30 → Mar 2) ───

const JWT_SECRET = "test-jwt-secret";

function makeToken(userId: string) {
  return jwt.sign({ userId, tokenVersion: 0 }, JWT_SECRET, { expiresIn: "1h" });
}

function makeStorage(): EventsStorage {
  return {
    getUser: vi.fn().mockResolvedValue({ id: "user-1", tokenVersion: 0, isActive: true, isSuperAdmin: false }),
    getEvent: vi.fn().mockResolvedValue(null),
    getBubble: vi.fn().mockResolvedValue({ id: "bubble-1", title: "Book Club", privacy: "Public", createdBy: "user-1" }),
    getMemberRole: vi.fn().mockResolvedValue("admin"),
    isMember: vi.fn().mockResolvedValue(true),
    createEvent: vi.fn().mockImplementation(async (data: any) => ({ id: "event-new", ...data })),
    createEventAttendee: vi.fn().mockResolvedValue({ id: "att-1" }),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    getEventAttendees: vi.fn().mockResolvedValue([]),
    getEventAttendee: vi.fn().mockResolvedValue(null),
    deleteEventAttendee: vi.fn().mockResolvedValue(undefined),
    getGoingCount: vi.fn().mockResolvedValue(0),
    getFirstWaitlistedAttendee: vi.fn().mockResolvedValue(null),
    updateEventAttendeeStatus: vi.fn().mockResolvedValue(undefined),
    rsvpEventWithCapacityCheck: vi.fn().mockResolvedValue("going"),
  } as unknown as EventsStorage;
}

function buildApp(storage: EventsStorage) {
  const app = express();
  app.use(express.json());
  registerEventsRoutes(app, storage, JWT_SECRET, {});
  return app;
}

describe("POST /api/events raw date/time validation (non-UTC)", () => {
  const validBody = {
    title: "Evening Run",
    date: "2026-08-20",
    startTime: "18:00",
    timezone: "America/Los_Angeles",
    bubbleId: "bubble-1",
  };

  it("accepts a valid non-UTC event", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/events")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(validBody);
    expect(res.status).toBe(200);
    expect(storage.createEvent).toHaveBeenCalledOnce();
  });

  it.each([
    ["impossible calendar date", { date: "2026-02-30" }],
    ["corrupt date", { date: "NaN-NaN-NaN" }],
    ["date with trailing junk", { date: "2026-08-15junk" }],
    ["corrupt startTime", { startTime: "NaN:NaN" }],
    ["out-of-range startTime", { startTime: "24:99" }],
    ["corrupt endTime", { endTime: "NaN:NaN" }],
  ])("rejects %s before timezone conversion", async (_label, patch) => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/events")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ ...validBody, ...patch });
    expect(res.status).toBe(400);
    expect(storage.createEvent).not.toHaveBeenCalled();
  });
});
