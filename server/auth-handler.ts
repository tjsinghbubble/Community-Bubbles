import { z } from "zod";
import express from "express";
import type { Express, RequestHandler, ErrorRequestHandler } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { insertUserSchema } from "@shared/schema";

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

export const AUTH_PAYLOAD_LIMIT_BYTES = 10 * 1024;

export const authEntityTooLargeHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request payload too large" });
  }
  next(err);
};

export interface AuthStorage {
  getUserByEmail(email: string): Promise<any>;
  createUser(data: any): Promise<any>;
  getUser(id: string): Promise<any>;
}

export interface VerifyCodeStorage {
  getValidVerificationCode(email: string, code: string): Promise<{ id: string } | undefined>;
  markCodeAsUsed(id: string): Promise<void>;
}

export interface RegisterVerifyCodeRouteOptions {
  rateLimiter?: RequestHandler;
}

const verifyCodeSchema = z.object({
  email: z
    .string({ required_error: "Email and code are required", invalid_type_error: "Email must be a string" })
    .min(1, "Email and code are required")
    .max(254, "Email must be 254 characters or fewer"),
  code: z
    .string({ required_error: "Email and code are required", invalid_type_error: "Code must be a string" })
    .min(1, "Email and code are required")
    .max(10, "Code must be 10 characters or fewer"),
});

export function registerVerifyCodeRoute(
  app: Express,
  storage: VerifyCodeStorage,
  options: RegisterVerifyCodeRouteOptions = {},
) {
  app.use("/api/auth/verify-code", express.json({ limit: AUTH_PAYLOAD_LIMIT_BYTES }), authEntityTooLargeHandler);

  const routeMiddleware: RequestHandler[] = options.rateLimiter ? [options.rateLimiter] : [];

  app.post("/api/auth/verify-code", ...routeMiddleware, async (req: any, res: any) => {
    try {
      const parseResult = verifyCodeSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        const message = parseResult.error.errors[0]?.message ?? "Email and code are required";
        return res.status(400).json({ error: message });
      }
      const { email, code } = parseResult.data;

      const verificationCode = await storage.getValidVerificationCode(email, code);
      if (!verificationCode) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }

      await storage.markCodeAsUsed(verificationCode.id);
      res.json({ success: true, verified: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
}

const loginFailures = new Map<string, { attempts: number; lockedUntil: number | null }>();

export function checkLoginLockout(email: string): { locked: boolean; retryAfterMs?: number } {
  const record = loginFailures.get(email);
  if (!record) return { locked: false };
  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    return { locked: true, retryAfterMs: record.lockedUntil - Date.now() };
  }
  return { locked: false };
}

export function recordLoginFailure(email: string) {
  const record = loginFailures.get(email) ?? { attempts: 0, lockedUntil: null };
  record.attempts += 1;
  if (record.attempts >= LOGIN_MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  }
  loginFailures.set(email, record);
}

export function clearLoginFailures(email: string) {
  loginFailures.delete(email);
}

export function resetAllLoginFailures() {
  loginFailures.clear();
}

export interface RegisterAuthRoutesOptions {
  loginRateLimiter?: RequestHandler;
  signupRateLimiter?: RequestHandler;
}

export function registerAuthRoutes(
  app: Express,
  storage: AuthStorage,
  jwtSecret: string,
  options: RegisterAuthRoutesOptions = {},
) {
  const loginMiddleware: RequestHandler[] = options.loginRateLimiter
    ? [options.loginRateLimiter]
    : [];
  const signupMiddleware: RequestHandler[] = options.signupRateLimiter
    ? [options.signupRateLimiter]
    : [];

  const loginSchema = z.object({
    email: z.string({ required_error: "Email is required", invalid_type_error: "Email must be a string" }).max(254, "Email must be 254 characters or fewer"),
    password: z.string({ required_error: "Password is required", invalid_type_error: "Password must be a string" }).max(1000, "Password must be 1000 characters or fewer"),
  });

  app.post("/api/auth/login", ...loginMiddleware, async (req: any, res: any) => {
    try {
      const parseResult = loginSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.errors[0]?.message ?? "Invalid request" });
      }
      const { email, password } = parseResult.data;

      const lockout = checkLoginLockout(email);
      if (lockout.locked) {
        const retryAfterSec = Math.ceil((lockout.retryAfterMs ?? 0) / 1000);
        return res.status(429).json({ error: `Account temporarily locked. Try again in ${retryAfterSec} seconds.` });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        recordLoginFailure(email);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        recordLoginFailure(email);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      clearLoginFailures(email);

      if (user.isActive === false) {
        return res.status(403).json({ error: "This account has been deactivated." });
      }

      const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, jwtSecret, {
        expiresIn: "7d",
      });

      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          interests: user.interests,
          campusId: user.campusId,
          campusEmail: user.campusEmail,
          campusVerified: user.campusVerified,
          dismissedCampusPrompt: user.dismissedCampusPrompt,
          isSuperAdmin: user.isSuperAdmin,
          profilePhoto: user.profilePhoto,
        },
        token,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/signup", ...signupMiddleware, async (req: any, res: any) => {
    try {
      const data = insertUserSchema.parse(req.body);

      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, jwtSecret, {
        expiresIn: "7d",
      });

      res.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          interests: user.interests,
          profilePhoto: user.profilePhoto,
        },
        token,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
}
