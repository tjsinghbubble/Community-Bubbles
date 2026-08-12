import { Express, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import appleSignIn from "apple-signin-auth";
import { storage } from "./storage";
import { z } from "zod";

const JWT_SECRET = process.env.JWT_SECRET as string;
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS as string;
const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID as string;

function makeJwt(userId: string, tokenVersion: number): string {
  return jwt.sign({ userId, tokenVersion }, JWT_SECRET, { expiresIn: "30d" });
}

const googleClient = new OAuth2Client();

export interface RegisterSocialAuthRoutesOptions {
  /** Rate limiter for check-email — it's a public account-existence oracle, so throttle it. */
  checkEmailRateLimiter?: RequestHandler;
}

export function registerSocialAuthRoutes(app: Express, options: RegisterSocialAuthRoutesOptions = {}) {
  const checkEmailMiddleware: RequestHandler[] = options.checkEmailRateLimiter
    ? [options.checkEmailRateLimiter]
    : [];

  // ---------------------------------------------------------------------------
  // POST /api/auth/check-email
  // Returns { exists: boolean } — used by the WelcomeAuthScreen and the
  // marketing homepage to decide whether to show Login or the Sign Up flow.
  // ---------------------------------------------------------------------------
  app.post("/api/auth/check-email", ...checkEmailMiddleware, async (req: any, res: any) => {
    try {
      const schema = z.object({ email: z.string().email() });
      const parsed = schema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      const user = await storage.getUserByEmail(parsed.data.email);
      return res.json({ exists: !!user });
    } catch (err: any) {
      console.error("[check-email]", err.message);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/auth/google
  // Accepts a Google ID token from the mobile app, verifies it, then either
  // logs in the existing user or creates a new pending social account.
  // ---------------------------------------------------------------------------
  app.post("/api/auth/google", async (req: any, res: any) => {
    try {
      const schema = z.object({ idToken: z.string().min(1) });
      const parsed = schema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: "idToken is required" });
      }

      const { idToken } = parsed.data;

      // Verify the Google ID token — accept both iOS and Android client IDs
      const audience = [GOOGLE_CLIENT_ID_IOS, GOOGLE_CLIENT_ID_ANDROID].filter(Boolean);
      if (audience.length === 0) {
        console.error("[google-auth] No Google client IDs configured");
        return res.status(500).json({ error: "Google Sign In is not configured" });
      }

      let payload: any;
      try {
        const ticket = await googleClient.verifyIdToken({ idToken, audience });
        payload = ticket.getPayload();
      } catch (verifyErr: any) {
        console.error("[google-auth] Token verification failed:", verifyErr.message);
        return res.status(401).json({ error: "Invalid Google token" });
      }

      if (!payload?.email || !payload?.sub) {
        return res.status(400).json({ error: "Google token missing required fields" });
      }

      if (!payload.email_verified) {
        return res.status(400).json({ error: "Google account email is not verified" });
      }

      const googleId = payload.sub as string;
      const email = payload.email as string;
      const name = (payload.name as string) || (payload.given_name as string) || "";

      // Try to find existing user by Google ID first, then by email
      let user = await storage.getUserByGoogleId(googleId);
      if (!user) {
        user = await storage.getUserByEmail(email);
      }

      let isNewUser = false;

      if (user) {
        // Existing user — link Google ID if not already linked
        if (!user.googleId) {
          await storage.linkGoogleId(user.id, googleId);
          user = { ...user, googleId };
        }
      } else {
        // New user — create a pending social account
        isNewUser = true;
        const placeholderPassword = await bcrypt.hash(
          `google_${googleId}_${Date.now()}`,
          10,
        );
        user = await storage.createUser({
          name: name || "New User",
          email,
          password: placeholderPassword,
          interests: [],
          socialAuthPending: true,
          googleId,
        } as any);
      }

      if (!user) {
        return res.status(500).json({ error: "Failed to create or retrieve user" });
      }

      if (user.isActive === false) {
        return res.status(403).json({ error: "This account has been deactivated." });
      }

      const token = makeJwt(user.id, user.tokenVersion);
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          interests: user.interests,
          profilePhoto: user.profilePhoto ?? null,
          isSuperAdmin: user.isSuperAdmin,
          socialAuthPending: user.socialAuthPending,
        },
        isNewUser,
        googleName: name,
      });
    } catch (err: any) {
      console.error("[google-auth]", err.message, err.stack);
      return res.status(500).json({ error: "Google Sign In failed" });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/auth/apple
  // Accepts an Apple identity token from the mobile app, verifies it, then
  // either logs in the existing user or creates a new pending social account.
  // ---------------------------------------------------------------------------
  app.post("/api/auth/apple", async (req: any, res: any) => {
    try {
      const schema = z.object({
        identityToken: z.string().min(1),
        fullName: z
          .object({
            givenName: z.string().nullable().optional(),
            familyName: z.string().nullable().optional(),
          })
          .optional()
          .nullable(),
      });
      const parsed = schema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: "identityToken is required" });
      }

      const { identityToken, fullName } = parsed.data;

      let applePayload: any;
      try {
        applePayload = await appleSignIn.verifyIdToken(identityToken, {
          audience: "io.trybubble.app",
          ignoreExpiration: false,
        });
      } catch (verifyErr: any) {
        console.error("[apple-auth] Token verification failed:", verifyErr.message);
        return res.status(401).json({ error: "Invalid Apple token" });
      }

      if (!applePayload?.sub) {
        return res.status(400).json({ error: "Apple token missing required fields" });
      }

      const appleId = applePayload.sub as string;
      // Apple only includes email on the very first sign-in for an app.
      // On subsequent attempts the field is absent — look up by Apple ID instead.
      const email = applePayload.email as string | undefined;

      // Apple only sends name on first sign-in
      const givenName = fullName?.givenName ?? "";
      const familyName = fullName?.familyName ?? "";
      const appleName = [givenName, familyName].filter(Boolean).join(" ");

      // Try to find existing user by Apple ID first, then by email
      let user = await storage.getUserByAppleId(appleId);
      if (!user && email) {
        user = await storage.getUserByEmail(email);
      }

      let isNewUser = false;

      if (user) {
        // Existing user — link Apple ID if not already linked
        if (!user.appleId) {
          await storage.linkAppleId(user.id, appleId);
          user = { ...user, appleId };
        }
      } else {
        // New user — email is required to create an account
        if (!email) {
          console.error("[apple-auth] New user but Apple did not provide email");
          return res.status(400).json({
            error: "Apple did not share your email. Please sign out of Bubble in your iPhone Settings > Apple ID > Password & Security > Apps Using Apple ID, then try again.",
          });
        }
        isNewUser = true;
        const placeholderPassword = await bcrypt.hash(
          `apple_${appleId}_${Date.now()}`,
          10,
        );
        user = await storage.createUser({
          name: appleName || "New User",
          email,
          password: placeholderPassword,
          interests: [],
          socialAuthPending: true,
          appleId,
        } as any);
      }

      if (!user) {
        return res.status(500).json({ error: "Failed to create or retrieve user" });
      }

      if (user.isActive === false) {
        return res.status(403).json({ error: "This account has been deactivated." });
      }

      const token = makeJwt(user.id, user.tokenVersion);
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          interests: user.interests,
          profilePhoto: user.profilePhoto ?? null,
          isSuperAdmin: user.isSuperAdmin,
          socialAuthPending: user.socialAuthPending,
        },
        isNewUser,
        appleName,
      });
    } catch (err: any) {
      console.error("[apple-auth]", err.message, err.stack);
      return res.status(500).json({ error: "Apple Sign In failed" });
    }
  });

  // ---------------------------------------------------------------------------
  // POST /api/auth/complete-social-profile  (requires auth)
  // After a social sign-up, the user fills in name, gender, and date of birth.
  // This endpoint persists those fields and clears the socialAuthPending flag.
  // ---------------------------------------------------------------------------
  app.post("/api/auth/complete-social-profile", async (req: any, res: any) => {
    // Inline auth check (authMiddleware is defined in routes.ts; we duplicate
    // the minimal check here so this file stays self-contained)
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.substring(7);
    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; tokenVersion: number };
      const u = await storage.getUser(decoded.userId);
      if (!u || u.tokenVersion !== decoded.tokenVersion) {
        return res.status(401).json({ error: "Token revoked" });
      }
      if (u.isActive === false) {
        return res.status(403).json({ error: "Account deactivated." });
      }
      userId = decoded.userId;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    try {
      const schema = z.object({
        name: z.string().min(1).max(100),
        gender: z.string().min(1).max(50),
        dateOfBirth: z.string().min(1),
      });
      const parsed = schema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid data" });
      }

      await storage.completeSocialProfile(userId, parsed.data);
      const user = await storage.getUser(userId);
      return res.json({ success: true, user });
    } catch (err: any) {
      console.error("[complete-social-profile]", err.message);
      return res.status(500).json({ error: "Failed to complete profile" });
    }
  });
}
