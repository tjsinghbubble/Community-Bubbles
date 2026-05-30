// Generates docs/db-schema-snapshot.json from shared/schema.ts.
// Run automatically via lint-staged when shared/schema.ts changes,
// or manually: tsx scripts/generate-db-snapshot.ts

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '../shared/schema';

const __dirname = dirname(fileURLToPath(import.meta.url));

const IsDrizzleTable = Symbol.for('drizzle:IsDrizzleTable');

function isPgTable(v: unknown): boolean {
  return Boolean(v && typeof v === 'object' && (v as Record<symbol, unknown>)[IsDrizzleTable]);
}

type ColumnEntry = { column: string; type: string; notNull: boolean; hasDefault: boolean };
const snapshot: Record<string, ColumnEntry[]> = {};

for (const value of Object.values(schema)) {
  if (!isPgTable(value)) continue;
  const cfg = getTableConfig(value as Parameters<typeof getTableConfig>[0]);
  snapshot[cfg.name] = cfg.columns.map(col => ({
    column: col.name,
    type: col.columnType,
    notNull: col.notNull,
    hasDefault: col.hasDefault,
  }));
}

const outPath = resolve(__dirname, '../docs/db-schema-snapshot.json');
writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n');
console.log(
  `[generate-db-snapshot] ${Object.keys(snapshot).length} tables → docs/db-schema-snapshot.json`,
);
