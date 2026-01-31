import { eq, and, desc, lt, gte, or } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  bubbles,
  memberships,
  verificationCodes,
  events,
  eventAttendees,
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
  createMembership(membership: InsertMembership): Promise<Membership>;
  deleteMembership(userId: string, bubbleId: string): Promise<void>;
  isMember(userId: string, bubbleId: string): Promise<boolean>;

  createVerificationCode(data: InsertVerificationCode): Promise<VerificationCode>;
  getValidVerificationCode(email: string, code: string): Promise<VerificationCode | undefined>;
  markCodeAsUsed(id: string): Promise<void>;

  // Events
  getEvent(id: string): Promise<Event | undefined>;
  getBubbleEvents(bubbleId: string): Promise<Event[]>;
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

  async createMembership(insertMembership: InsertMembership): Promise<Membership> {
    const result = await db.insert(memberships).values(insertMembership).returning();
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
}

export const storage = new DatabaseStorage();
