import type { Express } from "express";
import { makeAuthMiddleware } from "./auth-middleware";

export interface NotificationsStorage {
  getUser(id: string): Promise<any>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationRead(id: string, userId: string): Promise<any>;
  markAllNotificationsRead(userId: string): Promise<void>;
  upsertDevicePushToken(userId: string, token: string, platform: string): Promise<any>;
  deleteDevicePushToken(userId: string, token: string): Promise<void>;
}

export function registerNotificationsRoutes(
  app: Express,
  storage: NotificationsStorage,
  jwtSecret: string,
) {
  const auth = makeAuthMiddleware(storage, jwtSecret);

  app.get("/api/notifications/unread-count", auth, async (req: any, res: any) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.userId);
      res.json({ count });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/notifications/:id/read", auth, async (req: any, res: any) => {
    try {
      const notif = await storage.markNotificationRead(req.params.id, req.userId);
      if (!notif) return res.status(404).json({ error: "Notification not found" });
      res.json(notif);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/notifications/read-all", auth, async (req: any, res: any) => {
    try {
      await storage.markAllNotificationsRead(req.userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/device-push-tokens", auth, async (req: any, res: any) => {
    try {
      const { token, platform } = req.body;
      if (!token || !platform) {
        return res.status(400).json({ error: "token and platform required" });
      }
      const result = await storage.upsertDevicePushToken(req.userId, token, platform);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/device-push-tokens", auth, async (req: any, res: any) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "token required" });
      await storage.deleteDevicePushToken(req.userId, token);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
