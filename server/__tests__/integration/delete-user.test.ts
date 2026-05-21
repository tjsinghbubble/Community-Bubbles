import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users, deletedUsers } from "@shared/schema";
import { storage } from "../../storage";

const DATABASE_URL = process.env.DATABASE_URL;
const isDummyOrMissing =
  !DATABASE_URL || DATABASE_URL === "postgresql://localhost/dummy";

describe.skipIf(isDummyOrMissing)("deleteUser — archive integration", () => {
  const testUserId = `test-delete-${Date.now()}`;

  afterEach(async () => {
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(deletedUsers).where(eq(deletedUsers.id, testUserId));
  });

  it("removes the user from the users table", async () => {
    await db.insert(users).values({
      id: testUserId,
      name: "Test User",
      email: `test-${testUserId}@example.com`,
      emailHash: `hash-${testUserId}`,
      password: "hashed-password",
    });

    await storage.deleteUser(testUserId);

    const [row] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(row).toBeUndefined();
  });

  it("inserts a row into deleted_users with the correct id and deletedAt set", async () => {
    const before = new Date();
    await db.insert(users).values({
      id: testUserId,
      name: "Test User",
      email: `test-${testUserId}@example.com`,
      emailHash: `hash-${testUserId}`,
      password: "hashed-password",
    });

    await storage.deleteUser(testUserId);

    const [archived] = await db
      .select()
      .from(deletedUsers)
      .where(eq(deletedUsers.id, testUserId));

    expect(archived).toBeDefined();
    expect(archived.id).toBe(testUserId);
    expect(archived.name).toBe("Test User");
    expect(archived.deletedAt).toBeInstanceOf(Date);
    expect(archived.deletedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("preserves the original email in deleted_users", async () => {
    const originalEmail = `test-${testUserId}@example.com`;
    await db.insert(users).values({
      id: testUserId,
      name: "Test User",
      email: originalEmail,
      emailHash: `hash-${testUserId}`,
      password: "hashed-password",
    });

    await storage.deleteUser(testUserId);

    const [archived] = await db
      .select()
      .from(deletedUsers)
      .where(eq(deletedUsers.id, testUserId));

    expect(archived.email).toBe(originalEmail);
  });

  it("frees the emailHash so the same email can be registered again", async () => {
    await db.insert(users).values({
      id: testUserId,
      name: "Test User",
      email: `test-${testUserId}@example.com`,
      emailHash: `hash-${testUserId}`,
      password: "hashed-password",
    });

    await storage.deleteUser(testUserId);

    const newUserId = `${testUserId}-new`;
    await expect(
      db.insert(users).values({
        id: newUserId,
        name: "New User",
        email: `test-${testUserId}@example.com`,
        emailHash: `hash-${testUserId}`,
        password: "new-hashed-password",
      })
    ).resolves.toBeDefined();

    await db.delete(users).where(eq(users.id, newUserId));
  });
});
