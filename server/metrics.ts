const MAX_SAMPLES_PER_KEY = 500;
const MAX_KEYS = 250;

interface Sample {
  durationMs: number;
  statusCode: number;
  ts: number;
}

const store = new Map<string, Sample[]>();
const lastSeenMap = new Map<string, number>();

function evictOldestKey(): void {
  let oldestKey: string | null = null;
  let oldestTs = Infinity;
  for (const [k, ts] of lastSeenMap.entries()) {
    if (ts < oldestTs) {
      oldestTs = ts;
      oldestKey = k;
    }
  }
  if (oldestKey) {
    store.delete(oldestKey);
    lastSeenMap.delete(oldestKey);
  }
}

const EXCLUDED_PATHS = new Set(["/api/telemetry/latency"]);

export function recordRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
): void {
  if (statusCode === 404) return;
  if (EXCLUDED_PATHS.has(path)) return;

  const normalised = normalisePath(path);
  const key = `${method.toUpperCase()} ${normalised}`;

  let samples = store.get(key);
  if (!samples) {
    if (store.size >= MAX_KEYS) {
      evictOldestKey();
    }
    samples = [];
    store.set(key, samples);
  }

  const now = Date.now();
  samples.push({ durationMs, statusCode, ts: now });
  lastSeenMap.set(key, now);

  if (samples.length > MAX_SAMPLES_PER_KEY) {
    samples.splice(0, samples.length - MAX_SAMPLES_PER_KEY);
  }
}

function normalisePath(path: string): string {
  return path
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ":id";
      if (/^\d+$/.test(seg)) return ":id";
      if (/^[0-9a-f]{16,}$/i.test(seg)) return ":id";
      if (seg.length > 24 && /^[a-z0-9_\-]+$/i.test(seg)) return ":id";
      return seg;
    })
    .join("/");
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export interface EndpointMetric {
  method: string;
  endpoint: string;
  count: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
  maxMs: number;
  errorRate: number;
  lastSeenTs: number;
}

export function getMetrics(): EndpointMetric[] {
  const results: EndpointMetric[] = [];

  for (const [key, samples] of store.entries()) {
    const spaceIdx = key.indexOf(" ");
    const method = key.slice(0, spaceIdx);
    const endpoint = key.slice(spaceIdx + 1);

    const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
    const errorCount = samples.filter((s) => s.statusCode >= 500).length;
    const sum = durations.reduce((a, b) => a + b, 0);
    const lastSeenTs = lastSeenMap.get(key) ?? 0;

    results.push({
      method,
      endpoint,
      count: samples.length,
      p50Ms: Math.round(percentile(durations, 50)),
      p95Ms: Math.round(percentile(durations, 95)),
      p99Ms: Math.round(percentile(durations, 99)),
      avgMs: Math.round(sum / durations.length),
      maxMs: Math.round(durations[durations.length - 1] ?? 0),
      errorRate: Math.round((errorCount / samples.length) * 100),
      lastSeenTs,
    });
  }

  return results.sort((a, b) => b.p95Ms - a.p95Ms);
}

export function resetMetrics(): void {
  store.clear();
  lastSeenMap.clear();
}

export type TimeRange = "1h" | "6h" | "24h";

export interface StoreEntry {
  method: string;
  endpoint: string;
  samples: { durationMs: number; statusCode: number; ts: number }[];
}

export function getStoreSnapshot(): StoreEntry[] {
  const result: StoreEntry[] = [];
  for (const [key, samples] of store.entries()) {
    const spaceIdx = key.indexOf(" ");
    result.push({
      method: key.slice(0, spaceIdx),
      endpoint: key.slice(spaceIdx + 1),
      samples: [...samples],
    });
  }
  return result;
}
