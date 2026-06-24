/**
 * TEST RUNNER (dev only) for server/prod-import.ts.
 *
 * Exercises the exact production import code path against the target database
 * pointed to by DATABASE_URL (in dev this is the helium managed DB, which
 * already holds the real data). A truncate+reload from OLD_DATABASE_URL must
 * reproduce the source counts exactly. Clears the completion flag afterward so
 * dev is unaffected.
 *
 * Run:  npx tsx scripts/run-prod-import.ts
 */
import pg from "pg";
import { importProdData } from "../server/prod-import";
import { pool } from "../server/db";

const { Pool } = pg;
const FLAG_KEY = "prod_real_data_imported";

const TABLES = ["users", "bubbles", "events", "memberships", "event_attendees", "categories"];

async function counts(client: pg.PoolClient | pg.Pool, label: string) {
  const out: Record<string, number> = {};
  for (const t of TABLES) {
    try {
      const r = await client.query(`SELECT COUNT(*)::int AS c FROM "${t}"`);
      out[t] = r.rows[0].c;
    } catch {
      out[t] = -1;
    }
  }
  console.log(`\n[${label}]`, JSON.stringify(out));
  return out;
}

async function main() {
  const srcUrl = process.env.OLD_DATABASE_URL!;
  const srcPool = new Pool({
    connectionString: srcUrl,
    ssl: /neon\.tech|sslmode=require/i.test(srcUrl) ? { rejectUnauthorized: false } : undefined,
  });

  // Make sure we actually run: clear any pre-existing flag and allow the
  // destructive overwrite (helium already holds the real data).
  process.env.PROD_IMPORT_OVERWRITE = "true";
  await pool.query(`DELETE FROM app_config WHERE key = $1`, [FLAG_KEY]);

  const srcCounts = await counts(srcPool, "SOURCE (Neon)");
  await counts(pool, "TARGET before");

  const ok = await importProdData();
  console.log(`\nimportProdData() returned: ${ok}`);

  const tgtCounts = await counts(pool, "TARGET after");

  let allMatch = true;
  for (const t of TABLES) {
    if (srcCounts[t] !== tgtCounts[t]) {
      allMatch = false;
      console.log(`  MISMATCH ${t}: source=${srcCounts[t]} target=${tgtCounts[t]}`);
    }
  }

  // Confirm the flag was set, then clear it so dev is unaffected.
  const flag = await pool.query(`SELECT value FROM app_config WHERE key = $1`, [FLAG_KEY]);
  console.log(`\nflag after import: ${flag.rows[0]?.value ?? "(none)"}`);
  await pool.query(`DELETE FROM app_config WHERE key = $1`, [FLAG_KEY]);
  console.log("flag cleared for dev.");

  console.log(`\n=== RESULT: ${ok && allMatch ? "PASS ✓" : "FAIL ✗"} ===`);

  await srcPool.end();
  await pool.end();
  process.exit(ok && allMatch ? 0 : 1);
}

main().catch((e) => {
  console.error("test runner error:", e);
  process.exit(1);
});
