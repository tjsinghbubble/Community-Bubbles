// Validates the live database against docs/db-schema-snapshot.json.
// Checks connectivity, catalog presence, and column-level shape.
// Usage: tsx scripts/check-db-schema.ts
// Exit 0 = fully consistent. Exit 1 = missing tables or columns.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Load snapshot --------------------------------------------------------

const snapshotPath = resolve(__dirname, '../docs/db-schema-snapshot.json');
type ColumnEntry = { column: string; type: string; notNull: boolean; hasDefault: boolean };
const snapshot: Record<string, ColumnEntry[]> = JSON.parse(
  readFileSync(snapshotPath, 'utf8'),
);

// --- Connect to DB --------------------------------------------------------

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌  DATABASE_URL is not set — cannot validate schema');
  console.error('    Set it in .env or ~/.bubble_secrets');
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl });

try {
  await client.connect();
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const safeUrl = dbUrl.replace(/:\/\/[^@]+@/, '://<credentials>@');
  console.error(`❌  Cannot connect to database: ${msg}`);
  console.error(`    DATABASE_URL: ${safeUrl}`);
  console.error('    Is PostgreSQL running?  pg_isready');
  process.exit(1);
}

// --- Check catalog --------------------------------------------------------

const { rows: catalogRows } = await client.query<{ db: string }>(
  'SELECT current_database() AS db',
);
const actualDb = catalogRows[0].db;

// --- Fetch all columns in one query ---------------------------------------

const tableNames = Object.keys(snapshot);
const { rows: colRows } = await client.query<{ table_name: string; column_name: string }>(
  `SELECT table_name, column_name
   FROM information_schema.columns
   WHERE table_schema = 'public'
   AND   table_name   = ANY($1)
   ORDER BY table_name, ordinal_position`,
  [tableNames],
);

await client.end();

// --- Build DB column map --------------------------------------------------

const dbCols: Record<string, Set<string>> = {};
for (const { table_name, column_name } of colRows) {
  (dbCols[table_name] ??= new Set()).add(column_name);
}

// --- Compare --------------------------------------------------------------

let errors = 0;
let warnings = 0;

for (const [table, columns] of Object.entries(snapshot)) {
  if (!dbCols[table]) {
    console.error(`❌  Table missing:  ${table}`);
    errors++;
    continue;
  }
  for (const { column } of columns) {
    if (!dbCols[table].has(column)) {
      console.error(`❌  Column missing: ${table}.${column}`);
      errors++;
    }
  }
  const schemaColNames = new Set(columns.map(c => c.column));
  for (const dbCol of dbCols[table]) {
    if (!schemaColNames.has(dbCol)) {
      console.warn(`⚠️   Orphaned column: ${table}.${dbCol}  (in DB, not in schema)`);
      warnings++;
    }
  }
}

// --- Report ---------------------------------------------------------------

const tableCount = tableNames.length;
if (errors === 0 && warnings === 0) {
  console.log(`✅  Schema OK — ${tableCount} tables match snapshot  (database: ${actualDb})`);
  process.exit(0);
}
if (errors === 0) {
  console.log(`\n✅  No missing columns (${warnings} orphaned column(s) in DB — harmless but worth cleaning up)`);
  console.log(`    database: ${actualDb}`);
  process.exit(0);
}
console.error(`\n${errors} error(s), ${warnings} warning(s)  (database: ${actualDb})`);
console.error('Fix options:');
console.error('  • Add a RENAME COLUMN or ALTER TABLE statement to server/auto-migrate.ts');
console.error('  • Or run: npm run db:push:local   (interactive — will prompt for rename vs. add)');
process.exit(1);
