import type { Express } from "express";
import jwt from "jsonwebtoken";
import { insertBubbleSchema } from "@shared/schema";
import { moderateText } from "./moderation";
import { makeAuthMiddleware } from "./auth-middleware";

export interface BubblesStorage {
  getUser(id: string): Promise<any>;
  getBubble(id: string): Promise<any>;
  createBubble(data: any): Promise<any>;
  createMembershipWithRole(data: { userId: string; bubbleId: string }, role: string): Promise<any>;
  getRealMemberCount(bubbleId: string): Promise<number>;
}

export interface BubblesHandlerOptions {
  enrichBubble?: (bubble: any) => Promise<any>;
}

export function registerBubblesRoutes(
  app: Express,
  storage: BubblesStorage,
  jwtSecret: string,
  options: BubblesHandlerOptions = {},
) {
  const auth = makeAuthMiddleware(storage, jwtSecret);
  const enrich = options.enrichBubble ?? ((b: any) => Promise.resolve(b));

  app.get("/api/bubbles/:id", async (req: any, res: any) => {
    try {
      const bubble = await storage.getBubble(req.params.id);
      if (!bubble) return res.status(404).json({ error: "Bubble not found" });

      if (bubble.campusId) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return res.status(403).json({ error: "Campus verification required" });
        }
        try {
          const token = authHeader.slice(7);
          const decoded = jwt.verify(token, jwtSecret) as { userId: string };
          const user = await storage.getUser(decoded.userId);
          if (!user?.campusVerified || user.campusId !== bubble.campusId) {
            return res.status(403).json({ error: "Campus verification required" });
          }
        } catch {
          return res.status(403).json({ error: "Campus verification required" });
        }
      }

      const realMemberCount = await storage.getRealMemberCount(bubble.id);
      res.json(await enrich({ ...bubble, members: realMemberCount }));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/bubbles", auth, async (req: any, res: any) => {
    try {
      const body = { ...req.body, createdBy: req.userId };

      const modResult = moderateText({
        title: body.title,
        tagline: body.tagline,
        description: body.description,
        rules: body.rules,
      });
      if (modResult.flagged) {
        return res.status(400).json({ error: modResult.message });
      }

      const data = insertBubbleSchema.parse(body);
      const bubble = await storage.createBubble(data);

      try {
        await storage.createMembershipWithRole(
          { userId: req.userId, bubbleId: bubble.id },
          "admin",
        );
      } catch (e) {
        console.error("Failed to auto-add creator as admin member:", e);
      }

      res.json(await enrich(bubble));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
}
