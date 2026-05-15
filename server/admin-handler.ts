import type { Express } from "express";
import { makeAuthMiddleware } from "./auth-middleware";

export interface AdminStorage {
  getUser(id: string): Promise<any>;
  approveBubble(id: string): Promise<any>;
  rejectBubble(id: string, reason?: string): Promise<any>;
  getBubbleChat(bubbleId: string): Promise<any>;
  createBubbleChat(bubbleId: string, cometChatGroupId: string): Promise<any>;
  hasAnyMembership(userId: string, bubbleId: string): Promise<boolean>;
  createMembershipWithRole(data: { userId: string; bubbleId: string }, role: string): Promise<any>;
}

export interface AdminHandlerOptions {
  ensureCometChatGroup?: (groupId: string, title: string, type?: string) => Promise<void>;
  ensureCometChatUser?: (userId: string, name: string) => Promise<void>;
  addMemberToGroup?: (groupId: string, userId: string, role?: string) => Promise<void>;
  sendNotification?: (opts: {
    recipientId: string;
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) => void;
  enrichBubble?: (bubble: any) => Promise<any>;
  auditLog?: (
    action: string,
    adminId: string,
    targetId: string,
    ip: string,
    extra?: Record<string, unknown>,
  ) => void;
}

export function registerAdminBubbleRoutes(
  app: Express,
  storage: AdminStorage,
  jwtSecret: string,
  options: AdminHandlerOptions = {},
) {
  const auth = makeAuthMiddleware(storage, jwtSecret);
  const enrich = options.enrichBubble ?? ((b: any) => Promise.resolve(b));
  const audit = options.auditLog ?? (() => {});
  const notify = options.sendNotification ?? (() => {});

  app.post("/api/admin/bubbles/:id/approve", auth, async (req: any, res: any) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }

      const bubble = await storage.approveBubble(req.params.id);
      if (!bubble) return res.status(404).json({ error: "Bubble not found" });

      audit("bubble_approved", req.userId, req.params.id, req.ip ?? "");

      try {
        const groupType = bubble.privacy === "Public" ? "public" : "private";
        const cometChatGroupId = String(bubble.id);
        await options.ensureCometChatGroup?.(cometChatGroupId, bubble.title || "Bubble", groupType);
        if (bubble.createdBy) {
          const creator = await storage.getUser(bubble.createdBy);
          if (creator) {
            await options.ensureCometChatUser?.(String(creator.id), creator.name || creator.email);
            await options.addMemberToGroup?.(cometChatGroupId, String(creator.id), "admin");
          }
        }
        const existingChat = await storage.getBubbleChat(bubble.id);
        if (!existingChat) {
          await storage.createBubbleChat(bubble.id, cometChatGroupId);
        }
      } catch (e) {
        console.error("CometChat group creation on bubble approve:", e);
      }

      if (bubble.createdBy) {
        const existingMembership = await storage.hasAnyMembership(bubble.createdBy, bubble.id);
        if (!existingMembership) {
          try {
            await storage.createMembershipWithRole(
              { userId: bubble.createdBy, bubbleId: bubble.id },
              "admin",
            );
          } catch (e) {
            console.error("Failed to auto-add creator on approve:", e);
          }
        }
        notify({
          recipientId: bubble.createdBy,
          type: "bubble_approved",
          title: "Bubble Approved!",
          body: `Your bubble "${bubble.title}" has been approved and is now live!`,
          metadata: { bubbleId: bubble.id, bubbleName: bubble.title },
        });
      }

      res.json(await enrich(bubble));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/admin/bubbles/:id/reject", auth, async (req: any, res: any) => {
    try {
      const user = await storage.getUser(req.userId);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }

      const { reason } = req.body;
      if (reason !== undefined && (typeof reason !== "string" || reason.length > 500)) {
        return res.status(400).json({ error: "Reason must be 500 characters or fewer" });
      }

      const bubble = await storage.rejectBubble(req.params.id, reason);
      if (!bubble) return res.status(404).json({ error: "Bubble not found" });

      audit("bubble_rejected", req.userId, req.params.id, req.ip ?? "", { reason });

      if (bubble.createdBy) {
        notify({
          recipientId: bubble.createdBy,
          type: "bubble_rejected",
          title: "Bubble Not Approved",
          body: `Your bubble "${bubble.title}" was not approved.${reason ? ` Reason: ${reason}` : ""}`,
          metadata: { bubbleId: bubble.id, bubbleName: bubble.title, reason },
        });
      }

      res.json(await enrich(bubble));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
}
