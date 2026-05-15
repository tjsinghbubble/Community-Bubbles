import type { Express } from "express";
import jwt from "jsonwebtoken";
import { makeAuthMiddleware } from "./auth-middleware";

export interface BubbleMembershipStorage {
  getUser(id: string): Promise<any>;
  getBubble(id: string): Promise<any>;
  hasAnyMembership(userId: string, bubbleId: string): Promise<boolean>;
  getMembershipStatus(userId: string, bubbleId: string): Promise<string | null>;
  getRealMemberCount(bubbleId: string): Promise<number>;
  createMembershipWithStatus(data: { userId: string; bubbleId: string }, status: string): Promise<any>;
  createMembership(data: { userId: string; bubbleId: string }): Promise<any>;
  isMember(userId: string, bubbleId: string): Promise<boolean>;
  getMemberRole(userId: string, bubbleId: string): Promise<string | null>;
  getBubbleMembersWithUsers(bubbleId: string): Promise<any[]>;
  deleteMembership(userId: string, bubbleId: string): Promise<void>;
  updateMemberRole(userId: string, bubbleId: string, role: string): Promise<void>;
  getBubbleMemberships(bubbleId: string): Promise<any[]>;
  getPendingJoinRequests(bubbleId: string): Promise<any[]>;
  approveMembership(userId: string, bubbleId: string): Promise<any>;
  rejectMembership(userId: string, bubbleId: string): Promise<void>;
  getWaitlistMembers(bubbleId: string): Promise<any[]>;
  getAdminMemberChatsForBubble(bubbleId: string): Promise<any[]>;
  updateAdminMemberChatParticipants(chatId: string, participantIds: string[]): Promise<void>;
  archiveAdminMemberChatsForMember(bubbleId: string, userId: string): Promise<void>;
}

export interface BubbleMembershipOptions {
  ensureCometChatUser?: (userId: string, name: string) => Promise<void>;
  ensureCometChatGroup?: (groupId: string, title: string) => Promise<void>;
  addMemberToGroup?: (groupId: string, userId: string) => Promise<void>;
  removeMemberFromGroup?: (groupId: string, userId: string) => Promise<void>;
  syncAllAdminDmGroupsForBubble?: (...args: any[]) => Promise<void>;
  notifyBubbleAdmins?: (...args: any[]) => void;
  sendNotification?: (opts: {
    recipientId: string;
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) => void;
}

export function registerBubbleMembershipRoutes(
  app: Express,
  storage: BubbleMembershipStorage,
  jwtSecret: string,
  options: BubbleMembershipOptions = {},
) {
  const auth = makeAuthMiddleware(storage, jwtSecret);
  const notify = options.sendNotification ?? (() => {});
  const notifyAdmins = options.notifyBubbleAdmins ?? (() => {});

  // ── Join ──────────────────────────────────────────────────────────────────

  app.post("/api/bubbles/:id/join", auth, async (req: any, res: any) => {
    try {
      const bubbleId = req.params.id;
      const bubble = await storage.getBubble(bubbleId);
      if (!bubble) return res.status(404).json({ error: "Bubble not found" });

      if (bubble.campusId) {
        const user = await storage.getUser(req.userId);
        if (!user?.campusVerified || user.campusId !== bubble.campusId) {
          return res.status(403).json({ error: "Campus verification required to join this bubble" });
        }
      }

      const hasExisting = await storage.hasAnyMembership(req.userId, bubbleId);
      if (hasExisting) {
        const status = await storage.getMembershipStatus(req.userId, bubbleId);
        if (status === "approved") return res.status(400).json({ error: "Already a member" });
        if (status === "pending") return res.status(400).json({ error: "Join request already pending" });
        if (status === "waitlisted") return res.status(400).json({ error: "Already on the waitlist" });
        if (status === "on_hold") return res.status(400).json({ error: "Your waitlist spot is on hold" });
      }

      if (bubble.memberLimit != null) {
        const currentCount = await storage.getRealMemberCount(bubbleId);
        if (currentCount >= bubble.memberLimit) {
          await storage.createMembershipWithStatus({ userId: req.userId, bubbleId }, "waitlisted");
          return res.json({ success: true, status: "waitlisted" });
        }
      }

      if (bubble.privacy === "Request to Join" || bubble.privacy === "Request" || bubble.privacy === "Private") {
        await storage.createMembershipWithStatus({ userId: req.userId, bubbleId }, "pending");
        const requester = await storage.getUser(req.userId);
        notifyAdmins(
          bubbleId, req.userId, "membership_request",
          "Join Request", `${requester?.name || "Someone"} wants to join ${bubble.title}`,
          { bubbleId, bubbleName: bubble.title, userId: req.userId, userName: requester?.name },
          true,
        );
        return res.json({ success: true, status: "pending" });
      }

      await storage.createMembership({ userId: req.userId, bubbleId });

      try {
        const joiner = await storage.getUser(req.userId);
        if (joiner) {
          await options.ensureCometChatUser?.(String(joiner.id), joiner.name || joiner.email);
          await options.ensureCometChatGroup?.(bubbleId, bubble.title || "Bubble");
          await options.addMemberToGroup?.(bubbleId, String(joiner.id));
        }
      } catch (e) {
        console.error("CometChat add member on join:", e);
      }

      const joinerUser = await storage.getUser(req.userId);
      notifyAdmins(
        bubbleId, req.userId, "bubble_join",
        "New Member", `${joinerUser?.name || "Someone"} joined ${bubble.title}`,
        { bubbleId, bubbleName: bubble.title, userId: req.userId, userName: joinerUser?.name },
        true,
      );

      res.json({ success: true, status: "approved" });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Leave ─────────────────────────────────────────────────────────────────

  app.post("/api/bubbles/:id/leave", auth, async (req: any, res: any) => {
    try {
      const bubbleId = req.params.id;
      const memberRole = await storage.getMemberRole(req.userId, bubbleId);
      if (!memberRole) return res.status(400).json({ error: "Not a member" });

      await storage.deleteMembership(req.userId, bubbleId);

      try {
        await options.removeMemberFromGroup?.(bubbleId, String(req.userId));
      } catch (e) {
        console.error("CometChat remove member on leave:", e);
      }

      try {
        if (memberRole === "admin") {
          const adminChats = await storage.getAdminMemberChatsForBubble(bubbleId);
          const activeChats = adminChats.filter(
            (c) => c.status === "active" && c.participantIds.includes(req.userId),
          );
          for (const chat of activeChats) {
            const updated = chat.participantIds.filter((id: string) => id !== req.userId);
            await storage.updateAdminMemberChatParticipants(chat.id, updated);
            options.removeMemberFromGroup?.(chat.cometChatGroupId, String(req.userId)).catch(() => {});
          }
          const allMemberships = await storage.getBubbleMemberships(bubbleId).catch(() => []);
          for (const m of allMemberships) {
            if (String(m.userId) === String(req.userId)) continue;
            options.removeMemberFromGroup?.(
              `contact_${bubbleId}_${m.userId}`, String(req.userId),
            ).catch(() => {});
          }
          options.removeMemberFromGroup?.(
            `contact_${bubbleId}_${req.userId}`, String(req.userId),
          ).catch(() => {});
        } else {
          const memberChats = await storage.getAdminMemberChatsForBubble(bubbleId);
          const myChats = memberChats.filter((c) => c.memberId === req.userId);
          await storage.archiveAdminMemberChatsForMember(bubbleId, req.userId);
          for (const chat of myChats) {
            options.removeMemberFromGroup?.(chat.cometChatGroupId, String(req.userId)).catch(() => {});
          }
          options.removeMemberFromGroup?.(
            `contact_${bubbleId}_${req.userId}`, String(req.userId),
          ).catch(() => {});
        }
      } catch (e) {
        console.error("Handle admin-member chats on leave:", e);
      }

      const leaverUser = await storage.getUser(req.userId);
      const leaveBubble = await storage.getBubble(bubbleId);
      notifyAdmins(
        bubbleId, req.userId, "bubble_leave",
        "Member Left", `${leaverUser?.name || "Someone"} left ${leaveBubble?.title || "the bubble"}`,
        { bubbleId, bubbleName: leaveBubble?.title, userId: req.userId, userName: leaverUser?.name },
        true,
      );
      notify({
        recipientId: req.userId,
        type: "bubble_member_removed",
        title: "Left Bubble",
        body: `You've left ${leaveBubble?.title || "the bubble"}. Your DM conversations with that bubble have been hidden.`,
        metadata: { bubbleId, bubbleName: leaveBubble?.title },
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Members list ──────────────────────────────────────────────────────────

  app.get("/api/bubbles/:id/members", async (req: any, res: any) => {
    try {
      const bubble = await storage.getBubble(req.params.id);
      if (!bubble) return res.status(404).json({ error: "Bubble not found" });

      if (bubble.campusId) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return res.status(403).json({ error: "Campus verification required" });
        }
        try {
          const decoded = jwt.verify(authHeader.slice(7), jwtSecret) as { userId: string };
          const user = await storage.getUser(decoded.userId);
          if (!user?.campusVerified || user.campusId !== bubble.campusId) {
            return res.status(403).json({ error: "Campus verification required" });
          }
        } catch {
          return res.status(403).json({ error: "Campus verification required" });
        }
      }

      const members = await storage.getBubbleMembersWithUsers(req.params.id);
      res.json(
        members.map((m) => ({
          id: m.id,
          userId: m.userId,
          bubbleId: m.bubbleId,
          role: m.role,
          createdAt: m.createdAt,
          user: { id: m.user.id, name: m.user.name, profilePhoto: m.user.profilePhoto },
        })),
      );
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Membership status ─────────────────────────────────────────────────────

  app.get("/api/bubbles/:id/membership", auth, async (req: any, res: any) => {
    try {
      const isMember = await storage.isMember(req.userId, req.params.id);
      const role = await storage.getMemberRole(req.userId, req.params.id);
      const membershipStatus = await storage.getMembershipStatus(req.userId, req.params.id);
      res.json({ isMember, role, membershipStatus });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Change member role ────────────────────────────────────────────────────

  app.put("/api/bubbles/:bubbleId/members/:userId/role", auth, async (req: any, res: any) => {
    try {
      const { bubbleId, userId } = req.params;
      const { role } = req.body;

      if (!role || !["member", "admin"].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be 'member' or 'admin'" });
      }

      const requesterRole = await storage.getMemberRole(req.userId, bubbleId);
      if (requesterRole !== "admin") {
        return res.status(403).json({ error: "Only admins can change member roles" });
      }

      const targetIsMember = await storage.isMember(userId, bubbleId);
      if (!targetIsMember) {
        return res.status(404).json({ error: "User is not a member of this bubble" });
      }

      if (role === "member") {
        const targetRole = await storage.getMemberRole(userId, bubbleId);
        if (targetRole === "admin") {
          const members = await storage.getBubbleMembersWithUsers(bubbleId);
          const admins = members.filter((m) => m.role === "admin");
          if (admins.length <= 1) {
            return res.status(400).json({ error: "Cannot demote the only admin. Promote another member first." });
          }
        }
      }

      await storage.updateMemberRole(userId, bubbleId, role);

      try {
        const bubble = await storage.getBubble(bubbleId);
        const allMembers = await storage.getBubbleMembersWithUsers(bubbleId);
        const newAdminIds = allMembers.filter((m) => m.role === "admin").map((m) => String(m.userId));
        const allMemberIds = allMembers.map((m) => String(m.userId));
        await options.syncAllAdminDmGroupsForBubble?.(
          bubbleId,
          bubble?.title || "Bubble",
          newAdminIds,
          allMemberIds,
          async (id: string) => {
            const u = await storage.getUser(id);
            return u?.name || u?.email || "Unknown";
          },
        );
      } catch (e) {
        console.error("CometChat sync admin DM groups on role change:", e);
      }

      const roleBubble = await storage.getBubble(bubbleId);
      const roleLabel = role === "admin" ? "an admin" : "a member";
      notify({
        recipientId: userId,
        type: "bubble_role_changed",
        title: "Role Updated",
        body: `You're now ${roleLabel} of ${roleBubble?.title || "the bubble"}.`,
        metadata: { bubbleId, bubbleName: roleBubble?.title, role },
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Remove member ─────────────────────────────────────────────────────────

  app.delete("/api/bubbles/:bubbleId/members/:userId", auth, async (req: any, res: any) => {
    try {
      const { bubbleId, userId } = req.params;

      const requesterRole = await storage.getMemberRole(req.userId, bubbleId);
      const requesterUser = await storage.getUser(req.userId);
      if (requesterRole !== "admin" && !requesterUser?.isSuperAdmin) {
        return res.status(403).json({ error: "Only admins can remove members" });
      }

      if (userId === req.userId) {
        return res.status(400).json({ error: "Cannot remove yourself. Use the leave endpoint instead." });
      }

      const targetIsMember = await storage.isMember(userId, bubbleId);
      if (!targetIsMember) {
        return res.status(404).json({ error: "User is not a member of this bubble" });
      }

      const kickBubble = await storage.getBubble(bubbleId);
      const targetRole = await storage.getMemberRole(userId, bubbleId);
      await storage.deleteMembership(userId, bubbleId);

      try {
        await options.removeMemberFromGroup?.(bubbleId, String(userId));
      } catch (e) {
        console.error("CometChat remove member on admin kick:", e);
      }

      try {
        if (targetRole === "admin") {
          const adminChats = await storage.getAdminMemberChatsForBubble(bubbleId);
          const activeChats = adminChats.filter(
            (c) => c.status === "active" && c.participantIds.includes(userId),
          );
          for (const chat of activeChats) {
            const updated = chat.participantIds.filter((id: string) => id !== userId);
            await storage.updateAdminMemberChatParticipants(chat.id, updated);
            options.removeMemberFromGroup?.(chat.cometChatGroupId, String(userId)).catch(() => {});
          }
          const allMemberships = await storage.getBubbleMemberships(bubbleId).catch(() => []);
          for (const m of allMemberships) {
            if (String(m.userId) === String(userId)) continue;
            options.removeMemberFromGroup?.(
              `contact_${bubbleId}_${m.userId}`, String(userId),
            ).catch(() => {});
          }
          options.removeMemberFromGroup?.(
            `contact_${bubbleId}_${userId}`, String(userId),
          ).catch(() => {});
        } else {
          await storage.archiveAdminMemberChatsForMember(bubbleId, userId);
          const memberChats = await storage.getAdminMemberChatsForBubble(bubbleId);
          const myChats = memberChats.filter((c) => c.memberId === userId);
          for (const chat of myChats) {
            options.removeMemberFromGroup?.(chat.cometChatGroupId, String(userId)).catch(() => {});
          }
          options.removeMemberFromGroup?.(
            `contact_${bubbleId}_${userId}`, String(userId),
          ).catch(() => {});
        }
      } catch (e) {
        console.error("Handle admin-member chats on kick:", e);
      }

      notify({
        recipientId: userId,
        type: "bubble_member_removed",
        title: "Removed from Bubble",
        body: `You've been removed from ${kickBubble?.title || "the bubble"}. Your DM conversations with that bubble have been hidden.`,
        metadata: { bubbleId, bubbleName: kickBubble?.title },
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Join requests ─────────────────────────────────────────────────────────

  app.get("/api/bubbles/:bubbleId/join-requests", auth, async (req: any, res: any) => {
    try {
      const { bubbleId } = req.params;
      const bubble = await storage.getBubble(bubbleId);
      if (!bubble) return res.status(404).json({ error: "Bubble not found" });

      const requesterRole = await storage.getMemberRole(req.userId, bubbleId);
      const user = await storage.getUser(req.userId);
      if (requesterRole !== "admin" && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Only admins can view join requests" });
      }

      const requests = await storage.getPendingJoinRequests(bubbleId);
      res.json(
        requests.map((r) => ({
          id: r.id,
          userId: r.userId,
          bubbleId: r.bubbleId,
          membershipStatus: r.membershipStatus,
          createdAt: r.createdAt,
          user: { id: r.user.id, name: r.user.name, profilePhoto: r.user.profilePhoto },
        })),
      );
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/bubbles/:bubbleId/join-requests/:userId/approve", auth, async (req: any, res: any) => {
    try {
      const { bubbleId, userId } = req.params;

      const requesterRole = await storage.getMemberRole(req.userId, bubbleId);
      const user = await storage.getUser(req.userId);
      if (requesterRole !== "admin" && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Only admins can approve join requests" });
      }

      const membership = await storage.approveMembership(userId, bubbleId);
      if (!membership) return res.status(404).json({ error: "Join request not found" });

      try {
        const approvedUser = await storage.getUser(userId);
        const bubble = await storage.getBubble(bubbleId);
        if (approvedUser && bubble) {
          await options.ensureCometChatUser?.(String(approvedUser.id), approvedUser.name || approvedUser.email);
          await options.ensureCometChatGroup?.(bubbleId, bubble.title || "Bubble");
          await options.addMemberToGroup?.(bubbleId, String(approvedUser.id));
        }
      } catch (e) {
        console.error("CometChat add member on join approval:", e);
      }

      const approvalBubble = await storage.getBubble(bubbleId);
      notify({
        recipientId: userId,
        type: "bubble_request_approved",
        title: "Request Approved!",
        body: `Your request to join ${approvalBubble?.title || "the bubble"} was approved!`,
        metadata: { bubbleId, bubbleName: approvalBubble?.title },
      });

      res.json({ success: true, membership });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/bubbles/:bubbleId/join-requests/:userId/reject", auth, async (req: any, res: any) => {
    try {
      const { bubbleId, userId } = req.params;
      const rawReason = req.body?.reason;
      const reason = rawReason ? String(rawReason).trim().slice(0, 500) || undefined : undefined;

      const requesterRole = await storage.getMemberRole(req.userId, bubbleId);
      const user = await storage.getUser(req.userId);
      if (requesterRole !== "admin" && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Only admins can reject join requests" });
      }

      await storage.rejectMembership(userId, bubbleId);

      const rejBubble = await storage.getBubble(bubbleId);
      const base = `Your request to join ${rejBubble?.title || "the bubble"} was not approved.`;
      notify({
        recipientId: userId,
        type: "bubble_request_rejected",
        title: "Request Not Approved",
        body: reason ? `${base} Reason: ${reason}` : base,
        metadata: { bubbleId, bubbleName: rejBubble?.title },
      });

      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Waitlist ──────────────────────────────────────────────────────────────

  app.get("/api/bubbles/:bubbleId/waitlist", auth, async (req: any, res: any) => {
    try {
      const { bubbleId } = req.params;
      const requesterRole = await storage.getMemberRole(req.userId, bubbleId);
      const user = await storage.getUser(req.userId);
      if (requesterRole !== "admin" && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Only admins can view the waitlist" });
      }

      const waitlist = await storage.getWaitlistMembers(bubbleId);
      const fmt = (r: any) => ({
        id: r.id,
        userId: r.userId,
        bubbleId: r.bubbleId,
        membershipStatus: r.membershipStatus,
        createdAt: r.createdAt,
        user: { id: r.user.id, name: r.user.name, profilePhoto: r.user.profilePhoto },
      });
      res.json({
        waitlisted: waitlist.filter((r) => r.membershipStatus === "waitlisted").map(fmt),
        on_hold: waitlist.filter((r) => r.membershipStatus === "on_hold").map(fmt),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/bubbles/:bubbleId/waitlist/:userId/approve", auth, async (req: any, res: any) => {
    try {
      const { bubbleId, userId } = req.params;

      const requesterRole = await storage.getMemberRole(req.userId, bubbleId);
      const requester = await storage.getUser(req.userId);
      if (requesterRole !== "admin" && !requester?.isSuperAdmin) {
        return res.status(403).json({ error: "Only admins can approve waitlist members" });
      }

      const bubble = await storage.getBubble(bubbleId);
      if (!bubble) return res.status(404).json({ error: "Bubble not found" });

      if (bubble.memberLimit != null) {
        const currentCount = await storage.getRealMemberCount(bubbleId);
        if (currentCount >= bubble.memberLimit) {
          return res.status(400).json({ error: "Bubble is still at capacity" });
        }
      }

      const existingStatus = await storage.getMembershipStatus(userId, bubbleId);
      if (!existingStatus || (existingStatus !== "waitlisted" && existingStatus !== "on_hold")) {
        return res.status(400).json({ error: "User is not on the waitlist" });
      }

      const membership = await storage.approveMembership(userId, bubbleId);
      if (!membership) return res.status(400).json({ error: "Failed to approve membership" });

      notify({
        recipientId: userId,
        type: "waitlist_approved",
        title: "You're In!",
        body: `You've been approved to join ${bubble.title} from the waitlist!`,
        metadata: { bubbleId, bubbleName: bubble.title },
      });

      res.json({ success: true, membership });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
}
