/**
 * Deterministic reset + seed of the dedicated test database.
 *
 * Safety: refuses to run unless the target passes the fail-closed guard
 * (assertDestructiveAllowed) — a production-classified or denylisted DB is never touched.
 * Resets ONLY the `public` schema (TRUNCATE), leaving `meta.testing_journal` intact.
 *
 * Seeds the three role accounts via raw SQL using the SAME email encryption/hash and bcrypt
 * password hashing the login path expects (server/encryption.ts + bcrypt), so the accounts
 * can actually authenticate.
 *
 * Run:  TEST_DATABASE_URL=postgresql://localhost/bubble_test npm run qa:seed
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import bcrypt from "bcrypt";
import { encryptField, hashField } from "../../server/encryption.js";
import {
  makePool,
  ensureJournal,
  appendEntry,
  assertDestructiveAllowed,
} from "./journal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface RoleDef {
  label: string;
  email: string;
  password: string;
  isSuperAdmin: boolean;
  bubbleAdmin: boolean;
}

function loadRoles(): Record<string, RoleDef> {
  const cfg = JSON.parse(
    readFileSync(join(__dirname, "../config/roles.json"), "utf8"),
  );
  return cfg.roles as Record<string, RoleDef>;
}

async function createUser(
  pool: import("pg").Pool,
  u: { name: string; email: string; password: string; interests: string[]; isSuperAdmin: boolean },
): Promise<string> {
  const hashedPassword = await bcrypt.hash(u.password, 10);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (name, email, email_hash, password, interests, is_super_admin)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [u.name, encryptField(u.email), hashField(u.email), hashedPassword, u.interests, u.isSuperAdmin],
  );
  return rows[0].id;
}

async function main(): Promise<void> {
  const pool = makePool(); // prefers TEST_DATABASE_URL
  try {
    await ensureJournal(pool);

    // Fail-closed before touching any app data.
    const guard = await assertDestructiveAllowed(pool);
    console.log(`[qa-seed] target='${guard.dbName}' classification='${guard.classification}'`);

    // Confirm the app schema has been provisioned.
    const { rows: tableRows } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const tableNames = tableRows.map((r) => r.tablename);
    if (!tableNames.includes("users")) {
      throw new Error(
        `'${guard.dbName}' has no app schema (no 'users' table). ` +
          `Provision it first: npm run qa:provision`,
      );
    }

    // Reset: TRUNCATE every public table (keeps schema + meta.testing_journal).
    const quoted = tableNames.map((t) => `"${t}"`).join(", ");
    await pool.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
    console.log(`[qa-seed] truncated ${tableNames.length} public tables`);

    // Seed the three role accounts.
    const roles = loadRoles();
    let bubbleCount = 0;
    let membershipCount = 0;
    for (const [key, role] of Object.entries(roles)) {
      const userId = await createUser(pool, {
        name: role.label,
        email: role.email,
        password: role.password,
        interests: ["Sports", "Music", "Tech"],
        isSuperAdmin: role.isSuperAdmin,
      });
      console.log(`[qa-seed] created ${key}: ${role.email}`);

      if (role.bubbleAdmin) {
        const { rows: bubbleRows } = await pool.query<{ id: string }>(
          `INSERT INTO bubbles (title, tagline, category, description, created_by, status, privacy)
           VALUES ($1, $2, $3, $4, $5, 'approved', 'Public')
           RETURNING id`,
          [
            "QA Test Bubble",
            "Seeded by qa-seed",
            "Outdoors",
            "A deterministic, approved bubble owned by the bubble-admin role for automated tests.",
            userId,
          ],
        );
        const bubbleId = bubbleRows[0].id;
        bubbleCount++;
        await pool.query(
          `INSERT INTO memberships (user_id, bubble_id, role, membership_status, created_by)
           VALUES ($1, $2, 'admin', 'approved', $3)`,
          [userId, bubbleId, userId],
        );
        membershipCount++;
      }
    }

    // Dedicated password-stuffing victim for sec-0100. Kept separate so locking it out never
    // affects the shared role accounts (lockout is in-memory and survives reseeds on a
    // long-lived server).
    await createUser(pool, {
      name: "Lockout Victim",
      email: "lockout-victim@bubble.test",
      password: "Lockout123!",
      interests: [],
      isSuperAdmin: false,
    });
    console.log(`[qa-seed] created fixture: lockout-victim@bubble.test`);

    const userCount = Object.keys(roles).length + 1;
    await appendEntry(pool, {
      author: "qa-seed",
      observation: `reset+seeded smoke fixtures v1: ${userCount} role users, ${bubbleCount} bubble(s), ${membershipCount} membership(s).`,
      tags: ["env:test", "data-class:synthetic", "seed:smoke-v1", "destructive-ok"],
    });

    console.log(
      `[qa-seed] done — ${userCount} users, ${bubbleCount} bubble(s), ${membershipCount} membership(s); journal updated.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[qa-seed] FAILED:", err.message ?? err);
  process.exit(1);
});
