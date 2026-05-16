import type { Express } from "express";
import jwt from "jsonwebtoken";
import { updateEventSchema, insertEventSignupTaskSchema } from "@shared/schema";
import { moderateText } from "./moderation";
import { localToUtc, utcToLocal } from "./timezone";
import { makeAuthMiddleware } from "./auth-middleware";

export interface EventsManagementStorage {
  getUser(id: string): Promise<any>;
  getEvent(id: string): Promise<any>;
  getBubble(id: string): Promise<any>;
  getMemberRole(userId: string, bubbleId: string): Promise<string | null>;
  updateEvent(id: string, data: any): Promise<any>;
  resetTaskSignupReminder1hFlags(eventId: string): Promise<void>;
  resetTaskSignupReminderFlags(eventId: string): Promise<void>;
  resetEventReminderFlags(eventId: string): Promise<void>;
  getEventAttendees(eventId: string): Promise<any[]>;
  getEventSignupTasks(eventId: string, userId?: string): Promise<any[]>;
  createEventSignupTask(data: any): Promise<any>;
  getEventSignupTask(taskId: number): Promise<any>;
  deleteEventSignupTask(taskId: number): Promise<void>;
  joinEventSignupTask(taskId: number, userId: string): Promise<{ success: boolean; error?: string }>;
  leaveEventSignupTask(taskId: number, userId: string): Promise<void>;
}

export interface EventsManagementOptions {
  sendNotificationToMany?: (opts: {
    recipientIds: string[];
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    inAppOnly?: boolean;
  }) => void;
  transformEvent?: (event: any) => any;
}

function convertEventToLocal(event: any): any {
  if (!event || !event.timezone || event.timezone === "UTC") return event;
  if (!event.date || !event.startTime) return event;
  const normalizedDate = String(event.date).slice(0, 10);
  const localStart = utcToLocal(normalizedDate, event.startTime, event.timezone);
  const result = { ...event, date: localStart.date, startTime: localStart.time };
  if (event.endTime) {
    const utcStartDt = new Date(`${normalizedDate}T${event.startTime}:00Z`);
    const utcEndDt = new Date(`${normalizedDate}T${event.endTime}:00Z`);
    let endUtcDate = normalizedDate;
    if (utcEndDt <= utcStartDt) {
      const next = new Date(utcEndDt.getTime() + 86400000);
      endUtcDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
    }
    result.endTime = utcToLocal(endUtcDate, event.endTime, event.timezone).time;
  }
  return result;
}

export function registerEventsManagementRoutes(
  app: Express,
  storage: EventsManagementStorage,
  jwtSecret: string,
  options: EventsManagementOptions = {},
) {
  const auth = makeAuthMiddleware(storage, jwtSecret);
  const transform = options.transformEvent ?? convertEventToLocal;
  const notifyMany = options.sendNotificationToMany ?? (() => {});

  // ── Update event ──────────────────────────────────────────────────────────

  app.put("/api/events/:id", auth, async (req: any, res: any) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const user = await storage.getUser(req.userId);
      const isEventCreator = event.createdBy === req.userId;
      const isSuperAdmin = user?.isSuperAdmin === true;
      const bubble = await storage.getBubble(event.bubbleId);
      const isBubbleAdmin = bubble?.createdBy === req.userId;

      if (!isEventCreator && !isBubbleAdmin && !isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to edit this event" });
      }

      const parsed = updateEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0].message });
      }

      const modResult = moderateText({ title: req.body.title, description: req.body.description });
      if (modResult.flagged) return res.status(400).json({ error: modResult.message });

      let updateBody = { ...parsed.data };
      const tz = req.body.timezone || event.timezone || "UTC";
      if (tz !== "UTC") {
        if (req.body.date && req.body.startTime) {
          const utcStart = localToUtc(req.body.date, req.body.startTime, tz);
          updateBody.date = utcStart.date;
          updateBody.startTime = utcStart.time;
        }
        if (req.body.endTime && req.body.date) {
          const utcEnd = localToUtc(req.body.date, req.body.endTime, tz);
          updateBody.endTime = utcEnd.time;
        }
        updateBody.timezone = tz;
      }

      const originalDate = event.date;
      const originalStartTime = event.startTime;

      const updated = await storage.updateEvent(req.params.id, updateBody);

      const newDate = updateBody.date ?? originalDate;
      const newStartTime = updateBody.startTime ?? originalStartTime;
      if (newDate !== originalDate || newStartTime !== originalStartTime) {
        await storage.resetTaskSignupReminder1hFlags(req.params.id);
        await storage.resetTaskSignupReminderFlags(req.params.id);
        await storage.resetEventReminderFlags(req.params.id);
      }

      const attendees = await storage.getEventAttendees(req.params.id);
      const attendeeIds = attendees
        .filter((a) => a.userId !== req.userId && a.status === "going")
        .map((a) => a.userId);
      if (attendeeIds.length > 0) {
        notifyMany({
          recipientIds: attendeeIds,
          type: "event_updated",
          title: "Event Updated",
          body: `"${event.title}" has been updated — check the latest details`,
          metadata: { eventId: event.id, eventName: event.title },
          inAppOnly: true,
        });
      }

      res.json(transform(updated));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Signup tasks ──────────────────────────────────────────────────────────

  app.get("/api/events/:id/signup-tasks", async (req: any, res: any) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) return res.status(404).json({ error: "Event not found" });

      let userId: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const decoded = jwt.verify(authHeader.slice(7), jwtSecret) as { userId: string };
          userId = decoded.userId;
        } catch { /* treat as unauthenticated */ }
      }

      const tasks = await storage.getEventSignupTasks(req.params.id, userId);
      res.json(tasks);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/events/:id/signup-tasks", auth, async (req: any, res: any) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const user = await storage.getUser(req.userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const isCreator = event.createdBy === req.userId;
      const role = await storage.getMemberRole(req.userId, event.bubbleId);
      const isAdmin = role === "admin" || user.isSuperAdmin;
      if (!isCreator && !isAdmin) {
        return res.status(403).json({ error: "Only the event creator or bubble admins can add sign-up tasks" });
      }

      const parsed = insertEventSignupTaskSchema.safeParse({
        ...req.body,
        eventId: event.id,
        createdBy: req.userId,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
      }

      const nextPos = (await storage.getEventSignupTasks(event.id)).length;
      const task = await storage.createEventSignupTask({ ...parsed.data, position: nextPos });
      res.status(201).json({ ...task, signupCount: 0, hasSignedUp: false, signers: [] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/events/:id/signup-tasks/:taskId", auth, async (req: any, res: any) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const user = await storage.getUser(req.userId);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const isCreator = event.createdBy === req.userId;
      const role = await storage.getMemberRole(req.userId, event.bubbleId);
      const isAdmin = role === "admin" || user.isSuperAdmin;
      if (!isCreator && !isAdmin) {
        return res.status(403).json({ error: "Only the event creator or bubble admins can delete sign-up tasks" });
      }

      const taskId = parseInt(req.params.taskId, 10);
      if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID" });

      const existingTask = await storage.getEventSignupTask(taskId);
      if (!existingTask || existingTask.eventId !== event.id) {
        return res.status(404).json({ error: "Task not found" });
      }

      await storage.deleteEventSignupTask(taskId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Signup task join / leave ───────────────────────────────────────────────

  app.post("/api/events/signup-tasks/:taskId/join", auth, async (req: any, res: any) => {
    try {
      const taskId = parseInt(req.params.taskId, 10);
      if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID" });

      const task = await storage.getEventSignupTask(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      const event = await storage.getEvent(task.eventId);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const memberRole = await storage.getMemberRole(req.userId, event.bubbleId);
      if (!memberRole) {
        return res.status(403).json({ error: "You must be a bubble member to sign up for tasks" });
      }

      const result = await storage.joinEventSignupTask(taskId, req.userId);
      if (!result.success) return res.status(409).json({ error: result.error ?? "Could not sign up" });

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/events/signup-tasks/:taskId/join", auth, async (req: any, res: any) => {
    try {
      const taskId = parseInt(req.params.taskId, 10);
      if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID" });

      const task = await storage.getEventSignupTask(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });

      const event = await storage.getEvent(task.eventId);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const memberRole = await storage.getMemberRole(req.userId, event.bubbleId);
      if (!memberRole) {
        return res.status(403).json({ error: "You must be a bubble member to manage your sign-ups" });
      }

      await storage.leaveEventSignupTask(taskId, req.userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
