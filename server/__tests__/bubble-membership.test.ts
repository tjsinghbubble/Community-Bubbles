import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import {
  registerBubbleMembershipRoutes,
  type BubbleMembershipStorage,
  type BubbleMembershipOptions,
} from "../bubble-membership-handler";

const JWT_SECRET = "test-jwt-secret";

function makeToken(userId: string, tokenVersion = 0) {
  return jwt.sign({ userId, tokenVersion }, JWT_SECRET, { expiresIn: "1h" });
}

function buildApp(storage: BubbleMembershipStorage, options: BubbleMembershipOptions = {}) {
  const app = express();
  app.use(express.json());
  registerBubbleMembershipRoutes(app, storage, JWT_SECRET, options);
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

const PUBLIC_BUBBLE = { id: "bubble-1", title: "Book Club", privacy: "Public", campusId: null, memberLimit: null, createdBy: "owner-1" };
const PRIVATE_BUBBLE = { ...PUBLIC_BUBBLE, id: "bubble-2", privacy: "Private" };
const REQUEST_BUBBLE = { ...PUBLIC_BUBBLE, id: "bubble-3", privacy: "Request to Join" };
const CAPPED_BUBBLE = { ...PUBLIC_BUBBLE, id: "bubble-4", memberLimit: 10 };

function makeStorage(overrides: Partial<BubbleMembershipStorage> = {}): BubbleMembershipStorage {
  return {
    getUser: vi.fn().mockResolvedValue(ACTIVE_USER),
    getBubble: vi.fn().mockResolvedValue(PUBLIC_BUBBLE),
    hasAnyMembership: vi.fn().mockResolvedValue(false),
    getMembershipStatus: vi.fn().mockResolvedValue(null),
    getRealMemberCount: vi.fn().mockResolvedValue(5),
    createMembershipWithStatus: vi.fn().mockResolvedValue({ id: "mem-1" }),
    createMembership: vi.fn().mockResolvedValue({ id: "mem-1" }),
    isMember: vi.fn().mockResolvedValue(true),
    getMemberRole: vi.fn().mockResolvedValue("admin"),
    getBubbleMembersWithUsers: vi.fn().mockResolvedValue([
      { id: "mem-1", userId: "user-1", bubbleId: "bubble-1", role: "admin", createdAt: new Date().toISOString(), user: { id: "user-1", name: "Alice", profilePhoto: null } },
      { id: "mem-2", userId: "user-2", bubbleId: "bubble-1", role: "admin", createdAt: new Date().toISOString(), user: { id: "user-2", name: "Bob", profilePhoto: null } },
    ]),
    deleteMembership: vi.fn().mockResolvedValue(undefined),
    updateMemberRole: vi.fn().mockResolvedValue(undefined),
    getBubbleMemberships: vi.fn().mockResolvedValue([]),
    getPendingJoinRequests: vi.fn().mockResolvedValue([]),
    approveMembership: vi.fn().mockResolvedValue({ id: "mem-1", status: "approved" }),
    rejectMembership: vi.fn().mockResolvedValue(undefined),
    getWaitlistMembers: vi.fn().mockResolvedValue([]),
    getAdminMemberChatsForBubble: vi.fn().mockResolvedValue([]),
    updateAdminMemberChatParticipants: vi.fn().mockResolvedValue(undefined),
    archiveAdminMemberChatsForMember: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── POST /api/bubbles/:id/join ───────────────────────────────────────────────

describe("POST /api/bubbles/:id/join", () => {
  it("returns 401 when no auth token provided", async () => {
    const res = await request(buildApp(makeStorage())).post("/api/bubbles/bubble-1/join");
    expect(res.status).toBe(401);
  });

  it("returns 404 when bubble does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .post("/api/bubbles/missing/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Bubble not found");
  });

  it("returns 400 when user is already a member", async () => {
    const storage = makeStorage();
    vi.mocked(storage.hasAnyMembership).mockResolvedValue(true);
    vi.mocked(storage.getMembershipStatus).mockResolvedValue("approved");
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-1/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Already a member");
  });

  it("returns 400 when join request is already pending", async () => {
    const storage = makeStorage();
    vi.mocked(storage.hasAnyMembership).mockResolvedValue(true);
    vi.mocked(storage.getMembershipStatus).mockResolvedValue("pending");
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-1/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Join request already pending");
  });

  it("returns 400 when already on the waitlist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.hasAnyMembership).mockResolvedValue(true);
    vi.mocked(storage.getMembershipStatus).mockResolvedValue("waitlisted");
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-1/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Already on the waitlist");
  });

  it("waitlists user when bubble is at member limit", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue(CAPPED_BUBBLE);
    vi.mocked(storage.getRealMemberCount).mockResolvedValue(10);
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-4/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: "waitlisted" });
    expect(storage.createMembershipWithStatus).toHaveBeenCalledWith(
      { userId: "user-1", bubbleId: "bubble-4" }, "waitlisted",
    );
  });

  it("creates a pending request for a Request to Join bubble", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue(REQUEST_BUBBLE);
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-3/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: "pending" });
    expect(storage.createMembershipWithStatus).toHaveBeenCalledWith(
      { userId: "user-1", bubbleId: "bubble-3" }, "pending",
    );
  });

  it("notifies bubble admins when a pending request is created", async () => {
    const notifyBubbleAdmins = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue(REQUEST_BUBBLE);
    await request(buildApp(storage, { notifyBubbleAdmins }))
      .post("/api/bubbles/bubble-3/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(notifyBubbleAdmins).toHaveBeenCalledWith(
      "bubble-3", "user-1", "membership_request",
      expect.any(String), expect.any(String), expect.any(Object), true,
    );
  });

  it("creates an approved membership for a public bubble", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-1/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: "approved" });
    expect(storage.createMembership).toHaveBeenCalledWith({ userId: "user-1", bubbleId: "bubble-1" });
  });

  it("returns 403 for a campus bubble when user is not campus-verified", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue({ ...PUBLIC_BUBBLE, campusId: "campus-1" });
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, campusVerified: false });
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-1/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "Campus verification required to join this bubble");
  });

  it("swallows CometChat errors on join and still returns 200", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage, {
      ensureCometChatUser: vi.fn().mockRejectedValue(new Error("CC down")),
    }))
      .post("/api/bubbles/bubble-1/join")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
  });
});

// ─── POST /api/bubbles/:id/leave ──────────────────────────────────────────────

describe("POST /api/bubbles/:id/leave", () => {
  it("returns 400 when user is not a member", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-1/leave")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Not a member");
  });

  it("deletes membership and returns success", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-1/leave")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(storage.deleteMembership).toHaveBeenCalledWith("user-1", "bubble-1");
  });

  it("notifies bubble admins when a member leaves", async () => {
    const notifyBubbleAdmins = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    await request(buildApp(storage, { notifyBubbleAdmins }))
      .post("/api/bubbles/bubble-1/leave")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(notifyBubbleAdmins).toHaveBeenCalledWith(
      "bubble-1", "user-1", "bubble_leave",
      expect.any(String), expect.any(String), expect.any(Object), true,
    );
  });

  it("sends a confirmation notification to the leaving member", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    await request(buildApp(storage, { sendNotification }))
      .post("/api/bubbles/bubble-1/leave")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "user-1", type: "bubble_member_removed" }),
    );
  });
});

// ─── GET /api/bubbles/:id/members ─────────────────────────────────────────────

describe("GET /api/bubbles/:id/members", () => {
  it("returns 404 when bubble does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue(null);
    const res = await request(buildApp(storage)).get("/api/bubbles/missing/members");
    expect(res.status).toBe(404);
  });

  it("returns the member list with user info", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage)).get("/api/bubbles/bubble-1/members");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ userId: "user-1", role: "admin", user: { name: "Alice" } });
  });

  it("returns 403 for a campus bubble with no auth header", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue({ ...PUBLIC_BUBBLE, campusId: "campus-1" });
    const res = await request(buildApp(storage)).get("/api/bubbles/bubble-1/members");
    expect(res.status).toBe(403);
  });

  it("returns members for campus bubble when user is campus-verified", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue({ ...PUBLIC_BUBBLE, campusId: "campus-1" });
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, campusVerified: true, campusId: "campus-1" });
    const res = await request(buildApp(storage))
      .get("/api/bubbles/bubble-1/members")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/bubbles/:id/membership ──────────────────────────────────────────

describe("GET /api/bubbles/:id/membership", () => {
  it("returns 401 without auth", async () => {
    const res = await request(buildApp(makeStorage())).get("/api/bubbles/bubble-1/membership");
    expect(res.status).toBe(401);
  });

  it("returns membership status for authenticated user", async () => {
    const storage = makeStorage();
    vi.mocked(storage.isMember).mockResolvedValue(true);
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    vi.mocked(storage.getMembershipStatus).mockResolvedValue("approved");
    const res = await request(buildApp(storage))
      .get("/api/bubbles/bubble-1/membership")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ isMember: true, role: "member", membershipStatus: "approved" });
  });
});

// ─── PUT /api/bubbles/:bubbleId/members/:userId/role ──────────────────────────

describe("PUT /api/bubbles/:bubbleId/members/:userId/role", () => {
  it("returns 400 for an invalid role value", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .put("/api/bubbles/bubble-1/members/user-2/role")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ role: "superadmin" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Invalid role. Must be 'member' or 'admin'");
  });

  it("returns 403 when requester is not a bubble admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    const res = await request(buildApp(storage))
      .put("/api/bubbles/bubble-1/members/user-2/role")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ role: "admin" });
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty("error", "Only admins can change member roles");
  });

  it("returns 404 when target user is not a member", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("admin");
    vi.mocked(storage.isMember).mockResolvedValue(false);
    const res = await request(buildApp(storage))
      .put("/api/bubbles/bubble-1/members/user-99/role")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ role: "admin" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when demoting the only remaining admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole)
      .mockResolvedValueOnce("admin")  // requester
      .mockResolvedValueOnce("admin"); // target
    vi.mocked(storage.getBubbleMembersWithUsers).mockResolvedValue([
      { role: "admin", userId: "user-2" }, // only one admin
    ]);
    const res = await request(buildApp(storage))
      .put("/api/bubbles/bubble-1/members/user-2/role")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ role: "member" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/only admin/i);
  });

  it("updates the role and sends a notification", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("admin");
    const res = await request(buildApp(storage, { sendNotification }))
      .put("/api/bubbles/bubble-1/members/user-2/role")
      .set("Authorization", `Bearer ${makeToken("user-1")}`)
      .send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(storage.updateMemberRole).toHaveBeenCalledWith("user-2", "bubble-1", "admin");
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "user-2", type: "bubble_role_changed" }),
    );
  });
});

// ─── DELETE /api/bubbles/:bubbleId/members/:userId ────────────────────────────

describe("DELETE /api/bubbles/:bubbleId/members/:userId", () => {
  it("returns 403 when requester is not admin or super admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, isSuperAdmin: false });
    const res = await request(buildApp(storage))
      .delete("/api/bubbles/bubble-1/members/user-2")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
  });

  it("returns 400 when trying to remove self", async () => {
    const storage = makeStorage();
    const res = await request(buildApp(storage))
      .delete("/api/bubbles/bubble-1/members/user-1")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Cannot remove yourself. Use the leave endpoint instead.");
  });

  it("returns 404 when target is not a member", async () => {
    const storage = makeStorage();
    vi.mocked(storage.isMember).mockResolvedValue(false);
    const res = await request(buildApp(storage))
      .delete("/api/bubbles/bubble-1/members/user-99")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(404);
  });

  it("removes the member and sends a notification", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("admin");
    const res = await request(buildApp(storage, { sendNotification }))
      .delete("/api/bubbles/bubble-1/members/user-2")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(storage.deleteMembership).toHaveBeenCalledWith("user-2", "bubble-1");
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "user-2", type: "bubble_member_removed" }),
    );
  });

  it("allows a super admin to remove a member", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue(null);
    vi.mocked(storage.getUser).mockResolvedValue(SUPER_ADMIN);
    const res = await request(buildApp(storage))
      .delete("/api/bubbles/bubble-1/members/user-2")
      .set("Authorization", `Bearer ${makeToken("admin-1")}`);
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/bubbles/:bubbleId/join-requests ─────────────────────────────────

describe("GET /api/bubbles/:bubbleId/join-requests", () => {
  it("returns 404 when bubble does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .get("/api/bubbles/missing/join-requests")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(404);
  });

  it("returns 403 when requester is not an admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, isSuperAdmin: false });
    const res = await request(buildApp(storage))
      .get("/api/bubbles/bubble-1/join-requests")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
  });

  it("returns the pending join requests for an admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getPendingJoinRequests).mockResolvedValue([
      { id: "req-1", userId: "user-2", bubbleId: "bubble-1", membershipStatus: "pending", createdAt: new Date().toISOString(), user: { id: "user-2", name: "Bob", profilePhoto: null } },
    ]);
    const res = await request(buildApp(storage))
      .get("/api/bubbles/bubble-1/join-requests")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ userId: "user-2", membershipStatus: "pending" });
  });
});

// ─── POST /api/bubbles/:bubbleId/join-requests/:userId/approve ────────────────

describe("POST /api/bubbles/:bubbleId/join-requests/:userId/approve", () => {
  it("returns 403 when requester is not an admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, isSuperAdmin: false });
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-1/join-requests/user-2/approve")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 when the join request does not exist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.approveMembership).mockResolvedValue(null);
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-1/join-requests/user-99/approve")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "Join request not found");
  });

  it("approves membership and sends notification", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    const res = await request(buildApp(storage, { sendNotification }))
      .post("/api/bubbles/bubble-1/join-requests/user-2/approve")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(storage.approveMembership).toHaveBeenCalledWith("user-2", "bubble-1");
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "user-2", type: "bubble_request_approved" }),
    );
  });
});

// ─── POST /api/bubbles/:bubbleId/join-requests/:userId/reject ─────────────────

describe("POST /api/bubbles/:bubbleId/join-requests/:userId/reject", () => {
  it("returns 403 when requester is not an admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, isSuperAdmin: false });
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-1/join-requests/user-2/reject")
      .set("Authorization", `Bearer ${makeToken("user-1")}`).send({});
    expect(res.status).toBe(403);
  });

  it("rejects membership and sends notification without reason", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    await request(buildApp(storage, { sendNotification }))
      .post("/api/bubbles/bubble-1/join-requests/user-2/reject")
      .set("Authorization", `Bearer ${makeToken("user-1")}`).send({});
    expect(storage.rejectMembership).toHaveBeenCalledWith("user-2", "bubble-1");
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "user-2", type: "bubble_request_rejected" }),
    );
    const body = vi.mocked(sendNotification).mock.calls[0][0].body as string;
    expect(body).not.toMatch(/Reason:/);
  });

  it("includes reason in the rejection notification when provided", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    await request(buildApp(storage, { sendNotification }))
      .post("/api/bubbles/bubble-1/join-requests/user-2/reject")
      .set("Authorization", `Bearer ${makeToken("user-1")}`).send({ reason: "Not a fit" });
    const body = vi.mocked(sendNotification).mock.calls[0][0].body as string;
    expect(body).toMatch(/Not a fit/);
  });
});

// ─── GET /api/bubbles/:bubbleId/waitlist ──────────────────────────────────────

describe("GET /api/bubbles/:bubbleId/waitlist", () => {
  it("returns 403 when requester is not an admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, isSuperAdmin: false });
    const res = await request(buildApp(storage))
      .get("/api/bubbles/bubble-1/waitlist")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
  });

  it("returns waitlist split into waitlisted and on_hold", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getWaitlistMembers).mockResolvedValue([
      { id: "m1", userId: "u1", bubbleId: "bubble-1", membershipStatus: "waitlisted", createdAt: new Date().toISOString(), user: { id: "u1", name: "A", profilePhoto: null } },
      { id: "m2", userId: "u2", bubbleId: "bubble-1", membershipStatus: "on_hold", createdAt: new Date().toISOString(), user: { id: "u2", name: "B", profilePhoto: null } },
    ]);
    const res = await request(buildApp(storage))
      .get("/api/bubbles/bubble-1/waitlist")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body.waitlisted).toHaveLength(1);
    expect(res.body.on_hold).toHaveLength(1);
    expect(res.body.waitlisted[0].userId).toBe("u1");
    expect(res.body.on_hold[0].userId).toBe("u2");
  });
});

// ─── POST /api/bubbles/:bubbleId/waitlist/:userId/approve ─────────────────────

describe("POST /api/bubbles/:bubbleId/waitlist/:userId/approve", () => {
  it("returns 403 when requester is not an admin", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMemberRole).mockResolvedValue("member");
    vi.mocked(storage.getUser).mockResolvedValue({ ...ACTIVE_USER, isSuperAdmin: false });
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-1/waitlist/user-2/approve")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(403);
  });

  it("returns 400 when bubble is still at capacity", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getBubble).mockResolvedValue(CAPPED_BUBBLE);
    vi.mocked(storage.getRealMemberCount).mockResolvedValue(10);
    vi.mocked(storage.getMembershipStatus).mockResolvedValue("waitlisted");
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-4/waitlist/user-2/approve")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "Bubble is still at capacity");
  });

  it("returns 400 when user is not on the waitlist", async () => {
    const storage = makeStorage();
    vi.mocked(storage.getMembershipStatus).mockResolvedValue("approved");
    const res = await request(buildApp(storage))
      .post("/api/bubbles/bubble-1/waitlist/user-2/approve")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "User is not on the waitlist");
  });

  it("approves waitlisted user and sends notification", async () => {
    const sendNotification = vi.fn();
    const storage = makeStorage();
    vi.mocked(storage.getMembershipStatus).mockResolvedValue("waitlisted");
    const res = await request(buildApp(storage, { sendNotification }))
      .post("/api/bubbles/bubble-1/waitlist/user-2/approve")
      .set("Authorization", `Bearer ${makeToken("user-1")}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(storage.approveMembership).toHaveBeenCalledWith("user-2", "bubble-1");
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "user-2", type: "waitlist_approved" }),
    );
  });
});
