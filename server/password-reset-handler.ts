import bcrypt from "bcrypt";
import type { Express, RequestHandler } from "express";

export interface PasswordResetStorage {
  getUserByEmail(email: string): Promise<{ id: string; email: string } | null | undefined>;
  createVerificationCode(data: { email: string; code: string; expiresAt: Date }): Promise<unknown>;
  getValidVerificationCode(email: string, code: string): Promise<{ id: string } | null | undefined>;
  markCodeAsUsedAtomic(id: string): Promise<boolean>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  incrementTokenVersion(userId: string): Promise<void>;
}

export interface RegisterPasswordResetRoutesOptions {
  generateCode?: () => string;
  sendEmail?: (email: string, code: string) => Promise<void>;
  forgotPasswordRateLimiter?: RequestHandler;
  resetPasswordRateLimiter?: RequestHandler;
}

export function registerPasswordResetRoutes(
  app: Express,
  storage: PasswordResetStorage,
  options: RegisterPasswordResetRoutesOptions = {},
) {
  const forgotMiddleware: RequestHandler[] = options.forgotPasswordRateLimiter
    ? [options.forgotPasswordRateLimiter]
    : [];
  const resetMiddleware: RequestHandler[] = options.resetPasswordRateLimiter
    ? [options.resetPasswordRateLimiter]
    : [];

  const generateCode = options.generateCode ?? (() => Math.floor(100000 + Math.random() * 900000).toString());
  const sendEmail = options.sendEmail ?? (async () => {});

  app.post("/api/auth/forgot-password", ...forgotMiddleware, async (req: any, res: any) => {
    try {
      const { email } = req.body ?? {};
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }
      const emailLower = email.toLowerCase().trim();
      const user = await storage.getUserByEmail(emailLower);
      if (user) {
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await storage.createVerificationCode({ email: emailLower, code, expiresAt });
        try {
          await sendEmail(emailLower, code);
        } catch (e) {
          console.error("[forgot-password] Email delivery failed:", e);
        }
      }
      res.json({ success: true, message: "If an account with that email exists, a reset code has been sent." });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/reset-password", ...resetMiddleware, async (req: any, res: any) => {
    try {
      const { email, code, newPassword } = req.body ?? {};
      if (!email || !code || !newPassword) {
        return res.status(400).json({ error: "Email, code, and new password are required" });
      }
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const verificationCode = await storage.getValidVerificationCode(email, code);
      if (!verificationCode) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }
      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      const claimed = await storage.markCodeAsUsedAtomic(verificationCode.id);
      if (!claimed) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hashedPassword);
      await storage.incrementTokenVersion(user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
}
