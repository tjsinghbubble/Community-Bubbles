/**
 * Create a quantity of namespaced, never-used accounts for volume/perf tests.
 *
 * Emails follow tests/config/roles.json `bulkUsers.emailTemplate`
 * (test-db-speed-{N}@bb.org). Idempotent: existing accounts (matched by email_hash) are
 * skipped, so re-running just tops up. Non-destructive, but still refuses production-classified
 * or denylisted databases as a precaution.
 *
 * Run:  npm run qa:bulk -- --n 200 [--start 1]
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import bcrypt from "bcrypt";
import { encryptField, hashField } from "../../server/encryption.js";
import { makePool, ensureJournal, appendEntry, classify, currentDbName } from "./journal.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DENYLIST = ["bubble_dev", "postgres"];

function parseArgs(argv: string[]): { n: number; start: number } {
  let n = 200;
  let start = 1;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--n") n = parseInt(argv[++i], 10);
    else if (argv[i] === "--start") start = parseInt(argv[++i], 10);
  }
  if (!Number.isFinite(n) || n <= 0) throw new Error("--n must be a positive integer");
  return { n, start };
}

function loadBulkConfig(): { emailTemplate: string; password: string } {
  const cfg = JSON.parse(readFileSync(join(__dirname, "../config/roles.json"), "utf8"));
  return cfg.bulkUsers;
}

async function main(): Promise<void> {
  const { n, start } = parseArgs(process.argv.slice(2));
  const { emailTemplate, password } = loadBulkConfig();

  const pool = makePool();
  try {
    await ensureJournal(pool);
    const dbName = await currentDbName(pool);
    const cls = await classify(pool);
    if (DENYLIST.includes(dbName) || cls === "production") {
      throw new Error(
        `fail closed: refusing to create bulk users on '${dbName}' (classification='${cls}').`,
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let created = 0;
    let skipped = 0;
    for (let i = start; i < start + n; i++) {
      const email = emailTemplate.replace("{N}", String(i));
      const emailHash = hashField(email);
      const exists = await pool.query("SELECT 1 FROM users WHERE email_hash = $1", [emailHash]);
      if (exists.rowCount && exists.rowCount > 0) {
        skipped++;
        continue;
      }
      await pool.query(
        `INSERT INTO users (name, email, email_hash, password, interests, is_super_admin)
         VALUES ($1, $2, $3, $4, '{}', false)`,
        [`Bulk User ${i}`, encryptField(email), emailHash, hashedPassword],
      );
      created++;
    }

    await appendEntry(pool, {
      author: "qa-bulk",
      observation: `bulk users: created ${created}, skipped ${skipped} (range ${start}..${start + n - 1}, template ${emailTemplate}).`,
      tags: ["env:test", "data-class:synthetic", "fixture:bulk-users"],
    });

    console.log(`[qa-bulk] created ${created}, skipped ${skipped} on '${dbName}'.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[qa-bulk] FAILED:", err.message ?? err);
  process.exit(1);
});
