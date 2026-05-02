import type { Express } from "express";
import { db } from "./db";
import { appConfig } from "@shared/schema";
import { sql as drizzleSql, eq } from "drizzle-orm";

const APP_VERSION = process.env.npm_package_version ?? "1.0.0";

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

export async function pingUrl(
  url: string,
  timeoutMs: number,
  opts?: RequestInit,
): Promise<{ status: "ok" | "error"; latencyMs: number | null; error: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return { status: "ok", latencyMs: Date.now() - start, error: null };
  } catch (e: unknown) {
    clearTimeout(timer);
    const msg =
      e instanceof Error
        ? e.name === "AbortError"
          ? "Timeout"
          : e.message
        : "Unknown error";
    return { status: "error", latencyMs: null, error: msg };
  }
}

const MAINTENANCE_CACHE_TTL_MS = 30_000;
let _maintenanceModeCache: boolean | null = null;
let _maintenanceCacheExpiry = 0;

export async function getMaintenanceMode(): Promise<boolean> {
  if (_maintenanceModeCache !== null && Date.now() < _maintenanceCacheExpiry) {
    return _maintenanceModeCache;
  }
  try {
    const rows = await db
      .select()
      .from(appConfig)
      .where(eq(appConfig.key, "maintenance_mode"));
    _maintenanceModeCache = rows[0]?.value === "true";
  } catch {
    _maintenanceModeCache = _maintenanceModeCache ?? false;
  }
  _maintenanceCacheExpiry = Date.now() + MAINTENANCE_CACHE_TTL_MS;
  return _maintenanceModeCache;
}

export function setMaintenanceModeCache(value: boolean): void {
  _maintenanceModeCache = value;
  _maintenanceCacheExpiry = Date.now() + MAINTENANCE_CACHE_TTL_MS;
}

export function registerHealthRoutes(app: Express): void {
  app.get("/api/v1/ping", (_req, res) => {
    res.status(200).type("text/plain").send("pong");
  });

  app.get("/api/v1/version", async (_req, res) => {
    try {
      const rows = await db.select().from(appConfig).where(eq(appConfig.key, 'mobile_min_version'));
      const mobileMinVersion = rows[0]?.value ?? '1.0.0';
      return res.status(200).json({ version: APP_VERSION, mobileMinVersion });
    } catch {
      return res.status(200).json({ version: APP_VERSION, mobileMinVersion: '1.0.0' });
    }
  });

  app.get("/api/v1/status", async (_req, res) => {
    const maintenance = await getMaintenanceMode();
    if (maintenance) {
      return res.status(503).json({ status: "maintenance" });
    }
    return res.status(200).json({
      status: "ok",
      version: APP_VERSION,
      uptime: formatUptime(Math.floor(process.uptime())),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/v1/health", async (_req, res) => {
    const maintenance = await getMaintenanceMode();
    if (maintenance) {
      return res.status(503).json({ status: "maintenance" });
    }

    const timestamp = new Date().toISOString();
    const uptime = formatUptime(Math.floor(process.uptime()));

    let dbStatus: "up" | "down" = "up";
    let dbLatencyMs: number | null = null;
    let dbError: string | null = null;
    const dbStart = Date.now();
    try {
      await db.execute(drizzleSql`SELECT 1`);
      dbLatencyMs = Date.now() - dbStart;
    } catch (e: unknown) {
      dbStatus = "down";
      dbError = e instanceof Error ? e.message : "Unknown error";
    }

    const storageResult = await pingUrl("http://127.0.0.1:1106/", 3000);
    const storageStatus = storageResult.status === "ok" ? "up" : "down";

    const cometChatAppId = process.env.COMETCHAT_APP_ID ?? "";
    const cometChatRegion = process.env.COMETCHAT_REGION ?? "us";
    const cometChatApiKey =
      process.env.COMETCHAT_API_KEY ?? process.env.COMETCHAT_AUTH_KEY ?? "";
    let thirdPartyAuth: {
      status: "up" | "down" | "unconfigured";
      latency_ms?: number | null;
      error?: string | null;
    };
    if (!cometChatAppId || !cometChatApiKey) {
      thirdPartyAuth = { status: "unconfigured", error: "COMETCHAT_APP_ID or API key not set" };
    } else {
      const ccUrl = `https://${cometChatAppId}.api-${cometChatRegion}.cometchat.io/v3/users?perPage=1`;
      const ccResult = await pingUrl(ccUrl, 5000, {
        headers: { apikey: cometChatApiKey, appid: cometChatAppId },
      });
      thirdPartyAuth = {
        status: ccResult.status === "ok" ? "up" : "down",
        latency_ms: ccResult.latencyMs,
        error: ccResult.error,
      };
    }

    const criticalFail = dbStatus === "down";
    const partialFail =
      !criticalFail &&
      (storageStatus === "down" || thirdPartyAuth.status === "down");
    const overallStatus = criticalFail
      ? "fail"
      : partialFail
        ? "partial_fail"
        : "ok";

    const body: Record<string, unknown> = {
      status: overallStatus,
      version: APP_VERSION,
      uptime,
      timestamp,
      services: {
        database: {
          status: dbStatus,
          latency_ms: dbLatencyMs,
          ...(dbError ? { error: dbError } : {}),
        },
        storage: {
          status: storageStatus,
          latency_ms: storageResult.latencyMs,
          ...(storageResult.error ? { error: storageResult.error } : {}),
        },
        third_party_auth: thirdPartyAuth,
      },
    };

    return res.status(criticalFail ? 503 : 200).json(body);
  });
}
