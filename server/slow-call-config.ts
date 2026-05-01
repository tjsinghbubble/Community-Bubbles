const _parsedThreshold = parseInt(process.env.SLOW_CALL_THRESHOLD_MS ?? "", 10);
const ENV_THRESHOLD_MS = _parsedThreshold > 0 ? _parsedThreshold : 1000;

const _parsedRetention = parseInt(process.env.SLOW_CALL_RETENTION_DAYS ?? "", 10);
const ENV_RETENTION_DAYS = _parsedRetention > 0 ? _parsedRetention : 90;

let _thresholdMs = ENV_THRESHOLD_MS;
let _retentionDays = ENV_RETENTION_DAYS;

export function getSlowCallThresholdMs(): number {
  return _thresholdMs;
}

export function getSlowCallRetentionDays(): number {
  return _retentionDays;
}

export function setSlowCallConfig(thresholdMs: number, retentionDays: number): void {
  _thresholdMs = thresholdMs;
  _retentionDays = retentionDays;
}

export async function loadSlowCallConfigFromDb(
  getConfigValue: (key: string) => Promise<string | undefined>,
): Promise<void> {
  try {
    const [t, r] = await Promise.all([
      getConfigValue("slow_call_threshold_ms"),
      getConfigValue("slow_call_retention_days"),
    ]);
    if (t) {
      const parsed = parseInt(t, 10);
      if (parsed > 0) _thresholdMs = parsed;
    }
    if (r) {
      const parsed = parseInt(r, 10);
      if (parsed > 0) _retentionDays = parsed;
    }
    console.log(
      `[SlowCallConfig] Loaded from DB — thresholdMs=${_thresholdMs}, retentionDays=${_retentionDays}`,
    );
  } catch (err) {
    console.error("[SlowCallConfig] Failed to load from DB, using defaults:", err);
  }
}

// Legacy named exports kept for backward-compatibility during the transition;
// they reflect the env-var defaults only. New code should use the getters above.
export const SLOW_CALL_THRESHOLD_MS = ENV_THRESHOLD_MS;
export const SLOW_CALL_RETENTION_DAYS = ENV_RETENTION_DAYS;
