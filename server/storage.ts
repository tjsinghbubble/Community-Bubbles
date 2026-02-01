import { eq, and, desc, lt, gte, or, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  bubbles,
  memberships,
  verificationCodes,
  events,
  eventAttendees,
  campuses,
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
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<void>;

  getBubbles(): Promise<Bubble[]>;
  getBubble(id: string): Promise<Bubble | undefined>;
  createBubble(bubble: InsertBubble): Promise<Bubble>;
  updateBubbleMemberCount(id: string, delta: number): Promise<void>;

  getUserMemberships(userId: string): Promise<(Membership & { bubble: Bubble })[]>;
  getBubbleMemberships(bubbleId: string): Promise<Membership[]>;
  getBubbleMembersWithUsers(bubbleId: string): Promise<(Membership & { user: User })[]>;
  createMembership(membership: InsertMembership): Promise<Membership>;
  createMembershipWithRole(membership: InsertMembership, role: string): Promise<Membership>;
  deleteMembership(userId: string, bubbleId: string): Promise<void>;
  isMember(userId: string, bubbleId: string): Promise<boolean>;
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

  // Event Attendees
  getEventAttendees(eventId: string): Promise<EventAttendee[]>;
  isEventAttendee(userId: string, eventId: string): Promise<boolean>;
  createEventAttendee(attendee: InsertEventAttendee): Promise<EventAttendee>;
  deleteEventAttendee(userId: string, eventId: string): Promise<void>;

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
  getCampusEvents(campusId: string): Promise<(Event & { bubble: Bubble })[]>;
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
    return result[0];
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(memberships).where(eq(memberships.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getBubbles(): Promise<Bubble[]> {
    return db.select().from(bubbles).orderBy(desc(bubbles.createdAt));
  }

  async getBubble(id: string): Promise<Bubble | undefined> {
    const result = await db.select().from(bubbles).where(eq(bubbles.id, id)).limit(1);
    return result[0];
  }

  async createBubble(insertBubble: InsertBubble): Promise<Bubble> {
    const result = await db.insert(bubbles).values(insertBubble).returning();
    return result[0];
  }

  async updateBubbleMemberCount(id: string, delta: number): Promise<void> {
    const bubble = await this.getBubble(id);
    if (bubble) {
      await db.update(bubbles)
        .set({ members: bubble.members + delta })
        .where(eq(bubbles.id, id));
    }
  }

  async getUserMemberships(userId: string): Promise<(Membership & { bubble: Bubble })[]> {
    const result = await db
      .select()
      .from(memberships)
      .innerJoin(bubbles, eq(memberships.bubbleId, bubbles.id))
      .where(eq(memberships.userId, userId))
      .orderBy(desc(memberships.joinedAt));

    return result.map((row) => ({
      ...row.memberships,
      bubble: row.bubbles,
    }));
  }

  async getBubbleMemberships(bubbleId: string): Promise<Membership[]> {
    return db.select().from(memberships).where(eq(memberships.bubbleId, bubbleId));
  }

  async getBubbleMembersWithUsers(bubbleId: string): Promise<(Membership & { user: User })[]> {
    const result = await db
      .select()
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.bubbleId, bubbleId))
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

  async deleteMembership(userId: string, bubbleId: string): Promise<void> {
    await db.delete(memberships).where(
      and(eq(memberships.userId, userId), eq(memberships.bubbleId, bubbleId))
    );
    await this.updateBubbleMemberCount(bubbleId, -1);
  }

  async isMember(userId: string, bubbleId: string): Promise<boolean> {
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
      .where(and(eq(memberships.userId, userId), eq(memberships.bubbleId, bubbleId)))
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
      .where(and(eq(events.bubbleId, bubbleId), gte(events.date, today)))
      .orderBy(events.date, events.startTime);
  }

  async getAllPublicEvents(): Promise<(Event & { bubble: Bubble })[]> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db
      .select()
      .from(events)
      .innerJoin(bubbles, eq(events.bubbleId, bubbles.id))
      .where(and(eq(events.visibility, 'public'), gte(events.date, today)))
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
      .where(eq(eventAttendees.userId, userId))
      .orderBy(events.date, events.startTime);

    const created = await db
      .select()
      .from(events)
      .innerJoin(bubbles, eq(events.bubbleId, bubbles.id))
      .where(eq(events.creatorId, userId))
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
      .where(eq(events.creatorId, userId))
      .orderBy(events.date, events.startTime);

    return result.map(row => ({ ...row.events, bubble: row.bubbles }));
  }

  async getUserCreatedBubbles(userId: string): Promise<Bubble[]> {
    return db
      .select()
      .from(bubbles)
      .where(eq(bubbles.creatorId, userId))
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

  // Event Attendees
  async getEventAttendees(eventId: string): Promise<EventAttendee[]> {
    return db.select().from(eventAttendees).where(eq(eventAttendees.eventId, eventId));
  }

  async isEventAttendee(userId: string, eventId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(eventAttendees)
      .where(and(eq(eventAttendees.userId, userId), eq(eventAttendees.eventId, eventId)))
      .limit(1);
    return result.length > 0;
  }

  async createEventAttendee(insertAttendee: InsertEventAttendee): Promise<EventAttendee> {
    const result = await db.insert(eventAttendees).values(insertAttendee).returning();
    return result[0];
  }

  async deleteEventAttendee(userId: string, eventId: string): Promise<void> {
    await db.delete(eventAttendees).where(
      and(eq(eventAttendees.userId, userId), eq(eventAttendees.eventId, eventId))
    );
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
    }).where(eq(users.id, userId));
  }

  async dismissCampusPrompt(userId: string): Promise<void> {
    await db.update(users).set({
      dismissedCampusPrompt: true,
    }).where(eq(users.id, userId));
  }

  async getPublicBubbles(): Promise<Bubble[]> {
    return db.select().from(bubbles)
      .where(isNull(bubbles.campusId))
      .orderBy(desc(bubbles.createdAt));
  }

  async getCampusBubbles(campusId: string): Promise<Bubble[]> {
    return db.select().from(bubbles)
      .where(eq(bubbles.campusId, campusId))
      .orderBy(desc(bubbles.createdAt));
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
        gte(events.date, today)
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
      .where(eq(events.campusId, campusId))
      .orderBy(desc(events.createdAt));

    return result.map(row => ({
      ...row.events,
      bubble: row.bubbles,
    }));
  }
}

export const storage = new DatabaseStorage();
