/**
 * Database fingerprints recorded in the journal.
 *
 * Rationale: comparing two databases (or one DB against an expected state) row-by-row is
 * O(rows) and expensive across servers. A compact per-table signature lets you compare in
 * O(tables) by hashing instead. Two independent fingerprints:
 *
 *   - schemaSignature: hash of information_schema column layout. Trivially cheap (no table
 *     scan). Powers the drift gate that catches the `users.suspended_at`-class problem up
 *     front instead of as a buried runtime error.
 *   - rowCounts: per-table count(*) + a rollup. Cheap state fingerprint ("is this DB in the
 *     expected seeded shape?", e.g. users=4).
 *
 * FUTURE (not implemented — see TAXONOMY.md): full per-table CONTENT hashes, for tests that
 * require specific predefined content to pass and for comparing two servers' data without
 * shipping rows (e.g. image-cache-on vs off perf runs).
 *
 * The journal stores only the SHORT rollups (per the journaling design); the per-table schema
 * detail lives in meta.schema_baseline so drift can name the exact column.
 *
 * CLI:  npm run qa:sig         # print current signatures + drift vs baseline
 */
import pg from "pg";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { makePool, ensureJournal, appendEntry } from "./journal.js";

function md5(s: string): string {
  return createHash("md5").update(s).digest("hex");
}
const short = (hex: string) => hex.slice(0, 8);

export interface SchemaSig {
  rollup: string; // short (8 hex)
  perTable: Record<string, string>; // table -> sorted column-def string
  tableCount: number;
  columnCount: number;
}

/** Hash the public-schema column layout. Order-insensitive (sorted by name) so a harmless
 *  column reorder is not flagged as drift; type/nullability/default changes ARE flagged. */
export async function schemaSignature(pool: pg.Pool): Promise<SchemaSig> {
  const { rows } = await pool.query<{
    table_name: string; column_name: string; data_type: string;
    is_nullable: string; column_default: string;
  }>(
    `SELECT table_name, column_name, data_type, is_nullable,
            COALESCE(column_default, '') AS column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, column_name`,
  );
  const perTableCols: Record<string, string[]> = {};
  for (const r of rows) {
    (perTableCols[r.table_name] ??= []).push(
      `${r.column_name}:${r.data_type}:${r.is_nullable}:${r.column_default}`,
    );
  }
  const perTable: Record<string, string> = {};
  for (const [t, cols] of Object.entries(perTableCols)) perTable[t] = cols.join("\n");
  const canonical = Object.keys(perTable).sort().map((t) => `# ${t}\n${perTable[t]}`).join("\n");
  return {
    rollup: short(md5(canonical)),
    perTable,
    tableCount: Object.keys(perTable).length,
    columnCount: rows.length,
  };
}

export interface RowSig {
  rollup: string;
  perTable: Record<string, number>;
  total: number;
}

/** Exact per-table row counts (fine for small test DBs). */
export async function rowCounts(pool: pg.Pool): Promise<RowSig> {
  const { rows: tables } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  const perTable: Record<string, number> = {};
  let total = 0;
  for (const { tablename } of tables) {
    const { rows } = await pool.query<{ c: string }>(`SELECT count(*)::text AS c FROM "${tablename}"`);
    const n = parseInt(rows[0].c, 10);
    perTable[tablename] = n;
    total += n;
  }
  const canonical = Object.keys(perTable).sort().map((t) => `${t}=${perTable[t]}`).join(",");
  return { rollup: short(md5(canonical)), perTable, total };
}

/** Capture the schema baseline into meta.schema_baseline (replacing any prior) and record a
 *  short schema-sig entry in the journal. Called at provision time. */
export async function recordSchemaBaseline(pool: pg.Pool, label: string): Promise<SchemaSig> {
  const sig = await schemaSignature(pool);
  await pool.query("TRUNCATE meta.schema_baseline");
  for (const [table, def] of Object.entries(sig.perTable)) {
    await pool.query(
      `INSERT INTO meta.schema_baseline (table_name, column_def, rollup, label)
       VALUES ($1, $2, $3, $4)`,
      [table, def, sig.rollup, label],
    );
  }
  await appendEntry(pool, {
    author: "qa-signatures",
    observation: `captured schema baseline (${label}): schema-sig=${sig.rollup} (${sig.tableCount} tables, ${sig.columnCount} cols).`,
    tags: ["schema-sig:" + sig.rollup, "schema-baseline"],
  });
  return sig;
}

export interface Baseline {
  rollup: string;
  perTable: Record<string, string>;
}

export async function readSchemaBaseline(pool: pg.Pool): Promise<Baseline | null> {
  const { rows } = await pool.query<{ table_name: string; column_def: string; rollup: string }>(
    "SELECT table_name, column_def, rollup FROM meta.schema_baseline",
  );
  if (rows.length === 0) return null;
  const perTable: Record<string, string> = {};
  for (const r of rows) perTable[r.table_name] = r.column_def;
  return { rollup: rows[0].rollup, perTable };
}

/** Human-readable schema differences (missing/extra tables, per-table column add/remove). */
export function diffSchema(current: Record<string, string>, baseline: Record<string, string>): string[] {
  const out: string[] = [];
  const curTables = Object.keys(current);
  const baseTables = Object.keys(baseline);
  for (const t of baseTables) if (!curTables.includes(t)) out.push(`table removed: ${t}`);
  for (const t of curTables) if (!baseTables.includes(t)) out.push(`table added: ${t}`);
  const cols = (def: string): Record<string, string> =>
    Object.fromEntries(def.split("\n").map((l) => [l.split(":")[0], l]));
  for (const t of baseTables) {
    if (!curTables.includes(t) || current[t] === baseline[t]) continue;
    const curCols = cols(current[t]);
    const baseCols = cols(baseline[t]);
    for (const c of Object.keys(baseCols)) if (!(c in curCols)) out.push(`${t}.${c} missing`);
    for (const c of Object.keys(curCols)) if (!(c in baseCols)) out.push(`${t}.${c} added`);
    for (const c of Object.keys(baseCols)) if (c in curCols && curCols[c] !== baseCols[c]) out.push(`${t}.${c} changed`);
  }
  return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const pool = makePool();
  try {
    await ensureJournal(pool);
    const schema = await schemaSignature(pool);
    const rows = await rowCounts(pool);
    console.log(`schema-sig: ${schema.rollup}  (${schema.tableCount} tables, ${schema.columnCount} cols)`);
    console.log(`rows-sig:   ${rows.rollup}  (${rows.total} rows across ${Object.keys(rows.perTable).length} tables)`);
    const baseline = await readSchemaBaseline(pool);
    if (!baseline) {
      console.log("baseline:   (none recorded — run npm run qa:provision)");
    } else if (baseline.rollup === schema.rollup) {
      console.log(`baseline:   MATCH (${baseline.rollup})`);
    } else {
      console.log(`baseline:   DRIFT (live ${schema.rollup} vs baseline ${baseline.rollup})`);
      for (const d of diffSchema(schema.perTable, baseline.perTable)) console.log(`  - ${d}`);
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("[qa-signatures] FAILED:", err.message ?? err);
    process.exit(1);
  });
}
