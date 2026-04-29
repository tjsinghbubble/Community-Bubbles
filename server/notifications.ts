import { storage } from "./storage";
import type { InsertNotification, Event } from "@shared/schema";
import { utcToLocal, formatTime12h } from "./timezone";

export type NotificationType =
  | "bubble_join"
  | "bubble_leave"
  | "bubble_approved"
  | "bubble_rejected"
  | "bubble_join_request"
  | "bubble_request_approved"
  | "bubble_request_rejected"
  | "bubble_member_removed"
  | "bubble_role_changed"
  | "bubble_edited"
  | "event_created"
  | "event_rsvp"
  | "event_unrsvp"
  | "event_cancelled"
  | "event_updated"
  | "event_full"
  | "event_reminder_24h"
  | "event_reminder_1h"
  | "event_task_reminder_24h"
  | "event_task_reminder_1h"
  | "waitlist_promoted"
  | "waitlist_request"
  | "waitlist_approved"
  | "waitlist_on_hold"
  | "waitlist_rejected"
  | "membership_request"
  | "report_submitted"
  | "report_resolved"
  | "admin_announcement"
  | "peer_dm_started";

type NotificationMetadata = {
  bubbleId?: string;
  bubbleName?: string;
  eventId?: string;
  eventName?: string;
  taskId?: string;
  userId?: string;
  userName?: string;
  reason?: string;
  role?: string;
  reportId?: string | number;
};

export async function sendNotification(params: {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: NotificationMetadata;
  inAppOnly?: boolean;
}): Promise<void> {
  try {
    const data: InsertNotification = {
      recipientId: params.recipientId,
      type: params.type,
      title: params.title,
      body: params.body,
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    };

    await storage.createNotification(data);

    if (!params.inAppOnly) {
      const tokens = await storage.getDevicePushTokens(params.recipientId);
      if (tokens.length > 0) {
        await sendPushNotifications(
          tokens.map((t) => t.token),
          params.title,
          params.body,
          params.metadata,
          params.type,
        );
      }
    }
  } catch (error) {
    console.error("[Notifications] Failed to send notification:", error);
  }
}

export async function sendNotificationToMany(params: {
  recipientIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  metadata?: NotificationMetadata;
  inAppOnly?: boolean;
}): Promise<void> {
  await Promise.allSettled(
    params.recipientIds.map((recipientId) =>
      sendNotification({
        recipientId,
        type: params.type,
        title: params.title,
        body: params.body,
        metadata: params.metadata,
        inAppOnly: params.inAppOnly,
      }),
    ),
  );
}

async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: NotificationMetadata,
  type?: NotificationType,
): Promise<void> {
  const messages = tokens.map((token) => ({
    to: token,
    sound: "default" as const,
    title,
    body,
    data: { ...(data || {}), ...(type ? { notificationType: type } : {}) },
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.error(
        "[Push] Expo push failed:",
        response.status,
        await response.text(),
      );
    }
  } catch (error) {
    console.error("[Push] Failed to send push notifications:", error);
  }
}

export async function notifyBubbleAdmins(
  bubbleId: string,
  excludeUserId: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata?: NotificationMetadata,
  inAppOnly?: boolean,
): Promise<void> {
  try {
    const members = await storage.getBubbleMembersWithUsers(bubbleId);
    const adminIds = members
      .filter(
        (m) =>
          (m.role === "admin" || m.role === "creator") &&
          m.userId !== excludeUserId &&
          m.membershipStatus === "approved",
      )
      .map((m) => m.userId);

    if (adminIds.length > 0) {
      await sendNotificationToMany({
        recipientIds: adminIds,
        type,
        title,
        body,
        metadata,
        inAppOnly,
      });
    }
  } catch (error) {
    console.error("[Notifications] Failed to notify bubble admins:", error);
  }
}

export async function notifyBubbleMembers(
  bubbleId: string,
  excludeUserId: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata?: NotificationMetadata,
  inAppOnly?: boolean,
): Promise<void> {
  try {
    const members = await storage.getBubbleMembersWithUsers(bubbleId);
    const memberIds = members
      .filter(
        (m) => m.userId !== excludeUserId && m.membershipStatus === "approved",
      )
      .map((m) => m.userId);

    if (memberIds.length > 0) {
      await sendNotificationToMany({
        recipientIds: memberIds,
        type,
        title,
        body,
        metadata,
        inAppOnly,
      });
    }
  } catch (error) {
    console.error("[Notifications] Failed to notify bubble members:", error);
  }
}

async function processEventReminders(): Promise<void> {
  try {
    const events24h = await storage.getEventsNeedingReminder('24h');
    let sent24h = 0;
    for (const event of events24h) {
      const attendeeIds = await storage.getEventGoingAttendeeIds(event.id);
      if (attendeeIds.length > 0) {
        const bubble = await storage.getBubble(event.bubbleId);
        const localTime = event.timezone && event.timezone !== 'UTC'
          ? utcToLocal(event.date, event.startTime, event.timezone).time
          : event.startTime;
        const displayTime = formatTime12h(localTime);
        await sendNotificationToMany({
          recipientIds: attendeeIds,
          type: "event_reminder_24h",
          title: "Event Tomorrow",
          body: `"${event.title}" starts tomorrow at ${displayTime}`,
          metadata: { eventId: event.id, eventName: event.title, bubbleId: event.bubbleId, bubbleName: bubble?.title },
        });
        sent24h++;
      }
      await storage.markReminderSent(event.id, '24h');
    }

    const events1h = await storage.getEventsNeedingReminder('1h');
    let sent1h = 0;
    for (const event of events1h) {
      const attendeeIds = await storage.getEventGoingAttendeeIds(event.id);
      if (attendeeIds.length > 0) {
        const bubble = await storage.getBubble(event.bubbleId);
        const localTime1h = event.timezone && event.timezone !== 'UTC'
          ? utcToLocal(event.date, event.startTime, event.timezone).time
          : event.startTime;
        const displayTime1h = formatTime12h(localTime1h);
        await sendNotificationToMany({
          recipientIds: attendeeIds,
          type: "event_reminder_1h",
          title: "Starting Soon",
          body: `"${event.title}" starts in about 1 hour (${displayTime1h})`,
          metadata: { eventId: event.id, eventName: event.title, bubbleId: event.bubbleId, bubbleName: bubble?.title },
        });
        sent1h++;
      }
      await storage.markReminderSent(event.id, '1h');
    }

    if (sent24h > 0 || sent1h > 0) {
      console.log(`[Reminders] Sent ${sent24h} 24h and ${sent1h} 1h reminders`);
    }

    const taskSignups = await storage.getTaskSignupsNeedingReminder();
    let sentTaskReminders = 0;
    for (const signup of taskSignups) {
      const localTime = signup.eventTimezone && signup.eventTimezone !== 'UTC'
        ? utcToLocal(signup.eventDate, signup.eventStartTime, signup.eventTimezone).time
        : signup.eventStartTime;
      const displayTime = formatTime12h(localTime);
      await sendNotification({
        recipientId: signup.userId,
        type: "event_task_reminder_24h",
        title: "Task Reminder",
        body: `You signed up for "${signup.taskTitle}" at "${signup.eventTitle}" tomorrow at ${displayTime}`,
        metadata: { eventId: signup.eventId, eventName: signup.eventTitle, bubbleId: signup.bubbleId, taskId: String(signup.taskId) },
      });
      await storage.markTaskSignupReminderSent(signup.signupId);
      sentTaskReminders++;
    }
    if (sentTaskReminders > 0) {
      console.log(`[Reminders] Sent ${sentTaskReminders} task signup 24h reminders`);
    }

    const taskSignups1h = await storage.getTaskSignupsNeedingReminder1h();
    let sentTaskReminders1h = 0;
    for (const signup of taskSignups1h) {
      const localTime = signup.eventTimezone && signup.eventTimezone !== 'UTC'
        ? utcToLocal(signup.eventDate, signup.eventStartTime, signup.eventTimezone).time
        : signup.eventStartTime;
      const displayTime = formatTime12h(localTime);
      await sendNotification({
        recipientId: signup.userId,
        type: "event_task_reminder_1h",
        title: "Task Starting Soon",
        body: `"${signup.taskTitle}" at "${signup.eventTitle}" starts in about 1 hour (${displayTime})`,
        metadata: { eventId: signup.eventId, eventName: signup.eventTitle, bubbleId: signup.bubbleId, taskId: String(signup.taskId) },
      });
      await storage.markTaskSignupReminder1hSent(signup.signupId);
      sentTaskReminders1h++;
    }
    if (sentTaskReminders1h > 0) {
      console.log(`[Reminders] Sent ${sentTaskReminders1h} task signup 1h reminders`);
    }
  } catch (error) {
    console.error("[Reminders] Error processing event reminders:", error);
  }
}

export function startEventReminderScheduler(): void {
  console.log("[Reminders] Event reminder scheduler started (15-min interval)");
  setInterval(processEventReminders, 15 * 60 * 1000);
  setTimeout(processEventReminders, 10000);
}

async function pruneSlowCallMetrics(): Promise<void> {
  try {
    const deleted = await storage.pruneSlowCallMetrics(90);
    if (deleted > 0) {
      console.log(`[SlowCallPruner] Deleted ${deleted} slow-call record(s) older than 90 days`);
    }
  } catch (error) {
    console.error("[SlowCallPruner] Error pruning slow_call_metrics:", error);
  }
}

export function startSlowCallPrunerScheduler(): void {
  console.log("[SlowCallPruner] Nightly slow-call pruner started (24-hour interval)");
  setInterval(pruneSlowCallMetrics, 24 * 60 * 60 * 1000);
  setTimeout(pruneSlowCallMetrics, 30000);
}
