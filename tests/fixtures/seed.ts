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

        // Second bubble with ONE bubble-level rule, for the rules-acceptance flow
        // (joining-0600). Kept separate so "QA Test Bubble" stays rule-free and the
        // welcome modal in other join flows (joining-0400) is never gated by a checkbox.
        const { rows: rulesBubbleRows } = await pool.query<{ id: string }>(
          `INSERT INTO bubbles (title, tagline, category, description, created_by, status, privacy)
           VALUES ($1, $2, $3, $4, $5, 'approved', 'Public')
           RETURNING id`,
          [
            "QA Rules Bubble",
            "Seeded by qa-seed (has one rule)",
            "Outdoors",
            "A deterministic, approved bubble with one bubble-level rule, used by rules-acceptance tests.",
            userId,
          ],
        );
        const rulesBubbleId = rulesBubbleRows[0].id;
        bubbleCount++;
        await pool.query(
          `INSERT INTO memberships (user_id, bubble_id, role, membership_status, created_by)
           VALUES ($1, $2, 'admin', 'approved', $3)`,
          [userId, rulesBubbleId, userId],
        );
        membershipCount++;
        const { rows: ruleRows } = await pool.query<{ id: number }>(
          `INSERT INTO rules (text, name, description)
           VALUES ('Be kind to other members.', 'Be kind', 'Seeded rule for the rules-acceptance checkbox flow.')
           RETURNING id`,
        );
        await pool.query(
          `INSERT INTO bubble_rules (bubble_id, rule_id, position) VALUES ($1, $2, 0)`,
          [rulesBubbleId, ruleRows[0].id],
        );
        console.log(`[qa-seed] created 'QA Rules Bubble' with 1 bubble rule`);

        // Third bubble that NO test ever joins, so pre-join (non-member) reads like
        // discovery-0400 are order-independent from the join flows.
        const { rows: browseBubbleRows } = await pool.query<{ id: string }>(
          `INSERT INTO bubbles (title, tagline, category, description, created_by, status, privacy)
           VALUES ($1, $2, $3, $4, $5, 'approved', 'Public')
           RETURNING id`,
          [
            "QA Browse Bubble",
            "Seeded by qa-seed (read-only)",
            "Outdoors",
            "A deterministic, approved bubble that tests only VIEW — no test may ever join it.",
            userId,
          ],
        );
        bubbleCount++;
        await pool.query(
          `INSERT INTO memberships (user_id, bubble_id, role, membership_status, created_by)
           VALUES ($1, $2, 'admin', 'approved', $3)`,
          [userId, browseBubbleRows[0].id, userId],
        );
        membershipCount++;
        console.log(`[qa-seed] created 'QA Browse Bubble' (view-only fixture)`);

        // Seeded upcoming event inside QA Browse Bubble. Lets pre-join reads assert the
        // "upcoming events" section (discovery-0400) and gives the edit-event UI tests
        // (events-0720) a stable event to open WITHOUT saving changes. Date is always
        // 30 days out so "upcoming" never expires.
        await pool.query(
          `INSERT INTO events (title, date, start_time, timezone, bubble_id, created_by, status)
           VALUES ('QA Seeded Event', to_char(CURRENT_DATE + 30, 'YYYY-MM-DD'), '18:00', 'UTC', $1, $2, 'approved')`,
          [browseBubbleRows[0].id, userId],
        );
        console.log(`[qa-seed] created 'QA Seeded Event' in QA Browse Bubble (+30 days)`);

        // Request-to-Join bubble for the request-pending UI flow (joining-0520). Dedicated
        // so the member's pending request never leaks into the other bubbles' state.
        const { rows: requestBubbleRows } = await pool.query<{ id: string }>(
          `INSERT INTO bubbles (title, tagline, category, description, created_by, status, privacy)
           VALUES ($1, $2, $3, $4, $5, 'approved', 'Request to Join')
           RETURNING id`,
          [
            "QA Request Bubble",
            "Seeded by qa-seed (request to join)",
            "Outdoors",
            "A deterministic, approved Request-to-Join bubble for join-request UI tests.",
            userId,
          ],
        );
        bubbleCount++;
        await pool.query(
          `INSERT INTO memberships (user_id, bubble_id, role, membership_status, created_by)
           VALUES ($1, $2, 'admin', 'approved', $3)`,
          [userId, requestBubbleRows[0].id, userId],
        );
        membershipCount++;
        console.log(`[qa-seed] created 'QA Request Bubble' (Request to Join)`);
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

    // Bulletin post types (the app has no built-in defaults; prod rows were created by
    // admins). One member-postable type and one admin-only type, so sec-0200 can create a
    // bulletin post and future tests can probe the adminOnly gate.
    await pool.query(
      `INSERT INTO bulletin_post_types (name, display_name, color, admin_only, display_order)
       VALUES ('general', 'General', '#4A90D9', false, 0),
              ('announcement', 'Announcement', '#D94A4A', true, 1)`,
    );
    console.log(`[qa-seed] created 2 bulletin post types (general, announcement)`);

    // Categories: GET /api/categories drives the create-bubble wizard's first step
    // ("What category will your bubble be in?"). TRUNCATE wipes the categories table,
    // so a fresh test DB returns [] and the wizard can never advance (bubble-admin-0600).
    // Seed a representative subset of the canonical tree (server/seed-categories.ts) —
    // a few parent groups each with children — enough for the wizard to render and a
    // test to pick one. Raw SQL on the guarded pool (same idiom as bulletin types),
    // NOT the drizzle seedCategories(), which connects via DATABASE_URL (could be the
    // dev DB) and leaves an unclosed pool that would hang this script.
    const categoryTree: Array<{
      name: string; displayName: string; header: string; icon: string;
      children: Array<{ name: string; displayName: string; icon: string }>;
    }> = [
      { name: "food_and_social", displayName: "Food & Social", header: "Eat & Meet", icon: "cafe", children: [
        { name: "dining_out", displayName: "Dining Out", icon: "restaurant" },
        { name: "coffee_meetups", displayName: "Coffee Meetups", icon: "cafe" },
        { name: "brunch", displayName: "Brunch", icon: "sunny" },
      ] },
      { name: "active", displayName: "Active", header: "Move Together", icon: "fitness", children: [
        { name: "fitness_classes", displayName: "Fitness Classes", icon: "barbell" },
        { name: "hiking", displayName: "Hiking", icon: "walk" },
        { name: "yoga", displayName: "Yoga", icon: "body" },
      ] },
      { name: "creative", displayName: "Creative", header: "Create & Chill", icon: "color-palette", children: [
        { name: "cooking", displayName: "Cooking", icon: "restaurant" },
        { name: "board_games", displayName: "Board Games", icon: "game-controller" },
        { name: "book_clubs", displayName: "Book Clubs", icon: "book" },
      ] },
    ];
    let categoryCount = 0;
    for (let pIdx = 0; pIdx < categoryTree.length; pIdx++) {
      const parent = categoryTree[pIdx];
      const { rows: pRows } = await pool.query<{ id: number }>(
        `INSERT INTO categories (name, display_name, header, icon, parent_id, display_order)
         VALUES ($1, $2, $3, $4, NULL, $5) RETURNING id`,
        [parent.name, parent.displayName, parent.header, parent.icon, pIdx + 1],
      );
      categoryCount++;
      for (let cIdx = 0; cIdx < parent.children.length; cIdx++) {
        const child = parent.children[cIdx];
        await pool.query(
          `INSERT INTO categories
             (name, display_name, icon, parent_id, display_order,
              placeholder_name, placeholder_tagline, placeholder_description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [child.name, child.displayName, child.icon, pRows[0].id, cIdx + 1,
           `e.g., ${child.displayName} Crew`, `e.g., Connect over ${child.displayName.toLowerCase()}`,
           `e.g., A seeded ${child.displayName} category for automated create-bubble tests.`],
        );
        categoryCount++;
      }
    }
    console.log(`[qa-seed] created ${categoryCount} categories (${categoryTree.length} groups + children)`);

    const userCount = Object.keys(roles).length + 1;
    await appendEntry(pool, {
      author: "qa-seed",
      observation: `reset+seeded smoke fixtures v3: ${userCount} role users, ${bubbleCount} bubble(s), ${membershipCount} membership(s), 1 bubble rule, 1 event.`,
      tags: ["env:test", "data-class:synthetic", "seed:smoke-v3", "destructive-ok"],
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
