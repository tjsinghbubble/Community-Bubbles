/**
 * meta.testing_journal helpers + the DB-safety classifier used by the production guard.
 *
 * Pure pg (no drizzle, no server/* imports beyond nothing) so it can be used from the
 * runner, the seeder, and gating without dragging in the application's DB pool.
 */
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

export type DbClass = "test" | "production" | "unknown";

/** Databases that must NEVER be targeted by destructive test operations. */
const DESTRUCTIVE_DENYLIST = ["bubble_dev", "postgres", "template0", "template1"];

export function resolveDbUrl(explicit?: string): string {
  const url = explicit ?? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No database URL. Set TEST_DATABASE_URL (preferred) or DATABASE_URL.",
    );
  }
  return url;
}

export function makePool(explicitUrl?: string): pg.Pool {
  return new Pool({ connectionString: resolveDbUrl(explicitUrl) });
}

/** Create the meta schema + journal if they don't exist (idempotent). */
export async function ensureJournal(pool: pg.Pool): Promise<void> {
  const ddl = readFileSync(join(__dirname, "meta-schema.sql"), "utf8");
  await pool.query(ddl);
}

export interface JournalEntryInput {
  observation: string;
  author?: string;
  tags?: string[];
}

export async function appendEntry(
  pool: pg.Pool,
  entry: JournalEntryInput,
): Promise<void> {
  await pool.query(
    `INSERT INTO meta.testing_journal (observation, author, tags) VALUES ($1, $2, $3)`,
    [entry.observation.slice(0, 500), entry.author ?? null, entry.tags ?? null],
  );
}

export interface JournalRow {
  entry_id: string;
  entry_time: Date;
  observation: string;
  author: string | null;
  tags: string[] | null;
}

/** Most recent journal entry that carries an `env:*` tag, or null. */
export async function latestEnvEntry(pool: pg.Pool): Promise<JournalRow | null> {
  const { rows } = await pool.query<JournalRow>(
    `SELECT entry_id, entry_time, observation, author, tags
       FROM meta.testing_journal
      WHERE tags && ARRAY(SELECT t FROM unnest(tags) t WHERE t LIKE 'env:%')
      ORDER BY entry_time DESC, entry_id DESC
      LIMIT 1`,
  );
  return rows[0] ?? null;
}

/** Latest-entry-wins classification of the DB based on its newest env:* journal tag. */
export async function classify(pool: pg.Pool): Promise<DbClass> {
  const entry = await latestEnvEntry(pool);
  if (!entry?.tags) return "unknown";
  const envTag = entry.tags.find((t) => t.startsWith("env:"));
  const value = envTag?.slice("env:".length);
  if (value === "test" || value === "local" || value === "ci") return "test";
  if (value === "staging" || value === "production" || value === "production-like") {
    return "production";
  }
  return "unknown";
}

export async function currentDbName(pool: pg.Pool): Promise<string> {
  const { rows } = await pool.query<{ n: string }>("SELECT current_database() AS n");
  return rows[0].n;
}

export interface GuardResult {
  dbName: string;
  classification: DbClass;
  /** True when the DB was unclassified but allowed by name/flag; caller should record env:test. */
  needsBootstrap: boolean;
}

/**
 * Fail-closed guard for destructive operations (reset/seed). Throws unless the target is a
 * dedicated test DB. Never returns for production-classified or denylisted databases.
 */
export async function assertDestructiveAllowed(
  pool: pg.Pool,
  opts: { allowInit?: boolean } = {},
): Promise<GuardResult> {
  const dbName = await currentDbName(pool);

  if (DESTRUCTIVE_DENYLIST.includes(dbName)) {
    throw new Error(
      `fail closed: '${dbName}' is a known non-test database — refusing destructive op. ` +
        `Point TEST_DATABASE_URL at a dedicated test DB (e.g. bubble_test).`,
    );
  }

  const classification = await classify(pool);
  if (classification === "production") {
    const entry = await latestEnvEntry(pool);
    throw new Error(
      `fail closed: meta.testing_journal classifies '${dbName}' as production-like ` +
        `(latest env entry: "${entry?.observation ?? "?"}"). ` +
        `Destructive ops blocked. Append a later env:test entry to override.`,
    );
  }
  if (classification === "test") {
    return { dbName, classification, needsBootstrap: false };
  }

  // unknown:
  const looksTest = /_test$|^bubble_test$|test/.test(dbName);
  const allowInit = opts.allowInit || process.env.QA_ALLOW_INIT === "1";
  if (looksTest || allowInit) {
    return { dbName, classification, needsBootstrap: true };
  }
  throw new Error(
    `fail closed: '${dbName}' is unclassified and does not look like a test DB. ` +
      `Set QA_ALLOW_INIT=1 to bootstrap it, or append an env:test journal entry first.`,
  );
}
