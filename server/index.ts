import { initErrorBuffer } from "./errorBuffer";
import express, { type Request, Response, NextFunction } from "express";
import { initialiseSentry, reportSlowResponse } from "./sentry";
import { registerRoutes } from "./routes";
import { registerHealthRoutes } from "./health";
import { AUTH_PAYLOAD_LIMIT_BYTES, authEntityTooLargeHandler } from "./auth-handler";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startEventReminderScheduler, startSlowCallPrunerScheduler, startFatalCrashSpikeScheduler } from "./notifications";
import { loadSlowCallConfigFromDb } from "./slow-call-config";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { seedStaging } from "./seed-staging";
import { autoMigrate } from "./auto-migrate";
import { assertEncryptionKey } from "./encryption";

initialiseSentry();

// Last-resort guards: a stray rejection or throw from a request handler (or the Vite
// dev middleware) must not silently terminate the process. Log loudly and keep serving.
// This is deliberately log-and-continue rather than the Node default (crash on
// uncaughtException): for an always-on API the cost of dropping one request is far lower
// than tearing down the whole server. Anything truly fatal still surfaces in the logs.
process.on("unhandledRejection", (reason) => {
  console.error(`[fatal-guard] unhandledRejection:`, reason);
});
process.on("uncaughtException", (err) => {
  console.error(`[fatal-guard] uncaughtException:`, err);
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

import cors from 'cors';

// Allow requests from Expo tunnel and other origins
app.use(cors({
  origin: [
    'https://y29b50u-anonymous-5000.exp.direct',
    /\.exp\.direct$/,  // Allow all Expo tunnel origins
    'http://localhost:5000',
    'http://localhost:8081'
  ],
  credentials: true
}));

app.use(
  '/api/auth',
  express.json({ limit: AUTH_PAYLOAD_LIMIT_BYTES }),
  authEntityTooLargeHandler,
);

app.use(
  '/api/campus',
  express.json({ limit: AUTH_PAYLOAD_LIMIT_BYTES }),
  authEntityTooLargeHandler,
);

app.use(
  '/api/users/me',
  express.json({ limit: AUTH_PAYLOAD_LIMIT_BYTES }),
  authEntityTooLargeHandler,
);

app.use(
  express.json({
    limit: '50kb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // Client IP, real User-Agent, and the per-test tag. QA tests stamp X-Bubble-Test
      // (test(<id>,r=<role>,pid=<n>)) — a dedicated header so the browser's real UA is
      // preserved for web tests — letting requests/responses be synced to a test.
      logLine += ` ip=${req.ip ?? "-"} ua="${req.get("user-agent") ?? "-"}" test=${req.get("x-bubble-test") ?? "-"}`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
      reportSlowResponse(req.method, path, duration);
    }
  });

  next();
});

(async () => {
  // Validate ENCRYPTION_KEY before anything else.
  // In production this throws (refusing to start); in dev it warns and pads.
  try {
    assertEncryptionKey();
  } catch (err: any) {
    console.error("[startup] ENCRYPTION_KEY validation failed:\n" + err.message);
    process.exit(1);
  }

  await autoMigrate();
  initErrorBuffer(storage);
  await loadSlowCallConfigFromDb((key) => storage.getAppConfigValue(key));
  registerHealthRoutes(app);
  await registerRoutes(httpServer, app);

  // Ensure all team super admins exist on staging and production.
  // If the account already exists it is promoted; if not, it is created.
  if (process.env.NODE_ENV !== "development") (async () => {
    const superAdmins = [
      { name: "George Costanza",  email: "george@seinfeld.com" },
      { name: "M Mand",           email: "mmand@trybubble.io" },
      { name: "Renuka DSouza",    email: "rdsouza@trybubble.io" },
      { name: "TJ Singh",         email: "tjsingh@trybubble.io" },
      { name: "Travis Winfrey",   email: "twinfrey@trybubble.io" },
      { name: "Neet Randhawa",    email: "neet.randhawa@trybubble.io" },
    ];
    const hashed = await bcrypt.hash("Bubble123!", 10);
    for (const admin of superAdmins) {
      try {
        const existing = await storage.getUserByEmail(admin.email);
        if (existing) {
          if (!existing.isSuperAdmin) {
            await db.update(users).set({ isSuperAdmin: true }).where(eq(users.id, existing.id));
            console.log(`[startup] ${admin.email} promoted to super admin`);
          }
        } else {
          await storage.createUser({ name: admin.name, email: admin.email, password: hashed, interests: [], isSuperAdmin: true } as any);
          console.log(`[startup] ${admin.email} super admin created`);
        }
      } catch (e) { console.error(`[startup] super admin seed failed for ${admin.email}:`, e); }
    }
  })();

  // One-time: seed staging with Seinfeld test data (production only)
  if (process.env.NODE_ENV === "production") {
    seedStaging().catch(e => console.error("[seed-staging] Fatal error:", e));
  }

  // Clean up stale device push tokens on startup (tokens not refreshed in 90+ days)
  storage.deleteStaleDevicePushTokens().then(count => {
    if (count > 0) console.log(`Cleaned up ${count} stale push tokens`);
  }).catch(err => console.error('Push token cleanup failed:', err));

  // Terminal /api handler. Any request reaching here matched no real API route. The SPA
  // catch-all below must NEVER answer /api/* — returning index.html/200 would corrupt the
  // JSON contract and make every forced-browse probe (e.g. /api/v1/.env) look like a hit.
  //
  //  - Modifying verbs (POST/PUT/PATCH/DELETE) from a caller without a VALID token -> 401:
  //    don't reveal endpoint existence to anonymous writers; surface "auth required". We verify
  //    the JWT SIGNATURE ONLY (no DB lookup) so junk traffic can't amplify into DB load — the
  //    abuse vector the upcoming 429 work targets.
  //  - Everything else unmatched under /api -> 404 JSON.
  //
  // The ip + any presented (possibly bad) user-id are logged so the 429/abuse phase has data.
  const MODIFYING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  app.use("/api", (req: Request, res: Response) => {
    let userId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ") && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET) as { userId?: string };
        userId = decoded?.userId ?? null;
      } catch {
        userId = null; // present but invalid/expired -> treat as unauthorized
      }
    }
    const unauthorizedWrite = MODIFYING_METHODS.has(req.method) && !userId;
    const status = unauthorizedWrite ? 401 : 404;
    log(`unmatched-api ${req.method} ${req.originalUrl} -> ${status} ip=${req.ip ?? "-"} uid=${userId ?? "-"}`);
    if (unauthorizedWrite) return res.status(401).json({ error: "Unauthorized" });
    return res.status(404).json({ error: "Not Found", method: req.method, path: req.originalUrl });
  });

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    // Fail closed: the Vite dev middleware must NEVER run on a deployed host. It serves
    // the SPA in this same process, on-the-fly transforms source from disk, and exposes
    // the dev surface (/@vite/client, HMR) — a deployed instance must serve the prebuilt
    // static bundle with NODE_ENV=production instead. Refuse to start otherwise.
    const onDeployedHost = !!(process.env.REPLIT_DEPLOYMENT || process.env.BUBBLE_DEPLOYED);
    if (onDeployedHost) {
      throw new Error(
        "Refusing to start the Vite dev middleware on a deployed host. Build the client " +
          "and serve the static bundle with NODE_ENV=production (npm start / `node dist/index.cjs`).",
      );
    }
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.API_WEB_SERVER_PORT || "5000", 10);
  // Default bind is IPv4 wildcard (unchanged for the firewalled deploy). Set API_BIND_HOST=::
  // to bind dual-stack (IPv6 + IPv4-mapped) so `localhost` works for clients that prefer IPv6 —
  // the qa:server script does this so the test runner's loopback fetches don't hit ::1 refusals.
  httpServer.listen(
    {
      port,
      host: process.env.API_BIND_HOST || "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      startEventReminderScheduler();
      startSlowCallPrunerScheduler();
      startFatalCrashSpikeScheduler();
      // Final readiness banner — printed only here, after routes + static/Vite setup and the
      // listen succeed, so it is a true "setup complete" signal. The launching flow declares
      // its mode via BUBBLE_SERVER_MODE (dev | qa | prod); fall back to NODE_ENV otherwise.
      const mode = process.env.BUBBLE_SERVER_MODE
        || (process.env.NODE_ENV === "production" ? "prod" : "dev");
      const label = mode === "prod" ? "prod" : mode === "qa" ? "QA" : "dev";
      log(`API/${label} server ready`);
    },
  );
})();
