import { eq, and, desc, lt, gte, or, isNull, ne, inArray } from "drizzle-orm";
import { db } from "./db";
import { generateShortId } from "./shortId";
import {
  users,
  bubbles,
  memberships,
  verificationCodes,
  events,
  eventAttendees,
  campuses,
  userSessions,
  bubbleVisits,
  categories,
  type User,
  type InsertUser,
  type Bubble,
  type InsertBubble,
  type Membership,
  type InsertMembership,
  type VerificationCode,
  type InsertVerificationCode,
  type Event,
  type InsertEvent,
  type EventAttendee,
  type InsertEventAttendee,
  type Campus,
  type InsertCampus,
  type UserSession,
  type BubbleVisit,
  type Category,
  type InsertCategory,
  reports,
  type Report,
  type InsertReport,
  bubbleChats,
  type BubbleChat,
  adminMemberChats,
  type AdminMemberChat,
  notifications,
  type Notification,
  type InsertNotification,
  devicePushTokens,
  type DevicePushToken,
  bulletinBoards,
  type BulletinBoard,
  type InsertBulletinBoard,
  bulletinPostTypes,
  type BulletinPostType,
  bulletinPosts,
  type BulletinPost,
  type InsertBulletinPost,
  bulletinReplies,
  type BulletinReply,
  type InsertBulletinReply,
  bulletinPostReactions,
} from "@shared/schema";
import { sql, count, avg } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getSuperAdmins(): Promise<User[]>;

  getBubbles(): Promise<Bubble[]>;
  getBubble(id: string): Promise<Bubble | undefined>;
  getBubbleByShortId(shortId: string): Promise<Bubble | undefined>;
  backfillBubbleShortIds(): Promise<void>;
  createBubble(bubble: InsertBubble): Promise<Bubble>;
  updateBubble(id: string, bubble: Partial<InsertBubble>): Promise<Bubble | undefined>;
  deleteBubble(id: string): Promise<void>;
  updateBubbleMemberCount(id: string, delta: number): Promise<void>;
  getPendingBubbles(): Promise<Bubble[]>;
  approveBubble(id: string): Promise<Bubble | undefined>;
  rejectBubble(id: string, reason?: string): Promise<Bubble | undefined>;

  getUserMemberships(userId: string): Promise<(Membership & { bubble: Bubble })[]>;
  getBubbleMemberships(bubbleId: string): Promise<Membership[]>;
  getBubbleMembersWithUsers(bubbleId: string): Promise<(Membership & { user: User })[]>;
  getPendingJoinRequests(bubbleId: string): Promise<(Membership & { user: User })[]>;
  createMembership(membership: InsertMembership): Promise<Membership>;
  createMembershipWithRole(membership: InsertMembership, role: string): Promise<Membership>;
  createMembershipWithStatus(membership: InsertMembership, status: string): Promise<Membership>;
  approveMembership(userId: string, bubbleId: string): Promise<Membership | undefined>;
  rejectMembership(userId: string, bubbleId: string): Promise<void>;
  getMembershipStatus(userId: string, bubbleId: string): Promise<string | null>;
  deleteMembership(userId: string, bubbleId: string): Promise<void>;
  isMember(userId: string, bubbleId: string): Promise<boolean>;
  hasAnyMembership(userId: string, bubbleId: string): Promise<boolean>;
  getMemberRole(userId: string, bubbleId: string): Promise<string | null>;
  updateMemberRole(userId: string, bubbleId: string, role: string): Promise<void>;

  createVerificationCode(data: InsertVerificationCode): Promise<VerificationCode>;
  getValidVerificationCode(email: string, code: string): Promise<VerificationCode | undefined>;
  markCodeAsUsed(id: string): Promise<void>;

  // Events
  getEvent(id: string): Promise<Event | undefined>;
  getBubbleEvents(bubbleId: string): Promise<Event[]>;
  getAllPublicEvents(): Promise<(Event & { bubble: Bubble })[]>;
  getUserEvents(userId: string): Promise<(Event & { bubble: Bubble })[]>;
  getUserCreatedEvents(userId: string): Promise<(Event & { bubble: Bubble })[]>;
  getUserCreatedBubbles(userId: string): Promise<Bubble[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<void>;
  getPendingEventsForBubble(bubbleId: string): Promise<Event[]>;
  getPendingEventsForAdmin(userId: string): Promise<(Event & { bubble: Bubble })[]>;
  approveEvent(id: string): Promise<Event | undefined>;
  rejectEvent(id: string, reason?: string): Promise<Event | undefined>;

  // Event Attendees
  getEventAttendees(eventId: string): Promise<EventAttendee[]>;
  getEventAttendeesWithUsers(eventId: string): Promise<(EventAttendee & { user: User })[]>;
  isEventAttendee(userId: string, eventId: string): Promise<boolean>;
  getEventAttendee(userId: string, eventId: string): Promise<EventAttendee | undefined>;
  createEventAttendee(attendee: InsertEventAttendee): Promise<EventAttendee>;
  updateEventAttendeeStatus(userId: string, eventId: string, status: string): Promise<EventAttendee | undefined>;
  deleteEventAttendee(userId: string, eventId: string): Promise<void>;
  getFirstWaitlistedAttendee(eventId: string): Promise<EventAttendee | undefined>;
  getGoingCount(eventId: string): Promise<number>;
  getWaitlistCount(eventId: string): Promise<number>;
  getEventsNeedingReminder(type: '24h' | '1h'): Promise<Event[]>;
  markReminderSent(eventId: string, type: '24h' | '1h'): Promise<void>;
  getEventGoingAttendeeIds(eventId: string): Promise<string[]>;

  // Campus
  getCampuses(): Promise<Campus[]>;
  getCampus(id: string): Promise<Campus | undefined>;
  getCampusByDomain(domain: string): Promise<Campus | undefined>;
  createCampus(campus: InsertCampus): Promise<Campus>;
  updateUserCampus(userId: string, campusId: string, campusEmail: string, verified: boolean): Promise<void>;
  dismissCampusPrompt(userId: string): Promise<void>;
  getPublicBubbles(): Promise<Bubble[]>;
  getCampusBubbles(campusId: string): Promise<Bubble[]>;
  getPublicEvents(): Promise<(Event & { bubble: Bubble })[]>;
  getUpcomingEvents(): Promise<(Event & { bubble: Bubble })[]>;
  getCampusEvents(campusId: string): Promise<(Event & { bubble: Bubble })[]>;

  // Analytics
  createSession(userId: string): Promise<UserSession>;
  endSession(sessionId: string, userId: string): Promise<UserSession | undefined>;
  getRetentionMetrics(): Promise<{ day1: number; day7: number; day30: number }>;
  getDauMauMetrics(): Promise<{ dau: number; mau: number; stickiness: number; dailyData: { date: string; dau: number }[] }>;
  getAverageSessionLength(): Promise<{ averageSeconds: number; dailyData: { date: string; avgSeconds: number }[] }>;
  getSessionsPerUser(): Promise<{ daily: number; weekly: number; dailyData: { date: string; sessionsPerUser: number }[] }>;
  getOverviewMetrics(): Promise<{ totalUsers: number; totalBubbles: number; totalEvents: number; totalSessions: number }>;
  
  // Bubble visits
  trackBubbleVisit(bubbleId: string, userId?: string): Promise<BubbleVisit>;
  getBubbleVisitsMetrics(): Promise<{ topBubbles: { bubbleId: string; title: string; visits: number }[]; totalVisits: number; dailyData: { date: string; visits: number }[] }>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  getCategoriesByIds(ids: number[]): Promise<Category[]>;
  createCategory(data: InsertCategory): Promise<Category>;
  updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<void>;

  // Reports
  createReport(report: InsertReport): Promise<Report>;
  getReport(id: string): Promise<Report | undefined>;
  getReportsForBubble(bubbleId: string): Promise<(Report & { reporter: User; reportedUser?: User })[]>;
  getReportsForSysAdmin(): Promise<(Report & { reporter: User; reportedUser?: User; bubble: Bubble })[]>;
  updateReportStatus(id: string, status: string): Promise<Report | undefined>;

  // Bubble Chats
  createBubbleChat(bubbleId: string, cometChatGroupId: string): Promise<BubbleChat>;
  getBubbleChat(bubbleId: string): Promise<BubbleChat | undefined>;
  updateBubbleChatStatus(bubbleId: string, status: string): Promise<void>;

  // Admin-Member Chats
  createAdminMemberChat(bubbleId: string, memberId: string, cometChatGroupId: string, participantIds: string[]): Promise<AdminMemberChat>;
  getAdminMemberChat(bubbleId: string, memberId: string): Promise<AdminMemberChat | undefined>;
  getAdminMemberChatsForBubble(bubbleId: string): Promise<AdminMemberChat[]>;
  getActiveAdminMemberChatsForUser(userId: string, bubbleId: string): Promise<AdminMemberChat[]>;
  updateAdminMemberChatStatus(bubbleId: string, memberId: string, status: string): Promise<void>;
  updateAdminMemberChatParticipants(chatId: string, participantIds: string[]): Promise<void>;
  archiveAdminMemberChatsForBubble(bubbleId: string): Promise<void>;
  archiveAdminMemberChatsForMember(bubbleId: string, memberId: string): Promise<void>;

  // Notifications
  createNotification(data: InsertNotification): Promise<Notification>;
  getNotifications(userId: string, limit?: number, offset?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationRead(id: string, userId: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;
  deleteNotification(id: string, userId: string): Promise<void>;

  // Device Push Tokens
  upsertDevicePushToken(userId: string, token: string, platform: string): Promise<DevicePushToken>;
  getDevicePushTokens(userId: string): Promise<DevicePushToken[]>;
  deleteDevicePushToken(userId: string, token: string): Promise<void>;

  // Bulletin Boards
  getBulletinBoard(bubbleId: string): Promise<BulletinBoard | undefined>;
  getBulletinBoardById(boardId: string): Promise<BulletinBoard | undefined>;
  getOrCreateBulletinBoard(bubbleId: string, userId?: string): Promise<BulletinBoard>;
  getBulletinPostTypes(): Promise<BulletinPostType[]>;
  getBulletinPosts(boardId: string, postTypeId?: number, currentUserId?: string): Promise<(BulletinPost & { author: User; postType: BulletinPostType; replyCount: number; reactionCount: number; userReacted: boolean })[]>;
  getBulletinPost(postId: string): Promise<(BulletinPost & { author: User; postType: BulletinPostType }) | undefined>;
  createBulletinPost(post: InsertBulletinPost): Promise<BulletinPost>;
  deleteBulletinPost(postId: string): Promise<void>;
  toggleBulletinPostPin(postId: string, userId?: string): Promise<BulletinPost | undefined>;
  getBulletinReplies(postId: string): Promise<(BulletinReply & { author: User })[]>;
  createBulletinReply(reply: InsertBulletinReply): Promise<BulletinReply>;
  getBulletinPostCount(bubbleId: string): Promise<number>;
  toggleBulletinReaction(postId: string, userId: string, emoji?: string): Promise<{ added: boolean; emoji: string }>;
  getBulletinPostReactionSummaries(postIds: string[], currentUserId?: string): Promise<Record<string, { reactions: { emoji: string; count: number }[]; userEmojis: string[] }>>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    const user = result[0];
    await db.update(users).set({ updatedBy: user.id }).where(eq(users.id, user.id));
    return { ...user, updatedBy: user.id };
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(memberships).where(eq(memberships.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getSuperAdmins(): Promise<User[]> {
    return db.select().from(users).where(eq(users.isSuperAdmin, true));
  }

  async getBubbles(): Promise<Bubble[]> {
    return db.select().from(bubbles)
      .where(and(eq(bubbles.status, 'approved'), isNull(bubbles.deletedAt)))
      .orderBy(desc(bubbles.createdAt));
  }

  async getBubble(id: string): Promise<Bubble | undefined> {
    const result = await db.select().from(bubbles).where(and(eq(bubbles.id, id), isNull(bubbles.deletedAt))).limit(1);
    return result[0];
  }

  async getBubbleByShortId(shortId: string): Promise<Bubble | undefined> {
    const result = await db.select().from(bubbles).where(and(eq(bubbles.shortId, shortId), isNull(bubbles.deletedAt))).limit(1);
    return result[0];
  }

  async backfillBubbleShortIds(): Promise<void> {
    const rows = await db.select({ id: bubbles.id }).from(bubbles).where(isNull(bubbles.shortId));
    for (const row of rows) {
      let shortId: string;
      let attempts = 0;
      do {
        shortId = generateShortId();
        const existing = await db.select().from(bubbles).where(eq(bubbles.shortId, shortId)).limit(1);
        if (existing.length === 0) break;
        attempts++;
      } while (attempts < 10);
      await db.update(bubbles).set({ shortId }).where(eq(bubbles.id, row.id));
    }
    if (rows.length > 0) {
      console.log(`Backfilled shortIds for ${rows.length} bubbles`);
    }
  }

  async createBubble(insertBubble: InsertBubble): Promise<Bubble> {
    let shortId: string;
    let attempts = 0;
    do {
      shortId = generateShortId();
      const existing = await db.select().from(bubbles).where(eq(bubbles.shortId, shortId)).limit(1);
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < 10);

    const result = await db.insert(bubbles).values({ ...insertBubble, shortId }).returning();
    return result[0];
  }

  async updateBubble(id: string, data: Partial<InsertBubble>): Promise<Bubble | undefined> {
    const result = await db.update(bubbles).set(data).where(eq(bubbles.id, id)).returning();
    return result[0];
  }

  async deleteBubble(id: string): Promise<void> {
    await db.update(bubbles)
      .set({ deletedAt: new Date() })
      .where(eq(bubbles.id, id));
  }

  async updateBubbleMemberCount(id: string, delta: number): Promise<void> {
    const bubble = await this.getBubble(id);
    if (bubble) {
      await db.update(bubbles)
        .set({ members: bubble.members + delta })
        .where(eq(bubbles.id, id));
    }
  }

  async getPendingBubbles(): Promise<Bubble[]> {
    return db.select().from(bubbles)
      .where(and(eq(bubbles.status, 'pending'), isNull(bubbles.deletedAt)))
      .orderBy(desc(bubbles.createdAt));
  }

  async approveBubble(id: string): Promise<Bubble | undefined> {
    const result = await db.update(bubbles)
      .set({ status: 'approved', rejectionReason: null })
      .where(eq(bubbles.id, id))
      .returning();
    
    const approvedBubble = result[0];
    
    // When bubble is approved, make the creator an admin member
    if (approvedBubble && approvedBubble.creatorId) {
      // Check if membership already exists (shouldn't, but be safe)
      const alreadyMember = await this.isMember(approvedBubble.creatorId, id);
      
      if (!alreadyMember) {
        // Use existing method to create membership with proper role and count update
        await this.createMembershipWithRole({
          userId: approvedBubble.creatorId,
          bubbleId: id,
        }, 'admin');
      }
    }
    
    return approvedBubble;
  }

  async rejectBubble(id: string, reason?: string): Promise<Bubble | undefined> {
    const result = await db.update(bubbles)
      .set({ status: 'rejected', rejectionReason: reason || null })
      .where(eq(bubbles.id, id))
      .returning();
    return result[0];
  }

  async getUserMemberships(userId: string): Promise<(Membership & { bubble: Bubble })[]> {
    const result = await db
      .select()
      .from(memberships)
      .innerJoin(bubbles, eq(memberships.bubbleId, bubbles.id))
      .where(and(eq(memberships.userId, userId), eq(memberships.membershipStatus, 'approved'), isNull(bubbles.deletedAt)))
      .orderBy(desc(memberships.joinedAt));

    return result.map((row) => ({
      ...row.memberships,
      bubble: row.bubbles,
    }));
  }

  async getBubbleMemberships(bubbleId: string): Promise<Membership[]> {
    return db.select().from(memberships).where(
      and(eq(memberships.bubbleId, bubbleId), eq(memberships.membershipStatus, 'approved'))
    );
  }

  async getBubbleMembersWithUsers(bubbleId: string): Promise<(Membership & { user: User })[]> {
    const result = await db
      .select()
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(and(eq(memberships.bubbleId, bubbleId), eq(memberships.membershipStatus, 'approved')))
      .orderBy(desc(memberships.joinedAt));

    return result.map((row) => ({
      ...row.memberships,
      user: row.users,
    }));
  }

  async getPendingJoinRequests(bubbleId: string): Promise<(Membership & { user: User })[]> {
    const result = await db
      .select()
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(and(eq(memberships.bubbleId, bubbleId), eq(memberships.membershipStatus, 'pending')))
      .orderBy(desc(memberships.joinedAt));

    return result.map((row) => ({
      ...row.memberships,
      user: row.users,
    }));
  }

  async createMembership(insertMembership: InsertMembership): Promise<Membership> {
    const result = await db.insert(memberships).values(insertMembership).returning();
    await this.updateBubbleMemberCount(insertMembership.bubbleId, 1);
    return result[0];
  }

  async createMembershipWithRole(insertMembership: InsertMembership, role: string): Promise<Membership> {
    const result = await db.insert(memberships).values({ ...insertMembership, role }).returning();
    await this.updateBubbleMemberCount(insertMembership.bubbleId, 1);
    return result[0];
  }

  async createMembershipWithStatus(insertMembership: InsertMembership, status: string): Promise<Membership> {
    const result = await db.insert(memberships).values({ ...insertMembership, membershipStatus: status }).returning();
    if (status === 'approved') {
      await this.updateBubbleMemberCount(insertMembership.bubbleId, 1);
    }
    return result[0];
  }

  async approveMembership(userId: string, bubbleId: string): Promise<Membership | undefined> {
    const result = await db.update(memberships)
      .set({ membershipStatus: 'approved' })
      .where(and(eq(memberships.userId, userId), eq(memberships.bubbleId, bubbleId)))
      .returning();
    if (result[0]) {
      await this.updateBubbleMemberCount(bubbleId, 1);
    }
    return result[0];
  }

  async rejectMembership(userId: string, bubbleId: string): Promise<void> {
    await db.delete(memberships).where(
      and(eq(memberships.userId, userId), eq(memberships.bubbleId, bubbleId))
    );
  }

  async getMembershipStatus(userId: string, bubbleId: string): Promise<string | null> {
    const result = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.bubbleId, bubbleId)))
      .limit(1);
    return result[0]?.membershipStatus || null;
  }

  async deleteMembership(userId: string, bubbleId: string): Promise<void> {
    const existing = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.bubbleId, bubbleId)))
      .limit(1);
    await db.delete(memberships).where(
      and(eq(memberships.userId, userId), eq(memberships.bubbleId, bubbleId))
    );
    if (existing[0]?.membershipStatus === 'approved') {
      await this.updateBubbleMemberCount(bubbleId, -1);
    }
  }

  async isMember(userId: string, bubbleId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(memberships)
      .where(and(
        eq(memberships.userId, userId),
        eq(memberships.bubbleId, bubbleId),
        eq(memberships.membershipStatus, 'approved')
      ))
      .limit(1);
    return result.length > 0;
  }

  async hasAnyMembership(userId: string, bubbleId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.bubbleId, bubbleId)))
      .limit(1);
    return result.length > 0;
  }

  async getMemberRole(userId: string, bubbleId: string): Promise<string | null> {
    const result = await db
      .select()
      .from(memberships)
      .where(and(
        eq(memberships.userId, userId),
        eq(memberships.bubbleId, bubbleId),
        eq(memberships.membershipStatus, 'approved')
      ))
      .limit(1);
    return result[0]?.role || null;
  }

  async updateMemberRole(userId: string, bubbleId: string, role: string): Promise<void> {
    await db.update(memberships)
      .set({ role })
      .where(and(eq(memberships.userId, userId), eq(memberships.bubbleId, bubbleId)));
  }

  async createVerificationCode(data: InsertVerificationCode): Promise<VerificationCode> {
    const result = await db.insert(verificationCodes).values(data).returning();
    return result[0];
  }

  async getValidVerificationCode(email: string, code: string): Promise<VerificationCode | undefined> {
    const now = new Date();
    const result = await db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.email, email),
          eq(verificationCodes.code, code),
          eq(verificationCodes.used, false)
        )
      )
      .limit(1);
    
    const verificationCode = result[0];
    if (verificationCode && new Date(verificationCode.expiresAt) > now) {
      return verificationCode;
    }
    return undefined;
  }

  async markCodeAsUsed(id: string): Promise<void> {
    await db.update(verificationCodes).set({ used: true }).where(eq(verificationCodes.id, id));
  }

  // Events
  async getEvent(id: string): Promise<Event | undefined> {
    const result = await db.select().from(events).where(eq(events.id, id)).limit(1);
    return result[0];
  }

  async getBubbleEvents(bubbleId: string): Promise<Event[]> {
    const today = new Date().toISOString().split('T')[0];
    return db
      .select()
      .from(events)
      .where(and(
        eq(events.bubbleId, bubbleId),
        eq(events.status, 'approved'),
        gte(events.date, today)
      ))
      .orderBy(events.date, events.startTime);
  }

  async getAllPublicEvents(): Promise<(Event & { bubble: Bubble })[]> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db
      .select()
      .from(events)
      .innerJoin(bubbles, eq(events.bubbleId, bubbles.id))
      .where(and(
        eq(events.visibility, 'public'),
        eq(events.status, 'approved'),
        gte(events.date, today),
        isNull(bubbles.deletedAt)
      ))
      .orderBy(events.date, events.startTime);
    
    return result.map((row) => ({ ...row.events, bubble: row.bubbles }));
  }

  async getUserEvents(userId: string): Promise<(Event & { bubble: Bubble })[]> {
    // Get events user is attending or created
    const attending = await db
      .select()
      .from(eventAttendees)
      .innerJoin(events, eq(eventAttendees.eventId, events.id))
      .innerJoin(bubbles, eq(events.bubbleId, bubbles.id))
      .where(and(eq(eventAttendees.userId, userId), isNull(bubbles.deletedAt)))
      .orderBy(events.date, events.startTime);

    const created = await db
      .select()
      .from(events)
      .innerJoin(bubbles, eq(events.bubbleId, bubbles.id))
      .where(and(eq(events.creatorId, userId), isNull(bubbles.deletedAt)))
      .orderBy(events.date, events.startTime);

    const eventMap = new Map<string, Event & { bubble: Bubble }>();
    
    for (const row of attending) {
      eventMap.set(row.events.id, { ...row.events, bubble: row.bubbles });
    }
    for (const row of created) {
      eventMap.set(row.events.id, { ...row.events, bubble: row.bubbles });
    }

    return Array.from(eventMap.values()).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });
  }

  async getUserCreatedEvents(userId: string): Promise<(Event & { bubble: Bubble })[]> {
    const result = await db
      .select()
      .from(events)
      .innerJoin(bubbles, eq(events.bubbleId, bubbles.id))
      .where(and(eq(events.creatorId, userId), isNull(bubbles.deletedAt)))
      .orderBy(events.date, events.startTime);

    return result.map(row => ({ ...row.events, bubble: row.bubbles }));
  }

  async getUserCreatedBubbles(userId: string): Promise<Bubble[]> {
    return db
      .select()
      .from(bubbles)
      .where(and(eq(bubbles.creatorId, userId), isNull(bubbles.deletedAt)))
      .orderBy(desc(bubbles.createdAt));
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const result = await db.insert(events).values(insertEvent).returning();
    return result[0];
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    const result = await db.update(events).set(updates).where(eq(events.id, id)).returning();
    return result[0];
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(eventAttendees).where(eq(eventAttendees.eventId, id));
    await db.delete(events).where(eq(events.id, id));
  }

  async getPendingEventsForBubble(bubbleId: string): Promise<Event[]> {
    return db.select().from(events)
      .where(and(eq(events.bubbleId, bubbleId), eq(events.status, 'pending')))
      .orderBy(desc(events.createdAt));
  }

  async getPendingEventsForAdmin(userId: string): Promise<(Event & { bubble: Bubble })[]> {
    // Get bubbles where user is admin/creator
    const userBubbles = await db.select({ id: bubbles.id })
      .from(bubbles)
      .where(and(eq(bubbles.creatorId, userId), isNull(bubbles.deletedAt)));
    
    if (userBubbles.length === 0) return [];

    const bubbleIds = userBubbles.map(b => b.id);
    const result = await db.select()
      .from(events)
      .innerJoin(bubbles, eq(events.bubbleId, bubbles.id))
      .where(and(
        eq(events.status, 'pending'),
        sql`${events.bubbleId} = ANY(ARRAY[${sql.join(bubbleIds.map(id => sql`${id}`), sql`, `)}]::varchar[])`
      ))
      .orderBy(desc(events.createdAt));

    return result.map(row => ({ ...row.events, bubble: row.bubbles }));
  }

  async approveEvent(id: string): Promise<Event | undefined> {
    const result = await db.update(events)
      .set({ status: 'approved', rejectionReason: null })
      .where(eq(events.id, id))
      .returning();
    return result[0];
  }

  async rejectEvent(id: string, reason?: string): Promise<Event | undefined> {
    const result = await db.update(events)
      .set({ status: 'rejected', rejectionReason: reason || null })
      .where(eq(events.id, id))
      .returning();
    return result[0];
  }

  // Event Attendees
  async getEventAttendees(eventId: string): Promise<EventAttendee[]> {
    return db.select().from(eventAttendees).where(eq(eventAttendees.eventId, eventId));
  }

  async getEventAttendeesWithUsers(eventId: string): Promise<(EventAttendee & { user: User })[]> {
    const result = await db
      .select()
      .from(eventAttendees)
      .innerJoin(users, eq(eventAttendees.userId, users.id))
      .where(eq(eventAttendees.eventId, eventId));
    return result.map(r => ({
      ...r.event_attendees,
      user: r.users,
    }));
  }

  async isEventAttendee(userId: string, eventId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(eventAttendees)
      .where(and(eq(eventAttendees.userId, userId), eq(eventAttendees.eventId, eventId)))
      .limit(1);
    return result.length > 0;
  }

  async getEventAttendee(userId: string, eventId: string): Promise<EventAttendee | undefined> {
    const result = await db
      .select()
      .from(eventAttendees)
      .where(and(eq(eventAttendees.userId, userId), eq(eventAttendees.eventId, eventId)))
      .limit(1);
    return result[0];
  }

  async createEventAttendee(insertAttendee: InsertEventAttendee): Promise<EventAttendee> {
    const result = await db.insert(eventAttendees).values(insertAttendee).returning();
    return result[0];
  }

  async updateEventAttendeeStatus(userId: string, eventId: string, status: string): Promise<EventAttendee | undefined> {
    const result = await db.update(eventAttendees)
      .set({ status })
      .where(and(eq(eventAttendees.userId, userId), eq(eventAttendees.eventId, eventId)))
      .returning();
    return result[0];
  }

  async deleteEventAttendee(userId: string, eventId: string): Promise<void> {
    await db.delete(eventAttendees).where(
      and(eq(eventAttendees.userId, userId), eq(eventAttendees.eventId, eventId))
    );
  }

  async getFirstWaitlistedAttendee(eventId: string): Promise<EventAttendee | undefined> {
    const result = await db
      .select()
      .from(eventAttendees)
      .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.status, 'waitlisted')))
      .orderBy(eventAttendees.joinedAt)
      .limit(1);
    return result[0];
  }

  async getGoingCount(eventId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventAttendees)
      .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.status, 'going')));
    return result[0]?.count || 0;
  }

  async getWaitlistCount(eventId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventAttendees)
      .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.status, 'waitlisted')));
    return result[0]?.count || 0;
  }

  async getEventsNeedingReminder(type: '24h' | '1h'): Promise<Event[]> {
    const now = new Date();
    const col = type === '24h' ? events.reminder24hSent : events.reminder1hSent;
    const hoursAhead = type === '24h' ? 24 : 1;
    const windowEnd = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    const allEvents = await db.select().from(events)
      .where(and(eq(events.status, 'approved'), eq(col, false)));
    return allEvents.filter(e => {
      const eventDateTime = new Date(`${e.date}T${e.startTime}:00`);
      return eventDateTime > now && eventDateTime <= windowEnd;
    });
  }

  async markReminderSent(eventId: string, type: '24h' | '1h'): Promise<void> {
    const col = type === '24h' ? { reminder24hSent: true } : { reminder1hSent: true };
    await db.update(events).set(col).where(eq(events.id, eventId));
  }

  async getEventGoingAttendeeIds(eventId: string): Promise<string[]> {
    const attendees = await db.select({ userId: eventAttendees.userId })
      .from(eventAttendees)
      .where(and(eq(eventAttendees.eventId, eventId), eq(eventAttendees.status, 'going')));
    return attendees.map(a => a.userId);
  }

  // Campus methods
  async getCampuses(): Promise<Campus[]> {
    return db.select().from(campuses).orderBy(campuses.title);
  }

  async getCampus(id: string): Promise<Campus | undefined> {
    const result = await db.select().from(campuses).where(eq(campuses.id, id)).limit(1);
    return result[0];
  }

  async getCampusByDomain(domain: string): Promise<Campus | undefined> {
    const result = await db.select().from(campuses).where(eq(campuses.domain, domain.toLowerCase())).limit(1);
    return result[0];
  }

  async createCampus(insertCampus: InsertCampus): Promise<Campus> {
    const result = await db.insert(campuses).values({
      ...insertCampus,
      domain: insertCampus.domain.toLowerCase(),
    }).returning();
    return result[0];
  }

  async updateUserCampus(userId: string, campusId: string, campusEmail: string, verified: boolean): Promise<void> {
    await db.update(users).set({
      campusId,
      campusEmail,
      campusVerified: verified,
      updatedAt: new Date(),
      updatedBy: userId,
    }).where(eq(users.id, userId));
  }

  async dismissCampusPrompt(userId: string): Promise<void> {
    await db.update(users).set({
      dismissedCampusPrompt: true,
      updatedAt: new Date(),
      updatedBy: userId,
    }).where(eq(users.id, userId));
  }

  async getRealMemberCount(bubbleId: string): Promise<number> {
    const result = await db.select({ count: count() }).from(memberships)
      .where(and(eq(memberships.bubbleId, bubbleId), eq(memberships.membershipStatus, 'approved')));
    return result[0]?.count || 0;
  }

  async attachRealMemberCounts(bubbleList: Bubble[]): Promise<Bubble[]> {
    const counts = await Promise.all(bubbleList.map(b => this.getRealMemberCount(b.id)));
    return bubbleList.map((b, i) => ({ ...b, members: counts[i] }));
  }

  async getPublicBubbles(): Promise<Bubble[]> {
    const result = await db.select().from(bubbles)
      .where(and(isNull(bubbles.campusId), eq(bubbles.status, 'approved'), ne(bubbles.privacy, 'Private'), isNull(bubbles.deletedAt)))
      .orderBy(desc(bubbles.createdAt));
    return this.attachRealMemberCounts(result);
  }

  async getCampusBubbles(campusId: string): Promise<Bubble[]> {
    const result = await db.select().from(bubbles)
      .where(and(eq(bubbles.campusId, campusId), eq(bubbles.status, 'approved'), isNull(bubbles.deletedAt)))
      .orderBy(desc(bubbles.createdAt));
    return this.attachRealMemberCounts(result);
  }

  async getPublicEvents(): Promise<(Event & { bubble: Bubble })[]> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db
      .select()
      .from(events)
      .innerJoin(bubbles, eq(events.bubbleId, bubbles.id))
      .where(and(
        isNull(events.campusId),
        eq(events.visibility, 'public'),
        eq(events.status, 'approved'),
        ne(bubbles.privacy, 'Private'),
        gte(events.date, today),
        isNull(bubbles.deletedAt)
      ))
      .orderBy(events.date, events.startTime);

    return result.map(row => ({
      ...row.events,
      bubble: row.bubbles,
    }));
  }

  async getUpcomingEvents(): Promise<(Event & { bubble: Bubble })[]> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db
      .select()
      .from(events)
      .innerJoin(bubbles, eq(events.bubbleId, bubbles.id))
      .where(and(
        isNull(events.campusId),
        eq(events.visibility, 'public'),
        eq(events.status, 'approved'),
        ne(bubbles.privacy, 'Private'),
        gte(events.date, today),
        isNull(bubbles.deletedAt)
      ))
      .orderBy(events.date, events.startTime);

    return result.map(row => ({
      ...row.events,
      bubble: row.bubbles,
    }));
  }

  async getCampusEvents(campusId: string): Promise<(Event & { bubble: Bubble })[]> {
    const result = await db
      .select()
      .from(events)
      .innerJoin(bubbles, eq(events.bubbleId, bubbles.id))
      .where(and(eq(events.campusId, campusId), eq(events.status, 'approved'), isNull(bubbles.deletedAt)))
      .orderBy(desc(events.createdAt));

    return result.map(row => ({
      ...row.events,
      bubble: row.bubbles,
    }));
  }

  // Analytics methods
  async createSession(userId: string): Promise<UserSession> {
    const result = await db.insert(userSessions).values({ userId }).returning();
    return result[0];
  }

  async endSession(sessionId: string, userId: string): Promise<UserSession | undefined> {
    const session = await db.select().from(userSessions)
      .where(and(eq(userSessions.id, sessionId), eq(userSessions.userId, userId)))
      .limit(1);
    if (!session[0]) return undefined;

    const endedAt = new Date();
    const startedAt = new Date(session[0].startedAt);
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    const result = await db.update(userSessions)
      .set({ endedAt, durationSeconds })
      .where(eq(userSessions.id, sessionId))
      .returning();
    return result[0];
  }

  async getRetentionMetrics(): Promise<{ day1: number; day7: number; day30: number }> {
    const now = new Date();
    const day1Ago = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get users who signed up before each period
    const allUsers = await db.select().from(users);
    
    // Users who have sessions after their signup + N days
    const calculateRetention = async (daysAgo: Date, dayOffset: number) => {
      const cutoffDate = new Date(daysAgo.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const eligibleUsers = allUsers.filter(u => new Date(u.createdAt) <= cutoffDate);
      if (eligibleUsers.length === 0) return 0;

      let returnedCount = 0;
      for (const user of eligibleUsers) {
        const userSignupPlusN = new Date(new Date(user.createdAt).getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const sessions = await db.select().from(userSessions)
          .where(and(
            eq(userSessions.userId, user.id),
            gte(userSessions.startedAt, userSignupPlusN)
          ))
          .limit(1);
        if (sessions.length > 0) returnedCount++;
      }
      return eligibleUsers.length > 0 ? Math.round((returnedCount / eligibleUsers.length) * 100) : 0;
    };

    const day1 = await calculateRetention(day1Ago, 1);
    const day7 = await calculateRetention(day7Ago, 7);
    const day30 = await calculateRetention(day30Ago, 30);

    return { day1, day7, day30 };
  }

  async getDauMauMetrics(): Promise<{ dau: number; mau: number; stickiness: number; dailyData: { date: string; dau: number }[] }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // DAU - unique users with sessions today
    const dauResult = await db.selectDistinct({ userId: userSessions.userId })
      .from(userSessions)
      .where(gte(userSessions.startedAt, yesterday));
    const dau = dauResult.length;

    // MAU - unique users with sessions in last 30 days
    const mauResult = await db.selectDistinct({ userId: userSessions.userId })
      .from(userSessions)
      .where(gte(userSessions.startedAt, thirtyDaysAgo));
    const mau = mauResult.length;

    const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

    // Daily DAU for chart (last 14 days)
    const dailyData: { date: string; dau: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const dayUsers = await db.selectDistinct({ userId: userSessions.userId })
        .from(userSessions)
        .where(and(
          gte(userSessions.startedAt, dayStart),
          lt(userSessions.startedAt, dayEnd)
        ));
      dailyData.push({
        date: dayStart.toISOString().split('T')[0],
        dau: dayUsers.length,
      });
    }

    return { dau, mau, stickiness, dailyData };
  }

  async getAverageSessionLength(): Promise<{ averageSeconds: number; dailyData: { date: string; avgSeconds: number }[] }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Overall average
    const sessions = await db.select().from(userSessions)
      .where(and(
        gte(userSessions.durationSeconds, 0),
        gte(userSessions.startedAt, new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000))
      ));
    
    const totalDuration = sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    const averageSeconds = sessions.length > 0 ? Math.round(totalDuration / sessions.length) : 0;

    // Daily averages for chart (last 14 days)
    const dailyData: { date: string; avgSeconds: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const daySessions = await db.select().from(userSessions)
        .where(and(
          gte(userSessions.startedAt, dayStart),
          lt(userSessions.startedAt, dayEnd),
          gte(userSessions.durationSeconds, 0)
        ));
      
      const dayTotal = daySessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
      dailyData.push({
        date: dayStart.toISOString().split('T')[0],
        avgSeconds: daySessions.length > 0 ? Math.round(dayTotal / daySessions.length) : 0,
      });
    }

    return { averageSeconds, dailyData };
  }

  async getSessionsPerUser(): Promise<{ daily: number; weekly: number; dailyData: { date: string; sessionsPerUser: number }[] }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Daily sessions per user
    const dailySessions = await db.select().from(userSessions)
      .where(gte(userSessions.startedAt, yesterday));
    const dailyUsers = await db.selectDistinct({ userId: userSessions.userId })
      .from(userSessions)
      .where(gte(userSessions.startedAt, yesterday));
    const daily = dailyUsers.length > 0 ? Math.round((dailySessions.length / dailyUsers.length) * 10) / 10 : 0;

    // Weekly sessions per user
    const weeklySessions = await db.select().from(userSessions)
      .where(gte(userSessions.startedAt, weekAgo));
    const weeklyUsers = await db.selectDistinct({ userId: userSessions.userId })
      .from(userSessions)
      .where(gte(userSessions.startedAt, weekAgo));
    const weekly = weeklyUsers.length > 0 ? Math.round((weeklySessions.length / weeklyUsers.length) * 10) / 10 : 0;

    // Daily data for chart (last 14 days)
    const dailyData: { date: string; sessionsPerUser: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const daySessions = await db.select().from(userSessions)
        .where(and(
          gte(userSessions.startedAt, dayStart),
          lt(userSessions.startedAt, dayEnd)
        ));
      const dayUsers = await db.selectDistinct({ userId: userSessions.userId })
        .from(userSessions)
        .where(and(
          gte(userSessions.startedAt, dayStart),
          lt(userSessions.startedAt, dayEnd)
        ));
      
      dailyData.push({
        date: dayStart.toISOString().split('T')[0],
        sessionsPerUser: dayUsers.length > 0 ? Math.round((daySessions.length / dayUsers.length) * 10) / 10 : 0,
      });
    }

    return { daily, weekly, dailyData };
  }

  async getOverviewMetrics(): Promise<{ totalUsers: number; totalBubbles: number; totalEvents: number; totalSessions: number }> {
    const usersResult = await db.select({ count: count() }).from(users);
    const bubblesResult = await db.select({ count: count() }).from(bubbles).where(isNull(bubbles.deletedAt));
    const eventsResult = await db.select({ count: count() }).from(events);
    const sessionsResult = await db.select({ count: count() }).from(userSessions);

    return {
      totalUsers: usersResult[0]?.count || 0,
      totalBubbles: bubblesResult[0]?.count || 0,
      totalEvents: eventsResult[0]?.count || 0,
      totalSessions: sessionsResult[0]?.count || 0,
    };
  }

  async trackBubbleVisit(bubbleId: string, userId?: string): Promise<BubbleVisit> {
    const result = await db.insert(bubbleVisits).values({ 
      bubbleId, 
      userId: userId || null 
    }).returning();
    return result[0];
  }

  async getBubbleVisitsMetrics(): Promise<{ topBubbles: { bubbleId: string; title: string; visits: number }[]; totalVisits: number; dailyData: { date: string; visits: number }[] }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total visits
    const totalResult = await db.select({ count: count() }).from(bubbleVisits);
    const totalVisits = totalResult[0]?.count || 0;

    // Top bubbles by visits
    const allVisits = await db.select().from(bubbleVisits)
      .where(gte(bubbleVisits.visitedAt, thirtyDaysAgo));
    
    const visitCounts: Record<string, number> = {};
    for (const visit of allVisits) {
      visitCounts[visit.bubbleId] = (visitCounts[visit.bubbleId] || 0) + 1;
    }

    const sortedBubbleIds = Object.entries(visitCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topBubbles: { bubbleId: string; title: string; visits: number }[] = [];
    for (const [bubbleId, visits] of sortedBubbleIds) {
      const bubble = await db.select().from(bubbles).where(eq(bubbles.id, bubbleId)).limit(1);
      topBubbles.push({
        bubbleId,
        title: bubble[0]?.title || 'Unknown',
        visits,
      });
    }

    // Daily visits for chart (last 14 days)
    const dailyData: { date: string; visits: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const dayVisits = await db.select({ count: count() }).from(bubbleVisits)
        .where(and(
          gte(bubbleVisits.visitedAt, dayStart),
          lt(bubbleVisits.visitedAt, dayEnd)
        ));
      
      dailyData.push({
        date: dayStart.toISOString().split('T')[0],
        visits: dayVisits[0]?.count || 0,
      });
    }

    return { topBubbles, totalVisits, dailyData };
  }

  async getCategories(): Promise<Category[]> {
    return db.select().from(categories).orderBy(categories.name);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return result[0];
  }

  async getCategoriesByIds(ids: number[]): Promise<Category[]> {
    if (ids.length === 0) return [];
    return db.select().from(categories).where(inArray(categories.id, ids));
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    const result = await db.insert(categories).values(data).returning();
    return result[0];
  }

  async updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const result = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
    return result[0];
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.parentId, id));
    await db.delete(categories).where(eq(categories.id, id));
  }

  async createReport(report: InsertReport): Promise<Report> {
    const result = await db.insert(reports).values(report).returning();
    return result[0];
  }

  async getReport(id: string): Promise<Report | undefined> {
    const result = await db.select().from(reports).where(eq(reports.id, id));
    return result[0];
  }

  async getReportsForBubble(bubbleId: string): Promise<(Report & { reporter: User; reportedUser?: User })[]> {
    const result = await db.select().from(reports)
      .where(and(
        eq(reports.bubbleId, bubbleId),
        or(
          eq(reports.reportType, 'individual'),
          and(eq(reports.reportType, 'bubble'), or(eq(reports.visibleTo, 'bubble_admin'), eq(reports.visibleTo, 'both'))),
          and(eq(reports.reportType, 'event'), or(eq(reports.visibleTo, 'bubble_admin'), eq(reports.visibleTo, 'both')))
        )
      ))
      .orderBy(desc(reports.createdAt));
    const enriched = await Promise.all(result.map(async (r) => {
      const reporter = await this.getUser(r.reporterUserId);
      const reportedUser = r.reportedUserId ? await this.getUser(r.reportedUserId) : undefined;
      const bubble = await this.getBubble(r.bubbleId);
      return { ...r, reporter: reporter!, reportedUser, bubble: bubble! };
    }));
    return enriched;
  }

  async getReportsForSysAdmin(): Promise<(Report & { reporter: User; reportedUser?: User; bubble: Bubble })[]> {
    const result = await db.select().from(reports)
      .orderBy(desc(reports.createdAt));
    const enriched = await Promise.all(result.map(async (r) => {
      const reporter = await this.getUser(r.reporterUserId);
      const reportedUser = r.reportedUserId ? await this.getUser(r.reportedUserId) : undefined;
      const bubble = await this.getBubble(r.bubbleId);
      return { ...r, reporter: reporter!, reportedUser, bubble: bubble! };
    }));
    return enriched;
  }

  async updateReportStatus(id: string, status: string): Promise<Report | undefined> {
    const result = await db.update(reports).set({ status }).where(eq(reports.id, id)).returning();
    return result[0];
  }

  async createBubbleChat(bubbleId: string, cometChatGroupId: string): Promise<BubbleChat> {
    const result = await db.insert(bubbleChats).values({ bubbleId, cometChatGroupId, status: 'active' }).returning();
    return result[0];
  }

  async getBubbleChat(bubbleId: string): Promise<BubbleChat | undefined> {
    const result = await db.select().from(bubbleChats).where(eq(bubbleChats.bubbleId, bubbleId)).limit(1);
    return result[0];
  }

  async updateBubbleChatStatus(bubbleId: string, status: string): Promise<void> {
    await db.update(bubbleChats).set({ status }).where(eq(bubbleChats.bubbleId, bubbleId));
  }

  async createAdminMemberChat(bubbleId: string, memberId: string, cometChatGroupId: string, participantIds: string[]): Promise<AdminMemberChat> {
    const result = await db.insert(adminMemberChats).values({ bubbleId, memberId, cometChatGroupId, isAdminDm: true, participantIds, status: 'active' }).returning();
    return result[0];
  }

  async getAdminMemberChat(bubbleId: string, memberId: string): Promise<AdminMemberChat | undefined> {
    const result = await db.select().from(adminMemberChats)
      .where(and(eq(adminMemberChats.bubbleId, bubbleId), eq(adminMemberChats.memberId, memberId)))
      .limit(1);
    return result[0];
  }

  async getAdminMemberChatsForBubble(bubbleId: string): Promise<AdminMemberChat[]> {
    return db.select().from(adminMemberChats).where(eq(adminMemberChats.bubbleId, bubbleId));
  }

  async getActiveAdminMemberChatsForUser(userId: string, bubbleId: string): Promise<AdminMemberChat[]> {
    const chats = await db.select().from(adminMemberChats)
      .where(and(eq(adminMemberChats.bubbleId, bubbleId), eq(adminMemberChats.status, 'active')));
    return chats.filter(c => c.participantIds.includes(userId) || c.memberId === userId);
  }

  async updateAdminMemberChatStatus(bubbleId: string, memberId: string, status: string): Promise<void> {
    await db.update(adminMemberChats).set({ status })
      .where(and(eq(adminMemberChats.bubbleId, bubbleId), eq(adminMemberChats.memberId, memberId)));
  }

  async updateAdminMemberChatParticipants(chatId: string, participantIds: string[]): Promise<void> {
    await db.update(adminMemberChats).set({ participantIds })
      .where(eq(adminMemberChats.id, chatId));
  }

  async archiveAdminMemberChatsForBubble(bubbleId: string): Promise<void> {
    await db.update(adminMemberChats).set({ status: 'archived' }).where(eq(adminMemberChats.bubbleId, bubbleId));
  }

  async archiveAdminMemberChatsForMember(bubbleId: string, memberId: string): Promise<void> {
    await db.update(adminMemberChats).set({ status: 'archived' })
      .where(and(eq(adminMemberChats.bubbleId, bubbleId), eq(adminMemberChats.memberId, memberId)));
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(data).returning();
    return result[0];
  }

  async getNotifications(userId: string, lim = 50, offset = 0): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.recipientId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(lim)
      .offset(offset);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: count() }).from(notifications)
      .where(and(eq(notifications.recipientId, userId), eq(notifications.read, false)));
    return result[0]?.count ?? 0;
  }

  async markNotificationRead(id: string, userId: string): Promise<Notification | undefined> {
    const result = await db.update(notifications).set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.recipientId, userId)))
      .returning();
    return result[0];
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ read: true })
      .where(and(eq(notifications.recipientId, userId), eq(notifications.read, false)));
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    await db.delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.recipientId, userId)));
  }

  async upsertDevicePushToken(userId: string, token: string, platform: string): Promise<DevicePushToken> {
    const existing = await db.select().from(devicePushTokens)
      .where(and(eq(devicePushTokens.userId, userId), eq(devicePushTokens.token, token)))
      .limit(1);
    if (existing[0]) {
      const result = await db.update(devicePushTokens)
        .set({ platform, updatedAt: new Date() })
        .where(eq(devicePushTokens.id, existing[0].id))
        .returning();
      return result[0];
    }
    const result = await db.insert(devicePushTokens).values({ userId, token, platform }).returning();
    return result[0];
  }

  async getDevicePushTokens(userId: string): Promise<DevicePushToken[]> {
    return db.select().from(devicePushTokens).where(eq(devicePushTokens.userId, userId));
  }

  async deleteDevicePushToken(userId: string, token: string): Promise<void> {
    await db.delete(devicePushTokens)
      .where(and(eq(devicePushTokens.userId, userId), eq(devicePushTokens.token, token)));
  }

  async getBulletinBoard(bubbleId: string): Promise<BulletinBoard | undefined> {
    const result = await db.select().from(bulletinBoards).where(eq(bulletinBoards.bubbleId, bubbleId)).limit(1);
    return result[0];
  }

  async getBulletinBoardById(boardId: string): Promise<BulletinBoard | undefined> {
    const result = await db.select().from(bulletinBoards).where(eq(bulletinBoards.id, boardId)).limit(1);
    return result[0];
  }

  async getOrCreateBulletinBoard(bubbleId: string, userId?: string): Promise<BulletinBoard> {
    const existing = await this.getBulletinBoard(bubbleId);
    if (existing) return existing;
    const result = await db.insert(bulletinBoards).values({
      bubbleId,
      createdBy: userId || null,
      updatedBy: userId || null,
    }).returning();
    return result[0];
  }

  async getBulletinPostTypes(): Promise<BulletinPostType[]> {
    return db.select().from(bulletinPostTypes).orderBy(bulletinPostTypes.displayOrder);
  }

  async getBulletinPosts(boardId: string, postTypeId?: number, currentUserId?: string): Promise<(BulletinPost & { author: User; postType: BulletinPostType; replyCount: number; reactionCount: number; userReacted: boolean })[]> {
    const conditions = [eq(bulletinPosts.boardId, boardId)];
    if (postTypeId !== undefined) {
      conditions.push(eq(bulletinPosts.postTypeId, postTypeId));
    }

    const userReactedSql = currentUserId
      ? sql<boolean>`EXISTS(SELECT 1 FROM bulletin_post_reactions WHERE post_id = ${bulletinPosts.id} AND user_id = ${currentUserId})`
      : sql<boolean>`false`;

    const rows = await db
      .select({
        post: bulletinPosts,
        author: users,
        postType: bulletinPostTypes,
        replyCount: sql<number>`(SELECT COUNT(*) FROM bulletin_replies WHERE post_id = ${bulletinPosts.id})::int`,
        reactionCount: sql<number>`(SELECT COUNT(*) FROM bulletin_post_reactions WHERE post_id = ${bulletinPosts.id})::int`,
        userReacted: userReactedSql,
      })
      .from(bulletinPosts)
      .innerJoin(users, eq(bulletinPosts.authorId, users.id))
      .innerJoin(bulletinPostTypes, eq(bulletinPosts.postTypeId, bulletinPostTypes.id))
      .where(and(...conditions))
      .orderBy(desc(bulletinPosts.isPinned), desc(bulletinPosts.createdAt));

    return rows.map(r => ({
      ...r.post,
      author: r.author,
      postType: r.postType,
      replyCount: r.replyCount,
      reactionCount: r.reactionCount,
      userReacted: r.userReacted,
    }));
  }

  async getBulletinPost(postId: string): Promise<(BulletinPost & { author: User; postType: BulletinPostType }) | undefined> {
    const rows = await db
      .select({
        post: bulletinPosts,
        author: users,
        postType: bulletinPostTypes,
      })
      .from(bulletinPosts)
      .innerJoin(users, eq(bulletinPosts.authorId, users.id))
      .innerJoin(bulletinPostTypes, eq(bulletinPosts.postTypeId, bulletinPostTypes.id))
      .where(eq(bulletinPosts.id, postId))
      .limit(1);

    if (!rows[0]) return undefined;
    return { ...rows[0].post, author: rows[0].author, postType: rows[0].postType };
  }

  async createBulletinPost(post: InsertBulletinPost): Promise<BulletinPost> {
    const result = await db.insert(bulletinPosts).values({
      ...post,
      createdBy: post.authorId,
      updatedBy: post.authorId,
    }).returning();
    return result[0];
  }

  async deleteBulletinPost(postId: string): Promise<void> {
    await db.delete(bulletinPostReactions).where(eq(bulletinPostReactions.postId, postId));
    await db.delete(bulletinReplies).where(eq(bulletinReplies.postId, postId));
    await db.delete(bulletinPosts).where(eq(bulletinPosts.id, postId));
  }

  async toggleBulletinPostPin(postId: string, userId?: string): Promise<BulletinPost | undefined> {
    const post = await db.select().from(bulletinPosts).where(eq(bulletinPosts.id, postId)).limit(1);
    if (!post[0]) return undefined;
    const result = await db.update(bulletinPosts)
      .set({
        isPinned: !post[0].isPinned,
        updatedAt: new Date(),
        updatedBy: userId || null,
      })
      .where(eq(bulletinPosts.id, postId))
      .returning();
    return result[0];
  }

  async getBulletinReplies(postId: string): Promise<(BulletinReply & { author: User })[]> {
    const rows = await db
      .select({
        reply: bulletinReplies,
        author: users,
      })
      .from(bulletinReplies)
      .innerJoin(users, eq(bulletinReplies.authorId, users.id))
      .where(eq(bulletinReplies.postId, postId))
      .orderBy(bulletinReplies.createdAt);

    return rows.map(r => ({ ...r.reply, author: r.author }));
  }

  async createBulletinReply(reply: InsertBulletinReply): Promise<BulletinReply> {
    const result = await db.insert(bulletinReplies).values({
      ...reply,
      createdBy: reply.authorId,
      updatedBy: reply.authorId,
    }).returning();
    return result[0];
  }

  async getBulletinPostCount(bubbleId: string): Promise<number> {
    const board = await this.getBulletinBoard(bubbleId);
    if (!board) return 0;
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(bulletinPosts).where(eq(bulletinPosts.boardId, board.id));
    return result[0]?.count ?? 0;
  }

  async toggleBulletinReaction(postId: string, userId: string, emoji: string = 'heart'): Promise<{ added: boolean; emoji: string }> {
    const existing = await db
      .select()
      .from(bulletinPostReactions)
      .where(
        and(
          eq(bulletinPostReactions.postId, postId),
          eq(bulletinPostReactions.userId, userId),
          eq(bulletinPostReactions.emoji, emoji),
        )
      )
      .limit(1);

    if (existing[0]) {
      await db.delete(bulletinPostReactions).where(eq(bulletinPostReactions.id, existing[0].id));
      return { added: false, emoji };
    } else {
      await db.insert(bulletinPostReactions).values({ postId, userId, emoji });
      return { added: true, emoji };
    }
  }

  async getBulletinPostReactionSummaries(postIds: string[], currentUserId?: string): Promise<Record<string, { reactions: { emoji: string; count: number }[]; userEmojis: string[] }>> {
    if (postIds.length === 0) return {};

    const allReactions = await db
      .select({
        postId: bulletinPostReactions.postId,
        emoji: bulletinPostReactions.emoji,
        userId: bulletinPostReactions.userId,
      })
      .from(bulletinPostReactions)
      .where(inArray(bulletinPostReactions.postId, postIds));

    const result: Record<string, { reactions: { emoji: string; count: number }[]; userEmojis: string[] }> = {};

    for (const postId of postIds) {
      result[postId] = { reactions: [], userEmojis: [] };
    }

    const countsMap: Record<string, Record<string, number>> = {};
    for (const r of allReactions) {
      if (!countsMap[r.postId]) countsMap[r.postId] = {};
      countsMap[r.postId][r.emoji] = (countsMap[r.postId][r.emoji] || 0) + 1;
      if (currentUserId && r.userId === currentUserId) {
        if (!result[r.postId]) result[r.postId] = { reactions: [], userEmojis: [] };
        result[r.postId].userEmojis.push(r.emoji);
      }
    }

    for (const postId of Object.keys(countsMap)) {
      if (!result[postId]) result[postId] = { reactions: [], userEmojis: [] };
      result[postId].reactions = Object.entries(countsMap[postId])
        .map(([emoji, count]) => ({ emoji, count }))
        .sort((a, b) => b.count - a.count);
    }

    return result;
  }
}

export const storage = new DatabaseStorage();
