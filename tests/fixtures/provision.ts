/**
 * One-time provisioning of the dedicated test database:
 *   1. Push the app schema (drizzle-kit) into TEST_DATABASE_URL.
 *   2. Ensure the meta schema + journal exist.
 *   3. Bootstrap an `env:test` journal entry so the seed guard recognizes this DB.
 *
 * Assumes the database already exists (e.g. `createdb bubble_test`).
 * Run:  TEST_DATABASE_URL=postgresql://localhost/bubble_test npm run qa:provision
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makePool, ensureJournal, appendEntry, classify, currentDbName } from "./journal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

async function main(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set. Point it at a dedicated test DB.");

  console.log(`[qa-provision] pushing app schema into ${url} ...`);
  execSync("node ./node_modules/.bin/drizzle-kit push", {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });

  const pool = makePool(url);
  try {
    await ensureJournal(pool);
    const dbName = await currentDbName(pool);
    if ((await classify(pool)) !== "test") {
      await appendEntry(pool, {
        author: "qa-provision",
        observation: `provisioned dedicated test DB '${dbName}' (app schema pushed, meta journal created).`,
        tags: ["env:test", "destructive-ok", "data-class:synthetic"],
      });
      console.log(`[qa-provision] bootstrapped env:test journal entry for '${dbName}'.`);
    } else {
      console.log(`[qa-provision] '${dbName}' already classified 'test'.`);
    }
  } finally {
    await pool.end();
  }
  console.log("[qa-provision] done. Next: npm run qa:seed");
}

main().catch((err) => {
  console.error("[qa-provision] FAILED:", err.message ?? err);
  process.exit(1);
});
