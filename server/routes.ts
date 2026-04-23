import crypto from "crypto";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql as drizzleSql } from "drizzle-orm";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { insertUserSchema, insertBubbleSchema, insertEventSchema, insertCategorySchema, insertReportSchema, insertBulletinPostSchema, insertBulletinReplySchema, updateBubbleSchema, updateEventSchema, updateBulletinPostSchema, patchUserSchema, type InsertCategory, appConfig } from "@shared/schema";
import { seedCampuses } from "./seed-campuses";
import { seedCategories } from "./seed-categories";
import { seedBulletinPostTypes } from "./seed-bulletin-post-types";
import { seedData } from "./seed-data";
import { seedAppConfig } from "./seed-app-config";
import { seedRules } from "./seed-rules";
import { seedCategoryPlaceholders } from "./seed-category-placeholders";
import { registerObjectStorageRoutes, ObjectStorageService } from "./replit_integrations/object_storage";
const objectStorageService = new ObjectStorageService();
import { ensureCometChatUser, ensureCometChatGroup, addMemberToGroup, addMembersToGroupBatch, removeMemberFromGroup, syncAdminDmGroup, syncAllAdminDmGroupsForBubble, generateAuthToken, deleteCometChatGroup } from "./cometchat";
import { sendNotification, sendNotificationToMany, notifyBubbleAdmins, notifyBubbleMembers } from "./notifications";
import { localToUtc, utcToLocal } from "./timezone";
import { pingUrl, setMaintenanceModeCache, getMaintenanceMode } from "./health";
import { moderateText } from "./moderation";
import { sendVerificationEmail } from "./email";
import rateLimit from "express-rate-limit";

const AUTH_RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_AUTH_MAX ?? "10", 10);
const AUTH_RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MIN ?? "15", 10) * 60 * 1000;
const SEND_RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_SEND_MAX ?? "5", 10);
const SEND_RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_SEND_WINDOW_MIN ?? "60", 10) * 60 * 1000;

const USER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const userCache = new Map<string, { user: any; expiresAt: number }>();

async function getCachedUser(userId: string) {
  const cached = userCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached.user;
  const user = await storage.getUser(userId);
  if (user) userCache.set(userId, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  else userCache.delete(userId);
  return user;
}

function invalidateUserCache(userId: string) {
  userCache.delete(userId);
}

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const loginFailures = new Map<string, { attempts: number; lockedUntil: number | null }>();

function checkLoginLockout(email: string): { locked: boolean; retryAfterMs?: number } {
  const record = loginFailures.get(email);
  if (!record) return { locked: false };
  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    return { locked: true, retryAfterMs: record.lockedUntil - Date.now() };
  }
  return { locked: false };
}

function recordLoginFailure(email: string) {
  const record = loginFailures.get(email) ?? { attempts: 0, lockedUntil: null };
  record.attempts += 1;
  if (record.attempts >= LOGIN_MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  }
  loginFailures.set(email, record);
}

function clearLoginFailures(email: string) {
  loginFailures.delete(email);
}

// Protects login and verify-code against brute force
const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: `Too many attempts, please try again later.` },
});

// Protects send-verification and signup against spam
const sendLimiter = rateLimit({
  windowMs: SEND_RATE_LIMIT_WINDOW_MS,
  max: SEND_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: `Too many requests, please try again later.` },
});

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required but not set");
}

function truncateCoord(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  const num = parseFloat(value);
  return isNaN(num) ? value : num.toFixed(2);
}

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
  // Normalize date to YYYY-MM-DD in case it was stored as a full timestamp
  const normalizedDate = String(event.date).slice(0, 10);
  const localStart = utcToLocal(normalizedDate, event.startTime, event.timezone);
  const result = { ...event, date: localStart.date, startTime: localStart.time };
  if (event.endTime) {
    const utcStartDt = new Date(`${normalizedDate}T${event.startTime}:00Z`);
    const utcEndDt = new Date(`${normalizedDate}T${event.endTime}:00Z`);
    let endUtcDate = normalizedDate;
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
  return crypto.randomInt(100000, 1000000).toString();
}

function serverError(res: any, error: unknown) {
  console.error(error);
  res.status(500).json({ error: "An unexpected error occurred" });
}

// Audit log for super admin actions — persists to DB and echoes to console
async function auditLog(action: string, adminId: string, targetId: string, ip: string, extra?: Record<string, unknown>) {
  const extraStr = extra ? JSON.stringify(extra) : undefined;
  console.log(JSON.stringify({ audit: true, action, adminId, targetId, ip, timestamp: new Date().toISOString(), ...extra }));
  try {
    await storage.insertAuditLog({ action, adminId, targetId, ip, extra: extraStr });
  } catch (err) {
    console.error("[auditLog] failed to persist:", err);
  }
}

// Allowed origins for state-changing requests (H3)
const ALLOWED_WEB_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

// Profile photo URL allowlist (M5)
const ALLOWED_PHOTO_ORIGINS = (process.env.ALLOWED_PHOTO_ORIGINS ?? "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

function isAllowedPhotoUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  // Allow relative paths (object storage served from same origin)
  if (url.startsWith("/")) return true;
  try {
    const parsed = new URL(url);
    if (ALLOWED_PHOTO_ORIGINS.length === 0) return true; // no allowlist configured, allow all
    return ALLOWED_PHOTO_ORIGINS.some(origin => parsed.origin === origin || parsed.hostname.endsWith(origin));
  } catch {
    return false; // invalid URL
  }
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

async function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; tokenVersion: number };
    const user = await storage.getUser(decoded.userId);
    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ error: "Token revoked" });
    }
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

  // H3: Origin guard for state-changing requests from browsers
  app.use((req, res, next) => {
    const method = req.method;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
    const origin = req.headers.origin;
    // No origin = mobile app or server-to-server — allow
    if (!origin) return next();
    // Known allowed origins — allow
    if (ALLOWED_WEB_ORIGINS.includes(origin)) return next();
    // Expo dev tunnels (*.exp.direct) — allow for development builds
    if (/^https:\/\/[a-zA-Z0-9-]+\.exp\.direct$/.test(origin)) return next();
    // Same-origin requests served by Express have no Origin header, or match host
    const host = req.headers.host;
    if (host && (origin === `https://${host}` || origin === `http://${host}`)) return next();
    return res.status(403).json({ error: "Forbidden: cross-origin request blocked" });
  });

  app.post("/api/auth/send-verification", sendLimiter, async (req, res) => {
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

      let emailFailed = false;
      try {
        await sendVerificationEmail(email, code);
      } catch (emailError: any) {
        console.error(`[EMAIL] Delivery failed for ${email}:`, emailError.message);
        emailFailed = true;
      }

      const response: any = { success: true, message: "Verification code sent" };
      if (emailFailed) {
        response.emailFailed = true;
        response.fallbackCode = code;
      }
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Verification code for ${email}: ${code}`);
        response.devCode = code;
      }
      res.json(response);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/verify-code", authLimiter, async (req, res) => {
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

  app.post("/api/auth/signup", sendLimiter, async (req, res) => {
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

      const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, JWT_SECRET, {
        expiresIn: "7d",
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
      const user = await storage.getUser(req.userId!);
      if (user?.profilePhoto) {
        try {
          await objectStorageService.deleteObjectEntity(user.profilePhoto);
        } catch (e) {
          console.error("Failed to delete profile photo from storage:", e);
        }
      }
      await storage.deleteUser(req.userId!);
      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/users/me/export", authMiddleware, async (req, res) => {
    try {
      const userId = req.userId!;
      const [
        user,
        memberships,
        createdBubbles,
        attendedEvents,
        createdEvents,
        notifications,
        deviceTokens,
        sessions,
      ] = await Promise.all([
        storage.getUser(userId),
        storage.getUserMemberships(userId),
        storage.getUserCreatedBubbles(userId),
        storage.getUserEvents(userId),
        storage.getUserCreatedEvents(userId),
        storage.getNotifications(userId, 1000),
        storage.getDevicePushTokens(userId),
        storage.getUserSessions(userId),
      ]);

      if (!user) return res.status(404).json({ error: "User not found" });

      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: {
          id: user.id,
          name: user.name,
          email: user.email,
          campusEmail: user.campusEmail,
          campusVerified: user.campusVerified,
          interests: user.interests,
          aboutMe: user.aboutMe,
          profilePhoto: user.profilePhoto,
          accountCreatedAt: user.createdAt,
        },
        memberships: memberships.map((m) => ({
          bubbleId: m.bubble.id,
          bubbleTitle: m.bubble.title,
          category: m.bubble.category,
          role: m.role,
          status: m.membershipStatus,
          joinedAt: m.joinedAt,
        })),
        bubblesCreated: createdBubbles.map((b) => ({
          id: b.id,
          title: b.title,
          category: b.category,
          privacy: b.privacy,
          status: b.status,
          createdAt: b.createdAt,
        })),
        eventsAttended: attendedEvents.map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          bubbleTitle: e.bubble?.title,
        })),
        eventsCreated: createdEvents.map((e) => ({
          id: e.id,
          title: e.title,
          date: e.date,
          bubbleTitle: e.bubble?.title,
          createdAt: e.createdAt,
        })),
        notifications: notifications.map((n) => ({
          type: n.type,
          title: n.title,
          body: n.body,
          read: n.read,
          createdAt: n.createdAt,
        })),
        deviceTokens: deviceTokens.map((t) => ({
          platform: t.platform,
          registeredAt: t.createdAt,
          lastSeenAt: t.updatedAt,
        })),
        sessions: sessions.map((s) => ({
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          durationSeconds: s.durationSeconds,
        })),
      };

      res.json(exportData);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;

      const lockout = checkLoginLockout(email);
      if (lockout.locked) {
        const retryAfterSec = Math.ceil((lockout.retryAfterMs ?? 0) / 1000);
        return res.status(429).json({ error: `Account temporarily locked. Try again in ${retryAfterSec} seconds.` });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        recordLoginFailure(email);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        recordLoginFailure(email);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      clearLoginFailures(email);

      const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, JWT_SECRET, {
        expiresIn: "7d",
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

  // Logout — invalidates all existing tokens for this user
  app.post("/api/auth/logout", authMiddleware, async (req, res) => {
    try {
      await storage.incrementTokenVersion(req.userId!);
      invalidateUserCache(req.userId!);
      res.json({ success: true });
    } catch (error: any) {
      serverError(res, error);
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
        aboutMe: user.aboutMe,
      });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // CometChat: generate auth token for the authenticated user (creates CC user if needed)
  app.post("/api/cometchat/auth-token", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });
      const uid = String(user.id);
      const name = user.name || user.email;
      await ensureCometChatUser(uid, name);
      const authToken = await generateAuthToken(uid);
      res.json({ authToken, uid });
    } catch (error: any) {
      console.error("CometChat auth-token error:", error.message);
      serverError(res, error);
    }
  });

  app.patch("/api/users/me", authMiddleware, async (req, res) => {
    try {
      const parsed = patchUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }
      const { profilePhoto, name, aboutMe, interests } = parsed.data;
      if (!isAllowedPhotoUrl(profilePhoto)) {
        return res.status(400).json({ error: "Profile photo URL is not from an allowed domain" });
      }
      const updated = await storage.updateUserProfile(req.userId!, {
        profilePhoto: profilePhoto ?? undefined,
        name,
        aboutMe: aboutMe ?? undefined,
        interests,
      });
      invalidateUserCache(req.userId!);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        interests: updated.interests,
        profilePhoto: updated.profilePhoto,
        aboutMe: updated.aboutMe,
      });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/bubbles", async (req, res) => {
    try {
      // Return only public bubbles (excludes campus-specific ones)
      const bubbles = await storage.getPublicBubbles();
      res.json(await enrichBubblesCategory(bubbles));
    } catch (error: any) {
      serverError(res, error);
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
      serverError(res, error);
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
      serverError(res, error);
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

      if (body.locationLat != null) body.locationLat = truncateCoord(body.locationLat);
      if (body.locationLng != null) body.locationLng = truncateCoord(body.locationLng);
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

      const bodyParsed = updateBubbleSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return res.status(400).json({ error: bodyParsed.error.issues[0].message });
      }

      const { title, tagline, category, categoryId, description, rules, privacy, coverImage, images, attachments, memberLimit, locationName, locationAddress, locationLat, locationLng, radiusMiles } = bodyParsed.data as any;

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
      if (locationLat !== undefined) updateData.locationLat = truncateCoord(locationLat);
      if (locationLng !== undefined) updateData.locationLng = truncateCoord(locationLng);
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
      serverError(res, error);
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

      // Gather DM records before archiving so we have the CometChat group IDs
      const [adminMemberChatRecords, bubbleMemberships] = await Promise.all([
        storage.getAdminMemberChatsForBubble(bubbleId).catch(() => []),
        storage.getBubbleMemberships(bubbleId).catch(() => []),
      ]);

      try {
        await storage.archiveAdminMemberChatsForBubble(bubbleId);
        await storage.updateBubbleChatStatus(bubbleId, 'archived');
      } catch (e) {
        console.error('Archive chats on bubble delete:', e);
      }

      // Delete CometChat groups for all DM threads tied to this bubble
      try {
        for (const chat of adminMemberChatRecords) {
          deleteCometChatGroup(chat.cometChatGroupId).catch((e: any) =>
            console.error(`CometChat: delete adm group ${chat.cometChatGroupId}:`, e.message)
          );
        }
        for (const membership of bubbleMemberships) {
          const contactGuid = `contact_${bubbleId}_${membership.userId}`;
          deleteCometChatGroup(contactGuid).catch((e: any) =>
            console.error(`CometChat: delete contact group ${contactGuid}:`, e.message)
          );
        }
      } catch (e) {
        console.error('CometChat group cleanup on bubble delete:', e);
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
      auditLog("bubble_approved", req.userId!, req.params.id, req.ip ?? "");
      
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
      if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
        return res.status(400).json({ error: "Reason must be 500 characters or fewer" });
      }
      const bubble = await storage.rejectBubble(req.params.id, reason);
      if (!bubble) {
        return res.status(404).json({ error: "Bubble not found" });
      }
      auditLog("bubble_rejected", req.userId!, req.params.id, req.ip ?? "", { reason });

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

  // Unlock a locked account (super admin only)
  app.post("/api/admin/users/:id/unlock", authMiddleware, async (req, res) => {
    try {
      const requester = await storage.getUser(req.userId!);
      if (!requester?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }
      const target = await storage.getUser(req.params.id);
      if (!target) {
        return res.status(404).json({ error: "User not found" });
      }
      clearLoginFailures(target.email);
      auditLog("account_unlocked", req.userId!, req.params.id, req.ip ?? "");
      res.json({ success: true, message: `Account unlocked for ${target.email}` });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // System stats (super admin only)
  app.get("/api/admin/stats", authMiddleware, async (req, res) => {
    interface StatsRow extends Record<string, unknown> {
      total_users: number;
      new_users_7d: number;
      new_users_30d: number;
      total_bubbles: number;
      approved_bubbles: number;
      pending_bubbles: number;
      rejected_bubbles: number;
      new_bubbles_7d: number;
      new_bubbles_30d: number;
      orphan_bubbles: number;
      avg_members: number;
      total_events: number;
      approved_events: number;
      pending_events: number;
      events_this_month: number;
      upcoming_events: number;
      total_memberships: number;
      pending_waitlist: number;
      open_reports: number;
      total_campuses: number;
      campus_verified_users: number;
      campus_bubbles: number;
    }

    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }

      // Database health check
      let dbStatus: "connected" | "error" = "connected";
      let dbError: string | null = null;
      try {
        await db.execute(drizzleSql`SELECT 1`);
      } catch (e: unknown) {
        dbStatus = "error";
        dbError = e instanceof Error ? e.message : "Unknown error";
      }

      // Count queries — run independently so a DB outage returns a degraded
      // payload (db.status='error') rather than a hard 500.
      let counts: Partial<StatsRow> = {};
      try {
        const countsResult = await db.execute<StatsRow>(drizzleSql`
          SELECT
            (SELECT COUNT(*)::int FROM users) AS total_users,
            (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '7 days') AS new_users_7d,
            (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '30 days') AS new_users_30d,
            (SELECT COUNT(*)::int FROM bubbles WHERE deleted_at IS NULL) AS total_bubbles,
            (SELECT COUNT(*)::int FROM bubbles WHERE deleted_at IS NULL AND status = 'approved') AS approved_bubbles,
            (SELECT COUNT(*)::int FROM bubbles WHERE deleted_at IS NULL AND status = 'pending') AS pending_bubbles,
            (SELECT COUNT(*)::int FROM bubbles WHERE deleted_at IS NULL AND status = 'rejected') AS rejected_bubbles,
            (SELECT COUNT(*)::int FROM bubbles WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '7 days') AS new_bubbles_7d,
            (SELECT COUNT(*)::int FROM bubbles WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '30 days') AS new_bubbles_30d,
            (SELECT COUNT(*)::int FROM bubbles b WHERE b.deleted_at IS NULL AND b.status = 'approved' AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.bubble_id = b.id)) AS orphan_bubbles,
            (SELECT COALESCE(ROUND(AVG(m_count))::int, 0) FROM (SELECT COUNT(*) AS m_count FROM memberships m JOIN bubbles b ON b.id = m.bubble_id WHERE b.deleted_at IS NULL AND b.status = 'approved' GROUP BY b.id) sub) AS avg_members,
            (SELECT COUNT(*)::int FROM events) AS total_events,
            (SELECT COUNT(*)::int FROM events WHERE status = 'approved') AS approved_events,
            (SELECT COUNT(*)::int FROM events WHERE status = 'pending') AS pending_events,
            (SELECT COUNT(*)::int FROM events WHERE created_at >= DATE_TRUNC('month', NOW())) AS events_this_month,
            (SELECT COUNT(*)::int FROM events WHERE date >= TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')) AS upcoming_events,
            (SELECT COUNT(*)::int FROM memberships) AS total_memberships,
            (SELECT COUNT(*)::int FROM memberships WHERE membership_status IN ('waitlisted', 'on_hold')) AS pending_waitlist,
            (SELECT COUNT(*)::int FROM reports WHERE status = 'pending') AS open_reports,
            (SELECT COUNT(*)::int FROM campuses) AS total_campuses,
            (SELECT COUNT(*)::int FROM users WHERE campus_verified = true) AS campus_verified_users,
            (SELECT COUNT(*)::int FROM bubbles WHERE campus_id IS NOT NULL AND deleted_at IS NULL) AS campus_bubbles
        `);
        counts = countsResult.rows[0] ?? {};
      } catch (e: unknown) {
        // DB counts unavailable — surface as null values in the response
        if (dbStatus === "connected") {
          dbStatus = "error";
          dbError = e instanceof Error ? e.message : "Count query failed";
        }
      }

      // Memory usage
      const mem = process.memoryUsage();
      const memMb = (bytes: number) => Math.round(bytes / 1024 / 1024);

      // Environment
      const environment = process.env.NODE_ENV ?? "development";

      // CometChat health check
      const cometChatAppId = process.env.COMETCHAT_APP_ID ?? "";
      const cometChatRegion = process.env.COMETCHAT_REGION ?? "us";
      const cometChatApiKey = process.env.COMETCHAT_API_KEY ?? process.env.COMETCHAT_AUTH_KEY ?? "";
      let cometChat: { status: "ok" | "error" | "unconfigured"; latencyMs: number | null; error: string | null };
      if (!cometChatAppId || !cometChatApiKey) {
        cometChat = { status: "unconfigured", latencyMs: null, error: "COMETCHAT_APP_ID or API key not set" };
      } else {
        const ccUrl = `https://${cometChatAppId}.api-${cometChatRegion}.cometchat.io/v3/users?perPage=1`;
        const result = await pingUrl(ccUrl, 5000, { headers: { apikey: cometChatApiKey, appid: cometChatAppId } });
        cometChat = result;
      }

      // Object storage sidecar health check
      const storageResult = await pingUrl("http://127.0.0.1:1106/", 3000);
      const objectStorage: { status: "ok" | "error"; latencyMs: number | null; error: string | null } = storageResult;

      res.json({
        db: { status: dbStatus, error: dbError },
        server: {
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          environment,
          memory: {
            heapUsedMb: memMb(mem.heapUsed),
            heapTotalMb: memMb(mem.heapTotal),
            rssMb: memMb(mem.rss),
          },
        },
        integrations: { cometChat, objectStorage },
        stats: {
          users: {
            total: counts.total_users ?? null,
            new7d: counts.new_users_7d ?? null,
            new30d: counts.new_users_30d ?? null,
          },
          bubbles: {
            total: counts.total_bubbles ?? null,
            approved: counts.approved_bubbles ?? null,
            pending: counts.pending_bubbles ?? null,
            rejected: counts.rejected_bubbles ?? null,
            new7d: counts.new_bubbles_7d ?? null,
            new30d: counts.new_bubbles_30d ?? null,
            orphan: counts.orphan_bubbles ?? null,
            avgMembers: counts.avg_members ?? null,
          },
          events: {
            total: counts.total_events ?? null,
            approved: counts.approved_events ?? null,
            pending: counts.pending_events ?? null,
            thisMonth: counts.events_this_month ?? null,
            upcoming: counts.upcoming_events ?? null,
          },
          memberships: { total: counts.total_memberships ?? null },
          campuses: {
            total: counts.total_campuses ?? null,
            verifiedUsers: counts.campus_verified_users ?? null,
            campusBubbles: counts.campus_bubbles ?? null,
          },
          pendingReview: {
            bubbles: counts.pending_bubbles ?? 0,
            events: counts.pending_events ?? 0,
            waitlist: counts.pending_waitlist ?? 0,
            reports: counts.open_reports ?? 0,
          },
        },
        fetchedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      console.error("[admin/stats] error:", error);
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/admin/maintenance-mode", authMiddleware, async (req, res) => {
    try {
      const me = await storage.getUser(req.userId!);
      if (!me?.isSuperAdmin) return res.status(403).json({ error: "Super admin access required" });
      const enabled = await getMaintenanceMode();
      return res.json({ maintenance_mode: enabled });
    } catch (error: unknown) {
      serverError(res, error);
    }
  });

  app.patch("/api/admin/maintenance-mode", authMiddleware, async (req, res) => {
    try {
      const me = await storage.getUser(req.userId!);
      if (!me?.isSuperAdmin) return res.status(403).json({ error: "Super admin access required" });
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be a boolean" });
      }
      const value = enabled ? "true" : "false";
      await db
        .insert(appConfig)
        .values({ key: "maintenance_mode", value })
        .onConflictDoUpdate({ target: appConfig.key, set: { value } });
      setMaintenanceModeCache(enabled);
      return res.json({ maintenance_mode: enabled });
    } catch (error: unknown) {
      serverError(res, error);
    }
  });

  app.get("/api/admin/audit-logs", authMiddleware, async (req, res) => {
    try {
      const me = await storage.getUser(req.userId!);
      if (!me?.isSuperAdmin) return res.status(403).json({ error: "Forbidden" });
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const logs = await storage.getAuditLogs(limit);
      res.json({ logs });
    } catch (error: unknown) {
      serverError(res, error);
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
        if (status === 'waitlisted') {
          return res.status(400).json({ error: "Already on the waitlist" });
        }
        if (status === 'on_hold') {
          return res.status(400).json({ error: "Your waitlist spot is on hold" });
        }
      }

      if (bubble.memberLimit != null) {
        const currentCount = await storage.getRealMemberCount(bubbleId);
        if (currentCount >= bubble.memberLimit) {
          await storage.createMembershipWithStatus({ userId: req.userId!, bubbleId }, 'waitlisted');
          return res.json({ success: true, status: 'waitlisted' });
        }
      }

      if (bubble.privacy === 'Request to Join' || bubble.privacy === 'Request' || bubble.privacy === 'Private') {
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
          // Remove departing admin from all member contact_ groups for this bubble,
          // and also from their own contact group if they had one (e.g. contacted
          // admins before being promoted to admin themselves).
          const allMemberships = await storage.getBubbleMemberships(bubbleId).catch(() => []);
          for (const membership of allMemberships) {
            if (String(membership.userId) === String(req.userId)) continue;
            removeMemberFromGroup(`contact_${bubbleId}_${membership.userId}`, String(req.userId!)).catch((e: any) =>
              console.error(`CometChat: remove leaving admin from contact group contact_${bubbleId}_${membership.userId}:`, e.message)
            );
          }
          removeMemberFromGroup(`contact_${bubbleId}_${req.userId}`, String(req.userId!)).catch((e: any) =>
            console.error(`CometChat: remove leaving admin from own contact group contact_${bubbleId}_${req.userId}:`, e.message)
          );
        } else {
          const memberChats = await storage.getAdminMemberChatsForBubble(bubbleId);
          const myChats = memberChats.filter(c => c.memberId === req.userId);
          await storage.archiveAdminMemberChatsForMember(bubbleId, req.userId!);
          for (const chat of myChats) {
            removeMemberFromGroup(chat.cometChatGroupId, String(req.userId!)).catch((e: any) =>
              console.error(`CometChat: remove leaving member from adm group ${chat.cometChatGroupId}:`, e.message)
            );
          }
          removeMemberFromGroup(`contact_${bubbleId}_${req.userId}`, String(req.userId!)).catch((e: any) =>
            console.error(`CometChat: remove leaving member from contact group contact_${bubbleId}_${req.userId}:`, e.message)
          );
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

      // Determine if the requester is an authenticated bubble admin or super admin
      // so we can decide whether to expose email addresses
      let requesterIsAdmin = false;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.slice(7);
          const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
          const requester = await storage.getUser(decoded.userId);
          if (requester?.isSuperAdmin) {
            requesterIsAdmin = true;
          } else {
            const role = await storage.getMemberRole(decoded.userId, req.params.id);
            if (role === "admin") requesterIsAdmin = true;
          }
        } catch {
          // invalid token — treat as unauthenticated
        }
      }

      res.json(members.map(m => ({
        id: m.id,
        userId: m.userId,
        bubbleId: m.bubbleId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: {
          id: m.user.id,
          name: m.user.name,
          ...(requesterIsAdmin ? { email: m.user.email } : {}),
          profilePhoto: m.user.profilePhoto,
        }
      })));
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/bubbles/:id/membership", authMiddleware, async (req, res) => {
    try {
      const isMember = await storage.isMember(req.userId!, req.params.id);
      const role = await storage.getMemberRole(req.userId!, req.params.id);
      const membershipStatus = await storage.getMembershipStatus(req.userId!, req.params.id);
      res.json({ isMember, role, membershipStatus });
    } catch (error: any) {
      serverError(res, error);
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
          // Remove kicked admin from all member contact_ groups for this bubble,
          // and also from their own contact group if they had one.
          const allMemberships = await storage.getBubbleMemberships(bubbleId).catch(() => []);
          for (const membership of allMemberships) {
            if (String(membership.userId) === String(userId)) continue;
            removeMemberFromGroup(`contact_${bubbleId}_${membership.userId}`, String(userId)).catch((e: any) =>
              console.error(`CometChat: remove kicked admin from contact group contact_${bubbleId}_${membership.userId}:`, e.message)
            );
          }
          removeMemberFromGroup(`contact_${bubbleId}_${userId}`, String(userId)).catch((e: any) =>
            console.error(`CometChat: remove kicked admin from own contact group contact_${bubbleId}_${userId}:`, e.message)
          );
        } else {
          const memberChats = await storage.getAdminMemberChatsForBubble(bubbleId);
          const myChats = memberChats.filter(c => c.memberId === userId);
          await storage.archiveAdminMemberChatsForMember(bubbleId, userId);
          for (const chat of myChats) {
            removeMemberFromGroup(chat.cometChatGroupId, String(userId)).catch((e: any) =>
              console.error(`CometChat: remove kicked member from adm group ${chat.cometChatGroupId}:`, e.message)
            );
          }
          removeMemberFromGroup(`contact_${bubbleId}_${userId}`, String(userId)).catch((e: any) =>
            console.error(`CometChat: remove kicked member from contact group contact_${bubbleId}_${userId}:`, e.message)
          );
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
      serverError(res, error);
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

  app.get("/api/bubbles/:bubbleId/waitlist", authMiddleware, async (req, res) => {
    try {
      const { bubbleId } = req.params;
      const requesterRole = await storage.getMemberRole(req.userId!, bubbleId);
      const user = await storage.getUser(req.userId!);
      if (requesterRole !== 'admin' && !user?.isSuperAdmin) {
        return res.status(403).json({ error: "Only admins can view the waitlist" });
      }
      const waitlist = await storage.getWaitlistMembers(bubbleId);
      const formatMember = (r: any) => ({
        id: r.id,
        userId: r.userId,
        bubbleId: r.bubbleId,
        membershipStatus: r.membershipStatus,
        joinedAt: r.joinedAt,
        user: { id: r.user.id, name: r.user.name, email: r.user.email, profilePhoto: r.user.profilePhoto },
      });
      res.json({
        waitlisted: waitlist.filter(r => r.membershipStatus === 'waitlisted').map(formatMember),
        on_hold: waitlist.filter(r => r.membershipStatus === 'on_hold').map(formatMember),
      });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.post("/api/bubbles/:bubbleId/waitlist/:userId/approve", authMiddleware, async (req, res) => {
    try {
      const { bubbleId, userId } = req.params;
      const requesterRole = await storage.getMemberRole(req.userId!, bubbleId);
      const requester = await storage.getUser(req.userId!);
      if (requesterRole !== 'admin' && !requester?.isSuperAdmin) {
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
      if (!existingStatus || (existingStatus !== 'waitlisted' && existingStatus !== 'on_hold')) {
        return res.status(400).json({ error: "User is not on the waitlist" });
      }
      const membership = await storage.approveMembership(userId, bubbleId);
      if (!membership) {
        return res.status(400).json({ error: "Failed to approve membership" });
      }
      sendNotification({
        recipientId: userId,
        type: "waitlist_approved",
        title: "You're In!",
        body: `You've been approved to join ${bubble.title} from the waitlist!`,
        metadata: { bubbleId, bubbleName: bubble.title },
      });
      res.json({ success: true, membership });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/bubbles/:bubbleId/waitlist/:userId/hold", authMiddleware, async (req, res) => {
    try {
      const { bubbleId, userId } = req.params;
      const requesterRole = await storage.getMemberRole(req.userId!, bubbleId);
      const requester = await storage.getUser(req.userId!);
      if (requesterRole !== 'admin' && !requester?.isSuperAdmin) {
        return res.status(403).json({ error: "Only admins can manage waitlist" });
      }
      const bubble = await storage.getBubble(bubbleId);
      const existingStatusHold = await storage.getMembershipStatus(userId, bubbleId);
      if (!existingStatusHold || existingStatusHold !== 'waitlisted') {
        return res.status(400).json({ error: "User is not on the waitlist" });
      }
      const membership = await storage.holdMembership(userId, bubbleId);
      if (!membership) {
        return res.status(400).json({ error: "Failed to update membership" });
      }
      const holdReason = req.body?.reason as string | undefined;
      const holdBody = holdReason
        ? `Your waitlist spot for ${bubble?.title || 'the bubble'} has been put on hold: ${holdReason}`
        : `Your waitlist spot for ${bubble?.title || 'the bubble'} has been put on hold.`;
      sendNotification({
        recipientId: userId,
        type: "waitlist_on_hold",
        title: "Waitlist Update",
        body: holdBody,
        metadata: { bubbleId, bubbleName: bubble?.title },
      });
      res.json({ success: true, membership });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/bubbles/:bubbleId/waitlist/:userId/reject", authMiddleware, async (req, res) => {
    try {
      const { bubbleId, userId } = req.params;
      const requesterRole = await storage.getMemberRole(req.userId!, bubbleId);
      const requester = await storage.getUser(req.userId!);
      if (requesterRole !== 'admin' && !requester?.isSuperAdmin) {
        return res.status(403).json({ error: "Only admins can manage waitlist" });
      }
      const bubble = await storage.getBubble(bubbleId);
      const existingStatusReject = await storage.getMembershipStatus(userId, bubbleId);
      if (!existingStatusReject || (existingStatusReject !== 'waitlisted' && existingStatusReject !== 'on_hold')) {
        return res.status(400).json({ error: "User is not on the waitlist" });
      }
      await storage.rejectMembership(userId, bubbleId);
      const rejectReason = req.body?.reason as string | undefined;
      const rejectBody = rejectReason
        ? `Your waitlist spot for ${bubble?.title || 'the bubble'} has been removed: ${rejectReason}`
        : `Your waitlist spot for ${bubble?.title || 'the bubble'} has been removed.`;
      sendNotification({
        recipientId: userId,
        type: "waitlist_rejected",
        title: "Waitlist Update",
        body: rejectBody,
        metadata: { bubbleId, bubbleName: bubble?.title },
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
      serverError(res, error);
    }
  });

  app.get("/api/events/upcoming", async (req, res) => {
    try {
      const events = await storage.getUpcomingEvents();
      res.json(convertEventsToLocal(events));
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/events/my", authMiddleware, async (req, res) => {
    try {
      const events = await storage.getUserEvents(req.userId!);
      res.json(convertEventsToLocal(events));
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/events/created", authMiddleware, async (req, res) => {
    try {
      const events = await storage.getUserCreatedEvents(req.userId!);
      res.json(convertEventsToLocal(events));
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/bubbles/created/my", authMiddleware, async (req, res) => {
    try {
      const bubbles = await storage.getUserCreatedBubbles(req.userId!);
      res.json(await enrichBubblesCategory(bubbles));
    } catch (error: any) {
      serverError(res, error);
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
      serverError(res, error);
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
      serverError(res, error);
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
      if (bodyToStore.locationLat != null) bodyToStore.locationLat = truncateCoord(bodyToStore.locationLat);
      if (bodyToStore.locationLng != null) bodyToStore.locationLng = truncateCoord(bodyToStore.locationLng);
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

      const eventBodyParsed = updateEventSchema.safeParse(req.body);
      if (!eventBodyParsed.success) {
        return res.status(400).json({ error: eventBodyParsed.error.issues[0].message });
      }

      const modResult = moderateText({
        title: req.body.title,
        description: req.body.description,
      });
      if (modResult.flagged) {
        return res.status(400).json({ error: modResult.message });
      }

      let updateBody = { ...eventBodyParsed.data };
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

  app.get("/api/admin/waitlist", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });

      const result: any[] = [];

      if (user.isSuperAdmin) {
        const allBubbles = await storage.getBubbles();
        for (const bubble of allBubbles) {
          const members = await storage.getWaitlistMembers(bubble.id);
          for (const m of members) {
            result.push({
              id: m.id,
              userId: m.userId,
              bubbleId: m.bubbleId,
              bubbleTitle: bubble.title,
              membershipStatus: m.membershipStatus,
              joinedAt: m.joinedAt,
              user: { id: m.user.id, name: m.user.name, profilePhoto: m.user.profilePhoto },
            });
          }
        }
      } else {
        const userMemberships = await storage.getUserMemberships(req.userId!);
        const adminBubbles = userMemberships.filter(m => m.role === 'admin');
        for (const membership of adminBubbles) {
          const members = await storage.getWaitlistMembers(membership.bubbleId);
          for (const m of members) {
            result.push({
              id: m.id,
              userId: m.userId,
              bubbleId: m.bubbleId,
              bubbleTitle: membership.bubble.title,
              membershipStatus: m.membershipStatus,
              joinedAt: m.joinedAt,
              user: { id: m.user.id, name: m.user.name, profilePhoto: m.user.profilePhoto },
            });
          }
        }
      }

      // Sort oldest first (first come, first served)
      result.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
      res.json(result);
    } catch (error: any) {
      serverError(res, error);
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

      // Include waitlist count
      if (user.isSuperAdmin) {
        const allBubbles = await storage.getBubbles();
        for (const bubble of allBubbles) {
          const members = await storage.getWaitlistMembers(bubble.id);
          count += members.length;
        }
      } else {
        const userMemberships = await storage.getUserMemberships(req.userId!);
        const adminBubbles = userMemberships.filter(m => m.role === 'admin');
        for (const membership of adminBubbles) {
          const members = await storage.getWaitlistMembers(membership.bubbleId);
          count += members.length;
        }
      }

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
      auditLog("event_approved", req.userId!, req.params.id, req.ip ?? "");
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
      if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
        return res.status(400).json({ error: "Reason must be 500 characters or fewer" });
      }
      const rejectedEvent = await storage.rejectEvent(req.params.id, reason);
      auditLog("event_rejected", req.userId!, req.params.id, req.ip ?? "", { reason });
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
      serverError(res, error);
    }
  });

  // ============ CAMPUS ROUTES ============

  // Get all campuses
  app.get("/api/campuses", async (req, res) => {
    try {
      const campuses = await storage.getCampuses();
      res.json(campuses);
    } catch (error: any) {
      serverError(res, error);
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

      let emailFailed = false;
      try {
        await sendVerificationEmail(emailLower, code);
      } catch (emailError: any) {
        console.error(`[EMAIL] Delivery failed for ${emailLower}:`, emailError.message);
        emailFailed = true;
      }

      const response: any = {
        success: true,
        message: "Verification code sent to your email",
        campusId: campus.id,
        campusName: campus.title,
      };
      if (emailFailed) {
        response.emailFailed = true;
        response.fallbackCode = code;
      }
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
      serverError(res, error);
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
      serverError(res, error);
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
      serverError(res, error);
    }
  });

  // ========== ANALYTICS ENDPOINTS ==========

  // Session tracking - start session
  app.post("/api/sessions/start", authMiddleware, async (req, res) => {
    try {
      const session = await storage.createSession(req.userId!);
      res.json(session);
    } catch (error: any) {
      serverError(res, error);
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
      serverError(res, error);
    }
  });

  // Analytics - Get all metrics (super admin only)
  app.get("/api/analytics/metrics", authMiddleware, async (req, res) => {
    try {
      const user = await getCachedUser(req.userId!);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }
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
      serverError(res, error);
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
      serverError(res, error);
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

  function withoutLegacyPlaceholders(cat: any) {
    const { placeholderName, placeholderTagline, placeholderDescription, ...rest } = cat;
    return rest;
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
        ...withoutLegacyPlaceholders(withAbsoluteImageUrl(req, parent)),
        children: allCategories
          .filter(c => c.parentId === parent.id)
          .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
          .map(c => withoutLegacyPlaceholders(withAbsoluteImageUrl(req, c))),
      }));
      res.json(nested);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/categories/flat", async (req, res) => {
    try {
      const allCategories = await storage.getCategories();
      const sorted = allCategories.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
      res.json(sorted.map(c => withoutLegacyPlaceholders(withAbsoluteImageUrl(req, c))));
    } catch (error: any) {
      serverError(res, error);
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
      const { name, displayName, header, icon, image, parentId, displayOrder } = req.body;
      const updateData: Partial<InsertCategory> = {};
      if (name !== undefined) updateData.name = name;
      if (displayName !== undefined) updateData.displayName = displayName;
      if (header !== undefined) updateData.header = header;
      if (icon !== undefined) updateData.icon = icon;
      if (image !== undefined) updateData.image = image;
      if (parentId !== undefined) updateData.parentId = parentId === null ? null : Number(parentId);
      if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder);
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

  // Category Placeholders — lazy read (no auth)
  app.get("/api/categories/:id/placeholders", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid category id" });
      const rows = await storage.getCategoryPlaceholders(id);
      const grouped: { name: string[]; tagline: string[]; description: string[] } = {
        name: [],
        tagline: [],
        description: [],
      };
      for (const row of rows) {
        if (row.fieldType === "name") grouped.name.push(row.value);
        else if (row.fieldType === "tagline") grouped.tagline.push(row.value);
        else if (row.fieldType === "description") grouped.description.push(row.value);
      }
      const pick = (arr: string[]) =>
        arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : "";
      res.json({
        name: pick(grouped.name),
        tagline: pick(grouped.tagline),
        description: pick(grouped.description),
      });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // Category Placeholders — all (super admin)
  app.get("/api/category-placeholders", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) return res.status(403).json({ error: "Super admin access required" });
      const rows = await storage.getAllCategoryPlaceholders();
      res.json(rows);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // Category Placeholders — create
  const VALID_PLACEHOLDER_FIELD_TYPES = ['name', 'tagline', 'description'] as const;

  app.post("/api/categories/:id/placeholders", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) return res.status(403).json({ error: "Super admin access required" });
      const categoryId = parseInt(req.params.id);
      if (isNaN(categoryId)) return res.status(400).json({ error: "Invalid category id" });
      const { fieldType, value, displayOrder } = req.body;
      if (!fieldType || !value) return res.status(400).json({ error: "fieldType and value are required" });
      if (!(VALID_PLACEHOLDER_FIELD_TYPES as readonly string[]).includes(fieldType)) {
        return res.status(400).json({ error: `fieldType must be one of: ${VALID_PLACEHOLDER_FIELD_TYPES.join(', ')}` });
      }
      const trimmedValue = String(value).trim();
      if (!trimmedValue) return res.status(400).json({ error: "value must not be empty" });
      const row = await storage.createCategoryPlaceholder({ categoryId, fieldType, value: trimmedValue, displayOrder: displayOrder ?? 0 });
      res.json(row);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Category Placeholders — update
  app.put("/api/category-placeholders/:placeholderId", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) return res.status(403).json({ error: "Super admin access required" });
      const id = parseInt(req.params.placeholderId);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid placeholder id" });
      const { value, displayOrder, fieldType } = req.body;
      const updates: any = {};
      if (fieldType !== undefined) {
        if (!(VALID_PLACEHOLDER_FIELD_TYPES as readonly string[]).includes(fieldType)) {
          return res.status(400).json({ error: `fieldType must be one of: ${VALID_PLACEHOLDER_FIELD_TYPES.join(', ')}` });
        }
        updates.fieldType = fieldType;
      }
      if (value !== undefined) {
        const trimmedValue = String(value).trim();
        if (!trimmedValue) return res.status(400).json({ error: "value must not be empty" });
        updates.value = trimmedValue;
      }
      if (displayOrder !== undefined) updates.displayOrder = displayOrder;
      const row = await storage.updateCategoryPlaceholder(id, updates);
      if (!row) return res.status(404).json({ error: "Placeholder not found" });
      res.json(row);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Category Placeholders — delete
  app.delete("/api/category-placeholders/:placeholderId", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) return res.status(403).json({ error: "Super admin access required" });
      const id = parseInt(req.params.placeholderId);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid placeholder id" });
      await storage.deleteCategoryPlaceholder(id);
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
      serverError(res, error);
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
      serverError(res, error);
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
      serverError(res, error);
    }
  });

  app.get("/api/notifications/unread-count", authMiddleware, async (req, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.userId!);
      res.json({ count });
    } catch (error: any) {
      serverError(res, error);
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
      serverError(res, error);
    }
  });

  app.post("/api/notifications/read-all", authMiddleware, async (req, res) => {
    try {
      await storage.markAllNotificationsRead(req.userId!);
      res.json({ success: true });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.delete("/api/notifications/:id", authMiddleware, async (req, res) => {
    try {
      await storage.deleteNotification(req.params.id, req.userId!);
      res.json({ success: true });
    } catch (error: any) {
      serverError(res, error);
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
      serverError(res, error);
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
      serverError(res, error);
    }
  });

  // H4: Admin endpoint to purge stale push tokens globally (super admin only)
  app.post("/api/admin/push-tokens/cleanup", authMiddleware, async (req, res) => {
    try {
      const user = await getCachedUser(req.userId!);
      if (!user?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }
      const days = parseInt(req.query.days as string ?? "90", 10) || 90;
      const deleted = await storage.deleteStaleDevicePushTokens(days);
      auditLog("push_tokens_cleanup", req.userId!, "global", req.ip ?? "", { deleted, olderThanDays: days });
      res.json({ success: true, deleted });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // H4: Run stale push token cleanup on startup
  storage.deleteStaleDevicePushTokens(90)
    .then(n => { if (n > 0) console.log(`[startup] Deleted ${n} stale push tokens`); })
    .catch(console.error);

  seedCampuses().catch(console.error);
  seedCategories().then(() => seedCategoryPlaceholders()).catch(console.error);
  seedBulletinPostTypes().catch(console.error).then(() => {
    if (process.env.NODE_ENV !== "production") {
      seedData().catch(console.error);
    }
  });
  seedAppConfig().catch(console.error);
  seedRules().catch(console.error);
  storage.backfillBubbleShortIds().catch(console.error);

  // Bulletin Board - Post Types
  app.get("/api/bulletin/post-types", authMiddleware, async (_req, res) => {
    try {
      const types = await storage.getBulletinPostTypes();
      res.json(types);
    } catch (error: any) {
      serverError(res, error);
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
      serverError(res, error);
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
      serverError(res, error);
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

      const postParsed = insertBulletinPostSchema.safeParse({
        boardId: 'placeholder',
        postTypeId: req.body.postTypeId,
        authorId: userId,
        title: req.body.title,
        body: req.body.body,
        imageUrl: req.body.imageUrl || null,
      });
      if (!postParsed.success) {
        return res.status(400).json({ error: postParsed.error.issues[0].message });
      }

      const modResult = moderateText({ title: req.body.title, body: req.body.body });
      if (modResult.flagged) {
        return res.status(400).json({ error: modResult.message });
      }

      const board = await storage.getOrCreateBulletinBoard(bubbleId, userId);
      const post = await storage.createBulletinPost({
        boardId: board.id,
        postTypeId: postParsed.data.postTypeId,
        authorId: userId,
        title: postParsed.data.title,
        body: postParsed.data.body,
        imageUrl: postParsed.data.imageUrl || null,
      });
      res.json(post);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.put("/api/bulletin/posts/:postId", authMiddleware, async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = req.userId!;
      const post = await storage.getBulletinPost(postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const isAuthor = post.authorId === userId;
      if (!isAuthor) {
        return res.status(403).json({ error: "Only the author can edit this post" });
      }

      const updatePostParsed = updateBulletinPostSchema.safeParse({
        title: req.body.title,
        body: req.body.body,
        postTypeId: req.body.postTypeId,
        imageUrl: req.body.imageUrl,
      });
      if (!updatePostParsed.success) {
        return res.status(400).json({ error: updatePostParsed.error.issues[0].message });
      }

      if (req.body.title || req.body.body) {
        const modResult = moderateText({ title: req.body.title || post.title, body: req.body.body || post.body });
        if (modResult.flagged) {
          return res.status(400).json({ error: modResult.message });
        }
      }

      const updated = await storage.updateBulletinPost(postId, updatePostParsed.data, userId);
      res.json(updated);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // Bulletin Board - Get single post
  app.get("/api/bulletin/posts/:postId", authMiddleware, async (req, res) => {
    try {
      const post = await storage.getBulletinPost(req.params.postId);
      if (!post) return res.status(404).json({ error: "Post not found" });
      res.json(post);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // Bulletin Board - Delete post (author or bubble admin/super admin only)
  app.delete("/api/bulletin/posts/:postId", authMiddleware, async (req, res) => {
    try {
      const post = await storage.getBulletinPost(req.params.postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const user = await storage.getUser(req.userId!);
      const board = await storage.getBulletinBoardById(post.boardId);
      const bubbleRole = board ? await storage.getMemberRole(req.userId!, board.bubbleId) : null;
      const isBubbleAdmin = bubbleRole === 'admin';

      if (post.authorId !== req.userId && !user?.isSuperAdmin && !isBubbleAdmin) {
        return res.status(403).json({ error: "Not authorized to delete this post" });
      }

      await storage.deleteBulletinPost(req.params.postId);
      res.json({ success: true });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // Bulletin Board - Toggle pin (bubble admin/super admin only)
  app.patch("/api/bulletin/posts/:postId/pin", authMiddleware, async (req, res) => {
    try {
      const post = await storage.getBulletinPost(req.params.postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const user = await storage.getUser(req.userId!);
      const board = await storage.getBulletinBoardById(post.boardId);
      const bubbleRole = board ? await storage.getMemberRole(req.userId!, board.bubbleId) : null;
      const isBubbleAdmin = bubbleRole === 'admin';

      if (!user?.isSuperAdmin && !isBubbleAdmin) {
        return res.status(403).json({ error: "Only admins can pin or unpin posts" });
      }

      const result = await storage.toggleBulletinPostPin(req.params.postId, req.userId);
      res.json(result);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // Bulletin Board - Toggle reaction
  app.post("/api/bulletin/posts/:postId/reactions", authMiddleware, async (req, res) => {
    try {
      const post = await storage.getBulletinPost(req.params.postId);
      if (!post) return res.status(404).json({ error: "Post not found" });

      const emoji = req.body.emoji || 'heart';
      if (typeof emoji !== 'string' || emoji.length > 10) {
        return res.status(400).json({ error: "emoji must be 10 characters or fewer" });
      }
      const result = await storage.toggleBulletinReaction(req.params.postId, req.userId!, emoji);
      res.json(result);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  // Bulletin Board - List replies
  app.get("/api/bulletin/posts/:postId/replies", authMiddleware, async (req, res) => {
    try {
      const replies = await storage.getBulletinReplies(req.params.postId);
      res.json(replies);
    } catch (error: any) {
      serverError(res, error);
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

      const replyParsed = insertBulletinReplySchema.safeParse({
        postId: req.params.postId,
        authorId: req.userId!,
        body: req.body.body,
      });
      if (!replyParsed.success) {
        return res.status(400).json({ error: replyParsed.error.issues[0].message });
      }

      const replyModResult = moderateText({ body: req.body.body });
      if (replyModResult.flagged) {
        return res.status(400).json({ error: replyModResult.message });
      }

      const reply = await storage.createBulletinReply(replyParsed.data);
      res.json(reply);
    } catch (error: any) {
      serverError(res, error);
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
      serverError(res, error);
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
      serverError(res, error);
    }
  });

  app.get("/api/rules/effective/:bubbleId", authMiddleware, async (req, res) => {
    try {
      const effectiveRules = await storage.getEffectiveRules(req.params.bubbleId);
      res.json(effectiveRules);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/rules/app", authMiddleware, async (_req, res) => {
    try {
      const appRulesList = await storage.getAppRules();
      res.json(appRulesList);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.post("/api/rules/app", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) return res.status(403).json({ error: "Super admin required" });
      const { name, description, position } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const rule = await storage.createRule(name, description || '');
      const appRule = await storage.addAppRule(rule.id, position || 0);
      res.json({ ...appRule, rule });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.put("/api/rules/app/reorder", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) return res.status(403).json({ error: "Super admin required" });
      const { ruleIds } = req.body;
      if (!Array.isArray(ruleIds)) return res.status(400).json({ error: "ruleIds array required" });
      await storage.reorderAppRules(ruleIds);
      res.json({ success: true });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.put("/api/rules/app/:ruleId", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) return res.status(403).json({ error: "Super admin required" });
      const ruleId = parseInt(req.params.ruleId);
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const updated = await storage.updateRule(ruleId, name, description || '');
      if (!updated) return res.status(404).json({ error: "Rule not found" });
      res.json(updated);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.delete("/api/rules/app/:ruleId", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) return res.status(403).json({ error: "Super admin required" });
      const ruleId = parseInt(req.params.ruleId);
      const linked = await storage.isAppRuleLinked(ruleId);
      if (!linked) return res.status(404).json({ error: "Rule not linked to app" });
      await storage.removeAppRule(ruleId);
      const stillReferenced = await storage.isRuleReferenced(ruleId);
      if (!stillReferenced) {
        await storage.deleteRule(ruleId);
      }
      res.json({ success: true });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/rules/category/:categoryId", authMiddleware, async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const catRules = await storage.getCategoryRules(categoryId);
      res.json(catRules);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.post("/api/rules/category/:categoryId", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) return res.status(403).json({ error: "Super admin required" });
      const categoryId = parseInt(req.params.categoryId);
      const { name, description, position } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const rule = await storage.createRule(name, description || '');
      const catRule = await storage.addCategoryRule(categoryId, rule.id, position || 0);
      res.json({ ...catRule, rule });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.put("/api/rules/category/:categoryId/reorder", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) return res.status(403).json({ error: "Super admin required" });
      const categoryId = parseInt(req.params.categoryId);
      const { ruleIds } = req.body;
      if (!Array.isArray(ruleIds)) return res.status(400).json({ error: "ruleIds array required" });
      await storage.reorderCategoryRules(categoryId, ruleIds);
      res.json({ success: true });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.put("/api/rules/category/:categoryId/:ruleId", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) return res.status(403).json({ error: "Super admin required" });
      const categoryId = parseInt(req.params.categoryId);
      const ruleId = parseInt(req.params.ruleId);
      const linked = await storage.isCategoryRuleLinked(categoryId, ruleId);
      if (!linked) return res.status(404).json({ error: "Rule not linked to this category" });
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const updated = await storage.updateRule(ruleId, name, description || '');
      if (!updated) return res.status(404).json({ error: "Rule not found" });
      res.json(updated);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.delete("/api/rules/category/:categoryId/:ruleId", authMiddleware, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user?.isSuperAdmin) return res.status(403).json({ error: "Super admin required" });
      const categoryId = parseInt(req.params.categoryId);
      const ruleId = parseInt(req.params.ruleId);
      const linked = await storage.isCategoryRuleLinked(categoryId, ruleId);
      if (!linked) return res.status(404).json({ error: "Rule not linked to this category" });
      await storage.removeCategoryRule(categoryId, ruleId);
      const stillReferenced = await storage.isRuleReferenced(ruleId);
      if (!stillReferenced) {
        await storage.deleteRule(ruleId);
      }
      res.json({ success: true });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.get("/api/rules/bubble/:bubbleId", authMiddleware, async (req, res) => {
    try {
      const bubbleRulesList = await storage.getBubbleRules(req.params.bubbleId);
      res.json(bubbleRulesList);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.post("/api/rules/bubble/:bubbleId", authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.bubbleId;
      const userId = req.userId!;
      const role = await storage.getMemberRole(userId, bubbleId);
      const user = await storage.getUser(userId);
      const isAdmin = role === 'admin' || role === 'creator' || user?.isSuperAdmin;
      if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
      const { name, description, position } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const rule = await storage.createRule(name, description || '');
      const bubbleRule = await storage.addBubbleRule(bubbleId, rule.id, position || 0);
      res.json({ ...bubbleRule, rule });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.put("/api/rules/bubble/:bubbleId/reorder", authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.bubbleId;
      const userId = req.userId!;
      const role = await storage.getMemberRole(userId, bubbleId);
      const user = await storage.getUser(userId);
      const isAdmin = role === 'admin' || role === 'creator' || user?.isSuperAdmin;
      if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
      const { ruleIds } = req.body;
      if (!Array.isArray(ruleIds)) return res.status(400).json({ error: "ruleIds array required" });
      await storage.reorderBubbleRules(bubbleId, ruleIds);
      res.json({ success: true });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.put("/api/rules/bubble/:bubbleId/:ruleId", authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.bubbleId;
      const userId = req.userId!;
      const role = await storage.getMemberRole(userId, bubbleId);
      const user = await storage.getUser(userId);
      const isAdmin = role === 'admin' || role === 'creator' || user?.isSuperAdmin;
      if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
      const ruleId = parseInt(req.params.ruleId);
      const linked = await storage.isBubbleRuleLinked(bubbleId, ruleId);
      if (!linked) return res.status(404).json({ error: "Rule not linked to this bubble" });
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: "name is required" });
      const updated = await storage.updateRule(ruleId, name, description || '');
      if (!updated) return res.status(404).json({ error: "Rule not found" });
      res.json(updated);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.delete("/api/rules/bubble/:bubbleId/:ruleId", authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.bubbleId;
      const userId = req.userId!;
      const role = await storage.getMemberRole(userId, bubbleId);
      const user = await storage.getUser(userId);
      const isAdmin = role === 'admin' || role === 'creator' || user?.isSuperAdmin;
      if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
      const ruleId = parseInt(req.params.ruleId);
      const linked = await storage.isBubbleRuleLinked(bubbleId, ruleId);
      if (!linked) return res.status(404).json({ error: "Rule not linked to this bubble" });
      await storage.removeBubbleRule(bubbleId, ruleId);
      const stillReferenced = await storage.isRuleReferenced(ruleId);
      if (!stillReferenced) {
        await storage.deleteRule(ruleId);
      }
      res.json({ success: true });
    } catch (error: any) {
      serverError(res, error);
    }
  });

  app.post("/api/rules/bubble/:bubbleId/override", authMiddleware, async (req, res) => {
    try {
      const bubbleId = req.params.bubbleId;
      const userId = req.userId!;
      const role = await storage.getMemberRole(userId, bubbleId);
      const user = await storage.getUser(userId);
      const isAdmin = role === 'admin' || role === 'creator' || user?.isSuperAdmin;
      if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
      const { ruleId, hidden } = req.body;
      if (ruleId === undefined || hidden === undefined) return res.status(400).json({ error: "ruleId and hidden required" });
      const override = await storage.setBubbleRuleOverride(bubbleId, ruleId, hidden);
      res.json(override);
    } catch (error: any) {
      serverError(res, error);
    }
  });

  return httpServer;
}
