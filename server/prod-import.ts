import pg from "pg";
import { pool } from "./db";

const { Pool } = pg;
const LOG = "[prod-import]";
const FLAG_KEY = "prod_real_data_imported";

/**
 * One-time, guarded, transactional import of the real production data from the
 * external source database (OLD_DATABASE_URL) into the app's own database
 * (DATABASE_URL — Replit's managed production DB when deployed).
 *
 * Design notes:
 *  - Runs only when the `prod_real_data_imported` flag is NOT set in app_config.
 *  - Copies the intersection of columns that exist in BOTH databases with a
 *    compatible base type (timestamptz≡timestamp, text≡varchar), so schema drift
 *    between the older source and the current schema is handled automatically.
 *  - Operational / telemetry / incompatible tables are skipped.
 *  - The whole load runs inside ONE transaction. Tables are emptied children-first
 *    and reloaded parents-first using a topological sort of the live FK graph, so
 *    we never need to disable FK enforcement (the managed prod DB does NOT grant
 *    permission to set session_replication_role). On ANY error the transaction
 *    rolls back — no partial state — and the function returns false WITHOUT
 *    crashing the server.
 *  - The completion flag is written inside the same transaction so it is only set
 *    if the entire import committed successfully.
 *
 * @returns true if the real data is present (already imported, or imported now),
 *          false if the import did not run / failed (caller may fall back to the
 *          demo seed).
 */
export async function importProdData(): Promise<boolean> {
  // Already done? (flag lives in app_config, which is never truncated)
  try {
    const flag = await pool.query(
      `SELECT value FROM app_config WHERE key = $1 LIMIT 1`,
      [FLAG_KEY],
    );
    if (flag.rows.length && flag.rows[0].value === "true") {
      console.log(`${LOG} Real data already imported (flag set) — skipping`);
      return true;
    }
  } catch (e) {
    console.warn(`${LOG} Could not read import flag (continuing):`, e);
  }

  const sourceUrl = process.env.OLD_DATABASE_URL;
  if (!sourceUrl) {
    console.warn(`${LOG} OLD_DATABASE_URL not set — skipping import`);
    return false;
  }

  const srcPool = new Pool({
    connectionString: sourceUrl,
    ssl: needsSsl(sourceUrl) ? { rejectUnauthorized: false } : undefined,
  });

  let src: pg.PoolClient | undefined;
  let tgt: pg.PoolClient | undefined;
  try {
    src = await srcPool.connect();
    tgt = await pool.connect();

    await src.query(`SET TimeZone = 'UTC'`);

    const targetCols = await columnsMap(tgt);
    const sourceCols = await columnsMap(src);

    // Decide which tables to copy + which columns within each.
    const plan: TablePlan[] = [];
    for (const table of Object.keys(targetCols)) {
      if (shouldSkip(table) || !sourceCols[table]) continue;
      const srcTable = sourceCols[table];
      const shared = (targetCols[table] as ColMeta[]).filter(
        (c) =>
          srcTable[c.name] !== undefined &&
          baseType(c.type) === baseType(srcTable[c.name]),
      );
      if (shared.length === 0) continue;
      plan.push({
        name: table,
        cols: shared.map((c) => c.name),
        jsonCols: new Set(
          shared.filter((c) => c.type === "json" || c.type === "jsonb").map((c) => c.name),
        ),
        targetMeta: targetCols[table],
      });
    }

    if (plan.length === 0) {
      console.warn(`${LOG} No compatible tables found — skipping import`);
      return false;
    }

    // ── Safety gate ─────────────────────────────────────────────────────────
    // The import REPLACES the contents of the planned tables. If the target
    // already holds data (e.g. real signups created after launch), refuse to
    // overwrite it unless explicitly allowed via PROD_IMPORT_OVERWRITE=true.
    // This makes the destructive first run a deliberate, opt-in action.
    const existing = await tgt.query(`SELECT COUNT(*)::int AS c FROM users`);
    const targetHasData = (existing.rows[0]?.c ?? 0) > 0;
    const overwriteAllowed = process.env.PROD_IMPORT_OVERWRITE === "true";
    if (targetHasData && !overwriteAllowed) {
      console.warn(
        `${LOG} Target already contains ${existing.rows[0].c} users — refusing to overwrite. ` +
          `Set PROD_IMPORT_OVERWRITE=true to replace it with the imported data.`,
      );
      return false;
    }

    // Order the planned tables parents-first from the live FK graph so we can
    // load with FK enforcement ON (the managed prod DB does not let us turn it
    // off). Deletes run in the reverse (children-first) order.
    const ordered = await topoSortPlan(tgt, plan);

    // Preflight: a NON-imported table that holds rows and FK-references one of
    // the planned (parent) tables would make our scoped DELETE fail mid-load.
    // Detect that up front and abort cleanly with an explicit message rather
    // than discovering it as an FK violation after BEGIN.
    const blockers = await findBlockingChildren(tgt, new Set(plan.map((t) => t.name)));
    if (blockers.length) {
      console.warn(
        `${LOG} Refusing to import — these non-imported tables reference imported ` +
          `data and still hold rows (delete would fail): ` +
          blockers.map((b) => `${b.table}(${b.count})`).join(", "),
      );
      return false;
    }

    await tgt.query("BEGIN");
    await tgt.query(`SET TimeZone = 'UTC'`);

    // Empty ONLY the planned tables, children-first (scoped DELETE, not TRUNCATE
    // CASCADE) so non-imported tables that merely FK-reference these are left
    // untouched and the deletes don't violate foreign keys.
    for (let i = ordered.length - 1; i >= 0; i--) {
      await tgt.query(`DELETE FROM ${ident(ordered[i].name)}`);
    }

    let totalRows = 0;
    // Insert parents-first so every FK target already exists when its child loads.
    for (const t of ordered) {
      const n = await copyTable(src, tgt, t);
      totalRows += n;
      console.log(`${LOG}   ${t.name}: ${n} rows`);
    }

    // Reset serial/identity sequences to MAX(id) so future inserts don't collide.
    for (const t of plan) {
      for (const col of t.targetMeta) {
        if (!t.cols.includes(col.name)) continue;
        if (!col.default || !/nextval/i.test(col.default)) continue;
        const seq = await tgt.query(`SELECT pg_get_serial_sequence($1, $2) AS s`, [
          t.name,
          col.name,
        ]);
        const seqName = seq.rows[0]?.s;
        if (seqName) {
          await tgt.query(
            `SELECT setval($1, GREATEST((SELECT COALESCE(MAX(${ident(
              col.name,
            )}), 0) FROM ${ident(t.name)}), 1))`,
            [seqName],
          );
        }
      }
    }

    // Mark complete — inside the same transaction, so it only sticks on success.
    await tgt.query(
      `INSERT INTO app_config (key, value) VALUES ($1, 'true')
       ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()`,
      [FLAG_KEY],
    );

    await tgt.query("COMMIT");
    console.log(
      `${LOG} Import complete — ${totalRows} rows across ${plan.length} tables`,
    );
    return true;
  } catch (e) {
    if (tgt) {
      try {
        await tgt.query("ROLLBACK");
      } catch {
        /* ignore */
      }
    }
    console.error(
      `${LOG} Import FAILED — rolled back, no data changed, app continues:`,
      e,
    );
    return false;
  } finally {
    src?.release();
    tgt?.release();
    await srcPool.end().catch(() => {});
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

interface ColMeta {
  name: string;
  type: string;
  default: string | null;
}
interface TablePlan {
  name: string;
  cols: string[];
  jsonCols: Set<string>;
  targetMeta: ColMeta[];
}

/** Tables we never import: telemetry/operational, or schema-incompatible. */
const SKIP_TABLES = new Set<string>([
  "app_config", // holds our flag; must survive the truncate
  "api_latency_samples",
  "error_logs",
  "feedback", // legacy integer PK vs current uuid — incompatible
  "slow_calls",
  "crash_reports",
  "session",
  "sessions",
]);

function shouldSkip(table: string): boolean {
  return SKIP_TABLES.has(table) || table.startsWith("_");
}

/** Collapse interchangeable Postgres types so older source columns still match. */
function baseType(t: string): string {
  if (t.startsWith("timestamp")) return "timestamp";
  if (t === "character varying" || t === "text" || t === "character") return "text";
  return t;
}

function needsSsl(url: string): boolean {
  return /sslmode=require/i.test(url) || /neon\.tech/i.test(url);
}

function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

async function columnsMap(client: pg.PoolClient): Promise<Record<string, any>> {
  // Returns { [table]: ColMeta[] } where each array is ALSO indexable by column
  // name -> data_type, so callers can do sourceCols[table][colName].
  const res = await client.query(
    `SELECT table_name, column_name, data_type, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position`,
  );
  const map: Record<string, ColMeta[]> = {};
  for (const row of res.rows) {
    (map[row.table_name] ||= []).push({
      name: row.column_name,
      type: row.data_type,
      default: row.column_default,
    });
  }
  // attach a name->type lookup so callers can do sourceCols[table][colName]
  const out: Record<string, any> = {};
  for (const [t, cols] of Object.entries(map)) {
    const lookup: Record<string, string> = {};
    for (const c of cols) lookup[c.name] = c.type;
    out[t] = Object.assign(cols.slice(), lookup);
  }
  return out as any;
}

/**
 * Order the planned tables parents-first using the target DB's live FK graph
 * (Kahn topological sort). The load then inserts in this order and deletes in
 * reverse, so FK enforcement can stay ON. This schema has no self-referencing
 * tables and no FK cycles; if a cycle ever appears, leftover tables are appended
 * (best-effort) and a warning is logged rather than silently dropping them.
 */
async function topoSortPlan(
  client: pg.PoolClient,
  plan: TablePlan[],
): Promise<TablePlan[]> {
  const names = new Set(plan.map((t) => t.name));
  const res = await client.query(
    `SELECT tc.table_name AS child, ccu.table_name AS parent
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'`,
  );

  const children = new Map<string, Set<string>>();
  const indeg = new Map<string, number>();
  for (const name of names) {
    children.set(name, new Set());
    indeg.set(name, 0);
  }
  for (const row of res.rows) {
    const child = row.child as string;
    const parent = row.parent as string;
    if (child === parent) continue; // ignore self-references
    if (!names.has(child) || !names.has(parent)) continue;
    if (!children.get(parent)!.has(child)) {
      children.get(parent)!.add(child);
      indeg.set(child, (indeg.get(child) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [name, d] of indeg) if (d === 0) queue.push(name);
  queue.sort();
  const orderNames: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    orderNames.push(n);
    for (const c of children.get(n)!) {
      const left = indeg.get(c)! - 1;
      indeg.set(c, left);
      if (left === 0) queue.push(c);
    }
  }

  if (orderNames.length < names.size) {
    for (const name of names) {
      if (!orderNames.includes(name)) orderNames.push(name);
    }
    console.warn(`${LOG} FK cycle detected — load order is best-effort`);
  }

  const byName = new Map(plan.map((t) => [t.name, t]));
  return orderNames.map((n) => byName.get(n)!);
}

/**
 * Find non-imported tables that (a) FK-reference a planned (parent) table and
 * (b) still hold rows. Their rows would block our scoped DELETE of the parent,
 * so we detect them up front and abort the import cleanly instead of failing
 * with an FK violation mid-transaction.
 */
async function findBlockingChildren(
  tgt: pg.PoolClient,
  planNames: Set<string>,
): Promise<{ table: string; count: number }[]> {
  const res = await tgt.query(
    `SELECT DISTINCT tc.table_name AS child, ccu.table_name AS parent
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'`,
  );
  const candidates = new Set<string>();
  for (const row of res.rows) {
    const child = row.child as string;
    const parent = row.parent as string;
    // Child is NOT imported, but it references a table we will empty.
    if (!planNames.has(child) && planNames.has(parent)) candidates.add(child);
  }
  const blockers: { table: string; count: number }[] = [];
  for (const table of candidates) {
    const r = await tgt.query(`SELECT COUNT(*)::int AS c FROM ${ident(table)}`);
    const count = r.rows[0]?.c ?? 0;
    if (count > 0) blockers.push({ table, count });
  }
  return blockers;
}

async function copyTable(
  src: pg.PoolClient,
  tgt: pg.PoolClient,
  t: TablePlan,
): Promise<number> {
  const qTable = ident(t.name);
  const colList = t.cols.map(ident).join(", ");
  const { rows } = await src.query(`SELECT ${colList} FROM ${qTable}`);
  if (rows.length === 0) return 0;

  const perRow = t.cols.length;
  const chunkSize = Math.max(1, Math.floor(60000 / perRow));
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const values: unknown[] = [];
    const tuples: string[] = [];
    slice.forEach((row, ri) => {
      const placeholders = t.cols.map((_, ci) => `$${ri * perRow + ci + 1}`);
      tuples.push(`(${placeholders.join(", ")})`);
      for (const c of t.cols) {
        let v = row[c];
        // json/jsonb come back from the driver as parsed JS values; re-serialize
        // them (objects, arrays, and scalars alike) so they're stored as JSON,
        // not as Postgres array/composite literals.
        if (v !== null && t.jsonCols.has(c) && !(v instanceof Date)) {
          v = JSON.stringify(v);
        }
        values.push(v);
      }
    });
    await tgt.query(
      `INSERT INTO ${qTable} (${colList}) VALUES ${tuples.join(", ")}`,
      values,
    );
  }
  return rows.length;
}
