import { eq, and, desc, lt } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  bubbles,
  memberships,
  verificationCodes,
  type User,
  type InsertUser,
  type Bubble,
  type InsertBubble,
  type Membership,
  type InsertMembership,
  type VerificationCode,
  type InsertVerificationCode,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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
}

export const storage = new DatabaseStorage();
