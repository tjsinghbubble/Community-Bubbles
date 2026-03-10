import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { insertUserSchema, insertBubbleSchema, insertEventSchema, insertCategorySchema, insertReportSchema } from "@shared/schema";
import { seedCampuses } from "./seed-campuses";
import { seedCategories } from "./seed-categories";
import { seedBulletinPostTypes } from "./seed-bulletin-post-types";
import { seedData } from "./seed-data";
import { seedAppConfig } from "./seed-app-config";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { ensureCometChatUser, ensureCometChatGroup, addMemberToGroup, addMembersToGroupBatch, removeMemberFromGroup, syncAdminDmGroup, syncAllAdminDmGroupsForBubble } from "./cometchat";
import { sendNotification, sendNotificationToMany, notifyBubbleAdmins, notifyBubbleMembers } from "./notifications";
import { localToUtc, utcToLocal } from "./timezone";
import { moderateText } from "./moderation";
import { sendVerificationEmail } from "./email";

const JWT_SECRET =
  process.env.JWT_SECRET || "bubble-secret-key-change-in-production";

async function resolveCategoryName(categoryId: number | null | undefined): Promise<string | null> {
  if (!categoryId) return null;
  const cat = await storage.getCategory(categoryId);
  return cat ? (cat.displayName || cat.name) : null;
}

async function enrichBubbleCategory(bubble: any): Promise<any> {
  if (bubble && bubble.categoryId) {
    const name = await resolveCategoryName(bubble.categoryId);
    if (name) return { ...bubble, category: name };
  }
  return bubble;
}

async function enrichBubblesCategory(bubblesArr: any[]): Promise<any[]> {
  const ids = Array.from(new Set(bubblesArr.map(b => b.categoryId).filter(Boolean))) as number[];
  if (ids.length === 0) return bubblesArr;
  const cats = await storage.getCategoriesByIds(ids);
  const nameMap: Record<number, string> = {};
  for (const c of cats) {
    nameMap[c.id] = c.displayName || c.name;
  }
  return bubblesArr.map(b => {
    if (b.categoryId && nameMap[b.categoryId]) {
      return { ...b, category: nameMap[b.categoryId] };
    }
    return b;
  });
}

function convertEventToLocal(event: any): any {
  if (!event || !event.timezone || event.timezone === 'UTC') return event;
  if (!event.date || !event.startTime) return event;
  const localStart = utcToLocal(event.date, event.startTime, event.timezone);
  const result = { ...event, date: localStart.date, startTime: localStart.time };
  if (event.endTime) {
    const utcStartDt = new Date(`${event.date}T${event.startTime}:00Z`);
    const utcEndDt = new Date(`${event.date}T${event.endTime}:00Z`);
    let endUtcDate = event.date;
    if (utcEndDt <= utcStartDt) {
      const nextDay = new Date(utcEndDt.getTime() + 24 * 60 * 60 * 1000);
      endUtcDate = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDay.getUTCDate()).padStart(2, '0')}`;
    }
    const localEnd = utcToLocal(endUtcDate, event.endTime, event.timezone);
    result.endTime = localEnd.time;
  }
  return result;
}

function convertEventsToLocal(events: any[]): any[] {
  return events.map(e => {
    if (e.bubble) {
      return { ...convertEventToLocal(e), bubble: e.bubble };
    }
    return convertEventToLocal(e);
  });
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function optionalAuthMiddleware(req: any, _res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      req.userId = decoded.userId;
    } catch (_) {}
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Register object storage routes for image uploads with auth middleware
  registerObjectStorageRoutes(app, authMiddleware);

  // CORS middleware for analytics dashboard
  app.use((req, res, next) => {
    const allowedOrigins = ['http://localhost:3001', 'http://127.0.0.1:3001'];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.post("/api/auth/send-verification", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await storage.createVerificationCode({
        email,
        code,
        expiresAt,
      });

      await sendVerificationEmail(email, code);

      const response: any = { success: true, message: "Verification code sent" };
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Verification code for ${email}: ${code}`);
        response.devCode = code;
      }
      res.json(response);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/verify-code", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Email and code are required" });
      }

      const verificationCode = await storage.getValidVerificationCode(
        email,
        code,
      );
      if (!verificationCode) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }

      await storage.markCodeAsUsed(verificationCode.id);

      res.json({ success: true, verified: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);

      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
        expiresIn: "30d",
      });

      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          interests: user.interests,
          profilePhoto: user.profilePhoto,
        },
        token,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/auth/delete-account", authMiddleware, async (req, res) => {
    try {
      await storage.deleteUser(req.userId!);
      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
        expiresIn: "30d",
      });

      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          interests: user.interests,
          campusId: user.campusId,
          campusEmail: user.campusEmail,
          campusVerified: user.campusVerified,
          dismissedCampusPrompt: user.dismissedCampusPrompt,
          isSuperAdmin: user.isSuperAdmin,
          profilePhoto: user.profilePhoto,
        },
        token,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get current user profile
  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        interests: user.interests,
        campusId: user.campusId,
        campusEmail: user.campusEmail,
        campusVerified: user.campusVerified,
        dismissedCampusPrompt: user.dismissedCampusPrompt,
        isSuperAdmin: user.isSuperAdmin,
        profilePhoto: user.profilePhoto,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bubbles", async (req, res) => {
    try {
      // Return only public bubbles (excludes campus-specific ones)
      const bubbles = await storage.getPublicBubbles();
      res.json(await enrichBubblesCategory(bubbles));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bubbles/my", authMiddleware, async (req, res) => {
    try {
      const membershipList = await storage.getUserMemberships(req.userId!);
      const bubblesWithCounts = await Promise.all(membershipList.map(async (m) => {
        const realCount = await storage.getRealMemberCount(m.bubble.id);
        return { ...m.bubble, members: realCount, role: m.role };
      }));
      res.json(await enrichBubblesCategory(bubblesWithCounts));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bubbles/:id", async (req, res) => {
    try {
      const bubble = await storage.getBubble(req.params.id);
      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }
      
      // If campus bubble, check authorization
      if (bubble.campusId) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return res.status(403).json({ error: "Campus verification required" });
        }
        try {
          const token = authHeader.slice(7);
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
          const user = await storage.getUser(decoded.userId);
          if (!user?.campusVerified || user.campusId !== bubble.campusId) {
            return res.status(403).json({ error: "Campus verification required" });
          }
        } catch {
          return res.status(403).json({ error: "Campus verification required" });
        }
      }
      
      const realMemberCount = await storage.getRealMemberCount(bubble.id);
      res.json(await enrichBubbleCategory({ ...bubble, members: realMemberCount }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bubbles", authMiddleware, async (req, res) => {
    try {
      const body = { ...req.body, creatorId: req.userId };

      const modResult = moderateText({
        title: body.title,
        tagline: body.tagline,
        description: body.description,
        rules: body.rules,
      });
      if (modResult.flagged) {
        return res.status(400).json({ error: modResult.message });
      }

      if (body.categoryId && !body.category) {
        const catName = await resolveCategoryName(body.categoryId);
        body.category = catName || 'General';
      }

      const data = insertBubbleSchema.parse(body);
      const bubble = await storage.createBubble(data);

      try {
        await storage.createMembershipWithRole(
          { userId: req.userId!, bubbleId: bubble.id },
          'admin'
        );
      } catch (e) {
        console.error('Failed to auto-add creator as admin member:', e);
      }

      res.json(await enrichBubbleCategory(bubble));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/bubbles/:id", authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.id;
      const bubble = await storage.getBubble(bubbleId);

      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }

      const user = await storage.getUser(req.userId!);
      const isBubbleAdmin = bubble.creatorId === req.userId;
      const isSuperAdmin = user?.isSuperAdmin === true;

      if (!isBubbleAdmin && !isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to edit this bubble" });
      }

      const { title, tagline, category, categoryId, description, rules, privacy, coverImage, images, attachments, memberLimit, locationName, locationAddress, locationLat, locationLng, radiusMiles } = req.body;

      const modResult = moderateText({
        title,
        tagline,
        description,
        rules,
      });
      if (modResult.flagged) {
        return res.status(400).json({ error: modResult.message });
      }

      const updateData: any = {};
      
      if (title !== undefined) updateData.title = title;
      if (tagline !== undefined) updateData.tagline = tagline;
      if (categoryId !== undefined) {
        updateData.categoryId = categoryId;
        const catName = await resolveCategoryName(categoryId);
        if (catName) updateData.category = catName;
      } else if (category !== undefined) {
        updateData.category = category;
      }
      if (description !== undefined) updateData.description = description;
      if (rules !== undefined) updateData.rules = rules;
      if (privacy !== undefined) updateData.privacy = privacy;
      if (coverImage !== undefined) updateData.coverImage = coverImage;
      if (images !== undefined) updateData.images = images;
      if (attachments !== undefined) updateData.attachments = attachments;
      if (memberLimit !== undefined) updateData.memberLimit = memberLimit;
      if (locationName !== undefined) updateData.locationName = locationName;
      if (locationAddress !== undefined) updateData.locationAddress = locationAddress;
      if (locationLat !== undefined) updateData.locationLat = locationLat;
      if (locationLng !== undefined) updateData.locationLng = locationLng;
      if (radiusMiles !== undefined) updateData.radiusMiles = radiusMiles;

      const updatedBubble = await storage.updateBubble(bubbleId, updateData);

      const editorUser = await storage.getUser(req.userId!);
      notifyBubbleMembers(bubbleId, req.userId!, "bubble_edited",
        "Bubble Updated", `${editorUser?.name || 'An admin'} updated ${bubble.title}`,
        { bubbleId, bubbleName: bubble.title, userId: req.userId!, userName: editorUser?.name },
        true);

      res.json(await enrichBubbleCategory(updatedBubble));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/bubbles/:id/photos", authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.id;
      const bubble = await storage.getBubble(bubbleId);

      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }

      const memberStatus = await storage.getMembershipStatus(req.userId!, bubbleId);
      if (memberStatus !== 'approved') {
        return res.status(403).json({ error: "Only members can add photos" });
      }

      const { imageUrl } = req.body;
      if (!imageUrl || typeof imageUrl !== 'string') {
        return res.status(400).json({ error: "imageUrl is required" });
      }

      const maxPhotosValue = await storage.getAppConfigValue('max_bubble_photos');
      const maxPhotos = parseInt(maxPhotosValue || '20', 10);

      const currentImages = bubble.images || [];
      if (currentImages.length >= maxPhotos) {
        return res.status(400).json({ error: `This bubble already has the maximum of ${maxPhotos} photos` });
      }

      const updatedImages = [...currentImages, imageUrl];
      const updatedBubble = await storage.updateBubble(bubbleId, { images: updatedImages });
      res.json(updatedBubble);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/bubbles/:id", authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.id;
      const bubble = await storage.getBubble(bubbleId);

      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }

      const user = await storage.getUser(req.userId!);
      const isBubbleAdmin = bubble.creatorId === req.userId;
      const isSuperAdmin = user?.isSuperAdmin === true;

      if (!isBubbleAdmin && !isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to delete this bubble" });
      }

      try {
        await storage.archiveAdminMemberChatsForBubble(bubbleId);
        await storage.updateBubbleChatStatus(bubbleId, 'archived');
      } catch (e) {
        console.error('Archive chats on bubble delete:', e);
      }

      await storage.deleteBubble(bubbleId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get pending bubbles (super admin only)
  app.get("/api/admin/pending-bubbles", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }
      const pendingBubbles = await storage.getPendingBubbles();
      res.json(await enrichBubblesCategory(pendingBubbles));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Approve bubble (super admin only)
  app.post("/api/admin/bubbles/:id/approve", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }
      const bubble = await storage.approveBubble(req.params.id);
      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }
      
      try {
        const groupType = bubble.privacy === 'Public' ? 'public' : 'private';
        const cometChatGroupId = String(bubble.id);
        await ensureCometChatGroup(cometChatGroupId, bubble.title || 'Bubble', groupType);
        if (bubble.creatorId) {
          const creator = await storage.getUser(bubble.creatorId);
          if (creator) {
            await ensureCometChatUser(String(creator.id), creator.name || creator.email);
            await addMemberToGroup(cometChatGroupId, String(creator.id), 'admin');
          }
        }
        const existingChat = await storage.getBubbleChat(bubble.id);
        if (!existingChat) {
          await storage.createBubbleChat(bubble.id, cometChatGroupId);
        }
      } catch (e) {
        console.error('CometChat group creation on bubble approve:', e);
      }

      if (bubble.creatorId) {
        const existingMembership = await storage.hasAnyMembership(bubble.creatorId, bubble.id);
        if (!existingMembership) {
          try {
            await storage.createMembershipWithRole(
              { userId: bubble.creatorId, bubbleId: bubble.id },
              'admin'
            );
          } catch (e) {
            console.error('Failed to auto-add creator on approve:', e);
          }
        }

        sendNotification({
          recipientId: bubble.creatorId,
          type: "bubble_approved",
          title: "Bubble Approved!",
          body: `Your bubble "${bubble.title}" has been approved and is now live!`,
          metadata: { bubbleId: bubble.id, bubbleName: bubble.title },
        });
      }
      
      res.json(await enrichBubbleCategory(bubble));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Reject bubble (super admin only)
  app.post("/api/admin/bubbles/:id/reject", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }
      const { reason } = req.body;
      const bubble = await storage.rejectBubble(req.params.id, reason);
      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }

      if (bubble.creatorId) {
        sendNotification({
          recipientId: bubble.creatorId,
          type: "bubble_rejected",
          title: "Bubble Not Approved",
          body: `Your bubble "${bubble.title}" was not approved.${reason ? ` Reason: ${reason}` : ''}`,
          metadata: { bubbleId: bubble.id, bubbleName: bubble.title, reason },
        });
      }

      res.json(await enrichBubbleCategory(bubble));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/bubbles/:id/join", authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.id;
      const bubble = await storage.getBubble(bubbleId);

      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }
      
      if (bubble.campusId) {
        const user = await storage.getUser(req.userId!);
        if (!user?.campusVerified || user.campusId !== bubble.campusId) {
          return res.status(403).json({ error: "Campus verification required to join this bubble" });
        }
      }

      if (bubble.memberLimit != null) {
        const currentCount = await storage.getRealMemberCount(bubbleId);
        if (currentCount >= bubble.memberLimit) {
          return res.status(400).json({ error: "This bubble has reached its member limit" });
        }
      }

      const hasExisting = await storage.hasAnyMembership(req.userId!, bubbleId);
      if (hasExisting) {
        const status = await storage.getMembershipStatus(req.userId!, bubbleId);
        if (status === 'approved') {
          return res.status(400).json({ error: "Already a member" });
        }
        if (status === 'pending') {
          return res.status(400).json({ error: "Join request already pending" });
        }
      }

      if (bubble.privacy === 'Request to Join' || bubble.privacy === 'Private') {
        await storage.createMembershipWithStatus({
          userId: req.userId!,
          bubbleId,
        }, 'pending');

        const requester = await storage.getUser(req.userId!);
        notifyBubbleAdmins(bubbleId, req.userId!, "membership_request",
          "Join Request", `${requester?.name || 'Someone'} wants to join ${bubble.title}`,
          { bubbleId, bubbleName: bubble.title, userId: req.userId!, userName: requester?.name },
          true);

        res.json({ success: true, status: 'pending' });
      } else {
        await storage.createMembership({
          userId: req.userId!,
          bubbleId,
        });
        
        try {
          const joiner = await storage.getUser(req.userId!);
          if (joiner) {
            await ensureCometChatUser(String(joiner.id), joiner.name || joiner.email);
            await ensureCometChatGroup(bubbleId, bubble.title || 'Bubble');
            await addMemberToGroup(bubbleId, String(joiner.id));
          }
        } catch (e) {
          console.error('CometChat add member on join:', e);
        }

        const joinerUser = await storage.getUser(req.userId!);
        notifyBubbleAdmins(bubbleId, req.userId!, "bubble_join",
          "New Member", `${joinerUser?.name || 'Someone'} joined ${bubble.title}`,
          { bubbleId, bubbleName: bubble.title, userId: req.userId!, userName: joinerUser?.name },
          true);
        
        res.json({ success: true, status: 'approved' });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/bubbles/:id/leave", authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.id;
      const memberRole = await storage.getMemberRole(req.userId!, bubbleId);

      if (!memberRole) {
        return res.status(400).json({ error: "Not a member" });
      }

      await storage.deleteMembership(req.userId!, bubbleId);
      
      try {
        await removeMemberFromGroup(bubbleId, String(req.userId!));
      } catch (e) {
        console.error('CometChat remove member on leave:', e);
      }

      try {
        if (memberRole === 'admin') {
          const adminChats = await storage.getAdminMemberChatsForBubble(bubbleId);
          const activeChats = adminChats.filter(c => c.status === 'active' && c.participantIds.includes(req.userId!));
          for (const chat of activeChats) {
            const updatedParticipants = chat.participantIds.filter(id => id !== req.userId!);
            await storage.updateAdminMemberChatParticipants(chat.id, updatedParticipants);
            try {
              await removeMemberFromGroup(chat.cometChatGroupId, String(req.userId!));
            } catch (e) {
              console.error(`CometChat: remove leaving admin from DM group ${chat.cometChatGroupId}:`, e);
            }
          }
        } else {
          await storage.archiveAdminMemberChatsForMember(bubbleId, req.userId!);
        }
      } catch (e) {
        console.error('Handle admin-member chats on leave:', e);
      }

      const leaverUser = await storage.getUser(req.userId!);
      const leaveBubble = await storage.getBubble(bubbleId);
      notifyBubbleAdmins(bubbleId, req.userId!, "bubble_leave",
        "Member Left", `${leaverUser?.name || 'Someone'} left ${leaveBubble?.title || 'the bubble'}`,
        { bubbleId, bubbleName: leaveBubble?.title, userId: req.userId!, userName: leaverUser?.name },
        true);
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/bubbles/:id/members", async (req, res) => {
    try {
      // Check if bubble is campus-scoped
      const bubble = await storage.getBubble(req.params.id);
      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }
      
      if (bubble.campusId) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return res.status(403).json({ error: "Campus verification required" });
        }
        try {
          const token = authHeader.slice(7);
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
          const user = await storage.getUser(decoded.userId);
          if (!user?.campusVerified || user.campusId !== bubble.campusId) {
            return res.status(403).json({ error: "Campus verification required" });
          }
        } catch {
          return res.status(403).json({ error: "Campus verification required" });
        }
      }
      
      const members = await storage.getBubbleMembersWithUsers(req.params.id);
      res.json(members.map(m => ({
        id: m.id,
        userId: m.userId,
        bubbleId: m.bubbleId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          profilePhoto: m.user.profilePhoto,
        }
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bubbles/:id/membership", authMiddleware, async (req, res) => {
    try {
      const isMember = await storage.isMember(req.userId!, req.params.id);
      const role = await storage.getMemberRole(req.userId!, req.params.id);
      const membershipStatus = await storage.getMembershipStatus(req.userId!, req.params.id);
      res.json({ isMember, role, membershipStatus });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/bubbles/:bubbleId/members/:userId/role", authMiddleware, async (req, res) => {
    try {
      const { bubbleId, userId } = req.params;
      const { role } = req.body;
      
      if (!role || !['member', 'admin'].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be 'member' or 'admin'" });
      }
      
      const requesterRole = await storage.getMemberRole(req.userId!, bubbleId);
      if (requesterRole !== 'admin') {
        return res.status(403).json({ error: "Only admins can change member roles" });
      }
      
      const targetIsMember = await storage.isMember(userId, bubbleId);
      if (!targetIsMember) {
        return res.status(404).json({ error: "User is not a member of this bubble" });
      }
      
      // Prevent demoting the last admin
      if (role === 'member') {
        const targetRole = await storage.getMemberRole(userId, bubbleId);
        if (targetRole === 'admin') {
          const members = await storage.getBubbleMembersWithUsers(bubbleId);
          const admins = members.filter(m => m.role === 'admin');
          if (admins.length <= 1) {
            return res.status(400).json({ error: "Cannot demote the only admin. Promote another member first." });
          }
        }
      }
      
      await storage.updateMemberRole(userId, bubbleId, role);
      
      try {
        const bubble = await storage.getBubble(bubbleId);
        const allMembers = await storage.getBubbleMembersWithUsers(bubbleId);
        const newAdminIds = allMembers.filter(m => m.role === 'admin').map(m => String(m.userId));
        const allMemberIds = allMembers.map(m => String(m.userId));
        await syncAllAdminDmGroupsForBubble(
          bubbleId,
          bubble?.title || 'Bubble',
          newAdminIds,
          allMemberIds,
          async (id) => {
            const u = await storage.getUser(id);
            return u?.name || u?.email || 'Unknown';
          }
        );
      } catch (e) {
        console.error('CometChat sync admin DM groups on role change:', e);
      }

      const roleBubble = await storage.getBubble(bubbleId);
      const roleLabel = role === 'admin' ? 'an admin' : 'a member';
      sendNotification({
        recipientId: userId,
        type: "bubble_role_changed",
        title: "Role Updated",
        body: `You're now ${roleLabel} of ${roleBubble?.title || 'the bubble'}.`,
        metadata: { bubbleId, bubbleName: roleBubble?.title, role },
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/bubbles/:bubbleId/members/me/relinquish-admin", authMiddleware, async (req, res) => {
    try {
      const { bubbleId } = req.params;
      
      const myRole = await storage.getMemberRole(req.userId!, bubbleId);
      if (myRole !== 'admin') {
        return res.status(400).json({ error: "You are not an admin of this bubble" });
      }
      
      const members = await storage.getBubbleMembersWithUsers(bubbleId);
      const admins = members.filter(m => m.role === 'admin');
      
      if (admins.length <= 1) {
        return res.status(400).json({ error: "Cannot relinquish admin rights - you are the only admin. Promote another member first." });
      }
      
      await storage.updateMemberRole(req.userId!, bubbleId, 'member');
      
      try {
        const bubble = await storage.getBubble(bubbleId);
        const allMembers = await storage.getBubbleMembersWithUsers(bubbleId);
        const newAdminIds = allMembers.filter(m => m.role === 'admin').map(m => String(m.userId));
        const allMemberIds = allMembers.map(m => String(m.userId));
        await syncAllAdminDmGroupsForBubble(
          bubbleId,
          bubble?.title || 'Bubble',
          newAdminIds,
          allMemberIds,
          async (id) => {
            const u = await storage.getUser(id);
            return u?.name || u?.email || 'Unknown';
          }
        );
      } catch (e) {
        console.error('CometChat sync admin DM groups on relinquish:', e);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/bubbles/:bubbleId/members/:userId", authMiddleware, async (req, res) => {
    try {
      const { bubbleId, userId } = req.params;
      
      const requesterRole = await storage.getMemberRole(req.userId!, bubbleId);
      const requesterIsSuperAdmin = (await storage.getUser(req.userId!))?.isSuperAdmin;
      
      if (requesterRole !== 'admin' && !requesterIsSuperAdmin) {
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
        await removeMemberFromGroup(bubbleId, String(userId));
      } catch (e) {
        console.error('CometChat remove member on admin kick:', e);
      }

      try {
        if (targetRole === 'admin') {
          const adminChats = await storage.getAdminMemberChatsForBubble(bubbleId);
          const activeChats = adminChats.filter(c => c.status === 'active' && c.participantIds.includes(userId));
          for (const chat of activeChats) {
            const updatedParticipants = chat.participantIds.filter(id => id !== userId);
            await storage.updateAdminMemberChatParticipants(chat.id, updatedParticipants);
            try {
              await removeMemberFromGroup(chat.cometChatGroupId, String(userId));
            } catch (e) {
              console.error(`CometChat: remove kicked admin from DM group ${chat.cometChatGroupId}:`, e);
            }
          }
        } else {
          await storage.archiveAdminMemberChatsForMember(bubbleId, userId);
        }
      } catch (e) {
        console.error('Handle admin-member chats on kick:', e);
      }

      sendNotification({
        recipientId: userId,
        type: "bubble_member_removed",
        title: "Removed from Bubble",
        body: `You've been removed from ${kickBubble?.title || 'the bubble'}.`,
        metadata: { bubbleId, bubbleName: kickBubble?.title },
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/bubbles/:bubbleId/join-requests", authMiddleware, async (req, res) => {
    try {
      const { bubbleId } = req.params;
      const bubble = await storage.getBubble(bubbleId);
      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }

      const requesterRole = await storage.getMemberRole(req.userId!, bubbleId);
      const user = await storage.getUser(req.userId!);
      if (requesterRole !== 'admin' && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Only admins can view join requests" });
      }

      const requests = await storage.getPendingJoinRequests(bubbleId);
      res.json(requests.map(r => ({
        id: r.id,
        userId: r.userId,
        bubbleId: r.bubbleId,
        membershipStatus: r.membershipStatus,
        joinedAt: r.joinedAt,
        user: {
          id: r.user.id,
          name: r.user.name,
          email: r.user.email,
          profilePhoto: r.user.profilePhoto,
        }
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bubbles/:bubbleId/join-requests/:userId/approve", authMiddleware, async (req, res) => {
    try {
      const { bubbleId, userId } = req.params;
      const requesterRole = await storage.getMemberRole(req.userId!, bubbleId);
      const user = await storage.getUser(req.userId!);
      if (requesterRole !== 'admin' && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Only admins can approve join requests" });
      }

      const membership = await storage.approveMembership(userId, bubbleId);
      if (!membership) {
        return res.status(404).json({ error: "Join request not found" });
      }
      
      try {
        const approvedUser = await storage.getUser(userId);
        const bubble = await storage.getBubble(bubbleId);
        if (approvedUser && bubble) {
          await ensureCometChatUser(String(approvedUser.id), approvedUser.name || approvedUser.email);
          await ensureCometChatGroup(bubbleId, bubble.title || 'Bubble');
          await addMemberToGroup(bubbleId, String(approvedUser.id));
        }
      } catch (e) {
        console.error('CometChat add member on join approval:', e);
      }

      const approvalBubble = await storage.getBubble(bubbleId);
      sendNotification({
        recipientId: userId,
        type: "bubble_request_approved",
        title: "Request Approved!",
        body: `You've been accepted into ${approvalBubble?.title || 'the bubble'}!`,
        metadata: { bubbleId, bubbleName: approvalBubble?.title },
      });
      
      res.json({ success: true, membership });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/bubbles/:bubbleId/join-requests/:userId/reject", authMiddleware, async (req, res) => {
    try {
      const { bubbleId, userId } = req.params;
      const requesterRole = await storage.getMemberRole(req.userId!, bubbleId);
      const user = await storage.getUser(req.userId!);
      if (requesterRole !== 'admin' && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Only admins can reject join requests" });
      }

      await storage.rejectMembership(userId, bubbleId);

      const rejBubble = await storage.getBubble(bubbleId);
      sendNotification({
        recipientId: userId,
        type: "bubble_request_rejected",
        title: "Request Declined",
        body: `Your request to join ${rejBubble?.title || 'the bubble'} was declined.`,
        metadata: { bubbleId, bubbleName: rejBubble?.title },
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/bubbles/:bubbleId/sync-chat-members", authMiddleware, async (req, res) => {
    try {
      const { bubbleId } = req.params;
      const isMember = await storage.isMember(req.userId!, bubbleId);
      if (!isMember) {
        return res.status(403).json({ error: "Not a member of this bubble" });
      }

      const bubble = await storage.getBubble(bubbleId);
      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }

      const members = await storage.getBubbleMembersWithUsers(bubbleId);
      const memberList = members.map(m => ({
        uid: String(m.userId),
        name: m.user?.name || m.user?.email || 'User',
        scope: m.role === 'admin' ? 'admin' : 'participant',
      }));

      res.json({ success: true, synced: memberList.length, members: memberList });
    } catch (error: any) {
      console.error('Sync chat members failed:', error);
      res.status(500).json({ error: "Failed to sync chat members" });
    }
  });

  // Admin-Member DM API
  app.post("/api/bubbles/:bubbleId/admin-dm/:userId", authMiddleware, async (req, res) => {
    try {
      const { bubbleId, userId } = req.params;

      const requesterRole = await storage.getMemberRole(req.userId!, bubbleId);
      if (requesterRole !== 'admin') {
        return res.status(403).json({ error: "Only admins can initiate admin DMs" });
      }

      const bubble = await storage.getBubble(bubbleId);
      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const members = await storage.getBubbleMembersWithUsers(bubbleId);
      const adminUsers = members
        .filter(m => m.role === 'admin')
        .map(m => ({ id: String(m.userId), name: m.user.name || m.user.email }));

      const dmGuid = `adm_${bubbleId}_${userId}`;
      const participantIds = [String(userId), ...adminUsers.map(a => a.id)].filter((v, i, arr) => arr.indexOf(v) === i);

      let chatRecord = await storage.getAdminMemberChat(bubbleId, userId);

      if (chatRecord && chatRecord.status === 'active') {
        await storage.updateAdminMemberChatParticipants(chatRecord.id, participantIds);
      } else if (!chatRecord) {
        chatRecord = await storage.createAdminMemberChat(bubbleId, userId, dmGuid, participantIds);
      } else {
        await storage.updateAdminMemberChatStatus(bubbleId, userId, 'active');
        await storage.updateAdminMemberChatParticipants(chatRecord.id, participantIds);
      }

      res.json({
        groupId: dmGuid,
        groupName: `${bubble.title}: ${targetUser.name || targetUser.email}`,
        memberName: targetUser.name || targetUser.email,
        bubbleTitle: bubble.title,
        participantIds,
        adminUsers: adminUsers.map(a => ({ uid: a.id, name: a.name })),
        targetUser: { uid: String(targetUser.id), name: targetUser.name || targetUser.email },
      });
    } catch (error: any) {
      console.error('Admin DM creation failed:', error);
      res.status(500).json({ error: "Failed to create admin chat. Please try again." });
    }
  });

  // Events API
  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getPublicEvents();
      res.json(convertEventsToLocal(events));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/events/upcoming", async (req, res) => {
    try {
      const events = await storage.getUpcomingEvents();
      res.json(convertEventsToLocal(events));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/events/my", authMiddleware, async (req, res) => {
    try {
      const events = await storage.getUserEvents(req.userId!);
      res.json(convertEventsToLocal(events));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/events/created", authMiddleware, async (req, res) => {
    try {
      const events = await storage.getUserCreatedEvents(req.userId!);
      res.json(convertEventsToLocal(events));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bubbles/created/my", authMiddleware, async (req, res) => {
    try {
      const bubbles = await storage.getUserCreatedBubbles(req.userId!);
      res.json(await enrichBubblesCategory(bubbles));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bubbles/:bubbleId/events", async (req, res) => {
    try {
      // Check if bubble is campus-scoped
      const bubble = await storage.getBubble(req.params.bubbleId);
      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }
      
      if (bubble.campusId) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return res.status(403).json({ error: "Campus verification required" });
        }
        try {
          const token = authHeader.slice(7);
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
          const user = await storage.getUser(decoded.userId);
          if (!user?.campusVerified || user.campusId !== bubble.campusId) {
            return res.status(403).json({ error: "Campus verification required" });
          }
        } catch {
          return res.status(403).json({ error: "Campus verification required" });
        }
      }
      
      const events = await storage.getBubbleEvents(req.params.bubbleId);
      res.json(convertEventsToLocal(events));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      // If campus event, check authorization
      if (event.campusId) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return res.status(403).json({ error: "Campus verification required" });
        }
        try {
          const token = authHeader.slice(7);
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
          const user = await storage.getUser(decoded.userId);
          if (!user?.campusVerified || user.campusId !== event.campusId) {
            return res.status(403).json({ error: "Campus verification required" });
          }
        } catch {
          return res.status(403).json({ error: "Campus verification required" });
        }
      }
      
      const creator = await storage.getUser(event.creatorId);
      const localEvent = convertEventToLocal(event);
      res.json({ ...localEvent, creatorName: creator?.name || 'Event Creator', creatorProfilePhoto: creator?.profilePhoto || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/events", authMiddleware, async (req, res) => {
    try {
      const modResult = moderateText({
        title: req.body.title,
        description: req.body.description,
      });
      if (modResult.flagged) {
        return res.status(400).json({ error: modResult.message });
      }

      const timezone = req.body.timezone || 'UTC';
      let bodyToStore = { ...req.body };
      if (timezone !== 'UTC' && req.body.date && req.body.startTime) {
        const utcStart = localToUtc(req.body.date, req.body.startTime, timezone);
        bodyToStore.date = utcStart.date;
        bodyToStore.startTime = utcStart.time;
        if (req.body.endTime) {
          const utcEnd = localToUtc(req.body.date, req.body.endTime, timezone);
          bodyToStore.endTime = utcEnd.time;
          if (utcEnd.date !== utcStart.date) {
            bodyToStore.endTime = utcEnd.time;
          }
        }
        bodyToStore.timezone = timezone;
      }
      const data = insertEventSchema.parse({
        ...bodyToStore,
        creatorId: req.userId,
      });

      const bubble = await storage.getBubble(data.bubbleId);
      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }

      const user = await storage.getUser(req.userId!);
      const isSuperAdmin = user?.isSuperAdmin === true;

      if (bubble.privacy === 'Public') {
        const memberRole = await storage.getMemberRole(req.userId!, data.bubbleId);
        if (memberRole !== 'admin' && !isSuperAdmin) {
          return res.status(403).json({ error: "Only admins can create events in public bubbles" });
        }
      } else {
        const isMember = await storage.isMember(req.userId!, data.bubbleId);
        if (!isMember && !isSuperAdmin) {
          return res.status(403).json({ error: "You must be a member to create events" });
        }
      }

      const event = await storage.createEvent(data);

      await storage.createEventAttendee({
        eventId: event.id,
        userId: req.userId!,
        status: "going",
      });

      const eventCreator = await storage.getUser(req.userId!);
      notifyBubbleMembers(event.bubbleId, req.userId!, "event_created",
        "New Event", `${eventCreator?.name || 'Someone'} created "${event.title}" in ${bubble.title}`,
        { bubbleId: event.bubbleId, bubbleName: bubble.title, eventId: event.id, eventName: event.title, userName: eventCreator?.name });

      res.json(convertEventToLocal(event));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/events/:id", authMiddleware, async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const user = await storage.getUser(req.userId!);
      const isEventCreator = event.creatorId === req.userId;
      const isSuperAdmin = user?.isSuperAdmin === true;
      const bubble = await storage.getBubble(event.bubbleId);
      const isBubbleAdmin = bubble?.creatorId === req.userId;

      if (!isEventCreator && !isBubbleAdmin && !isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to edit this event" });
      }

      const modResult = moderateText({
        title: req.body.title,
        description: req.body.description,
      });
      if (modResult.flagged) {
        return res.status(400).json({ error: modResult.message });
      }

      let updateBody = { ...req.body };
      const tz = req.body.timezone || event.timezone || 'UTC';
      if (tz !== 'UTC') {
        if (req.body.date && req.body.startTime) {
          const utcStart = localToUtc(req.body.date, req.body.startTime, tz);
          updateBody.date = utcStart.date;
          updateBody.startTime = utcStart.time;
        }
        if (req.body.endTime && req.body.date) {
          const utcEnd = localToUtc(req.body.date, req.body.endTime, tz);
          updateBody.endTime = utcEnd.time;
        }
        updateBody.timezone = tz;
      }

      const updated = await storage.updateEvent(req.params.id, updateBody);

      const attendees = await storage.getEventAttendees(req.params.id);
      const attendeeIds = attendees
        .filter(a => a.userId !== req.userId && a.status === 'going')
        .map(a => a.userId);
      if (attendeeIds.length > 0) {
        sendNotificationToMany({
          recipientIds: attendeeIds,
          type: "event_updated",
          title: "Event Updated",
          body: `"${event.title}" has been updated — check the latest details`,
          metadata: { eventId: event.id, eventName: event.title, bubbleId: event.bubbleId, bubbleName: bubble?.title },
          inAppOnly: true,
        });
      }

      res.json(convertEventToLocal(updated));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/events/:id", authMiddleware, async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const user = await storage.getUser(req.userId!);
      const isEventCreator = event.creatorId === req.userId;
      const isSuperAdmin = user?.isSuperAdmin === true;
      const bubble = await storage.getBubble(event.bubbleId);
      const isBubbleAdmin = bubble?.creatorId === req.userId;

      if (!isEventCreator && !isBubbleAdmin && !isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to delete this event" });
      }

      const cancelAttendees = await storage.getEventAttendees(req.params.id);
      const cancelIds = cancelAttendees
        .filter(a => a.userId !== req.userId && a.status === 'going')
        .map(a => a.userId);
      if (cancelIds.length > 0) {
        sendNotificationToMany({
          recipientIds: cancelIds,
          type: "event_cancelled",
          title: "Event Cancelled",
          body: `"${event.title}" has been cancelled`,
          metadata: { eventId: event.id, eventName: event.title, bubbleId: event.bubbleId, bubbleName: bubble?.title },
        });
      }

      await storage.deleteEvent(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get pending events (super admins see all, bubble admins see their bubbles' events)
  app.get("/api/admin/pending-events", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      
      const pendingEvents: any[] = [];

      if (user?.isSuperAdmin) {
        const allBubbles = await storage.getBubbles();
        const enrichedAll = await enrichBubblesCategory(allBubbles);
        for (const bubble of enrichedAll) {
          const events = await storage.getPendingEventsForBubble(bubble.id);
          pendingEvents.push(...events.map(e => ({ ...e, bubble })));
        }
        const allPending = await storage.getPendingBubbles();
        const enrichedPending = await enrichBubblesCategory(allPending);
        for (const bubble of enrichedPending) {
          const events = await storage.getPendingEventsForBubble(bubble.id);
          pendingEvents.push(...events.map(e => ({ ...e, bubble })));
        }
      } else {
        const userMemberships = await storage.getUserMemberships(req.userId!);
        const adminBubbles = userMemberships.filter(m => m.role === 'admin');
        const enrichedMemberBubbles = await enrichBubblesCategory(adminBubbles.map(m => m.bubble));
        for (let i = 0; i < adminBubbles.length; i++) {
          const events = await storage.getPendingEventsForBubble(adminBubbles[i].bubbleId);
          pendingEvents.push(...events.map(e => ({ ...e, bubble: enrichedMemberBubbles[i] })));
        }
      }

      res.json(convertEventsToLocal(pendingEvents));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/admin/pending-count", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });

      let count = 0;

      if (user.isSuperAdmin) {
        const pendingBubbles = await storage.getPendingBubbles();
        count += pendingBubbles.length;
      }

      const pendingEvents: any[] = [];
      if (user.isSuperAdmin) {
        const allBubbles = await storage.getBubbles();
        for (const bubble of allBubbles) {
          const events = await storage.getPendingEventsForBubble(bubble.id);
          pendingEvents.push(...events);
        }
        const allPending = await storage.getPendingBubbles();
        for (const bubble of allPending) {
          const events = await storage.getPendingEventsForBubble(bubble.id);
          pendingEvents.push(...events);
        }
      } else {
        const userMemberships = await storage.getUserMemberships(req.userId!);
        const adminBubbles = userMemberships.filter(m => m.role === 'admin');
        for (const membership of adminBubbles) {
          const events = await storage.getPendingEventsForBubble(membership.bubbleId);
          pendingEvents.push(...events);
        }
      }
      count += pendingEvents.length;

      res.json({ count });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Approve event (super admin only)
  app.post("/api/admin/events/:id/approve", authMiddleware, async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const user = await storage.getUser(req.userId!);
      const isSuperAdmin = user?.isSuperAdmin === true;

      if (!isSuperAdmin) {
        return res.status(403).json({ error: "Only super admins can approve events" });
      }

      const approvedEvent = await storage.approveEvent(req.params.id);
      res.json(approvedEvent);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Reject event (super admin only)
  app.post("/api/admin/events/:id/reject", authMiddleware, async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const user = await storage.getUser(req.userId!);
      const isSuperAdmin = user?.isSuperAdmin === true;

      if (!isSuperAdmin) {
        return res.status(403).json({ error: "Only super admins can reject events" });
      }

      const { reason } = req.body;
      const rejectedEvent = await storage.rejectEvent(req.params.id, reason);
      res.json(rejectedEvent);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/events/:id/rsvp", authMiddleware, async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      if (event.campusId) {
        const user = await storage.getUser(req.userId!);
        if (!user?.campusVerified || user.campusId !== event.campusId) {
          return res.status(403).json({ error: "Campus verification required to RSVP" });
        }
      }

      const existingAttendee = await storage.getEventAttendee(req.userId!, req.params.id);
      if (existingAttendee) {
        return res.status(400).json({ error: "Already RSVP'd" });
      }

      const requestedStatus = req.body.status || "going";
      let finalStatus = requestedStatus;

      if (requestedStatus === "going" && event.attendeeLimit) {
        const goingCount = await storage.getGoingCount(req.params.id);
        if (goingCount >= event.attendeeLimit) {
          finalStatus = "waitlisted";
        }
      }

      await storage.createEventAttendee({
        eventId: req.params.id,
        userId: req.userId!,
        status: finalStatus,
      });

      if (finalStatus === "going" && event.creatorId !== req.userId) {
        const rsvpUser = await storage.getUser(req.userId!);
        const rsvpBubble = await storage.getBubble(event.bubbleId);
        sendNotification({
          recipientId: event.creatorId,
          type: "event_rsvp",
          title: "New RSVP",
          body: `${rsvpUser?.name || 'Someone'} is going to "${event.title}"`,
          metadata: { eventId: event.id, eventName: event.title, bubbleId: event.bubbleId, bubbleName: rsvpBubble?.title, userName: rsvpUser?.name },
          inAppOnly: true,
        });
      }

      if (finalStatus === "going" && event.attendeeLimit) {
        const goingAfterRsvp = await storage.getGoingCount(req.params.id);
        if (goingAfterRsvp >= event.attendeeLimit) {
          const fullBubble = await storage.getBubble(event.bubbleId);
          sendNotification({
            recipientId: event.creatorId,
            type: "event_full",
            title: "Event Full!",
            body: `"${event.title}" has reached its capacity of ${event.attendeeLimit}`,
            metadata: { eventId: event.id, eventName: event.title, bubbleId: event.bubbleId, bubbleName: fullBubble?.title },
            inAppOnly: true,
          });
        }
      }

      res.json({ success: true, status: finalStatus });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/events/:id/rsvp", authMiddleware, async (req, res) => {
    try {
      const attendee = await storage.getEventAttendee(req.userId!, req.params.id);
      const wasGoing = attendee?.status === 'going';

      await storage.deleteEventAttendee(req.userId!, req.params.id);

      if (wasGoing) {
        const unrsvpEvent = await storage.getEvent(req.params.id);
        if (unrsvpEvent && unrsvpEvent.creatorId !== req.userId) {
          const unrsvpUser = await storage.getUser(req.userId!);
          const unrsvpBubble = await storage.getBubble(unrsvpEvent.bubbleId);
          sendNotification({
            recipientId: unrsvpEvent.creatorId,
            type: "event_unrsvp",
            title: "RSVP Cancelled",
            body: `${unrsvpUser?.name || 'Someone'} is no longer going to "${unrsvpEvent.title}"`,
            metadata: { eventId: unrsvpEvent.id, eventName: unrsvpEvent.title, bubbleId: unrsvpEvent.bubbleId, bubbleName: unrsvpBubble?.title, userName: unrsvpUser?.name },
            inAppOnly: true,
          });
        }
      }

      let promotedUserId: string | null = null;
      if (wasGoing) {
        const event = await storage.getEvent(req.params.id);
        if (event?.attendeeLimit) {
          const firstWaitlisted = await storage.getFirstWaitlistedAttendee(req.params.id);
          if (firstWaitlisted) {
            await storage.updateEventAttendeeStatus(firstWaitlisted.userId, req.params.id, 'going');
            promotedUserId = firstWaitlisted.userId;

            const promoBubble = await storage.getBubble(event.bubbleId);
            sendNotification({
              recipientId: firstWaitlisted.userId,
              type: "waitlist_promoted",
              title: "You're In!",
              body: `A spot opened up for "${event.title}" — you're now going!`,
              metadata: { eventId: event.id, eventName: event.title, bubbleId: event.bubbleId, bubbleName: promoBubble?.title },
            });
          }
        }
      }

      res.json({ success: true, promotedUserId });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/events/:id/attendees", async (req, res) => {
    try {
      // Check if event is campus-scoped
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      if (event.campusId) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return res.status(403).json({ error: "Campus verification required" });
        }
        try {
          const token = authHeader.slice(7);
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
          const user = await storage.getUser(decoded.userId);
          if (!user?.campusVerified || user.campusId !== event.campusId) {
            return res.status(403).json({ error: "Campus verification required" });
          }
        } catch {
          return res.status(403).json({ error: "Campus verification required" });
        }
      }
      
      const attendees = await storage.getEventAttendeesWithUsers(req.params.id);
      res.json(attendees.map(a => ({
        id: a.id,
        userId: a.userId,
        eventId: a.eventId,
        status: a.status,
        joinedAt: a.joinedAt,
        user: {
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
          profilePhoto: a.user.profilePhoto,
        }
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CAMPUS ROUTES ============

  // Get all campuses
  app.get("/api/campuses", async (req, res) => {
    try {
      const campuses = await storage.getCampuses();
      res.json(campuses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send campus verification code
  app.post("/api/campus/send-verification", authMiddleware, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Validate .edu email domain
      const emailLower = email.toLowerCase();
      const domain = emailLower.split("@")[1];
      if (!domain || !domain.endsWith(".edu")) {
        return res.status(400).json({ error: "Please use a valid .edu email address" });
      }

      // Check if campus exists
      const campus = await storage.getCampusByDomain(domain);
      if (!campus) {
        return res.status(400).json({ error: "This university is not yet supported. Check back later!" });
      }

      // Generate and store verification code
      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await storage.createVerificationCode({
        email: emailLower,
        code,
        expiresAt,
      });

      await sendVerificationEmail(emailLower, code);

      const response: any = {
        success: true,
        message: "Verification code sent to your email",
        campusId: campus.id,
        campusName: campus.title,
      };
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Campus verification code for ${emailLower}: ${code}`);
        response.devCode = code;
      }
      res.json(response);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Verify campus code and associate user with campus
  app.post("/api/campus/verify-code", authMiddleware, async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Email and code are required" });
      }

      const emailLower = email.toLowerCase();
      const domain = emailLower.split("@")[1];

      // Verify code
      const validCode = await storage.getValidVerificationCode(emailLower, code);
      if (!validCode) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }

      // Get campus
      const campus = await storage.getCampusByDomain(domain);
      if (!campus) {
        return res.status(400).json({ error: "Campus not found" });
      }

      // Mark code as used
      await storage.markCodeAsUsed(validCode.id);

      // Update user with campus info
      await storage.updateUserCampus(req.userId!, campus.id, emailLower, true);

      // Get updated user
      const user = await storage.getUser(req.userId!);

      res.json({
        success: true,
        campus: {
          id: campus.id,
          name: campus.title,
          domain: campus.domain,
        },
        user: {
          id: user!.id,
          name: user!.name,
          email: user!.email,
          campusId: user!.campusId,
          campusEmail: user!.campusEmail,
          campusVerified: user!.campusVerified,
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Dismiss campus prompt
  app.post("/api/campus/dismiss-prompt", authMiddleware, async (req, res) => {
    try {
      await storage.dismissCampusPrompt(req.userId!);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get campus bubbles (only for verified campus users)
  app.get("/api/campus/bubbles", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.campusVerified || !user.campusId) {
        return res.status(403).json({ error: "Campus verification required" });
      }

      const bubbles = await storage.getCampusBubbles(user.campusId);
      res.json(await enrichBubblesCategory(bubbles));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get campus events (only for verified campus users)
  app.get("/api/campus/events", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.campusVerified || !user.campusId) {
        return res.status(403).json({ error: "Campus verification required" });
      }

      const events = await storage.getCampusEvents(user.campusId);
      res.json(convertEventsToLocal(events));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get user's campus info
  app.get("/api/campus/my-campus", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.campusId) {
        return res.json({ campus: null });
      }

      const campus = await storage.getCampus(user.campusId);
      res.json({
        campus: campus ? {
          id: campus.id,
          name: campus.title,
          domain: campus.domain,
        } : null,
        verified: user.campusVerified,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== ANALYTICS ENDPOINTS ==========

  // Session tracking - start session
  app.post("/api/sessions/start", authMiddleware, async (req, res) => {
    try {
      const session = await storage.createSession(req.userId!);
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Session tracking - end session (validates ownership)
  app.post("/api/sessions/:sessionId/end", authMiddleware, async (req, res) => {
    try {
      const session = await storage.endSession(req.params.sessionId, req.userId!);
      if (!session) {
        return res.status(404).json({ error: "Session not found or unauthorized" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Analytics - Get all metrics
  app.get("/api/analytics/metrics", async (req, res) => {
    try {
      const [retention, dauMau, sessionLength, sessionsPerUser, overview, bubbleVisits] = await Promise.all([
        storage.getRetentionMetrics(),
        storage.getDauMauMetrics(),
        storage.getAverageSessionLength(),
        storage.getSessionsPerUser(),
        storage.getOverviewMetrics(),
        storage.getBubbleVisitsMetrics(),
      ]);

      res.json({
        retention,
        dauMau,
        sessionLength,
        sessionsPerUser,
        overview,
        bubbleVisits,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Track bubble visit
  app.post("/api/bubbles/:bubbleId/visit", async (req, res) => {
    try {
      const { bubbleId } = req.params;
      const authHeader = req.headers.authorization;
      let userId: string | undefined;
      
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
          userId = decoded.userId;
        } catch (e) {}
      }
      
      const visit = await storage.trackBubbleVisit(bubbleId, userId);
      res.json(visit);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Categories API
  function withAbsoluteImageUrl(req: any, cat: any) {
    if (!cat.image) return cat;
    if (cat.image.startsWith("http")) return cat;
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    return { ...cat, image: `${protocol}://${host}${cat.image}` };
  }

  app.get("/api/categories", optionalAuthMiddleware, async (req, res) => {
    try {
      let campusFirst = false;
      if (req.userId) {
        const user = await storage.getUser(req.userId);
        if (user?.campusVerified && user?.campusId) {
          campusFirst = true;
        }
      }

      const allCategories = await storage.getCategories();
      const topLevel = allCategories
        .filter(c => c.parentId === null)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

      if (campusFirst) {
        const campusIndex = topLevel.findIndex(c => c.name === 'campus');
        if (campusIndex > 0) {
          const [campusGroup] = topLevel.splice(campusIndex, 1);
          topLevel.unshift(campusGroup);
        }
      }

      const nested = topLevel.map(parent => ({
        ...withAbsoluteImageUrl(req, parent),
        children: allCategories
          .filter(c => c.parentId === parent.id)
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          .map(c => withAbsoluteImageUrl(req, c)),
      }));
      res.json(nested);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/categories/flat", async (req, res) => {
    try {
      const allCategories = await storage.getCategories();
      const sorted = allCategories.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
      res.json(sorted.map(c => withAbsoluteImageUrl(req, c)));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categories", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }
      const data = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(data);
      res.json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/categories/:id", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }
      const id = parseInt(req.params.id);
      const { name, icon, parentId } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (icon !== undefined) updateData.icon = icon;
      if (parentId !== undefined) updateData.parentId = parentId;
      const category = await storage.updateCategory(id, updateData);
      if (!category) return res.status(404).json({ error: "Category not found" });
      res.json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/categories/:id", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const EVENT_REPORT_VISIBILITY: Record<string, string> = {
    'Safety issue at this event': 'both',
    'Event didn\'t match description': 'bubble_admin',
    'Organizer no-show or unprepared': 'both',
    'Venue issue (unsafe, inaccessible, closed)': 'both',
    'Other': 'both',
  };

  const BUBBLE_REPORT_VISIBILITY: Record<string, string> = {
    'Safety issue (harassment, threats, unsafe environment)': 'superadmin',
    'Misleading group description': 'both',
    'Inactive or abandoned group': 'bubble_admin',
    'Organizer misconduct': 'superadmin',
    'Exclusionary behavior (discrimination, cliques)': 'both',
    'Spam or promotional content': 'both',
    'Other': 'superadmin',
  };

  // Reports
  app.post("/api/reports", authMiddleware, async (req, res) => {
    try {
      let visibleTo = 'superadmin';
      if (req.body.reportType === 'bubble') {
        visibleTo = BUBBLE_REPORT_VISIBILITY[req.body.reason] || 'superadmin';
      } else if (req.body.reportType === 'event') {
        visibleTo = EVENT_REPORT_VISIBILITY[req.body.reason] || 'both';
      } else if (req.body.reportType === 'individual') {
        if (req.body.reportedUserId) {
          const reportedRole = await storage.getMemberRole(req.body.reportedUserId, req.body.bubbleId);
          visibleTo = reportedRole === 'admin' ? 'both' : 'bubble_admin';
        } else {
          visibleTo = 'bubble_admin';
        }
      } else if (req.body.reportType === 'admin') {
        visibleTo = 'superadmin';
      }
      const parsed = insertReportSchema.parse({
        ...req.body,
        reporterUserId: req.userId,
        visibleTo,
      });
      const report = await storage.createReport(parsed);

      const reporter = await storage.getUser(req.userId!);
      const reportBubble = await storage.getBubble(parsed.bubbleId);
      if (visibleTo === 'bubble_admin' || visibleTo === 'both') {
        notifyBubbleAdmins(parsed.bubbleId, req.userId!, "report_submitted",
          "New Report", `${reporter?.name || 'Someone'} submitted a ${parsed.reportType} concern in ${reportBubble?.title || 'a bubble'}`,
          { bubbleId: parsed.bubbleId, bubbleName: reportBubble?.title, userId: req.userId!, userName: reporter?.name });
      }
      if (visibleTo === 'superadmin' || visibleTo === 'both') {
        const superAdmins = await storage.getSuperAdmins();
        const superAdminIds = superAdmins.filter(u => u.id !== req.userId).map(u => u.id);
        if (superAdminIds.length > 0) {
          sendNotificationToMany({
            recipientIds: superAdminIds,
            type: "report_submitted",
            title: "New Report",
            body: `${reporter?.name || 'Someone'} submitted a ${parsed.reportType} concern in ${reportBubble?.title || 'a bubble'}`,
            metadata: { bubbleId: parsed.bubbleId, bubbleName: reportBubble?.title, userId: req.userId!, userName: reporter?.name },
          });
        }
      }

      res.status(201).json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/bubbles/:bubbleId/reports", authMiddleware, async (req, res) => {
    try {
      const { bubbleId } = req.params;
      const role = await storage.getMemberRole(req.userId!, bubbleId);
      if (role !== 'admin') {
        return res.status(403).json({ error: "Only bubble admins can view reports" });
      }
      const reps = await storage.getReportsForBubble(bubbleId);
      const filtered = reps.filter(r => r.reportedUserId !== req.userId);
      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/reports", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }
      const reps = await storage.getReportsForSysAdmin();
      res.json(reps);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/reports/:id/status", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) {
        const report = await storage.getReport(req.params.id);
        if (!report) return res.status(404).json({ error: "Report not found" });
        const role = await storage.getMemberRole(req.userId!, report.bubbleId);
        if (role !== 'admin') {
          return res.status(403).json({ error: "Admin access required" });
        }
      }
      const report = await storage.updateReportStatus(req.params.id, req.body.status);
      if (!report) return res.status(404).json({ error: "Report not found" });

      if (req.body.status === 'resolved' && report.reporterUserId !== req.userId) {
        const resolvedBubble = await storage.getBubble(report.bubbleId);
        sendNotification({
          recipientId: report.reporterUserId,
          type: "report_resolved",
          title: "Report Resolved",
          body: `Your ${report.reportType} report in ${resolvedBubble?.title || 'a bubble'} has been reviewed and resolved`,
          metadata: { bubbleId: report.bubbleId, bubbleName: resolvedBubble?.title, reportId: report.id },
          inAppOnly: true,
        });
      }

      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Seed campuses and categories on startup
  app.get("/api/static-map", async (req, res) => {
    try {
      const { lat, lng, zoom = "15" } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ error: "lat and lng required" });
      }
      const latNum = parseFloat(lat as string);
      const lngNum = parseFloat(lng as string);
      const z = parseInt(zoom as string);
      const x = Math.floor(((lngNum + 180) / 360) * Math.pow(2, z));
      const latRad = (latNum * Math.PI) / 180;
      const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z)
      );
      const tileUrl = `https://basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`;
      const response = await fetch(tileUrl, {
        headers: { "User-Agent": "BubbleApp/1.0" },
      });
      if (!response.ok) {
        return res.status(502).json({ error: "Failed to fetch map tile" });
      }
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "public, max-age=3600");
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error) {
      res.status(500).json({ error: "Failed to generate map" });
    }
  });

  // ===== NOTIFICATIONS =====
  app.get("/api/notifications", authMiddleware, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const notifs = await storage.getNotifications(req.userId!, limit, offset);
      res.json(notifs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/notifications/unread-count", authMiddleware, async (req, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.userId!);
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/notifications/:id/read", authMiddleware, async (req, res) => {
    try {
      const notif = await storage.markNotificationRead(req.params.id, req.userId!);
      if (!notif) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notif);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/notifications/read-all", authMiddleware, async (req, res) => {
    try {
      await storage.markAllNotificationsRead(req.userId!);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/notifications/:id", authMiddleware, async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id, req.userId!);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== DEVICE PUSH TOKENS =====
  app.post("/api/device-push-tokens", authMiddleware, async (req, res) => {
    try {
      const { token, platform } = req.body;
      if (!token || !platform) {
        return res.status(400).json({ error: "token and platform required" });
      }
      const result = await storage.upsertDevicePushToken(req.userId!, token, platform);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/device-push-tokens", authMiddleware, async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "token required" });
      }
      await storage.deleteDevicePushToken(req.userId!, token);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  seedCampuses().catch(console.error);
  seedCategories().catch(console.error);
  seedBulletinPostTypes().catch(console.error).then(() => {
    seedData().catch(console.error);
  });
  seedAppConfig().catch(console.error);
  storage.backfillBubbleShortIds().catch(console.error);

  // Bulletin Board - Post Types
  app.get("/api/bulletin/post-types", authMiddleware, async (_req, res) => {
    try {
      const types = await storage.getBulletinPostTypes();
      res.json(types);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulletin Board - Get board info and post count for a bubble
  app.get("/api/bubbles/:bubbleId/bulletin", authMiddleware, async (req, res) => {
    try {
      const { bubbleId } = req.params;
      const board = await storage.getBulletinBoard(bubbleId);
      const postCount = await storage.getBulletinPostCount(bubbleId);
      res.json({ board, postCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulletin Board - List posts
  app.get("/api/bubbles/:bubbleId/bulletin/posts", authMiddleware, async (req, res) => {
    try {
      const { bubbleId } = req.params;
      const postTypeId = req.query.postTypeId ? parseInt(req.query.postTypeId as string) : undefined;
      const board = await storage.getBulletinBoard(bubbleId);
      if (!board) {
        return res.json([]);
      }
      const posts = await storage.getBulletinPosts(board.id, postTypeId, req.userId);
      const postIds = posts.map(p => p.id);
      const reactionSummaries = await storage.getBulletinPostReactionSummaries(postIds, req.userId);
      const enrichedPosts = posts.map(p => ({
        ...p,
        reactionSummary: reactionSummaries[p.id] || { reactions: [], userEmojis: [] },
      }));
      res.json(enrichedPosts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulletin Board - Create post
  app.post("/api/bubbles/:bubbleId/bulletin/posts", authMiddleware, async (req, res) => {
    try {
      const { bubbleId } = req.params;
      const userId = req.userId!;

      const isMember = await storage.isMember(userId, bubbleId);
      if (!isMember) {
        return res.status(403).json({ error: "Must be a member to post" });
      }

      const postTypes = await storage.getBulletinPostTypes();
      const postType = postTypes.find(pt => pt.id === req.body.postTypeId);
      if (!postType) {
        return res.status(400).json({ error: "Invalid post type" });
      }

      if (postType.adminOnly) {
        const role = await storage.getMemberRole(userId, bubbleId);
        const user = await storage.getUser(userId);
        if (role !== 'admin' && !user?.isSuperAdmin) {
          return res.status(403).json({ error: "Only admins can create this type of post" });
        }
      }

      const modResult = moderateText({ title: req.body.title, body: req.body.body });
      if (modResult.flagged) {
        return res.status(400).json({ error: modResult.message });
      }

      const board = await storage.getOrCreateBulletinBoard(bubbleId, userId);
      const post = await storage.createBulletinPost({
        boardId: board.id,
        postTypeId: req.body.postTypeId,
        authorId: userId,
        title: req.body.title,
        body: req.body.body,
        imageUrl: req.body.imageUrl || null,
      });
      res.json(post);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulletin Board - Get single post
  app.get("/api/bulletin/posts/:postId", authMiddleware, async (req, res) => {
    try {
      const post = await storage.getBulletinPost(req.params.postId);
      if (!post) return res.status(404).json({ error: "Post not found" });
      res.json(post);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulletin Board - Delete post
  app.delete("/api/bulletin/posts/:postId", authMiddleware, async (req, res) => {
    try {
      const post = await storage.getBulletinPost(req.params.postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const user = await storage.getUser(req.userId!);
      if (post.authorId !== req.userId && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to delete this post" });
      }

      await storage.deleteBulletinPost(req.params.postId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulletin Board - Toggle pin
  app.patch("/api/bulletin/posts/:postId/pin", authMiddleware, async (req, res) => {
    try {
      const post = await storage.getBulletinPost(req.params.postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const board = await storage.getBulletinBoard(req.params.postId);
      const result = await storage.toggleBulletinPostPin(req.params.postId, req.userId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulletin Board - Toggle reaction
  app.post("/api/bulletin/posts/:postId/reactions", authMiddleware, async (req, res) => {
    try {
      const post = await storage.getBulletinPost(req.params.postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const emoji = req.body.emoji || 'heart';
      const result = await storage.toggleBulletinReaction(req.params.postId, req.userId!, emoji);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulletin Board - List replies
  app.get("/api/bulletin/posts/:postId/replies", authMiddleware, async (req, res) => {
    try {
      const replies = await storage.getBulletinReplies(req.params.postId);
      res.json(replies);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulletin Board - Create reply
  app.post("/api/bulletin/posts/:postId/replies", authMiddleware, async (req, res) => {
    try {
      const post = await storage.getBulletinPost(req.params.postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const board = await storage.getBulletinBoardById(post.boardId);
      if (!board) return res.status(404).json({ error: "Board not found" });

      const membershipStatus = await storage.getMembershipStatus(req.userId!, board.bubbleId);
      if (!membershipStatus || membershipStatus !== 'approved') {
        return res.status(403).json({ error: "Must be a member to reply" });
      }

      const replyModResult = moderateText({ body: req.body.body });
      if (replyModResult.flagged) {
        return res.status(400).json({ error: replyModResult.message });
      }

      const reply = await storage.createBulletinReply({
        postId: req.params.postId,
        authorId: req.userId!,
        body: req.body.body,
      });
      res.json(reply);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/b/:shortId", async (req, res) => {
    try {
      const bubble = await storage.getBubbleByShortId(req.params.shortId);
      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }
      const realMemberCount = await storage.getRealMemberCount(bubble.id);
      res.json(await enrichBubbleCategory({ ...bubble, members: realMemberCount }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/config/share-base-url", (_req, res) => {
    const baseUrl = process.env.SHARE_BASE_URL || "https://mybubble.trybubble.io";
    res.json({ baseUrl });
  });

  app.get("/api/config/app", async (req, res) => {
    try {
      const key = req.query.key as string | undefined;
      if (key) {
        const value = await storage.getAppConfigValue(key);
        if (value === undefined) {
          return res.status(404).json({ error: `Config key '${key}' not found` });
        }
        return res.json({ key, value });
      }
      const all = await storage.getAllAppConfig();
      res.json(all);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
