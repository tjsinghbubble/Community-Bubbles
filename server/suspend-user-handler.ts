import type { Express } from "express";
import { makeAuthMiddleware } from "./auth-middleware";

export interface SuspendUserStorage {
  getUser(id: string): Promise<{ id: string; tokenVersion: number; isActive: boolean; isSuperAdmin: boolean } | null | undefined>;
  suspendUser(id: string, reason: string): Promise<void>;
  unsuspendUser(id: string): Promise<void>;
}

export interface SuspendUserOptions {
  auditLog?: (action: string, adminId: string, targetId: string, ip: string, extra?: Record<string, unknown>) => void;
}

export function registerSuspendUserRoutes(
  app: Express,
  storage: SuspendUserStorage,
  jwtSecret: string,
  options: SuspendUserOptions = {},
) {
  const auth = makeAuthMiddleware(storage, jwtSecret);
  const audit = options.auditLog ?? (() => {});

  app.post("/api/admin/users/:id/suspend", auth, async (req: any, res: any) => {
    try {
      const caller = await storage.getUser(req.userId);
      if (!caller?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }

      const { reason } = req.body ?? {};
      if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
        return res.status(400).json({ error: "Reason is required" });
      }
      if (reason.length > 500) {
        return res.status(400).json({ error: "Reason must be 500 characters or fewer" });
      }

      if (req.params.id === req.userId) {
        return res.status(400).json({ error: "Cannot suspend your own account" });
      }

      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ error: "User not found" });
      if (target.isSuperAdmin) {
        return res.status(400).json({ error: "Cannot suspend a super admin" });
      }

      await storage.suspendUser(req.params.id, reason.trim());
      audit("user_suspended", req.userId, req.params.id, req.ip ?? "", { reason: reason.trim() });
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/admin/users/:id/unsuspend", auth, async (req: any, res: any) => {
    try {
      const caller = await storage.getUser(req.userId);
      if (!caller?.isSuperAdmin) {
        return res.status(403).json({ error: "Super admin access required" });
      }

      const target = await storage.getUser(req.params.id);
      if (!target) return res.status(404).json({ error: "User not found" });

      await storage.unsuspendUser(req.params.id);
      audit("user_unsuspended", req.userId, req.params.id, req.ip ?? "", undefined);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
}
