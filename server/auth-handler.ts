import { z } from "zod";
import type { Express, RequestHandler } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { insertUserSchema } from "@shared/schema";

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

export interface AuthStorage {
  getUserByEmail(email: string): Promise<any>;
  createUser(data: any): Promise<any>;
  getUser(id: string): Promise<any>;
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

  app.post("/api/auth/login", ...loginMiddleware, async (req: any, res: any) => {
    try {
      const { email, password } = req.body;

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
