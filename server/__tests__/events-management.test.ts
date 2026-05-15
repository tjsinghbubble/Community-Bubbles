import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  registerEventsManagementRoutes,
  type EventsManagementStorage,
  type EventsManagementOptions,
} from "../events-management-handler";

const JWT_SECRET = "test-jwt-secret";

function makeToken(userId: string, tokenVersion = 0) {
  return jwt.sign({ userId, tokenVersion }, JWT_SECRET, { expiresIn: "1h" });
}

function buildApp(storage: EventsManagementStorage, options: EventsManagementOptions = {}) {
  const app = express();
  app.use(express.json());
  registerEventsManagementRoutes(app, storage, JWT_SECRET, options);
  return app;
}

const ACTIVE_USER = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  tokenVersion: 0,
  isActive: true,
  isSuperAdmin: false,
};
const SUPER_ADMIN = { ...ACTIVE_USER, id: "admin-1", isSuperAdmin: true };

const SAMPLE_EVENT = {
  id: "event-1",
  title: "Monthly Meetup",
  date: "2026-06-01",
  startTime: "18:00",
  timezone: "UTC",
  bubbleId: "bubble-1",
  createdBy: "user-1",
  attendeeLimit: null,
};

const SAMPLE_BUBBLE = { id: "bubble-1", title: "Book Club", createdBy: "owner-1" };

const SAMPLE_TASK = { id: 42, eventId: "event-1", title: "Set up chairs", position: 0 };

function makeStorage(overrides: Partial<EventsManagementStorage> = {}): EventsManagementStorage {
  return {
    getUser: vi.fn().mockResolvedValue(ACTIVE_USER),
    getEvent: vi.fn().mockResolvedValue(SAMPLE_EVENT),
    getBubble: vi.fn().mockResolvedValue(SAMPLE_BUBBLE),
    getMemberRole: vi.fn().mockResolvedValue("admin"),
    updateEvent: vi.fn().mockResolvedValue({ ...SAMPLE_EVENT, title: "Updated" }),
    resetTaskSignupReminder1hFlags: vi.fn().mockResolvedValue(undefined),
    resetTaskSignupReminderFlags: vi.fn().mockResolvedValue(undefined),
    resetEventReminderFlags: vi.fn().mockResolvedValue(undefined),
    getEventAttendees: vi.fn().mockResolvedValue([]),
    getEventSignupTasks: vi.fn().mockResolvedValue([]),
    createEventSignupTask: vi.fn().mockResolvedValue({ ...SAMPLE_TASK, id: 99 }),
    getEventSignupTask: vi.fn().mockResolvedValue(SAMPLE_TASK),
    deleteEventSignupTask: vi.fn().mockResolvedValue(undefined),
    joinEventSignupTask: vi.fn().mockResolvedValue({ success: true }),
    leaveEventSignupTask: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── PUT /api/events/:id ──────────────────────────────────────────────────────

describe("PUT /api/events/:id", () => {
  const VALID_UPDATE = { title: "Updated Title" };

  it("returns 401 when no auth token provided", async () => {
    const res = await request(buildApp(makeStorage())).put("/api/events/event-1").send(VALID_UPDATE);
    expect(res.status).toBe(401);
  });

  it("returns 404 when event does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .put("/api/events/missing")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_UPDATE);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Event not found");
  });

  it("returns 403 when user is not creator, bubble admin, or super admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "other-user" });
    vi.mocked(storage.getBubble).mockResolvedValue({ ...SAMPLE_BUBBLE, createdBy: "another-user" });
    const res = await request(buildApp(storage))
      .put("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_UPDATE);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "Not authorized to edit this event");
  });

  it("allows the event creator to edit", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "user-1" });
    const res = await request(buildApp(storage))
      .put("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_UPDATE);
    expect(res.status).toBe(200);
    expect(storage.updateEvent).toHaveBeenCalledWith("event-1", expect.objectContaining({ title: "Updated Title" }));
  });

  it("allows the bubble owner to edit another user's event", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "other-user" });
    vi.mocked(storage.getBubble).mockResolvedValue({ ...SAMPLE_BUBBLE, createdBy: "user-1" });
    const res = await request(buildApp(storage))
      .put("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_UPDATE);
    expect(res.status).toBe(200);
  });

  it("allows a super admin to edit any event", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUser).mockResolvedValue(SUPER_ADMIN);
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "other-user" });
    const res = await request(buildApp(storage))
      .put("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send(VALID_UPDATE);
    expect(res.status).toBe(200);
  });

  it("returns 400 when title contains profanity", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "user-1" });
    const res = await request(buildApp(storage))
      .put("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ title: "shit meetup" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inappropriate language/i);
  });

  it("resets reminder flags when the date changes", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, date: "2026-06-01", startTime: "18:00" });
    vi.mocked(storage.updateEvent).mockResolvedValue({ ...SAMPLE_EVENT, date: "2026-07-01" });
    await request(buildApp(storage))
      .put("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ date: "2026-07-01" });
    expect(storage.resetEventReminderFlags).toHaveBeenCalledWith("event-1");
    expect(storage.resetTaskSignupReminderFlags).toHaveBeenCalledWith("event-1");
    expect(storage.resetTaskSignupReminder1hFlags).toHaveBeenCalledWith("event-1");
  });

  it("does NOT reset reminder flags when only the title changes", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, date: "2026-06-01", startTime: "18:00" });
    vi.mocked(storage.updateEvent).mockResolvedValue({ ...SAMPLE_EVENT });
    await request(buildApp(storage))
      .put("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ title: "New Title" });
    expect(storage.resetEventReminderFlags).not.toHaveBeenCalled();
  });

  it("notifies going attendees (excluding the editor) of the update", async () => {
    const sendNotificationToMany = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getEventAttendees).mockResolvedValue([
      { userId: "user-2", status: "going" },
      { userId: "user-3", status: "going" },
      { userId: "user-1", status: "going" }, // editor — excluded
      { userId: "user-4", status: "waitlisted" }, // excluded
    ]);
    await request(buildApp(storage, { sendNotificationToMany }))
      .put("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_UPDATE);
    expect(sendNotificationToMany).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "event_updated",
        recipientIds: expect.arrayContaining(["user-2", "user-3"]),
      }),
    );
    const call = vi.mocked(sendNotificationToMany).mock.calls[0][0];
    expect(call.recipientIds).not.toContain("user-1");
    expect(call.recipientIds).not.toContain("user-4");
  });

  it("does not call sendNotificationToMany when no other going attendees exist", async () => {
    const sendNotificationToMany = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getEventAttendees).mockResolvedValue([
      { userId: "user-1", status: "going" }, // only the editor
    ]);
    await request(buildApp(storage, { sendNotificationToMany }))
      .put("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_UPDATE);
    expect(sendNotificationToMany).not.toHaveBeenCalled();
  });
});

// ─── GET /api/events/:id/signup-tasks ─────────────────────────────────────────

describe("GET /api/events/:id/signup-tasks", () => {
  it("returns 404 when event does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue(null);
    const res = await request(buildApp(storage)).get("/api/events/missing/signup-tasks");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Event not found");
  });

  it("returns task list without authentication", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEventSignupTasks).mockResolvedValue([SAMPLE_TASK]);
    const res = await request(buildApp(storage)).get("/api/events/event-1/signup-tasks");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(storage.getEventSignupTasks).toHaveBeenCalledWith("event-1", undefined);
  });

  it("passes userId to storage when authenticated", async () => {
    const storage = makeStorage();
    await request(buildApp(storage))
      .get("/api/events/event-1/signup-tasks")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(storage.getEventSignupTasks).toHaveBeenCalledWith("event-1", "user-1");
  });
});

// ─── POST /api/events/:id/signup-tasks ────────────────────────────────────────

describe("POST /api/events/:id/signup-tasks", () => {
  const VALID_TASK_BODY = { title: "Set up chairs", icon: "🪑" };

  it("returns 401 when no auth token provided", async () => {
    const res = await request(buildApp(makeStorage()))
      .post("/api/events/event-1/signup-tasks")
      .send(VALID_TASK_BODY);
    expect(res.status).toBe(401);
  });

  it("returns 404 when event does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .post("/api/events/missing/signup-tasks")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_TASK_BODY);
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is neither event creator nor bubble admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "other-user" });
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, isSuperAdmin: false });
    const res = await request(buildApp(storage))
      .post("/api/events/event-1/signup-tasks")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_TASK_BODY);
    expect(res.status).toBe(403);
  });

  it("returns 400 when title is missing", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/events/event-1/signup-tasks")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ icon: "🪑" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("creates the task with the next position and returns 201", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEventSignupTasks).mockResolvedValue([SAMPLE_TASK]); // 1 existing
    const res = await request(buildApp(storage))
      .post("/api/events/event-1/signup-tasks")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_TASK_BODY);
    expect(res.status).toBe(201);
    expect(storage.createEventSignupTask).toHaveBeenCalledWith(
      expect.objectContaining({ position: 1, eventId: "event-1" }),
    );
    expect(res.body).toMatchObject({ signupCount: 0, hasSignedUp: false });
  });

  it("allows a bubble admin (non-creator) to add tasks", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "other-user" });
    vi.mocked(storage.getMemberRole).mockResolvedValue("admin");
    const res = await request(buildApp(storage))
      .post("/api/events/event-1/signup-tasks")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_TASK_BODY);
    expect(res.status).toBe(201);
  });
});

// ─── DELETE /api/events/:id/signup-tasks/:taskId ──────────────────────────────

describe("DELETE /api/events/:id/signup-tasks/:taskId", () => {
  it("returns 401 when no auth token provided", async () => {
    const res = await request(buildApp(makeStorage())).delete("/api/events/event-1/signup-tasks/42");
    expect(res.status).toBe(401);
  });

  it("returns 404 when event does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .delete("/api/events/missing/signup-tasks/42")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not creator or admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "other-user" });
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, isSuperAdmin: false });
    const res = await request(buildApp(storage))
      .delete("/api/events/event-1/signup-tasks/42")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
  });

  it("returns 400 for a non-numeric task ID", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .delete("/api/events/event-1/signup-tasks/abc")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid task ID");
  });

  it("returns 404 when task does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEventSignupTask).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .delete("/api/events/event-1/signup-tasks/999")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Task not found");
  });

  it("returns 404 when task belongs to a different event", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEventSignupTask).mockResolvedValue({ ...SAMPLE_TASK, eventId: "other-event" });
    const res = await request(buildApp(storage))
      .delete("/api/events/event-1/signup-tasks/42")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(404);
  });

  it("deletes the task and returns success", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .delete("/api/events/event-1/signup-tasks/42")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(storage.deleteEventSignupTask).toHaveBeenCalledWith(42);
  });
});

// ─── POST /api/events/signup-tasks/:taskId/join ───────────────────────────────

describe("POST /api/events/signup-tasks/:taskId/join", () => {
  it("returns 401 when no auth token provided", async () => {
    const res = await request(buildApp(makeStorage())).post("/api/events/signup-tasks/42/join");
    expect(res.status).toBe(401);
  });

  it("returns 400 for a non-numeric task ID", async () => {
    const res = await request(buildApp(makeStorage()))
      .post("/api/events/signup-tasks/abc/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid task ID");
  });

  it("returns 404 when task does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEventSignupTask).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .post("/api/events/signup-tasks/999/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not a bubble member", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .post("/api/events/signup-tasks/42/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "You must be a bubble member to sign up for tasks");
  });

  it("returns 409 when joinEventSignupTask fails", async () => {
    const storage = makeStorage();
    vi.mocked(storage.joinEventSignupTask).mockResolvedValue({ success: false, error: "Spots full" });
    const res = await request(buildApp(storage))
      .post("/api/events/signup-tasks/42/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty("error", "Spots full");
  });

  it("signs up successfully and returns success", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/events/signup-tasks/42/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(storage.joinEventSignupTask).toHaveBeenCalledWith(42, "user-1");
  });
});

// ─── DELETE /api/events/signup-tasks/:taskId/join ─────────────────────────────

describe("DELETE /api/events/signup-tasks/:taskId/join", () => {
  it("returns 401 when no auth token provided", async () => {
    const res = await request(buildApp(makeStorage())).delete("/api/events/signup-tasks/42/join");
    expect(res.status).toBe(401);
  });

  it("returns 400 for a non-numeric task ID", async () => {
    const res = await request(buildApp(makeStorage()))
      .delete("/api/events/signup-tasks/abc/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is not a bubble member", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .delete("/api/events/signup-tasks/42/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
  });

  it("removes the user from the task and returns success", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .delete("/api/events/signup-tasks/42/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(storage.leaveEventSignupTask).toHaveBeenCalledWith(42, "user-1");
  });
});
