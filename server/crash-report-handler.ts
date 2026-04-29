import { z } from "zod";
import type { Express } from "express";
import rateLimit from "express-rate-limit";

export const CRASH_REPORT_MAX_MESSAGE_CHARS = 1024;
export const CRASH_REPORT_MAX_STACK_CHARS = 4096;
export const CRASH_REPORT_MAX_CONTEXT_CHARS = 2048;
export const CRASH_REPORT_MAX_USER_ID_CHARS = 128;
export const CRASH_REPORT_MAX_USERNAME_CHARS = 128;

export const crashReportSchema = z.object({
  message: z.string().min(1, "message is required").max(
    CRASH_REPORT_MAX_MESSAGE_CHARS,
    `message must not exceed ${CRASH_REPORT_MAX_MESSAGE_CHARS} characters`,
  ),
  stack: z.string().max(
    CRASH_REPORT_MAX_STACK_CHARS,
    `stack must not exceed ${CRASH_REPORT_MAX_STACK_CHARS} characters`,
  ).optional(),
  context: z.string().max(
    CRASH_REPORT_MAX_CONTEXT_CHARS,
    `context must not exceed ${CRASH_REPORT_MAX_CONTEXT_CHARS} characters`,
  ).optional(),
  platform: z.string().optional(),
  timestamp: z.string().optional(),
  isFatal: z.boolean().optional(),
  appVersion: z.string().optional(),
  userId: z.string().max(
    CRASH_REPORT_MAX_USER_ID_CHARS,
    `userId must not exceed ${CRASH_REPORT_MAX_USER_ID_CHARS} characters`,
  ).optional(),
  username: z.string().max(
    CRASH_REPORT_MAX_USERNAME_CHARS,
    `username must not exceed ${CRASH_REPORT_MAX_USERNAME_CHARS} characters`,
  ).optional(),
});

const crashReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

export function registerCrashReportRoute(app: Express) {
  app.post("/api/crash-report", crashReportLimiter, async (req: any, res: any) => {
    try {
      const parsed = crashReportSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid crash report" });
      }
      const { message, stack, context, platform, timestamp, isFatal, appVersion, userId, username } = parsed.data;
      const level = isFatal ? "FATAL" : "ERROR";
      const userTag = userId ? ` | user=${username ?? userId}` : '';
      console.error(
        `[CrashReport] ${level} | platform=${platform ?? "unknown"} | context=${context ?? "unknown"} | version=${appVersion ?? "unknown"}${userTag} | ts=${timestamp ?? new Date().toISOString()}\n` +
        `  message: ${message}\n` +
        (stack ? `  stack: ${stack}` : "  stack: (none)"),
      );
      return res.status(200).json({ received: true });
    } catch (e) {
      console.error("[CrashReport] Failed to log crash report:", e);
      return res.status(500).json({ error: "Failed to log report" });
    }
  });
}
