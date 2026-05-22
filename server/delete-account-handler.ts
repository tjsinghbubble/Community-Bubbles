import type { Express, RequestHandler } from "express";
import { makeAuthMiddleware } from "./auth-middleware";

export interface DeleteAccountStorage {
  getUser(id: string): Promise<{ id: string; tokenVersion: number; isActive: boolean; profilePhoto?: string | null } | null | undefined>;
  deleteUser(id: string): Promise<void>;
}

export interface DeleteAccountOptions {
  deleteProfilePhoto?: (key: string) => Promise<void>;
}

export function registerDeleteAccountRoute(
  app: Express,
  storage: DeleteAccountStorage,
  jwtSecret: string,
  options: DeleteAccountOptions = {},
) {
  const auth = makeAuthMiddleware(storage, jwtSecret);

  app.delete("/api/auth/delete-account", auth, async (req: any, res: any) => {
    try {
      const user = await storage.getUser(req.userId);
      if (user?.profilePhoto && options.deleteProfilePhoto) {
        try {
          await options.deleteProfilePhoto(user.profilePhoto);
        } catch (e) {
          console.error("Failed to delete profile photo from storage:", e);
        }
      }
      await storage.deleteUser(req.userId);
      res.json({ success: true, message: "Account deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
}
