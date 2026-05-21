import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { verificationCodes } from "@shared/schema";
import { storage } from "../../storage";

const DATABASE_URL = process.env.DATABASE_URL;
const isDummyOrMissing =
  !DATABASE_URL || DATABASE_URL === "postgresql://localhost/dummy";

describe.skipIf(isDummyOrMissing)("markCodeAsUsedAtomic — integration", () => {
  const testCodeId = "test-atomic-" + Date.now();

  afterEach(async () => {
    await db.delete(verificationCodes).where(eq(verificationCodes.id, testCodeId));
  });

  it("allows exactly one concurrent caller to claim the code", async () => {
    await db.insert(verificationCodes).values({
      id: testCodeId,
      email: "test@example.com",
      code: "999999",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      used: false,
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => storage.markCodeAsUsedAtomic(testCodeId)),
    );

    const trueCount = results.filter(Boolean).length;
    expect(trueCount).toBe(1);

    const [row] = await db
      .select()
      .from(verificationCodes)
      .where(eq(verificationCodes.id, testCodeId));
    expect(row.used).toBe(true);
  });
});

// memberships and eventAttendees require FK setup (users + bubbles / events rows).
// Add integration tests for those tables here once fixture helpers are available.
describe("memberships concurrent operations", () => {
  it.todo("concurrent join requests — requires user + bubble fixtures");
});

describe("eventAttendees concurrent operations", () => {
  it.todo("concurrent RSVP — requires user + event fixtures");
});
