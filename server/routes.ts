import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { insertUserSchema, insertBubbleSchema, insertEventSchema, insertCategorySchema, insertReportSchema } from "@shared/schema";
import { seedCampuses } from "./seed-campuses";
import { seedCategories } from "./seed-categories";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

const JWT_SECRET =
  process.env.JWT_SECRET || "bubble-secret-key-change-in-production";

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

      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Verification code for ${email}: ${code}`);
        res.json({
          success: true,
          message: "Verification code sent",
          devCode: code,
        });
      } else {
        res.json({ success: true, message: "Verification code sent" });
      }
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
      res.json(bubbles);
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
      res.json(bubblesWithCounts);
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
      res.json({ ...bubble, members: realMemberCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bubbles", authMiddleware, async (req, res) => {
    try {
      const data = insertBubbleSchema.parse({
        ...req.body,
        creatorId: req.userId,
      });

      const bubble = await storage.createBubble(data);

      // Note: Creator does NOT become admin until super admin approves the bubble
      // This prevents creators from approving their own events before bubble approval

      res.json(bubble);
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

      const { title, tagline, category, description, rules, privacy, coverImage, images, attachments, memberLimit, locationName, locationAddress, locationLat, locationLng, radiusMiles } = req.body;
      const updateData: any = {};
      
      if (title !== undefined) updateData.title = title;
      if (tagline !== undefined) updateData.tagline = tagline;
      if (category !== undefined) updateData.category = category;
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
      res.json(updatedBubble);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
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
      res.json(pendingBubbles);
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
      res.json(bubble);
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
      res.json(bubble);
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
        res.json({ success: true, status: 'pending' });
      } else {
        await storage.createMembership({
          userId: req.userId!,
          bubbleId,
        });
        res.json({ success: true, status: 'approved' });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/bubbles/:id/leave", authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.id;
      const isMember = await storage.isMember(req.userId!, bubbleId);

      if (!isMember) {
        return res.status(400).json({ error: "Not a member" });
      }

      await storage.deleteMembership(req.userId!, bubbleId);
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
      
      await storage.deleteMembership(userId, bubbleId);
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
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Events API
  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getPublicEvents();
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/events/upcoming", async (req, res) => {
    try {
      const events = await storage.getUpcomingEvents();
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/events/my", authMiddleware, async (req, res) => {
    try {
      const events = await storage.getUserEvents(req.userId!);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/events/created", authMiddleware, async (req, res) => {
    try {
      const events = await storage.getUserCreatedEvents(req.userId!);
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bubbles/created/my", authMiddleware, async (req, res) => {
    try {
      const bubbles = await storage.getUserCreatedBubbles(req.userId!);
      res.json(bubbles);
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
      res.json(events);
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
      res.json({ ...event, creatorName: creator?.name || 'Event Creator', creatorProfilePhoto: creator?.profilePhoto || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/events", authMiddleware, async (req, res) => {
    try {
      const data = insertEventSchema.parse({
        ...req.body,
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

      res.json(event);
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

      const updated = await storage.updateEvent(req.params.id, req.body);
      res.json(updated);
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
        for (const bubble of allBubbles) {
          const events = await storage.getPendingEventsForBubble(bubble.id);
          pendingEvents.push(...events.map(e => ({ ...e, bubble })));
        }
        const allPending = await storage.getPendingBubbles();
        for (const bubble of allPending) {
          const events = await storage.getPendingEventsForBubble(bubble.id);
          pendingEvents.push(...events.map(e => ({ ...e, bubble })));
        }
      } else {
        const userMemberships = await storage.getUserMemberships(req.userId!);
        const adminBubbles = userMemberships.filter(m => m.role === 'admin');
        for (const membership of adminBubbles) {
          const events = await storage.getPendingEventsForBubble(membership.bubbleId);
          pendingEvents.push(...events.map(e => ({ ...e, bubble: membership.bubble })));
        }
      }

      res.json(pendingEvents);
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
      
      // Check if campus event requires campus verification
      if (event.campusId) {
        const user = await storage.getUser(req.userId!);
        if (!user?.campusVerified || user.campusId !== event.campusId) {
          return res.status(403).json({ error: "Campus verification required to RSVP" });
        }
      }

      const isAttendee = await storage.isEventAttendee(req.userId!, req.params.id);
      if (isAttendee) {
        return res.status(400).json({ error: "Already RSVP'd" });
      }

      // Check attendee limit
      if (event.attendeeLimit) {
        const attendees = await storage.getEventAttendees(req.params.id);
        if (attendees.length >= event.attendeeLimit) {
          return res.status(400).json({ error: "Event is full" });
        }
      }

      await storage.createEventAttendee({
        eventId: req.params.id,
        userId: req.userId!,
        status: req.body.status || "going",
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/events/:id/rsvp", authMiddleware, async (req, res) => {
    try {
      await storage.deleteEventAttendee(req.userId!, req.params.id);
      res.json({ success: true });
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

      // In dev mode, return the code for testing (hidden in production)
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Campus verification code for ${emailLower}: ${code}`);
        res.json({
          success: true,
          message: "Verification code sent",
          campusId: campus.id,
          campusName: campus.title,
          devCode: code,
        });
      } else {
        // In production, would send email - for now just return success
        res.json({
          success: true,
          message: "Verification code sent to your email",
          campusId: campus.id,
          campusName: campus.title,
        });
      }
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
      res.json(bubbles);
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
      res.json(events);
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

  app.get("/api/categories", async (req, res) => {
    try {
      const allCategories = await storage.getCategories();
      const topLevel = allCategories.filter(c => c.parentId === null);
      const nested = topLevel.map(parent => ({
        ...withAbsoluteImageUrl(req, parent),
        children: allCategories.filter(c => c.parentId === parent.id).map(c => withAbsoluteImageUrl(req, c)),
      }));
      res.json(nested);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/categories/flat", async (req, res) => {
    try {
      const allCategories = await storage.getCategories();
      res.json(allCategories.map(c => withAbsoluteImageUrl(req, c)));
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
        visibleTo = 'bubble_admin';
      } else if (req.body.reportType === 'admin') {
        visibleTo = 'superadmin';
      }
      const parsed = insertReportSchema.parse({
        ...req.body,
        reporterUserId: req.userId,
        visibleTo,
      });
      const report = await storage.createReport(parsed);
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
      res.json(reps);
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
        return res.status(403).json({ error: "Super admin access required" });
      }
      const report = await storage.updateReportStatus(req.params.id, req.body.status);
      if (!report) return res.status(404).json({ error: "Report not found" });
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Seed campuses and categories on startup
  seedCampuses().catch(console.error);
  seedCategories().catch(console.error);

  return httpServer;
}
