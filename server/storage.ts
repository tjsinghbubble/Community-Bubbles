import { eq, and, desc, lt, gte, or, isNull, ne, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { encryptField, hashField, safeDecryptField, decryptUserEmails } from "./encryption";
import { generateShortId } from "./shortId";
import {
  users,
  userProfiles,
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
  type UserProfile,
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
  appConfig,
  type AppConfig,
  rules,
  appRules,
  categoryRules,
  bubbleRules,
  bubbleRuleOverrides,
  type Rule,
  type AppRule,
  type CategoryRule,
  type BubbleRule,
  type BubbleRuleOverride,
  categoryPlaceholders,
  type CategoryPlaceholder,
  type InsertCategoryPlaceholder,
  auditLogs,
  type AuditLog,
  eventSignupTasks,
  eventTaskSignups,
  type EventSignupTask,
  type InsertEventSignupTask,
} from "@shared/schema";
import { count, avg } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<void>;
  incrementTokenVersion(id: string): Promise<void>;
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
  getWaitlistMembers(bubbleId: string): Promise<(Membership & { user: User })[]>;
  holdMembership(userId: string, bubbleId: string): Promise<Membership | undefined>;

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
  getTaskSignupsNeedingReminder(): Promise<{ signupId: number; userId: string; taskTitle: string; eventId: string; eventTitle: string; eventDate: string; eventStartTime: string; eventTimezone: string | null; bubbleId: string }[]>;
  markTaskSignupReminderSent(signupId: number): Promise<void>;

  // Campus
  getCampuses(): Promise<Campus[]>;
  getCampus(id: string): Promise<Campus | undefined>;
  getCampusByDomain(domain: string): Promise<Campus | undefined>;
  createCampus(campus: InsertCampus): Promise<Campus>;
  updateUserProfile(userId: string, updates: { profilePhoto?: string; name?: string; aboutMe?: string; interests?: string[] }): Promise<User | undefined>;
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
  getUserSessions(userId: string): Promise<UserSession[]>;
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

  // Category Placeholders
  getCategoryPlaceholders(categoryId: number): Promise<CategoryPlaceholder[]>;
  getAllCategoryPlaceholders(): Promise<CategoryPlaceholder[]>;
  createCategoryPlaceholder(data: InsertCategoryPlaceholder): Promise<CategoryPlaceholder>;
  updateCategoryPlaceholder(id: number, data: Partial<InsertCategoryPlaceholder>): Promise<CategoryPlaceholder | undefined>;
  deleteCategoryPlaceholder(id: number): Promise<void>;

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
  deleteStaleDevicePushTokens(olderThanDays?: number): Promise<number>;

  // Audit Logs
  insertAuditLog(entry: { action: string; adminId: string; targetId: string; ip?: string; extra?: string }): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;

  // Bulletin Boards
  getBulletinBoard(bubbleId: string): Promise<BulletinBoard | undefined>;
  getBulletinBoardById(boardId: string): Promise<BulletinBoard | undefined>;
  getOrCreateBulletinBoard(bubbleId: string, userId?: string): Promise<BulletinBoard>;
  getBulletinPostTypes(): Promise<BulletinPostType[]>;
  getBulletinPosts(boardId: string, postTypeId?: number, currentUserId?: string): Promise<(BulletinPost & { author: User; postType: BulletinPostType; replyCount: number; reactionCount: number; userReacted: boolean })[]>;
  getBulletinPost(postId: string): Promise<(BulletinPost & { author: User; postType: BulletinPostType }) | undefined>;
  createBulletinPost(post: InsertBulletinPost): Promise<BulletinPost>;
  updateBulletinPost(postId: string, data: { title?: string; body?: string; postTypeId?: number; imageUrl?: string | null }, userId?: string): Promise<BulletinPost | undefined>;
  deleteBulletinPost(postId: string): Promise<void>;
  toggleBulletinPostPin(postId: string, userId?: string): Promise<BulletinPost | undefined>;
  getBulletinReplies(postId: string): Promise<(BulletinReply & { author: User })[]>;
  createBulletinReply(reply: InsertBulletinReply): Promise<BulletinReply>;
  getBulletinPostCount(bubbleId: string): Promise<number>;
  toggleBulletinReaction(postId: string, userId: string, emoji?: string): Promise<{ added: boolean; emoji: string }>;
  getBulletinPostReactionSummaries(postIds: string[], currentUserId?: string): Promise<Record<string, { reactions: { emoji: string; count: number }[]; userEmojis: string[] }>>;

  getAppConfigValue(key: string): Promise<string | undefined>;
  getAllAppConfig(): Promise<AppConfig[]>;

  createRule(name: string, description: string): Promise<Rule>;
  getRule(id: number): Promise<Rule | undefined>;
  updateRule(id: number, name: string, description: string): Promise<Rule | undefined>;
  deleteRule(id: number): Promise<void>;

  getAppRules(): Promise<(AppRule & { rule: Rule })[]>;
  addAppRule(ruleId: number, position: number): Promise<AppRule>;
  removeAppRule(ruleId: number): Promise<void>;
  reorderAppRules(ruleIds: number[]): Promise<void>;

  getCategoryRules(categoryId: number): Promise<(CategoryRule & { rule: Rule })[]>;
  addCategoryRule(categoryId: number, ruleId: number, position: number): Promise<CategoryRule>;
  removeCategoryRule(categoryId: number, ruleId: number): Promise<void>;
  reorderCategoryRules(categoryId: number, ruleIds: number[]): Promise<void>;

  getBubbleRules(bubbleId: string): Promise<(BubbleRule & { rule: Rule })[]>;
  addBubbleRule(bubbleId: string, ruleId: number, position: number): Promise<BubbleRule>;
  removeBubbleRule(bubbleId: string, ruleId: number): Promise<void>;
  reorderBubbleRules(bubbleId: string, ruleIds: number[]): Promise<void>;

  getBubbleRuleOverrides(bubbleId: string): Promise<BubbleRuleOverride[]>;
  setBubbleRuleOverride(bubbleId: string, ruleId: number, hidden: boolean): Promise<BubbleRuleOverride>;
  removeBubbleRuleOverride(bubbleId: string, ruleId: number): Promise<void>;

  getEffectiveRules(bubbleId: string): Promise<{ level: string; ruleId: number; name: string; description: string; text: string; position: number; hidden: boolean }[]>;

  isBubbleRuleLinked(bubbleId: string, ruleId: number): Promise<boolean>;
  isCategoryRuleLinked(categoryId: number, ruleId: number): Promise<boolean>;
  isAppRuleLinked(ruleId: number): Promise<boolean>;
  isRuleReferenced(ruleId: number): Promise<boolean>;

  // Event Sign-Up Sheet
  getEventSignupTasks(eventId: string, currentUserId?: string): Promise<(EventSignupTask & { signupCount: number; hasSignedUp: boolean; signers: { id: string; name: string; profilePhoto: string | null }[] })[]>;
  getEventSignupTask(taskId: number): Promise<EventSignupTask | undefined>;
  createEventSignupTask(data: InsertEventSignupTask): Promise<EventSignupTask>;
  updateEventSignupTask(taskId: number, data: Partial<InsertEventSignupTask>): Promise<EventSignupTask | undefined>;
  deleteEventSignupTask(taskId: number): Promise<void>;
  reorderEventSignupTasks(eventId: string, taskIds: number[]): Promise<void>;
  joinEventSignupTask(taskId: number, userId: string): Promise<{ success: boolean; error?: string }>;
  leaveEventSignupTask(taskId: number, userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(users.id, id))
      .limit(1);
    if (!row) return undefined;
    const { userId: _uid, ...profileFields } = row.user_profiles ?? {};
    return decryptUserEmails({ ...row.users, ...profileFields } as User);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const hash = hashField(email);

    // Try hash lookup (post-migration users)
    let [row] = await db
      .select()
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(users.emailHash, hash))
      .limit(1);

    // Fallback: plaintext lookup for pre-migration users
    if (!row) {
      [row] = await db
        .select()
        .from(users)
        .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(eq(users.email, email))
        .limit(1);
    }

    if (!row) return undefined;
    const { userId: _uid, ...profileFields } = row.user_profiles ?? {};
    return decryptUserEmails({ ...row.users, ...profileFields } as User);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const encryptedEmail = encryptField(insertUser.email);
    const emailHash = hashField(insertUser.email);

    const result = await db
      .insert(users)
      .values({ ...insertUser, email: encryptedEmail, emailHash })
      .returning();
    const authUser = result[0];
    await db
      .update(users)
      .set({ updatedBy: authUser.id })
      .where(eq(users.id, authUser.id));

    // Sync profile data to user_profiles
    await db
      .insert(userProfiles)
      .values({
        userId: authUser.id,
        name: authUser.name,
        interests: authUser.interests,
        campusId: authUser.campusId,
        campusEmail: authUser.campusEmail,
        campusVerified: authUser.campusVerified,
        dismissedCampusPrompt: authUser.dismissedCampusPrompt,
        profilePhoto: authUser.profilePhoto,
        aboutMe: authUser.aboutMe,
      })
      .onConflictDoNothing();

    return decryptUserEmails({ ...authUser, updatedBy: authUser.id } as User);
  }

  async deleteUser(id: string): Promise<void> {
    // 1. Delete bulletin post reactions by user
    await db.delete(bulletinPostReactions).where(eq(bulletinPostReactions.userId, id));

    // 2. Delete bulletin replies authored by user
    await db.delete(bulletinReplies).where(eq(bulletinReplies.authorId, id));

    // 3. Delete bulletin posts authored by user (and their dependents first)
    const userPostIds = (
      await db.select({ id: bulletinPosts.id }).from(bulletinPosts).where(eq(bulletinPosts.authorId, id))
    ).map((p) => p.id);
    if (userPostIds.length > 0) {
      await db.delete(bulletinPostReactions).where(inArray(bulletinPostReactions.postId, userPostIds));
      await db.delete(bulletinReplies).where(inArray(bulletinReplies.postId, userPostIds));
      await db.delete(bulletinPosts).where(inArray(bulletinPosts.id, userPostIds));
    }

    // 4. Delete notifications sent to user
    await db.delete(notifications).where(eq(notifications.recipientId, id));

    // 5. Delete push tokens for user
    await db.delete(devicePushTokens).where(eq(devicePushTokens.userId, id));

    // 6. Delete sessions for user
    await db.delete(userSessions).where(eq(userSessions.userId, id));

    // 7. Delete bubble visits by user
    await db.delete(bubbleVisits).where(eq(bubbleVisits.userId, id));

    // 8. Delete event attendance by user
    await db.delete(eventAttendees).where(eq(eventAttendees.userId, id));

    // 9. Delete reports involving user
    await db.delete(reports).where(
      or(eq(reports.reporterUserId, id), eq(reports.reportedUserId, id))
    );

    // 10. Delete admin-member chat threads for user
    await db.delete(adminMemberChats).where(eq(adminMemberChats.memberId, id));

    // 11. Delete events created by user (and their attendees first)
    const userEventIds = (
      await db.select({ id: events.id }).from(events).where(eq(events.creatorId, id))
    ).map((e) => e.id);
    if (userEventIds.length > 0) {
      await db.delete(eventAttendees).where(inArray(eventAttendees.eventId, userEventIds));
      await db.delete(events).where(inArray(events.id, userEventIds));
    }

    // 12. Delete bubbles created by user and all their dependents
    const userBubbleIds = (
      await db.select({ id: bubbles.id }).from(bubbles).where(eq(bubbles.creatorId, id))
    ).map((b) => b.id);
    if (userBubbleIds.length > 0) {
      // Delete bulletin content in those bubbles
      const boardIds = (
        await db.select({ id: bulletinBoards.id }).from(bulletinBoards)
          .where(inArray(bulletinBoards.bubbleId, userBubbleIds))
      ).map((b) => b.id);
      if (boardIds.length > 0) {
        const boardPostIds = (
          await db.select({ id: bulletinPosts.id }).from(bulletinPosts)
            .where(inArray(bulletinPosts.boardId, boardIds))
        ).map((p) => p.id);
        if (boardPostIds.length > 0) {
          await db.delete(bulletinPostReactions).where(inArray(bulletinPostReactions.postId, boardPostIds));
          await db.delete(bulletinReplies).where(inArray(bulletinReplies.postId, boardPostIds));
          await db.delete(bulletinPosts).where(inArray(bulletinPosts.id, boardPostIds));
        }
        await db.delete(bulletinBoards).where(inArray(bulletinBoards.id, boardIds));
      }

      // Delete events in those bubbles and their attendees
      const bubbleEventIds = (
        await db.select({ id: events.id }).from(events)
          .where(inArray(events.bubbleId, userBubbleIds))
      ).map((e) => e.id);
      if (bubbleEventIds.length > 0) {
        await db.delete(eventAttendees).where(inArray(eventAttendees.eventId, bubbleEventIds));
        await db.delete(events).where(inArray(events.id, bubbleEventIds));
      }

      // Delete admin-member chats and memberships in those bubbles
      await db.delete(adminMemberChats).where(inArray(adminMemberChats.bubbleId, userBubbleIds));
      await db.delete(memberships).where(inArray(memberships.bubbleId, userBubbleIds));
      await db.delete(bubbleChats).where(inArray(bubbleChats.bubbleId, userBubbleIds));
      await db.delete(bubbles).where(inArray(bubbles.id, userBubbleIds));
    }

    // 13. Delete remaining memberships for user (in other bubbles)
    await db.delete(memberships).where(eq(memberships.userId, id));

    // 14. Set user as inactive (soft delete) instead of deleting the row
    await db.update(users)
      .set({ isActive: false, tokenVersion: sql`token_version + 1` })
      .where(eq(users.id, id));
  }

  async incrementTokenVersion(id: string): Promise<void> {
    await db.update(users).set({ tokenVersion: sql`token_version + 1` }).where(eq(users.id, id));
  }

  async getSuperAdmins(): Promise<User[]> {
    const rows = await db
      .select()
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(users.isSuperAdmin, true));
    return rows.map(row => {
      const { userId: _uid, ...profileFields } = row.user_profiles ?? {};
      return decryptUserEmails({ ...row.users, ...profileFields } as User);
    });
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
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(and(eq(memberships.bubbleId, bubbleId), eq(memberships.membershipStatus, 'approved')))
      .orderBy(desc(memberships.joinedAt));

    return result.map((row) => {
      const { userId: _uid, ...profileFields } = row.user_profiles ?? {};
      return {
        ...row.memberships,
        user: decryptUserEmails({ ...row.users, ...profileFields } as User),
      };
    });
  }

  async getPendingJoinRequests(bubbleId: string): Promise<(Membership & { user: User })[]> {
    const result = await db
      .select()
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(and(eq(memberships.bubbleId, bubbleId), eq(memberships.membershipStatus, 'pending')))
      .orderBy(desc(memberships.joinedAt));

    return result.map((row) => {
      const { userId: _uid, ...profileFields } = row.user_profiles ?? {};
      return {
        ...row.memberships,
        user: decryptUserEmails({ ...row.users, ...profileFields } as User),
      };
    });
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

  async getWaitlistMembers(bubbleId: string): Promise<(Membership & { user: User })[]> {
    const result = await db
      .select()
      .from(memberships)
      .leftJoin(users, eq(memberships.userId, users.id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(and(
        eq(memberships.bubbleId, bubbleId),
        sql`${memberships.membershipStatus} IN ('waitlisted', 'on_hold')`
      ))
      .orderBy(memberships.joinedAt);
    return result.map((row) => {
      const { userId: _uid, ...profileFields } = row.user_profiles ?? {};
      return {
        ...row.memberships,
        user: decryptUserEmails({ ...row.users, ...profileFields } as User),
      };
    });
  }

  async holdMembership(userId: string, bubbleId: string): Promise<Membership | undefined> {
    const result = await db.update(memberships)
      .set({ membershipStatus: 'on_hold' })
      .where(and(eq(memberships.userId, userId), eq(memberships.bubbleId, bubbleId)))
      .returning();
    return result[0];
  }

  async createVerificationCode(data: InsertVerificationCode): Promise<VerificationCode> {
    const normalizedEmail = data.email.toLowerCase().trim();
    const result = await db.insert(verificationCodes).values({
      ...data,
      email: encryptField(normalizedEmail),
      emailHash: hashField(normalizedEmail),
    }).returning();
    return result[0];
  }

  async getValidVerificationCode(email: string, code: string): Promise<VerificationCode | undefined> {
    const now = new Date();
    const hash = hashField(email.toLowerCase().trim());

    // Try hash lookup (post-migration)
    let result = await db
      .select()
      .from(verificationCodes)
      .where(
        and(
          eq(verificationCodes.emailHash, hash),
          eq(verificationCodes.code, code),
          eq(verificationCodes.used, false)
        )
      )
      .limit(1);

    // Fallback: plaintext lookup for pre-migration codes
    if (result.length === 0) {
      result = await db
        .select()
        .from(verificationCodes)
        .where(
          and(
            eq(verificationCodes.email, email.toLowerCase().trim()),
            eq(verificationCodes.code, code),
            eq(verificationCodes.used, false)
          )
        )
        .limit(1);
    }

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
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(eventAttendees.eventId, eventId));
    return result.map(r => {
      const { userId: _uid, ...profileFields } = r.user_profiles ?? {};
      return {
        ...r.event_attendees,
        user: decryptUserEmails({ ...r.users, ...profileFields } as User),
      };
    });
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

  async getTaskSignupsNeedingReminder(): Promise<{ signupId: number; userId: string; taskTitle: string; eventId: string; eventTitle: string; eventDate: string; eventStartTime: string; eventTimezone: string | null; bubbleId: string }[]> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        signupId: eventTaskSignups.id,
        userId: eventTaskSignups.userId,
        taskTitle: eventSignupTasks.title,
        eventId: events.id,
        eventTitle: events.title,
        eventDate: events.date,
        eventStartTime: events.startTime,
        eventTimezone: events.timezone,
        bubbleId: events.bubbleId,
      })
      .from(eventTaskSignups)
      .innerJoin(eventSignupTasks, eq(eventSignupTasks.id, eventTaskSignups.taskId))
      .innerJoin(events, eq(events.id, eventSignupTasks.eventId))
      .where(
        and(
          eq(eventTaskSignups.reminderSent, false),
          eq(events.status, 'approved'),
        ),
      );
    return rows.filter(r => {
      const eventDateTime = new Date(`${r.eventDate}T${r.eventStartTime}:00`);
      return eventDateTime > now && eventDateTime <= windowEnd;
    });
  }

  async markTaskSignupReminderSent(signupId: number): Promise<void> {
    await db.update(eventTaskSignups).set({ reminderSent: true }).where(eq(eventTaskSignups.id, signupId));
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

  async updateUserProfile(userId: string, updates: { profilePhoto?: string; name?: string; aboutMe?: string; interests?: string[] }): Promise<User | undefined> {
    // Fetch current row so we can upsert userProfiles with all required fields
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!currentUser) return undefined;

    // Upsert userProfiles (creates row if it doesn't exist yet)
    await db.insert(userProfiles).values({
      userId,
      name: updates.name ?? currentUser.name,
      interests: updates.interests ?? currentUser.interests,
      campusId: currentUser.campusId,
      campusEmail: currentUser.campusEmail,
      campusVerified: currentUser.campusVerified,
      dismissedCampusPrompt: currentUser.dismissedCampusPrompt,
      profilePhoto: updates.profilePhoto ?? currentUser.profilePhoto,
      aboutMe: updates.aboutMe ?? currentUser.aboutMe,
    }).onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.interests !== undefined && { interests: updates.interests }),
        ...(updates.profilePhoto !== undefined && { profilePhoto: updates.profilePhoto }),
        ...(updates.aboutMe !== undefined && { aboutMe: updates.aboutMe }),
      },
    });

    // Phase 1 dual-write: keep users table in sync
    const setObj: Record<string, any> = { updatedAt: new Date(), updatedBy: userId };
    if (updates.profilePhoto !== undefined) setObj.profilePhoto = updates.profilePhoto;
    if (updates.name !== undefined) setObj.name = updates.name;
    if (updates.aboutMe !== undefined) setObj.aboutMe = updates.aboutMe;
    if (updates.interests !== undefined) setObj.interests = updates.interests;
    await db.update(users).set(setObj).where(eq(users.id, userId));

    return this.getUser(userId);
  }

  async updateUserCampus(userId: string, campusId: string, campusEmail: string, verified: boolean): Promise<void> {
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!currentUser) return;

    const encryptedCampusEmail = encryptField(campusEmail.toLowerCase().trim());
    const campusEmailHash = hashField(campusEmail);

    await db
      .insert(userProfiles)
      .values({
        userId,
        name: currentUser.name,
        interests: currentUser.interests,
        campusId,
        campusEmail: encryptedCampusEmail,
        campusEmailHash,
        campusVerified: verified,
        dismissedCampusPrompt: currentUser.dismissedCampusPrompt,
        profilePhoto: currentUser.profilePhoto,
        aboutMe: currentUser.aboutMe,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { campusId, campusEmail: encryptedCampusEmail, campusEmailHash, campusVerified: verified },
      });

    // Phase 1 dual-write
    await db.update(users).set({
      campusId,
      campusEmail: encryptedCampusEmail,
      campusVerified: verified,
      updatedAt: new Date(),
      updatedBy: userId,
    }).where(eq(users.id, userId));
  }

  async dismissCampusPrompt(userId: string): Promise<void> {
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!currentUser) return;

    await db.insert(userProfiles).values({
      userId,
      name: currentUser.name,
      interests: currentUser.interests,
      campusId: currentUser.campusId,
      campusEmail: currentUser.campusEmail,
      campusVerified: currentUser.campusVerified,
      dismissedCampusPrompt: true,
      profilePhoto: currentUser.profilePhoto,
      aboutMe: currentUser.aboutMe,
    }).onConflictDoUpdate({
      target: userProfiles.userId,
      set: { dismissedCampusPrompt: true },
    });

    // Phase 1 dual-write
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
  async getUserSessions(userId: string): Promise<UserSession[]> {
    return db.select().from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.startedAt));
  }

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

  async getCategoryPlaceholders(categoryId: number): Promise<CategoryPlaceholder[]> {
    return db.select().from(categoryPlaceholders)
      .where(eq(categoryPlaceholders.categoryId, categoryId))
      .orderBy(categoryPlaceholders.fieldType, categoryPlaceholders.displayOrder);
  }

  async getAllCategoryPlaceholders(): Promise<CategoryPlaceholder[]> {
    return db.select().from(categoryPlaceholders)
      .orderBy(categoryPlaceholders.categoryId, categoryPlaceholders.fieldType, categoryPlaceholders.displayOrder);
  }

  async createCategoryPlaceholder(data: InsertCategoryPlaceholder): Promise<CategoryPlaceholder> {
    const result = await db.insert(categoryPlaceholders).values(data).returning();
    return result[0];
  }

  async updateCategoryPlaceholder(id: number, data: Partial<InsertCategoryPlaceholder>): Promise<CategoryPlaceholder | undefined> {
    const result = await db.update(categoryPlaceholders).set(data).where(eq(categoryPlaceholders.id, id)).returning();
    return result[0];
  }

  async deleteCategoryPlaceholder(id: number): Promise<void> {
    await db.delete(categoryPlaceholders).where(eq(categoryPlaceholders.id, id));
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

    // Clean up stale tokens for this user (older than 90 days) on each upsert
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await db.delete(devicePushTokens).where(
      and(eq(devicePushTokens.userId, userId), lt(devicePushTokens.updatedAt, cutoff))
    );

    return result[0];
  }

  async getDevicePushTokens(userId: string): Promise<DevicePushToken[]> {
    return db.select().from(devicePushTokens).where(eq(devicePushTokens.userId, userId));
  }

  async deleteDevicePushToken(userId: string, token: string): Promise<void> {
    await db.delete(devicePushTokens)
      .where(and(eq(devicePushTokens.userId, userId), eq(devicePushTokens.token, token)));
  }

  async deleteStaleDevicePushTokens(olderThanDays = 90): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await db.delete(devicePushTokens)
      .where(lt(devicePushTokens.updatedAt, cutoff))
      .returning({ id: devicePushTokens.id });
    return result.length;
  }

  async insertAuditLog(entry: { action: string; adminId: string; targetId: string; ip?: string; extra?: string }): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(entry).returning();
    return result[0];
  }

  async getAuditLogs(limit = 100): Promise<AuditLog[]> {
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
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
        authUser: users,
        profile: userProfiles,
        postType: bulletinPostTypes,
        replyCount: sql<number>`(SELECT COUNT(*) FROM bulletin_replies WHERE post_id = ${bulletinPosts.id})::int`,
        reactionCount: sql<number>`(SELECT COUNT(*) FROM bulletin_post_reactions WHERE post_id = ${bulletinPosts.id})::int`,
        userReacted: userReactedSql,
      })
      .from(bulletinPosts)
      .innerJoin(users, eq(bulletinPosts.authorId, users.id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .innerJoin(bulletinPostTypes, eq(bulletinPosts.postTypeId, bulletinPostTypes.id))
      .where(and(...conditions))
      .orderBy(desc(bulletinPosts.isPinned), desc(bulletinPosts.createdAt));

    return rows.map(r => {
      const { userId: _uid, ...profileFields } = r.profile ?? {};
      return {
        ...r.post,
        author: decryptUserEmails({ ...r.authUser, ...profileFields } as User),
        postType: r.postType,
        replyCount: r.replyCount,
        reactionCount: r.reactionCount,
        userReacted: r.userReacted,
      };
    });
  }

  async getBulletinPost(postId: string): Promise<(BulletinPost & { author: User; postType: BulletinPostType }) | undefined> {
    const rows = await db
      .select({
        post: bulletinPosts,
        authUser: users,
        profile: userProfiles,
        postType: bulletinPostTypes,
      })
      .from(bulletinPosts)
      .innerJoin(users, eq(bulletinPosts.authorId, users.id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .innerJoin(bulletinPostTypes, eq(bulletinPosts.postTypeId, bulletinPostTypes.id))
      .where(eq(bulletinPosts.id, postId))
      .limit(1);

    if (!rows[0]) return undefined;
    const { userId: _uid, ...profileFields } = rows[0].profile ?? {};
    return {
      ...rows[0].post,
      author: decryptUserEmails({ ...rows[0].authUser, ...profileFields } as User),
      postType: rows[0].postType,
    };
  }

  async createBulletinPost(post: InsertBulletinPost): Promise<BulletinPost> {
    const result = await db.insert(bulletinPosts).values({
      ...post,
      createdBy: post.authorId,
      updatedBy: post.authorId,
    }).returning();
    return result[0];
  }

  async updateBulletinPost(postId: string, data: { title?: string; body?: string; postTypeId?: number; imageUrl?: string | null }, userId?: string): Promise<BulletinPost | undefined> {
    const result = await db.update(bulletinPosts)
      .set({
        ...data,
        updatedAt: new Date(),
        updatedBy: userId || null,
      })
      .where(eq(bulletinPosts.id, postId))
      .returning();
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
        authUser: users,
        profile: userProfiles,
      })
      .from(bulletinReplies)
      .innerJoin(users, eq(bulletinReplies.authorId, users.id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(bulletinReplies.postId, postId))
      .orderBy(bulletinReplies.createdAt);

    return rows.map(r => {
      const { userId: _uid, ...profileFields } = r.profile ?? {};
      return { ...r.reply, author: decryptUserEmails({ ...r.authUser, ...profileFields } as User) };
    });
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

  async getAppConfigValue(key: string): Promise<string | undefined> {
    const result = await db.select().from(appConfig).where(eq(appConfig.key, key)).limit(1);
    return result[0]?.value;
  }

  async getAllAppConfig(): Promise<AppConfig[]> {
    return db.select().from(appConfig);
  }

  async createRule(name: string, description: string): Promise<Rule> {
    const text = description ? `${name}. ${description}` : name;
    const [rule] = await db.insert(rules).values({ text, name, description }).returning();
    return rule;
  }

  async getRule(id: number): Promise<Rule | undefined> {
    const result = await db.select().from(rules).where(eq(rules.id, id)).limit(1);
    return result[0];
  }

  async updateRule(id: number, name: string, description: string): Promise<Rule | undefined> {
    const text = description ? `${name}. ${description}` : name;
    const result = await db.update(rules).set({ text, name, description }).where(eq(rules.id, id)).returning();
    return result[0];
  }

  async deleteRule(id: number): Promise<void> {
    await db.delete(rules).where(eq(rules.id, id));
  }

  async getAppRules(): Promise<(AppRule & { rule: Rule })[]> {
    const rows = await db
      .select({ appRule: appRules, rule: rules })
      .from(appRules)
      .innerJoin(rules, eq(appRules.ruleId, rules.id))
      .orderBy(appRules.position);
    return rows.map(r => ({ ...r.appRule, rule: r.rule }));
  }

  async addAppRule(ruleId: number, position: number): Promise<AppRule> {
    const [row] = await db.insert(appRules).values({ ruleId, position }).returning();
    return row;
  }

  async removeAppRule(ruleId: number): Promise<void> {
    await db.delete(appRules).where(eq(appRules.ruleId, ruleId));
  }

  async reorderAppRules(ruleIds: number[]): Promise<void> {
    for (let i = 0; i < ruleIds.length; i++) {
      await db.update(appRules).set({ position: i + 1 }).where(eq(appRules.ruleId, ruleIds[i]));
    }
  }

  async getCategoryRules(categoryId: number): Promise<(CategoryRule & { rule: Rule })[]> {
    const rows = await db
      .select({ categoryRule: categoryRules, rule: rules })
      .from(categoryRules)
      .innerJoin(rules, eq(categoryRules.ruleId, rules.id))
      .where(eq(categoryRules.categoryId, categoryId))
      .orderBy(categoryRules.position);
    return rows.map(r => ({ ...r.categoryRule, rule: r.rule }));
  }

  async addCategoryRule(categoryId: number, ruleId: number, position: number): Promise<CategoryRule> {
    const [row] = await db.insert(categoryRules).values({ categoryId, ruleId, position }).returning();
    return row;
  }

  async removeCategoryRule(categoryId: number, ruleId: number): Promise<void> {
    await db.delete(categoryRules).where(and(eq(categoryRules.categoryId, categoryId), eq(categoryRules.ruleId, ruleId)));
  }

  async reorderCategoryRules(categoryId: number, ruleIds: number[]): Promise<void> {
    for (let i = 0; i < ruleIds.length; i++) {
      await db.update(categoryRules).set({ position: i + 1 }).where(and(eq(categoryRules.categoryId, categoryId), eq(categoryRules.ruleId, ruleIds[i])));
    }
  }

  async getBubbleRules(bubbleId: string): Promise<(BubbleRule & { rule: Rule })[]> {
    const rows = await db
      .select({ bubbleRule: bubbleRules, rule: rules })
      .from(bubbleRules)
      .innerJoin(rules, eq(bubbleRules.ruleId, rules.id))
      .where(eq(bubbleRules.bubbleId, bubbleId))
      .orderBy(bubbleRules.position);
    return rows.map(r => ({ ...r.bubbleRule, rule: r.rule }));
  }

  async addBubbleRule(bubbleId: string, ruleId: number, position: number): Promise<BubbleRule> {
    const [row] = await db.insert(bubbleRules).values({ bubbleId, ruleId, position }).returning();
    return row;
  }

  async removeBubbleRule(bubbleId: string, ruleId: number): Promise<void> {
    await db.delete(bubbleRules).where(and(eq(bubbleRules.bubbleId, bubbleId), eq(bubbleRules.ruleId, ruleId)));
  }

  async reorderBubbleRules(bubbleId: string, ruleIds: number[]): Promise<void> {
    for (let i = 0; i < ruleIds.length; i++) {
      await db.update(bubbleRules).set({ position: i + 1 }).where(and(eq(bubbleRules.bubbleId, bubbleId), eq(bubbleRules.ruleId, ruleIds[i])));
    }
  }

  async getBubbleRuleOverrides(bubbleId: string): Promise<BubbleRuleOverride[]> {
    return db.select().from(bubbleRuleOverrides).where(eq(bubbleRuleOverrides.bubbleId, bubbleId));
  }

  async setBubbleRuleOverride(bubbleId: string, ruleId: number, hidden: boolean): Promise<BubbleRuleOverride> {
    const existing = await db.select().from(bubbleRuleOverrides)
      .where(and(eq(bubbleRuleOverrides.bubbleId, bubbleId), eq(bubbleRuleOverrides.ruleId, ruleId)))
      .limit(1);
    if (existing.length > 0) {
      const [row] = await db.update(bubbleRuleOverrides).set({ hidden })
        .where(and(eq(bubbleRuleOverrides.bubbleId, bubbleId), eq(bubbleRuleOverrides.ruleId, ruleId)))
        .returning();
      return row;
    }
    const [row] = await db.insert(bubbleRuleOverrides).values({ bubbleId, ruleId, hidden }).returning();
    return row;
  }

  async removeBubbleRuleOverride(bubbleId: string, ruleId: number): Promise<void> {
    await db.delete(bubbleRuleOverrides).where(and(eq(bubbleRuleOverrides.bubbleId, bubbleId), eq(bubbleRuleOverrides.ruleId, ruleId)));
  }

  async getEffectiveRules(bubbleId: string): Promise<{ level: string; ruleId: number; name: string; description: string; text: string; position: number; hidden: boolean }[]> {
    const bubble = await this.getBubble(bubbleId);
    if (!bubble) return [];

    const overrides = await this.getBubbleRuleOverrides(bubbleId);
    const overrideMap = new Map(overrides.map(o => [o.ruleId, o.hidden]));

    const deriveNameDesc = (rule: { name: string; description: string; text: string }) => {
      if (rule.name) return { name: rule.name, description: rule.description };
      const dotIdx = rule.text.indexOf('. ');
      if (dotIdx > 0) return { name: rule.text.substring(0, dotIdx), description: rule.text.substring(dotIdx + 2) };
      return { name: rule.text, description: '' };
    };

    const appRuleRows = await this.getAppRules();
    const result: { level: string; ruleId: number; name: string; description: string; text: string; position: number; hidden: boolean }[] = [];

    for (const ar of appRuleRows) {
      const { name, description } = deriveNameDesc(ar.rule);
      result.push({
        level: 'app',
        ruleId: ar.ruleId,
        name,
        description,
        text: ar.rule.text,
        position: ar.position,
        hidden: overrideMap.get(ar.ruleId) ?? false,
      });
    }

    if (bubble.categoryId) {
      const catRuleRows = await this.getCategoryRules(bubble.categoryId);
      for (const cr of catRuleRows) {
        const { name, description } = deriveNameDesc(cr.rule);
        result.push({
          level: 'category',
          ruleId: cr.ruleId,
          name,
          description,
          text: cr.rule.text,
          position: cr.position,
          hidden: overrideMap.get(cr.ruleId) ?? false,
        });
      }
    }

    const bubbleRuleRows = await this.getBubbleRules(bubbleId);
    for (const br of bubbleRuleRows) {
      const { name, description } = deriveNameDesc(br.rule);
      result.push({
        level: 'bubble',
        ruleId: br.ruleId,
        name,
        description,
        text: br.rule.text,
        position: br.position,
        hidden: overrideMap.get(br.ruleId) ?? false,
      });
    }

    return result;
  }

  async isBubbleRuleLinked(bubbleId: string, ruleId: number): Promise<boolean> {
    const rows = await db.select()
      .from(bubbleRules)
      .where(and(eq(bubbleRules.bubbleId, bubbleId), eq(bubbleRules.ruleId, ruleId)))
      .limit(1);
    return rows.length > 0;
  }

  async isCategoryRuleLinked(categoryId: number, ruleId: number): Promise<boolean> {
    const rows = await db.select()
      .from(categoryRules)
      .where(and(eq(categoryRules.categoryId, categoryId), eq(categoryRules.ruleId, ruleId)))
      .limit(1);
    return rows.length > 0;
  }

  async isAppRuleLinked(ruleId: number): Promise<boolean> {
    const rows = await db.select()
      .from(appRules)
      .where(eq(appRules.ruleId, ruleId))
      .limit(1);
    return rows.length > 0;
  }

  async isRuleReferenced(ruleId: number): Promise<boolean> {
    const [appRef] = await db.select().from(appRules).where(eq(appRules.ruleId, ruleId)).limit(1);
    if (appRef) return true;
    const [catRef] = await db.select().from(categoryRules).where(eq(categoryRules.ruleId, ruleId)).limit(1);
    if (catRef) return true;
    const [bubRef] = await db.select().from(bubbleRules).where(eq(bubbleRules.ruleId, ruleId)).limit(1);
    if (bubRef) return true;
    return false;
  }

  async getEventSignupTasks(eventId: string, currentUserId?: string): Promise<(EventSignupTask & { signupCount: number; hasSignedUp: boolean; signers: { id: string; name: string; profilePhoto: string | null }[] })[]> {
    const tasks = await db
      .select()
      .from(eventSignupTasks)
      .where(eq(eventSignupTasks.eventId, eventId))
      .orderBy(eventSignupTasks.position, eventSignupTasks.createdAt);

    if (tasks.length === 0) return [];

    const taskIds = tasks.map(t => t.id);

    const signupRows = await db
      .select({
        taskId: eventTaskSignups.taskId,
        userId: eventTaskSignups.userId,
        name: users.name,
        profilePhoto: users.profilePhoto,
      })
      .from(eventTaskSignups)
      .leftJoin(users, eq(users.id, eventTaskSignups.userId))
      .where(inArray(eventTaskSignups.taskId, taskIds))
      .orderBy(eventTaskSignups.createdAt);

    const signupsByTask: Record<number, { id: string; name: string; profilePhoto: string | null }[]> = {};
    for (const row of signupRows) {
      if (!signupsByTask[row.taskId]) signupsByTask[row.taskId] = [];
      signupsByTask[row.taskId].push({ id: row.userId, name: row.name ?? '', profilePhoto: row.profilePhoto ?? null });
    }

    return tasks.map(task => {
      const signers = signupsByTask[task.id] ?? [];
      return {
        ...task,
        signupCount: signers.length,
        hasSignedUp: currentUserId ? signers.some(s => s.id === currentUserId) : false,
        signers: signers.slice(0, 3),
      };
    });
  }

  async createEventSignupTask(data: InsertEventSignupTask): Promise<EventSignupTask> {
    const [task] = await db.insert(eventSignupTasks).values(data).returning();
    return task;
  }

  async updateEventSignupTask(taskId: number, data: Partial<InsertEventSignupTask>): Promise<EventSignupTask | undefined> {
    const [task] = await db
      .update(eventSignupTasks)
      .set(data)
      .where(eq(eventSignupTasks.id, taskId))
      .returning();
    return task;
  }

  async deleteEventSignupTask(taskId: number): Promise<void> {
    await db.delete(eventTaskSignups).where(eq(eventTaskSignups.taskId, taskId));
    await db.delete(eventSignupTasks).where(eq(eventSignupTasks.id, taskId));
  }

  async reorderEventSignupTasks(eventId: string, taskIds: number[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < taskIds.length; i++) {
        await tx
          .update(eventSignupTasks)
          .set({ position: i })
          .where(and(eq(eventSignupTasks.id, taskIds[i]), eq(eventSignupTasks.eventId, eventId)));
      }
    });
  }

  async getEventSignupTask(taskId: number): Promise<EventSignupTask | undefined> {
    const [task] = await db
      .select()
      .from(eventSignupTasks)
      .where(eq(eventSignupTasks.id, taskId))
      .limit(1);
    return task;
  }

  async joinEventSignupTask(taskId: number, userId: string): Promise<{ success: boolean; error?: string }> {
    return db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(eventSignupTasks)
        .where(eq(eventSignupTasks.id, taskId))
        .limit(1);
      if (!task) return { success: false, error: 'Task not found' };

      if (task.spotsNeeded !== null) {
        const [{ total }] = await tx
          .select({ total: count() })
          .from(eventTaskSignups)
          .where(eq(eventTaskSignups.taskId, taskId));
        if (total >= task.spotsNeeded) {
          return { success: false, error: 'This task is full' };
        }
      }

      await tx
        .insert(eventTaskSignups)
        .values({ taskId, userId })
        .onConflictDoNothing();

      return { success: true };
    });
  }

  async leaveEventSignupTask(taskId: number, userId: string): Promise<void> {
    await db
      .delete(eventTaskSignups)
      .where(and(eq(eventTaskSignups.taskId, taskId), eq(eventTaskSignups.userId, userId)));
  }
}

export const storage = new DatabaseStorage();
