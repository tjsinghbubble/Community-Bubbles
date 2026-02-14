import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  image: text("image"),
  parentId: integer("parent_id"),
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
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
  campusId: varchar("campus_id").references(() => campuses.id),
  campusEmail: text("campus_email"),
  campusVerified: boolean("campus_verified").notNull().default(false),
  dismissedCampusPrompt: boolean("dismissed_campus_prompt").notNull().default(false),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  profilePhoto: text("profile_photo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bubbles = pgTable("bubbles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  tagline: text("tagline").notNull(),
  category: text("category").notNull(),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertBubbleSchema = createInsertSchema(bubbles).omit({
  id: true,
  members: true,
  createdAt: true,
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
  date: text("date").notNull(), // YYYY-MM-DD format
  startTime: text("start_time").notNull(), // HH:MM format
  endTime: text("end_time"), // HH:MM format, optional
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Event attendees join table
export const eventAttendees = pgTable("event_attendees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default('going'), // going, interested, requested
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
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
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
