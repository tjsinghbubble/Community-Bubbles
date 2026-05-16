import { z } from "zod";
import type { Express, RequestHandler } from "express";

export interface CampusSendVerificationStorage {
  getCampusByDomain(domain: string): Promise<{ id: string; title: string } | null | undefined>;
  createVerificationCode(data: { email: string; code: string; expiresAt: Date }): Promise<unknown>;
}

export interface RegisterCampusSendVerificationRouteOptions {
  generateCode?: () => string;
  sendEmail?: (email: string, code: string) => Promise<void>;
}

const campusSendVerificationSchema = z.object({
  email: z
    .string({ required_error: "Email is required", invalid_type_error: "Email must be a string" })
    .min(1, "Email is required")
    .max(254, "Email must be 254 characters or fewer"),
});

export function registerCampusSendVerificationRoute(
  app: Express,
  storage: CampusSendVerificationStorage,
  authMiddleware: RequestHandler,
  options: RegisterCampusSendVerificationRouteOptions = {},
) {
  app.post("/api/campus/send-verification", authMiddleware, async (req: any, res: any) => {
    try {
      const parseResult = campusSendVerificationSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        const message = parseResult.error.errors[0]?.message ?? "Email is required";
        return res.status(400).json({ error: message });
      }
      const { email } = parseResult.data;

      const emailLower = email.toLowerCase();
      const domain = emailLower.split("@")[1];
      if (!domain || !domain.endsWith(".edu")) {
        return res.status(400).json({ error: "Please use a valid .edu email address" });
      }

      const campus = await storage.getCampusByDomain(domain);
      if (!campus) {
        return res.status(400).json({ error: "This university is not yet supported. Check back later!" });
      }

      const generateCode = options.generateCode ?? (() => Math.floor(100000 + Math.random() * 900000).toString());
      const code = generateCode();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await storage.createVerificationCode({ email: emailLower, code, expiresAt });

      if (options.sendEmail) {
        try {
          await options.sendEmail(emailLower, code);
        } catch (emailError: any) {
          console.error(`[EMAIL] Delivery failed for ${emailLower}:`, emailError.message);
        }
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Campus verification code for ${emailLower}: ${code}`);
      }

      res.json({
        success: true,
        message: "Verification code sent to your email",
        campusId: campus.id,
        campusName: campus.title,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
}

export interface CampusVerifyCodeStorage {
  getValidVerificationCode(email: string, code: string): Promise<{ id: string } | null | undefined>;
  getCampusByDomain(domain: string): Promise<{ id: string; title: string; domain: string } | null | undefined>;
  markCodeAsUsed(id: string): Promise<void>;
  updateUserCampus(userId: string, campusId: string, campusEmail: string, campusVerified: boolean): Promise<void>;
  getUser(id: string): Promise<{ id: string; name: string; email: string; campusId: string | null; campusEmail: string | null; campusVerified: boolean | null } | null | undefined>;
}

const campusVerifyCodeSchema = z.object({
  email: z
    .string({ required_error: "Email and code are required", invalid_type_error: "Email must be a string" })
    .min(1, "Email and code are required")
    .max(254, "Email must be 254 characters or fewer"),
  code: z
    .string({ required_error: "Email and code are required", invalid_type_error: "Code must be a string" })
    .min(1, "Email and code are required")
    .max(10, "Code must be 10 characters or fewer"),
});

export function registerCampusVerifyCodeRoute(
  app: Express,
  storage: CampusVerifyCodeStorage,
  authMiddleware: RequestHandler,
) {
  app.post("/api/campus/verify-code", authMiddleware, async (req: any, res: any) => {
    try {
      const parseResult = campusVerifyCodeSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        const message = parseResult.error.errors[0]?.message ?? "Email and code are required";
        return res.status(400).json({ error: message });
      }
      const { email, code } = parseResult.data;

      const emailLower = email.toLowerCase();
      const domain = emailLower.split("@")[1];

      const validCode = await storage.getValidVerificationCode(emailLower, code);
      if (!validCode) {
        return res.status(400).json({ error: "Invalid or expired code" });
      }

      const campus = await storage.getCampusByDomain(domain);
      if (!campus) {
        return res.status(400).json({ error: "Campus not found" });
      }

      await storage.markCodeAsUsed(validCode.id);
      await storage.updateUserCampus(req.userId, campus.id, emailLower, true);

      const user = await storage.getUser(req.userId);

      res.json({
        success: true,
        campus: {
          id: campus.id,
          name: campus.title,
          domain: campus.domain,
        },
        user: {
          id: user!.id,
          name: user!.name,
          email: user!.email,
          campusId: user!.campusId,
          campusEmail: user!.campusEmail,
          campusVerified: user!.campusVerified,
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
}
