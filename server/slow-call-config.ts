const _parsedThreshold = parseInt(process.env.SLOW_CALL_THRESHOLD_MS ?? "", 10);
export const SLOW_CALL_THRESHOLD_MS = _parsedThreshold > 0 ? _parsedThreshold : 1000;

const _parsedRetention = parseInt(process.env.SLOW_CALL_RETENTION_DAYS ?? "", 10);
export const SLOW_CALL_RETENTION_DAYS = _parsedRetention > 0 ? _parsedRetention : 90;
