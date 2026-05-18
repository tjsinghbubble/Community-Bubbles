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
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { seedStaging } from "./seed-staging";
import { autoMigrate } from "./auto-migrate";

initialiseSentry();

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
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
      startEventReminderScheduler();
      startSlowCallPrunerScheduler();
      startFatalCrashSpikeScheduler();
    },
  );
})();
