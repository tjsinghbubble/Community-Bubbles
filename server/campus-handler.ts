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

      let emailFailed = false;
      if (options.sendEmail) {
        try {
          await options.sendEmail(emailLower, code);
        } catch (emailError: any) {
          console.error(`[EMAIL] Delivery failed for ${emailLower}:`, emailError.message);
          emailFailed = true;
        }
      }

      const response: any = {
        success: true,
        message: "Verification code sent to your email",
        campusId: campus.id,
        campusName: campus.title,
      };
      if (emailFailed) {
        response.emailFailed = true;
        response.fallbackCode = code;
      }
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Campus verification code for ${emailLower}: ${code}`);
        response.devCode = code;
      }
      res.json(response);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
}
