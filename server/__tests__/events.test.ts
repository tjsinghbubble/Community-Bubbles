import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { registerEventsRoutes, type EventsStorage, type EventsHandlerOptions } from "../events-handler";

const JWT_SECRET = "test-jwt-secret";

function makeToken(userId: string, tokenVersion = 0) {
  return jwt.sign({ userId, tokenVersion }, JWT_SECRET, { expiresIn: "1h" });
}

function buildApp(storage: EventsStorage, options: EventsHandlerOptions = {}) {
  const app = express();
  app.use(express.json());
  registerEventsRoutes(app, storage, JWT_SECRET, options);
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

const PUBLIC_BUBBLE = {
  id: "bubble-1",
  title: "Book Club",
  privacy: "Public",
  createdBy: "owner-1",
};

const PRIVATE_BUBBLE = { ...PUBLIC_BUBBLE, id: "bubble-2", privacy: "Private" };

const SAMPLE_EVENT = {
  id: "event-1",
  title: "Monthly Meetup",
  date: "2026-06-01",
  startTime: "18:00",
  timezone: "UTC",
  bubbleId: "bubble-1",
  createdBy: "user-1",
  campusId: null,
  attendeeLimit: null,
};

function makeStorage(overrides: Partial<EventsStorage> = {}): EventsStorage {
  return {
    getUser: vi.fn().mockResolvedValue(ACTIVE_USER),
    getEvent: vi.fn().mockResolvedValue(SAMPLE_EVENT),
    getBubble: vi.fn().mockResolvedValue(PUBLIC_BUBBLE),
    getMemberRole: vi.fn().mockResolvedValue("admin"),
    isMember: vi.fn().mockResolvedValue(true),
    createEvent: vi.fn().mockResolvedValue({ ...SAMPLE_EVENT, id: "event-new" }),
    createEventAttendee: vi.fn().mockResolvedValue({ id: "att-1" }),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    getEventAttendees: vi.fn().mockResolvedValue([]),
    getEventAttendee: vi.fn().mockResolvedValue(null),
    deleteEventAttendee: vi.fn().mockResolvedValue(undefined),
    getGoingCount: vi.fn().mockResolvedValue(0),
    getFirstWaitlistedAttendee: vi.fn().mockResolvedValue(null),
    updateEventAttendeeStatus: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const VALID_EVENT_BODY = {
  title: "Monthly Meetup",
  date: "2026-06-01",
  startTime: "18:00",
  bubbleId: "bubble-1",
};

// ─── GET /api/events/:id ────────────────────────────────────────────────────

describe("GET /api/events/:id", () => {
  it("returns 404 when event does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue(null);
    const res = await request(buildApp(storage)).get("/api/events/missing");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Event not found");
  });

  it("returns the event with creatorName", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, name: "Alice" });
    const res = await request(buildApp(storage)).get("/api/events/event-1");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "event-1", creatorName: "Alice" });
  });

  it("falls back to 'Event Creator' when creator user is missing", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUser).mockResolvedValue(null);
    const res = await request(buildApp(storage)).get("/api/events/event-1");
    expect(res.status).toBe(200);
    expect(res.body.creatorName).toBe("Event Creator");
  });

  it("returns 403 for a campus event with no auth header", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, campusId: "campus-1" });
    const res = await request(buildApp(storage)).get("/api/events/event-1");
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "Campus verification required");
  });

  it("returns 403 for campus event when user is not campus-verified", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, campusId: "campus-1" });
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, campusVerified: false });
    const res = await request(buildApp(storage))
      .get("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
  });

  it("returns 403 for campus event when user belongs to a different campus", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, campusId: "campus-1" });
    vi.mocked(storage.getUser).mockResolvedValue({
      ...ACTIVE_USER,
      campusVerified: true,
      campusId: "campus-99",
    });
    const res = await request(buildApp(storage))
      .get("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
  });

  it("returns the campus event when user is verified for that campus", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, campusId: "campus-1" });
    vi.mocked(storage.getUser).mockResolvedValue({
      ...ACTIVE_USER,
      campusVerified: true,
      campusId: "campus-1",
    });
    const res = await request(buildApp(storage))
      .get("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "event-1" });
  });
});

// ─── POST /api/events ───────────────────────────────────────────────────────

describe("POST /api/events", () => {
  it("returns 401 when no auth token provided", async () => {
    const res = await request(buildApp(makeStorage())).post("/api/events").send(VALID_EVENT_BODY);
    expect(res.status).toBe(401);
  });

  it("returns 400 when title is missing", async () => {
    const { title: _t, ...noTitle } = VALID_EVENT_BODY;
    const res = await request(buildApp(makeStorage()))
      .post("/api/events")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(noTitle);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when title contains profanity", async () => {
    const res = await request(buildApp(makeStorage()))
      .post("/api/events")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ ...VALID_EVENT_BODY, title: "shit meetup" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inappropriate language/i);
  });

  it("returns 404 when the bubble does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .post("/api/events")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_EVENT_BODY);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Bubble not found");
  });

  it("returns 403 when user is not an admin of a public bubble", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue(PUBLIC_BUBBLE);
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    const res = await request(buildApp(storage))
      .post("/api/events")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_EVENT_BODY);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "Only admins can create events in public bubbles");
  });

  it("returns 403 when user is not a member of a private bubble", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue(PRIVATE_BUBBLE);
    vi.mocked(storage.isMember).mockResolvedValue(false);
    const res = await request(buildApp(storage))
      .post("/api/events")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ ...VALID_EVENT_BODY, bubbleId: "bubble-2" });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "You must be a member to create events");
  });

  it("allows a super admin to create events in a public bubble without an admin role", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUser).mockResolvedValue(SUPER_ADMIN);
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    const res = await request(buildApp(storage))
      .post("/api/events")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`)
      .send(VALID_EVENT_BODY);
    expect(res.status).toBe(200);
  });

  it("creates the event and auto-RSVPs the creator as going", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/events")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_EVENT_BODY);
    expect(res.status).toBe(200);
    expect(storage.createEvent).toHaveBeenCalledOnce();
    expect(storage.createEventAttendee).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", status: "going" }),
    );
  });

  it("notifies bubble members after creating an event", async () => {
    const notifyBubbleMembers = vi.fn();
    const storage = makeStorage();
    await request(buildApp(storage, { notifyBubbleMembers }))
      .post("/api/events")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send(VALID_EVENT_BODY);
    expect(notifyBubbleMembers).toHaveBeenCalledWith(
      expect.any(String),
      "user-1",
      "event_created",
      expect.any(String),
      expect.any(String),
      expect.any(Object),
    );
  });
});

// ─── DELETE /api/events/:id ─────────────────────────────────────────────────

describe("DELETE /api/events/:id", () => {
  it("returns 401 when no auth token provided", async () => {
    const res = await request(buildApp(makeStorage())).delete("/api/events/event-1");
    expect(res.status).toBe(401);
  });

  it("returns 404 when event does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .delete("/api/events/missing")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is not creator, bubble admin, or super admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "other-user" });
    vi.mocked(storage.getBubble).mockResolvedValue({ ...PUBLIC_BUBBLE, createdBy: "another-user" });
    const res = await request(buildApp(storage))
      .delete("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "Not authorized to delete this event");
  });

  it("allows the event creator to delete", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "user-1" });
    const res = await request(buildApp(storage))
      .delete("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(storage.deleteEvent).toHaveBeenCalledWith("event-1");
  });

  it("allows the bubble owner to delete another user's event", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "other-user" });
    vi.mocked(storage.getBubble).mockResolvedValue({ ...PUBLIC_BUBBLE, createdBy: "user-1" });
    const res = await request(buildApp(storage))
      .delete("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
  });

  it("allows a super admin to delete any event", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getUser).mockResolvedValue(SUPER_ADMIN);
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "other-user" });
    const res = await request(buildApp(storage))
      .delete("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(res.status).toBe(200);
  });

  it("notifies going attendees (excluding the deleter) on deletion", async () => {
    const sendNotificationToMany = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getEventAttendees).mockResolvedValue([
      { userId: "user-2", status: "going" },
      { userId: "user-3", status: "going" },
      { userId: "user-1", status: "going" }, // the deleter — should be excluded
      { userId: "user-4", status: "waitlisted" }, // waitlisted — should be excluded
    ]);
    const res = await request(buildApp(storage, { sendNotificationToMany }))
      .delete("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(sendNotificationToMany).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientIds: expect.arrayContaining(["user-2", "user-3"]),
        type: "event_cancelled",
      }),
    );
    const call = vi.mocked(sendNotificationToMany).mock.calls[0][0];
    expect(call.recipientIds).not.toContain("user-1");
    expect(call.recipientIds).not.toContain("user-4");
  });

  it("does not call sendNotificationToMany when no going attendees remain", async () => {
    const sendNotificationToMany = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getEventAttendees).mockResolvedValue([
      { userId: "user-1", status: "going" }, // only the deleter
    ]);
    await request(buildApp(storage, { sendNotificationToMany }))
      .delete("/api/events/event-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(sendNotificationToMany).not.toHaveBeenCalled();
  });
});

// ─── POST /api/events/:id/rsvp ──────────────────────────────────────────────

describe("POST /api/events/:id/rsvp", () => {
  it("returns 401 when no auth token provided", async () => {
    const res = await request(buildApp(makeStorage())).post("/api/events/event-1/rsvp");
    expect(res.status).toBe(401);
  });

  it("returns 404 when event does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .post("/api/events/missing/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it("returns 400 when user has already RSVP'd", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEventAttendee).mockResolvedValue({ id: "att-1", status: "going" });
    const res = await request(buildApp(storage))
      .post("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Already RSVP'd");
  });

  it("RSVPs as going when below attendee limit", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, attendeeLimit: 10 });
    vi.mocked(storage.getGoingCount).mockResolvedValue(5);
    const res = await request(buildApp(storage))
      .post("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-2")}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: "going" });
  });

  it("RSVPs as waitlisted when at or above attendee limit", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, attendeeLimit: 10, createdBy: "other" });
    vi.mocked(storage.getGoingCount).mockResolvedValue(10);
    const res = await request(buildApp(storage))
      .post("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-2")}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: "waitlisted" });
    expect(storage.createEventAttendee).toHaveBeenCalledWith(
      expect.objectContaining({ status: "waitlisted" }),
    );
  });

  it("returns 403 for campus event when user is not campus-verified", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, campusId: "campus-1" });
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, campusVerified: false });
    const res = await request(buildApp(storage))
      .post("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "Campus verification required to RSVP");
  });

  it("sends event_rsvp notification to creator when someone else RSVPs as going", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "creator-1" });
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, name: "Bob" });
    vi.mocked(storage.getGoingCount).mockResolvedValue(1);
    await request(buildApp(storage, { sendNotification }))
      .post("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-2")}`)
      .send({});
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "creator-1", type: "event_rsvp" }),
    );
  });

  it("does not notify creator when the creator RSVPs their own event", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "user-1" });
    await request(buildApp(storage, { sendNotification }))
      .post("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({});
    const rsvpNotif = vi.mocked(sendNotification).mock.calls.find(
      ([opts]) => opts.type === "event_rsvp",
    );
    expect(rsvpNotif).toBeUndefined();
  });

  it("sends event_full notification when RSVP fills the last spot", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getEvent).mockResolvedValue({
      ...SAMPLE_EVENT,
      attendeeLimit: 5,
      createdBy: "creator-1",
    });
    vi.mocked(storage.getGoingCount)
      .mockResolvedValueOnce(4)  // before RSVP — under limit
      .mockResolvedValueOnce(5); // after RSVP — at limit
    await request(buildApp(storage, { sendNotification }))
      .post("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-2")}`)
      .send({});
    const fullNotif = vi.mocked(sendNotification).mock.calls.find(
      ([opts]) => opts.type === "event_full",
    );
    expect(fullNotif).toBeDefined();
    expect(fullNotif![0]).toMatchObject({ recipientId: "creator-1", type: "event_full" });
  });
});

// ─── DELETE /api/events/:id/rsvp ────────────────────────────────────────────

describe("DELETE /api/events/:id/rsvp", () => {
  it("returns 401 when no auth token provided", async () => {
    const res = await request(buildApp(makeStorage())).delete("/api/events/event-1/rsvp");
    expect(res.status).toBe(401);
  });

  it("cancels RSVP and returns success with null promotedUserId", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEventAttendee).mockResolvedValue({ status: "going" });
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, attendeeLimit: null });
    const res = await request(buildApp(storage))
      .delete("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, promotedUserId: null });
    expect(storage.deleteEventAttendee).toHaveBeenCalledWith("user-1", "event-1");
  });

  it("sends event_unrsvp notification to creator when a non-creator cancels a going RSVP", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getEventAttendee).mockResolvedValue({ status: "going" });
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "creator-1", attendeeLimit: null });
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, name: "Alice" });
    await request(buildApp(storage, { sendNotification }))
      .delete("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "creator-1", type: "event_unrsvp" }),
    );
  });

  it("does not notify creator when creator cancels their own RSVP", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getEventAttendee).mockResolvedValue({ status: "going" });
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, createdBy: "user-1", attendeeLimit: null });
    await request(buildApp(storage, { sendNotification }))
      .delete("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("promotes the first waitlisted user when a going attendee cancels from a limited event", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getEventAttendee).mockResolvedValue({ status: "going" });
    vi.mocked(storage.getEvent).mockResolvedValue({
      ...SAMPLE_EVENT,
      createdBy: "user-1",
      attendeeLimit: 5,
    });
    vi.mocked(storage.getFirstWaitlistedAttendee).mockResolvedValue({ userId: "waitlisted-user" });
    const res = await request(buildApp(storage, { sendNotification }))
      .delete("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, promotedUserId: "waitlisted-user" });
    expect(storage.updateEventAttendeeStatus).toHaveBeenCalledWith("waitlisted-user", "event-1", "going");
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "waitlisted-user", type: "waitlist_promoted" }),
    );
  });

  it("does not promote when attendeeLimit is null (unlimited event)", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getEventAttendee).mockResolvedValue({ status: "going" });
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, attendeeLimit: null });
    await request(buildApp(storage))
      .delete("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(storage.getFirstWaitlistedAttendee).not.toHaveBeenCalled();
    expect(storage.updateEventAttendeeStatus).not.toHaveBeenCalled();
  });

  it("does not promote or send cancellation when attendee was waitlisted (not going)", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getEventAttendee).mockResolvedValue({ status: "waitlisted" });
    vi.mocked(storage.getEvent).mockResolvedValue({ ...SAMPLE_EVENT, attendeeLimit: 5 });
    const res = await request(buildApp(storage, { sendNotification }))
      .delete("/api/events/event-1/rsvp")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(storage.getFirstWaitlistedAttendee).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
