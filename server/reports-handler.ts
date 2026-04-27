import type { Express } from "express";
import jwt from "jsonwebtoken";
import { insertReportSchema } from "@shared/schema";
import type { notifyBubbleAdmins as NotifyBubbleAdminsFunc, sendNotificationToMany as SendNotificationToManyFunc } from "./notifications";

export interface ReportsStorage {
  getUser(id: string): Promise<any>;
  getMemberRole(userId: string, bubbleId: string): Promise<string | null>;
  createReport(data: any): Promise<any>;
  getBubble(id: string): Promise<any>;
  getSuperAdmins(): Promise<any[]>;
}

export interface RegisterReportsRouteOptions {
  notifyBubbleAdmins?: typeof NotifyBubbleAdminsFunc;
  sendNotificationToMany?: typeof SendNotificationToManyFunc;
}

export const BUBBLE_REPORT_VISIBILITY: Record<string, string> = {
  "Safety issue (harassment, threats, unsafe environment)": "superadmin",
  "Misleading group description": "both",
  "Inactive or abandoned group": "bubble_admin",
  "Organizer misconduct": "superadmin",
  "Exclusionary behavior (discrimination, cliques)": "both",
  "Spam or promotional content": "both",
  "Other": "superadmin",
};

export const EVENT_REPORT_VISIBILITY: Record<string, string> = {
  "Safety issue at this event": "both",
  "Event didn't match description": "bubble_admin",
  "Organizer no-show or unprepared": "both",
  "Venue issue (unsafe, inaccessible, closed)": "both",
  "Other": "both",
};

function makeAuthMiddleware(storage: ReportsStorage, jwtSecret: string) {
  return async function authMiddleware(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, jwtSecret) as { userId: string; tokenVersion: number };
      const user = await storage.getUser(decoded.userId);
      if (!user || user.tokenVersion !== decoded.tokenVersion) {
        return res.status(401).json({ error: "Token revoked" });
      }
      if (user.isActive === false) {
        return res.status(403).json({ error: "This account has been deactivated." });
      }
      req.userId = decoded.userId;
      next();
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

export function registerReportsRoute(
  app: Express,
  storage: ReportsStorage,
  jwtSecret: string,
  options: RegisterReportsRouteOptions = {},
) {
  const authMiddleware = makeAuthMiddleware(storage, jwtSecret);

  app.post("/api/reports", authMiddleware, async (req: any, res: any) => {
    try {
      let visibleTo = "superadmin";
      if (req.body.reportType === "bubble") {
        visibleTo = BUBBLE_REPORT_VISIBILITY[req.body.reason] || "superadmin";
      } else if (req.body.reportType === "event") {
        visibleTo = EVENT_REPORT_VISIBILITY[req.body.reason] || "both";
      } else if (req.body.reportType === "individual") {
        if (req.body.reportedUserId) {
          const reportedRole = await storage.getMemberRole(req.body.reportedUserId, req.body.bubbleId);
          visibleTo = reportedRole === "admin" ? "both" : "bubble_admin";
        } else {
          visibleTo = "bubble_admin";
        }
      } else if (req.body.reportType === "admin") {
        visibleTo = "superadmin";
      }

      const parsed = insertReportSchema.parse({
        ...req.body,
        reporterUserId: req.userId,
        visibleTo,
      });

      const report = await storage.createReport(parsed);

      if (options.notifyBubbleAdmins || options.sendNotificationToMany) {
        const reporter = await storage.getUser(req.userId);
        const reportBubble = await storage.getBubble(parsed.bubbleId);

        if ((visibleTo === "bubble_admin" || visibleTo === "both") && options.notifyBubbleAdmins) {
          options.notifyBubbleAdmins(
            parsed.bubbleId,
            req.userId,
            "report_submitted",
            "New Report",
            `${reporter?.name || "Someone"} submitted a ${parsed.reportType} concern in ${reportBubble?.title || "a bubble"}`,
            { bubbleId: parsed.bubbleId, bubbleName: reportBubble?.title, userId: req.userId, userName: reporter?.name },
          );
        }

        if ((visibleTo === "superadmin" || visibleTo === "both") && options.sendNotificationToMany) {
          const superAdmins = await storage.getSuperAdmins();
          const superAdminIds = superAdmins.filter((u) => u.id !== req.userId).map((u) => u.id);
          if (superAdminIds.length > 0) {
            options.sendNotificationToMany({
              recipientIds: superAdminIds,
              type: "report_submitted",
              title: "New Report",
              body: `${reporter?.name || "Someone"} submitted a ${parsed.reportType} concern in ${reportBubble?.title || "a bubble"}`,
              metadata: { bubbleId: parsed.bubbleId, bubbleName: reportBubble?.title, userId: req.userId, userName: reporter?.name },
            });
          }
        }
      }

      res.status(201).json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
}
