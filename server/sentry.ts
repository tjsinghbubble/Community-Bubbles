import * as Sentry from "@sentry/node";

const SLOW_API_THRESHOLD_MS = 1000;
const ALERT_FINGERPRINT = "api-slow-response-alert";
const MAX_SLOW_COUNT_KEYS = 500;

let initialised = false;

export function initialiseSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn("[Sentry] SENTRY_DSN not set – server-side Sentry disabled");
    return;
  }
  if (initialised) return;
  Sentry.init({ dsn, tracesSampleRate: 0 });
  initialised = true;
  console.log("[Sentry] Server-side Sentry initialised");
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

const slowCounts = new Map<string, number>();

export function reportSlowResponse(
  method: string,
  path: string,
  durationMs: number,
): void {
  if (durationMs <= SLOW_API_THRESHOLD_MS) return;
  if (!initialised) return;

  const normalisedPath = normalisePath(path);
  const key = `${method.toUpperCase()} ${normalisedPath}`;

  if (slowCounts.size >= MAX_SLOW_COUNT_KEYS && !slowCounts.has(key)) {
    const evictKey = slowCounts.keys().next().value;
    if (evictKey !== undefined) slowCounts.delete(evictKey);
  }

  const count = (slowCounts.get(key) ?? 0) + 1;
  slowCounts.set(key, count);

  console.warn(
    `[SlowAPI] ${key} took ${durationMs} ms (threshold ${SLOW_API_THRESHOLD_MS} ms, occurrences: ${count})`,
  );

  Sentry.withScope((scope) => {
    scope.setLevel("warning");
    scope.setTag("alert_type", "slow_api_response");
    scope.setTag("endpoint", normalisedPath);
    scope.setTag("method", method.toUpperCase());
    scope.setExtra("durationMs", durationMs);
    scope.setExtra("threshold", SLOW_API_THRESHOLD_MS);
    scope.setExtra("occurrences", count);
    scope.setFingerprint([ALERT_FINGERPRINT, method.toUpperCase(), normalisedPath]);
    Sentry.captureMessage(
      `[API] Slow response: ${method.toUpperCase()} ${normalisedPath} (${durationMs} ms)`,
      "warning",
    );
  });
}
