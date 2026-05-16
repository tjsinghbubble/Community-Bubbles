import type { Express } from "express";
import jwt from "jsonwebtoken";
import { insertEventSchema } from "@shared/schema";
import { moderateText } from "./moderation";
import { localToUtc, utcToLocal } from "./timezone";
import { makeAuthMiddleware } from "./auth-middleware";

export interface EventsStorage {
  getUser(id: string): Promise<any>;
  getEvent(id: string): Promise<any>;
  getBubble(id: string): Promise<any>;
  getMemberRole(userId: string, bubbleId: string): Promise<string | null>;
  isMember(userId: string, bubbleId: string): Promise<boolean>;
  createEvent(data: any): Promise<any>;
  createEventAttendee(data: { eventId: string; userId: string; status: string }): Promise<any>;
  deleteEvent(id: string): Promise<void>;
  getEventAttendees(eventId: string): Promise<any[]>;
  getEventAttendee(userId: string, eventId: string): Promise<any>;
  deleteEventAttendee(userId: string, eventId: string): Promise<void>;
  getGoingCount(eventId: string): Promise<number>;
  getFirstWaitlistedAttendee(eventId: string): Promise<any>;
  updateEventAttendeeStatus(userId: string, eventId: string, status: string): Promise<any>;
}

export interface EventsHandlerOptions {
  sendNotification?: (opts: {
    recipientId: string;
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
    inAppOnly?: boolean;
  }) => void;
  sendNotificationToMany?: (opts: {
    recipientIds: string[];
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) => void;
  notifyBubbleMembers?: (...args: any[]) => void;
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
      const nextDay = new Date(utcEndDt.getTime() + 24 * 60 * 60 * 1000);
      endUtcDate = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDay.getUTCDate()).padStart(2, "0")}`;
    }
    const localEnd = utcToLocal(endUtcDate, event.endTime, event.timezone);
    result.endTime = localEnd.time;
  }
  return result;
}

export function registerEventsRoutes(
  app: Express,
  storage: EventsStorage,
  jwtSecret: string,
  options: EventsHandlerOptions = {},
) {
  const auth = makeAuthMiddleware(storage, jwtSecret);
  const transform = options.transformEvent ?? convertEventToLocal;
  const notify = options.sendNotification ?? (() => {});
  const notifyMany = options.sendNotificationToMany ?? (() => {});
  const notifyBubbleMembers = options.notifyBubbleMembers ?? (() => {});

  app.get("/api/events/:id", async (req: any, res: any) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) return res.status(404).json({ error: "Event not found" });

      if (event.campusId) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          return res.status(403).json({ error: "Campus verification required" });
        }
        try {
          const token = authHeader.slice(7);
          const decoded = jwt.verify(token, jwtSecret) as { userId: string };
          const user = await storage.getUser(decoded.userId);
          if (!user?.campusVerified || user.campusId !== event.campusId) {
            return res.status(403).json({ error: "Campus verification required" });
          }
        } catch {
          return res.status(403).json({ error: "Campus verification required" });
        }
      }

      const creator = await storage.getUser(event.createdBy);
      res.json({ ...transform(event), creatorName: creator?.name || "Event Creator" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/events", auth, async (req: any, res: any) => {
    try {
      const modResult = moderateText({
        title: req.body.title,
        description: req.body.description,
      });
      if (modResult.flagged) {
        return res.status(400).json({ error: modResult.message });
      }

      const timezone = req.body.timezone || "UTC";
      let bodyToStore = { ...req.body };
      if (timezone !== "UTC" && req.body.date && req.body.startTime) {
        const utcStart = localToUtc(req.body.date, req.body.startTime, timezone);
        bodyToStore.date = utcStart.date;
        bodyToStore.startTime = utcStart.time;
        if (req.body.endTime) {
          const utcEnd = localToUtc(req.body.date, req.body.endTime, timezone);
          bodyToStore.endTime = utcEnd.time;
        }
        bodyToStore.timezone = timezone;
      }

      const data = insertEventSchema.parse({ ...bodyToStore, createdBy: req.userId });

      const bubble = await storage.getBubble(data.bubbleId);
      if (!bubble) return res.status(404).json({ error: "Bubble not found" });

      const user = await storage.getUser(req.userId);
      const isSuperAdmin = user?.isSuperAdmin === true;

      if (bubble.privacy === "Public") {
        const memberRole = await storage.getMemberRole(req.userId, data.bubbleId);
        if (memberRole !== "admin" && !isSuperAdmin) {
          return res.status(403).json({ error: "Only admins can create events in public bubbles" });
        }
      } else {
        const isMember = await storage.isMember(req.userId, data.bubbleId);
        if (!isMember && !isSuperAdmin) {
          return res.status(403).json({ error: "You must be a member to create events" });
        }
      }

      const event = await storage.createEvent(data);

      await storage.createEventAttendee({ eventId: event.id, userId: req.userId, status: "going" });

      const eventCreator = await storage.getUser(req.userId);
      notifyBubbleMembers(
        event.bubbleId,
        req.userId,
        "event_created",
        "New Event",
        `${eventCreator?.name || "Someone"} created "${event.title}" in ${bubble.title}`,
        { bubbleId: event.bubbleId, eventId: event.id },
      );

      res.json(transform(event));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/events/:id", auth, async (req: any, res: any) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) return res.status(404).json({ error: "Event not found" });

      const user = await storage.getUser(req.userId);
      const isEventCreator = event.createdBy === req.userId;
      const isSuperAdmin = user?.isSuperAdmin === true;
      const bubble = await storage.getBubble(event.bubbleId);
      const isBubbleAdmin = bubble?.createdBy === req.userId;

      if (!isEventCreator && !isBubbleAdmin && !isSuperAdmin) {
        return res.status(403).json({ error: "Not authorized to delete this event" });
      }

      const cancelAttendees = await storage.getEventAttendees(req.params.id);
      const cancelIds = cancelAttendees
        .filter((a) => a.userId !== req.userId && a.status === "going")
        .map((a) => a.userId);
      if (cancelIds.length > 0) {
        notifyMany({
          recipientIds: cancelIds,
          type: "event_cancelled",
          title: "Event Cancelled",
          body: `"${event.title}" has been cancelled`,
          metadata: { eventId: event.id, eventName: event.title },
        });
      }

      await storage.deleteEvent(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/events/:id/rsvp", auth, async (req: any, res: any) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) return res.status(404).json({ error: "Event not found" });

      if (event.campusId) {
        const user = await storage.getUser(req.userId);
        if (!user?.campusVerified || user.campusId !== event.campusId) {
          return res.status(403).json({ error: "Campus verification required to RSVP" });
        }
      }

      const existingAttendee = await storage.getEventAttendee(req.userId, req.params.id);
      if (existingAttendee) return res.status(400).json({ error: "Already RSVP'd" });

      const requestedStatus = req.body.status || "going";
      let finalStatus = requestedStatus;

      if (requestedStatus === "going" && event.attendeeLimit) {
        const goingCount = await storage.getGoingCount(req.params.id);
        if (goingCount >= event.attendeeLimit) finalStatus = "waitlisted";
      }

      await storage.createEventAttendee({ eventId: req.params.id, userId: req.userId, status: finalStatus });

      if (finalStatus === "going" && event.createdBy !== req.userId) {
        const rsvpUser = await storage.getUser(req.userId);
        notify({
          recipientId: event.createdBy,
          type: "event_rsvp",
          title: "New RSVP",
          body: `${rsvpUser?.name || "Someone"} is going to "${event.title}"`,
          metadata: { eventId: event.id, eventName: event.title },
          inAppOnly: true,
        });
      }

      if (finalStatus === "going" && event.attendeeLimit) {
        const goingAfterRsvp = await storage.getGoingCount(req.params.id);
        if (goingAfterRsvp >= event.attendeeLimit) {
          notify({
            recipientId: event.createdBy,
            type: "event_full",
            title: "Event Full!",
            body: `"${event.title}" has reached its capacity of ${event.attendeeLimit}`,
            metadata: { eventId: event.id, eventName: event.title },
            inAppOnly: true,
          });
        }
      }

      res.json({ success: true, status: finalStatus });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/events/:id/rsvp", auth, async (req: any, res: any) => {
    try {
      const attendee = await storage.getEventAttendee(req.userId, req.params.id);
      const wasGoing = attendee?.status === "going";

      await storage.deleteEventAttendee(req.userId, req.params.id);

      if (wasGoing) {
        const unrsvpEvent = await storage.getEvent(req.params.id);
        if (unrsvpEvent && unrsvpEvent.createdBy !== req.userId) {
          const unrsvpUser = await storage.getUser(req.userId);
          notify({
            recipientId: unrsvpEvent.createdBy,
            type: "event_unrsvp",
            title: "RSVP Cancelled",
            body: `${unrsvpUser?.name || "Someone"} is no longer going to "${unrsvpEvent.title}"`,
            metadata: { eventId: unrsvpEvent.id, eventName: unrsvpEvent.title },
            inAppOnly: true,
          });
        }
      }

      let promotedUserId: string | null = null;
      if (wasGoing) {
        const event = await storage.getEvent(req.params.id);
        if (event?.attendeeLimit) {
          const firstWaitlisted = await storage.getFirstWaitlistedAttendee(req.params.id);
          if (firstWaitlisted) {
            await storage.updateEventAttendeeStatus(firstWaitlisted.userId, req.params.id, "going");
            promotedUserId = firstWaitlisted.userId;
            notify({
              recipientId: firstWaitlisted.userId,
              type: "waitlist_promoted",
              title: "You're In!",
              body: `A spot opened up for "${event.title}" — you're now going!`,
              metadata: { eventId: event.id, eventName: event.title },
            });
          }
        }
      }

      res.json({ success: true, promotedUserId });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });
}
