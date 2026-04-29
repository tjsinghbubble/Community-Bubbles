import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, serial, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  displayName: text("display_name"),
  header: text("header"),
  icon: text("icon"),
  image: text("image"),
  parentId: integer("parent_id"),
  displayOrder: integer("display_order").notNull().default(0),
  placeholderName: text("placeholder_name"),
  placeholderTagline: text("placeholder_tagline"),
  placeholderDescription: text("placeholder_description"),
});

export const campuses = pgTable("campuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: text("domain").notNull().unique(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailHash: text("email_hash").unique(),
  password: text("password").notNull(),
  interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
  campusId: varchar("campus_id").references(() => campuses.id),
  campusEmail: text("campus_email"),
  campusVerified: boolean("campus_verified").notNull().default(false),
  dismissedCampusPrompt: boolean("dismissed_campus_prompt").notNull().default(false),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  profilePhoto: text("profile_photo"),
  aboutMe: text("about_me"),
  tokenVersion: integer("token_version").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by"),
});

export const userProfiles = pgTable("user_profiles", {
  userId: varchar("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
  campusId: varchar("campus_id").references(() => campuses.id),
  campusEmail: text("campus_email"),
  campusVerified: boolean("campus_verified").notNull().default(false),
  dismissedCampusPrompt: boolean("dismissed_campus_prompt").notNull().default(false),
  profilePhoto: text("profile_photo"),
  aboutMe: text("about_me"),
  campusEmailHash: text("campus_email_hash"),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;

export const bubbles = pgTable("bubbles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  tagline: text("tagline").notNull(),
  category: text("category").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  description: text("description").notNull(),
  rules: text("rules").array().notNull().default(sql`'{}'::text[]`),
  privacy: text("privacy").notNull().default('Public'),
  coverImage: text("cover_image"),
  images: text("images").array().notNull().default(sql`'{}'::text[]`),
  attachments: text("attachments").array().notNull().default(sql`'{}'::text[]`),
  members: integer("members").notNull().default(0),
  memberLimit: integer("member_limit"),
  distance: text("distance"),
  locationName: text("location_name"),
  locationAddress: text("location_address"),
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  radiusMiles: integer("radius_miles").default(15),
  creatorId: varchar("creator_id").notNull().references(() => users.id),
  campusId: varchar("campus_id").references(() => campuses.id),
  status: text("status").notNull().default('pending'),
  rejectionReason: text("rejection_reason"),
  shortId: text("short_id").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const memberships = pgTable("memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bubbleId: varchar("bubble_id").notNull().references(() => bubbles.id),
  role: text("role").notNull().default('member'),
  membershipStatus: text("membership_status").notNull().default('approved'),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const verificationCodes = pgTable("verification_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  emailHash: text("email_hash"),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  updatedBy: true,
}).extend({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254, "Email must be 254 characters or fewer"),
  password: z.string().min(8, "Password must be at least 8 characters").max(1000, "Password must be 1000 characters or fewer"),
  aboutMe: z.string().max(500).optional().nullable(),
  interests: z.array(z.string().max(50)).max(20).default([]),
});

export const insertBubbleSchema = createInsertSchema(bubbles).omit({
  id: true,
  members: true,
  shortId: true,
  createdAt: true,
  deletedAt: true,
}).extend({
  title: z.string().min(1).max(150),
  tagline: z.string().min(1).max(150),
  description: z.string().min(1).max(2000),
  rules: z.array(z.string().max(300)).max(20).default([]),
  locationName: z.string().max(300).optional().nullable(),
  locationAddress: z.string().max(300).optional().nullable(),
});

export const insertMembershipSchema = createInsertSchema(memberships).omit({
  id: true,
  role: true,
  joinedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertBubble = z.infer<typeof insertBubbleSchema>;
export type Bubble = typeof bubbles.$inferSelect;

export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Membership = typeof memberships.$inferSelect;

export const insertVerificationCodeSchema = createInsertSchema(verificationCodes).omit({
  id: true,
  createdAt: true,
  used: true,
});

export type InsertVerificationCode = z.infer<typeof insertVerificationCodeSchema>;
export type VerificationCode = typeof verificationCodes.$inferSelect;

// Events table
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"), // Optional
  coverImage: text("cover_image"),
  images: text("images").array().notNull().default(sql`'{}'::text[]`),
  date: text("date").notNull(), // YYYY-MM-DD format (stored in UTC)
  startTime: text("start_time").notNull(), // HH:MM format (stored in UTC)
  endTime: text("end_time"), // HH:MM format (stored in UTC), optional
  timezone: text("timezone").notNull().default('UTC'), // IANA timezone e.g. "America/Chicago"
  locationName: text("location_name"), // Optional
  locationAddress: text("location_address"),
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  locationTbd: boolean("location_tbd").notNull().default(false),
  visibility: text("visibility").notNull().default('public'), // public, request, private
  petFriendly: boolean("pet_friendly").notNull().default(false),
  smokeFree: boolean("smoke_free").notNull().default(false),
  wheelchairAccessible: boolean("wheelchair_accessible").notNull().default(false),
  attendeeLimit: integer("attendee_limit"), // null means unlimited
  rsvpDeadline: text("rsvp_deadline"), // ISO datetime string, null means no deadline
  recurrenceType: text("recurrence_type").notNull().default('never'), // never, daily, weekly, biweekly, monthly, yearly, custom
  recurrenceCustomFrequency: text("recurrence_custom_frequency"), // daily, weekly, monthly, yearly
  recurrenceCustomInterval: integer("recurrence_custom_interval"), // 1-999
  bubbleId: varchar("bubble_id").notNull().references(() => bubbles.id),
  creatorId: varchar("creator_id").notNull().references(() => users.id),
  campusId: varchar("campus_id").references(() => campuses.id),
  status: text("status").notNull().default('approved'),
  rejectionReason: text("rejection_reason"),
  reminder24hSent: boolean("reminder_24h_sent").notNull().default(false),
  reminder1hSent: boolean("reminder_1h_sent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Event attendees join table
export const eventAttendees = pgTable("event_attendees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default('going'), // going, interested, requested, waitlisted
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  reminder24hSent: true,
  reminder1hSent: true,
}).extend({
  title: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
  locationName: z.string().max(300).optional().nullable(),
  locationAddress: z.string().max(300).optional().nullable(),
});

export const insertEventAttendeeSchema = createInsertSchema(eventAttendees).omit({
  id: true,
  joinedAt: true,
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

export type InsertEventAttendee = z.infer<typeof insertEventAttendeeSchema>;
export type EventAttendee = typeof eventAttendees.$inferSelect;

// Campus types
export const insertCampusSchema = createInsertSchema(campuses).omit({
  id: true,
  createdAt: true,
});

export type InsertCampus = z.infer<typeof insertCampusSchema>;
export type Campus = typeof campuses.$inferSelect;

// User sessions for analytics tracking
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds"),
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  endedAt: true,
  durationSeconds: true,
});

export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;

// Bubble visits for analytics
export const bubbleVisits = pgTable("bubble_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bubbleId: varchar("bubble_id").notNull().references(() => bubbles.id),
  userId: varchar("user_id").references(() => users.id),
  visitedAt: timestamp("visited_at").notNull().defaultNow(),
});

export const insertBubbleVisitSchema = createInsertSchema(bubbleVisits).omit({
  id: true,
  visitedAt: true,
});

export type InsertBubbleVisit = z.infer<typeof insertBubbleVisitSchema>;
export type BubbleVisit = typeof bubbleVisits.$inferSelect;

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
}).extend({
  name: z.string().min(1).max(100),
  displayName: z.string().max(100).optional().nullable(),
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export const categoryPlaceholders = pgTable("category_placeholders", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  fieldType: text("field_type").notNull(),
  value: text("value").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
});

export const insertCategoryPlaceholderSchema = createInsertSchema(categoryPlaceholders).omit({
  id: true,
});

export type InsertCategoryPlaceholder = z.infer<typeof insertCategoryPlaceholderSchema>;
export type CategoryPlaceholder = typeof categoryPlaceholders.$inferSelect;

export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportType: text("report_type").notNull(),
  reason: text("reason").notNull(),
  freeText: text("free_text"),
  reporterUserId: varchar("reporter_user_id").notNull().references(() => users.id),
  reportedUserId: varchar("reported_user_id").references(() => users.id),
  bubbleId: varchar("bubble_id").notNull().references(() => bubbles.id),
  eventId: varchar("event_id").references(() => events.id),
  visibleTo: text("visible_to").notNull().default("superadmin"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  status: true,
  createdAt: true,
}).extend({
  reason: z.string().min(1).max(500),
  freeText: z.string().max(2000).optional().nullable(),
});

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

export const bubbleChats = pgTable("bubble_chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bubbleId: varchar("bubble_id").notNull().references(() => bubbles.id),
  cometChatGroupId: text("cometchat_group_id").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("bubble_chats_bubble_id_unique").on(table.bubbleId),
]);

export const insertBubbleChatSchema = createInsertSchema(bubbleChats).omit({
  id: true,
  createdAt: true,
});

export type InsertBubbleChat = z.infer<typeof insertBubbleChatSchema>;
export type BubbleChat = typeof bubbleChats.$inferSelect;

export const adminMemberChats = pgTable("admin_member_chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bubbleId: varchar("bubble_id").notNull().references(() => bubbles.id),
  memberId: varchar("member_id").notNull().references(() => users.id),
  cometChatGroupId: text("cometchat_group_id").notNull(),
  isAdminDm: boolean("is_admin_dm").notNull().default(true),
  participantIds: text("participant_ids").array().notNull().default(sql`'{}'::text[]`),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("admin_member_chats_bubble_member_unique").on(table.bubbleId, table.memberId),
]);

export const insertAdminMemberChatSchema = createInsertSchema(adminMemberChats).omit({
  id: true,
  createdAt: true,
});

export type InsertAdminMemberChat = z.infer<typeof insertAdminMemberChatSchema>;
export type AdminMemberChat = typeof adminMemberChats.$inferSelect;

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipientId: varchar("recipient_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  metadata: text("metadata"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  read: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const devicePushTokens = pgTable("device_push_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull(),
  platform: text("platform").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("device_push_tokens_user_token_unique").on(table.userId, table.token),
]);

export const insertDevicePushTokenSchema = createInsertSchema(devicePushTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDevicePushToken = z.infer<typeof insertDevicePushTokenSchema>;
export type DevicePushToken = typeof devicePushTokens.$inferSelect;

export const bulletinBoards = pgTable("bulletin_boards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bubbleId: varchar("bubble_id").notNull().references(() => bubbles.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  unique("bulletin_boards_bubble_id_unique").on(table.bubbleId),
]);

export const bulletinPostTypes = pgTable("bulletin_post_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  color: text("color").notNull(),
  adminOnly: boolean("admin_only").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const bulletinPosts = pgTable("bulletin_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").notNull().references(() => bulletinBoards.id),
  postTypeId: integer("post_type_id").notNull().references(() => bulletinPostTypes.id),
  authorId: varchar("author_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  imageUrl: text("image_url"),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const bulletinReplies = pgTable("bulletin_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => bulletinPosts.id),
  authorId: varchar("author_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const insertBulletinBoardSchema = createInsertSchema(bulletinBoards).omit({
  id: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
});

export const insertBulletinPostTypeSchema = createInsertSchema(bulletinPostTypes).omit({
  id: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
});

export const insertBulletinPostSchema = createInsertSchema(bulletinPosts).omit({
  id: true,
  createdAt: true,
  createdBy: true,
  isPinned: true,
  updatedAt: true,
  updatedBy: true,
}).extend({
  title: z.string().min(1).max(150),
  body: z.string().min(1).max(5000),
});

export const insertBulletinReplySchema = createInsertSchema(bulletinReplies).omit({
  id: true,
  createdAt: true,
  createdBy: true,
  updatedAt: true,
  updatedBy: true,
}).extend({
  body: z.string().min(1).max(2000),
});

export const bulletinPostReactions = pgTable("bulletin_post_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => bulletinPosts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  emoji: varchar("emoji", { length: 32 }).notNull().default('heart'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type BulletinBoard = typeof bulletinBoards.$inferSelect;
export type InsertBulletinBoard = z.infer<typeof insertBulletinBoardSchema>;

export type BulletinPostType = typeof bulletinPostTypes.$inferSelect;
export type InsertBulletinPostType = z.infer<typeof insertBulletinPostTypeSchema>;

export type BulletinPost = typeof bulletinPosts.$inferSelect;
export type InsertBulletinPost = z.infer<typeof insertBulletinPostSchema>;

export type BulletinReply = typeof bulletinReplies.$inferSelect;
export type InsertBulletinReply = z.infer<typeof insertBulletinReplySchema>;

export type BulletinPostReaction = typeof bulletinPostReactions.$inferSelect;

// Partial schemas for update routes
export const updateBubbleSchema = insertBubbleSchema.partial();
export const updateEventSchema = insertEventSchema.partial();
export const updateBulletinPostSchema = insertBulletinPostSchema.partial();

// Patch schema for user profile (fields that can be updated individually)
export const patchUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  aboutMe: z.string().max(500).optional().nullable(),
  interests: z.array(z.string().max(50)).max(20).optional(),
  profilePhoto: z.string().optional().nullable(),
});

export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAppConfigSchema = createInsertSchema(appConfig);
export type AppConfig = typeof appConfig.$inferSelect;
export type InsertAppConfig = z.infer<typeof insertAppConfigSchema>;

export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(''),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const appRules = pgTable("app_rules", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").notNull().references(() => rules.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
});

export const categoryRules = pgTable("category_rules", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  ruleId: integer("rule_id").notNull().references(() => rules.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
});

export const bubbleRules = pgTable("bubble_rules", {
  id: serial("id").primaryKey(),
  bubbleId: varchar("bubble_id").notNull().references(() => bubbles.id, { onDelete: "cascade" }),
  ruleId: integer("rule_id").notNull().references(() => rules.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
});

export const bubbleRuleOverrides = pgTable("bubble_rule_overrides", {
  id: serial("id").primaryKey(),
  bubbleId: varchar("bubble_id").notNull().references(() => bubbles.id, { onDelete: "cascade" }),
  ruleId: integer("rule_id").notNull().references(() => rules.id, { onDelete: "cascade" }),
  hidden: boolean("hidden").notNull().default(true),
});

export type Rule = typeof rules.$inferSelect;
export type AppRule = typeof appRules.$inferSelect;
export type CategoryRule = typeof categoryRules.$inferSelect;
export type BubbleRule = typeof bubbleRules.$inferSelect;
export type BubbleRuleOverride = typeof bubbleRuleOverrides.$inferSelect;

// Persisted server error log entries
export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  platform: text("platform").notNull().default("server"),
  level: text("level").notNull().default("error"),
}, (table) => [
  index("error_logs_timestamp_idx").on(table.timestamp),
]);

export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({ id: true, timestamp: true });
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type ErrorLog = typeof errorLogs.$inferSelect;

// Audit log for super admin actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  targetId: text("target_id").notNull(),
  ip: text("ip"),
  extra: text("extra"), // JSON string for additional context
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AuditLog = typeof auditLogs.$inferSelect;

// Event Sign-Up Sheet tables
export const eventSignupTasks = pgTable("event_signup_tasks", {
  id: serial("id").primaryKey(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default('📋'),
  spotsNeeded: integer("spots_needed"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  position: integer("position").notNull().default(0),
});

export const eventTaskSignups = pgTable("event_task_signups", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => eventSignupTasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  reminderSent: boolean("reminder_sent").notNull().default(false),
  reminderSent1h: boolean("reminder_sent_1h").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  unique("event_task_signups_task_user_unique").on(table.taskId, table.userId),
]);

export const insertEventSignupTaskSchema = createInsertSchema(eventSignupTasks).omit({
  id: true,
  createdAt: true,
}).extend({
  title: z.string().min(1).max(150),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().default('📋'),
  spotsNeeded: z.number().int().min(1).max(999).optional().nullable(),
});

export type EventSignupTask = typeof eventSignupTasks.$inferSelect;
export type InsertEventSignupTask = z.infer<typeof insertEventSignupTaskSchema>;
export type EventTaskSignup = typeof eventTaskSignups.$inferSelect;

// Crash reports submitted by mobile clients
export const crashReports = pgTable("crash_reports", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  stack: text("stack"),
  context: text("context"),
  platform: text("platform"),
  appVersion: text("app_version"),
  isFatal: boolean("is_fatal").notNull().default(false),
  userId: text("user_id"),
  username: text("username"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCrashReportSchema = createInsertSchema(crashReports).omit({
  id: true,
  createdAt: true,
});

export type CrashReport = typeof crashReports.$inferSelect;
export type InsertCrashReport = z.infer<typeof insertCrashReportSchema>;

// Latency trend buckets — 5-minute aggregated snapshots per endpoint
export const latencyBuckets = pgTable(
  "latency_buckets",
  {
    id: serial("id").primaryKey(),
    method: text("method").notNull(),
    endpoint: text("endpoint").notNull(),
    bucketTs: timestamp("bucket_ts").notNull(),
    p50Ms: integer("p50_ms").notNull(),
    p95Ms: integer("p95_ms").notNull(),
    p99Ms: integer("p99_ms").notNull(),
    avgMs: integer("avg_ms").notNull(),
    maxMs: integer("max_ms").notNull(),
    count: integer("count").notNull(),
    errorCount: integer("error_count").notNull().default(0),
  },
  (table) => [
    unique("latency_buckets_endpoint_method_ts_unique").on(table.method, table.endpoint, table.bucketTs),
  ],
);

export type LatencyBucket = typeof latencyBuckets.$inferSelect;

// Slow API call alerts — persisted records for admin visibility
export const slowCalls = pgTable("slow_calls", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  durationMs: integer("duration_ms").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSlowCallSchema = createInsertSchema(slowCalls).omit({
  id: true,
  createdAt: true,
});

export type SlowCall = typeof slowCalls.$inferSelect;
export type InsertSlowCall = z.infer<typeof insertSlowCallSchema>;

// Aggregated API latency snapshots — flushed periodically from in-memory store
export const apiLatencySamples = pgTable("api_latency_samples", {
  id: serial("id").primaryKey(),
  method: text("method").notNull(),
  endpoint: text("endpoint").notNull(),
  count: integer("count").notNull(),
  p50Ms: integer("p50_ms").notNull(),
  p95Ms: integer("p95_ms").notNull(),
  p99Ms: integer("p99_ms").notNull(),
  avgMs: integer("avg_ms").notNull(),
  maxMs: integer("max_ms").notNull(),
  errorRate: integer("error_rate").notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export type ApiLatencySample = typeof apiLatencySamples.$inferSelect;
