import { db } from "./db";
import { latencyBuckets } from "@shared/schema";
import { lt, gte, sql } from "drizzle-orm";

const BUCKET_MS = 5 * 60 * 1000;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export async function ensureLatencyBucketsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "latency_buckets" (
      "id" serial PRIMARY KEY NOT NULL,
      "method" text NOT NULL,
      "endpoint" text NOT NULL,
      "bucket_ts" timestamp NOT NULL,
      "p50_ms" integer NOT NULL,
      "p95_ms" integer NOT NULL,
      "p99_ms" integer NOT NULL,
      "avg_ms" integer NOT NULL,
      "max_ms" integer NOT NULL,
      "count" integer NOT NULL,
      "error_count" integer NOT NULL DEFAULT 0,
      CONSTRAINT "latency_buckets_endpoint_method_ts_unique"
        UNIQUE("method", "endpoint", "bucket_ts")
    );
    CREATE INDEX IF NOT EXISTS "latency_buckets_bucket_ts_idx"
      ON "latency_buckets" ("bucket_ts");
    CREATE INDEX IF NOT EXISTS "latency_buckets_endpoint_method_idx"
      ON "latency_buckets" ("method", "endpoint");
  `);
}

interface SampleIn {
  durationMs: number;
  statusCode: number;
  ts: number;
}

export async function flushBucketsForKey(
  method: string,
  endpoint: string,
  samples: SampleIn[],
  sinceTs: number,
  includeCurrent = true,
): Promise<void> {
  if (samples.length === 0) return;

  const now = Date.now();
  const currentBucketStart = Math.floor(now / BUCKET_MS) * BUCKET_MS;

  const bucketed = new Map<number, SampleIn[]>();
  for (const s of samples) {
    if (s.ts < sinceTs) continue;
    if (!includeCurrent && s.ts >= currentBucketStart) continue;
    const bucketStart = Math.floor(s.ts / BUCKET_MS) * BUCKET_MS;
    if (!bucketed.has(bucketStart)) bucketed.set(bucketStart, []);
    bucketed.get(bucketStart)!.push(s);
  }

  if (bucketed.size === 0) return;

  const rows = [];
  for (const [bucketStart, bSamples] of bucketed.entries()) {
    const durations = bSamples.map((s) => s.durationMs).sort((a, b) => a - b);
    const errorCount = bSamples.filter((s) => s.statusCode >= 500).length;
    const sum = durations.reduce((a, b) => a + b, 0);
    rows.push({
      method,
      endpoint,
      bucketTs: new Date(bucketStart),
      p50Ms: Math.round(percentile(durations, 50)),
      p95Ms: Math.round(percentile(durations, 95)),
      p99Ms: Math.round(percentile(durations, 99)),
      avgMs: Math.round(sum / durations.length),
      maxMs: Math.round(durations[durations.length - 1] ?? 0),
      count: durations.length,
      errorCount,
    });
  }

  if (rows.length === 0) return;

  await db
    .insert(latencyBuckets)
    .values(rows)
    .onConflictDoUpdate({
      target: [latencyBuckets.method, latencyBuckets.endpoint, latencyBuckets.bucketTs],
      set: {
        p50Ms: sql`excluded.p50_ms`,
        p95Ms: sql`excluded.p95_ms`,
        p99Ms: sql`excluded.p99_ms`,
        avgMs: sql`excluded.avg_ms`,
        maxMs: sql`excluded.max_ms`,
        count: sql`excluded.count`,
        errorCount: sql`excluded.error_count`,
      },
    });
}

export interface DBTrendBucket {
  ts: number;
  p50Ms: number;
  p95Ms: number;
  avgMs: number;
  count: number;
}

export interface DBEndpointTrend {
  method: string;
  endpoint: string;
  buckets: DBTrendBucket[];
}

const RANGE_WINDOW_MS: Record<"1h" | "6h" | "24h", number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
};

export async function getTimeSeriesFromDB(
  range: "1h" | "6h" | "24h",
): Promise<DBEndpointTrend[]> {
  const windowMs = RANGE_WINDOW_MS[range];
  const since = new Date(Date.now() - windowMs);

  const rows = await db
    .select()
    .from(latencyBuckets)
    .where(gte(latencyBuckets.bucketTs, since))
    .orderBy(latencyBuckets.bucketTs);

  const grouped = new Map<string, DBEndpointTrend>();
  for (const row of rows) {
    const key = `${row.method} ${row.endpoint}`;
    if (!grouped.has(key)) {
      grouped.set(key, { method: row.method, endpoint: row.endpoint, buckets: [] });
    }
    grouped.get(key)!.buckets.push({
      ts: row.bucketTs.getTime(),
      p50Ms: row.p50Ms,
      p95Ms: row.p95Ms,
      avgMs: row.avgMs,
      count: row.count,
    });
  }

  return Array.from(grouped.values());
}

export interface SystemWideTrendBucket {
  ts: number;
  p95Ms: number;
  maxP95Ms: number;
  totalCount: number;
}

export async function getSystemWideTrendFromDB(
  range: "1h" | "6h" | "24h",
): Promise<SystemWideTrendBucket[]> {
  const windowMs = RANGE_WINDOW_MS[range];
  const since = new Date(Date.now() - windowMs);

  const rows = await db
    .select()
    .from(latencyBuckets)
    .where(gte(latencyBuckets.bucketTs, since))
    .orderBy(latencyBuckets.bucketTs);

  const byTs = new Map<number, { maxP95: number; totalCount: number; weightedSum: number }>();
  for (const row of rows) {
    const ts = row.bucketTs.getTime();
    const existing = byTs.get(ts);
    if (!existing) {
      byTs.set(ts, { maxP95: row.p95Ms, totalCount: row.count, weightedSum: row.p95Ms * row.count });
    } else {
      existing.maxP95 = Math.max(existing.maxP95, row.p95Ms);
      existing.totalCount += row.count;
      existing.weightedSum += row.p95Ms * row.count;
    }
  }

  return Array.from(byTs.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, { maxP95, totalCount, weightedSum }]) => ({
      ts,
      p95Ms: totalCount > 0 ? Math.round(weightedSum / totalCount) : 0,
      maxP95Ms: maxP95,
      totalCount,
    }));
}

export async function pruneOldLatencyBuckets(olderThanDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await db.delete(latencyBuckets).where(lt(latencyBuckets.bucketTs, cutoff));
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}
