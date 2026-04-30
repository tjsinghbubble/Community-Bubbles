import { storage } from "./storage";
import type { InsertNotification, Event } from "@shared/schema";
import { utcToLocal, formatTime12h } from "./timezone";
import { getSlowCallRetentionDays } from "./slow-call-config";
import { reportFatalCrashSpike } from "./sentry";

function parsePositiveInt(value: string | undefined, defaultValue: number): number {
  const parsed = parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

const FATAL_CRASH_SPIKE_WINDOW_MINUTES = parsePositiveInt(
  process.env.FATAL_CRASH_SPIKE_WINDOW_MINUTES,
  5,
);
const FATAL_CRASH_SPIKE_THRESHOLD = parsePositiveInt(
  process.env.FATAL_CRASH_SPIKE_THRESHOLD,
  5,
);

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

type NotificationCategory = "bubbleActivity" | "eventActivity" | "eventReminders" | "taskReminders" | "waitlistUpdates" | "announcements";

const NOTIFICATION_CATEGORY_MAP: Record<NotificationType, NotificationCategory> = {
  bubble_join: "bubbleActivity",
  bubble_leave: "bubbleActivity",
  bubble_approved: "bubbleActivity",
  bubble_rejected: "bubbleActivity",
  bubble_join_request: "bubbleActivity",
  bubble_request_approved: "bubbleActivity",
  bubble_request_rejected: "bubbleActivity",
  bubble_member_removed: "bubbleActivity",
  bubble_role_changed: "bubbleActivity",
  bubble_edited: "bubbleActivity",
  membership_request: "bubbleActivity",
  event_created: "eventActivity",
  event_rsvp: "eventActivity",
  event_unrsvp: "eventActivity",
  event_cancelled: "eventActivity",
  event_updated: "eventActivity",
  event_full: "eventActivity",
  event_reminder_24h: "eventReminders",
  event_reminder_1h: "eventReminders",
  event_task_reminder_24h: "taskReminders",
  event_task_reminder_1h: "taskReminders",
  waitlist_promoted: "waitlistUpdates",
  waitlist_request: "waitlistUpdates",
  waitlist_approved: "waitlistUpdates",
  waitlist_on_hold: "waitlistUpdates",
  waitlist_rejected: "waitlistUpdates",
  report_submitted: "announcements",
  report_resolved: "announcements",
  admin_announcement: "announcements",
  peer_dm_started: "announcements",
};

async function isPushAllowed(userId: string, type: NotificationType): Promise<boolean> {
  try {
    const prefs = await storage.getNotificationPreferences(userId);
    if (!prefs) return true;
    if (prefs.pushPaused) return false;
    const category = NOTIFICATION_CATEGORY_MAP[type];
    return prefs[category] !== false;
  } catch (error) {
    console.error("[Notifications] Failed to read notification preferences for user", userId, "— suppressing push:", error);
    return false;
  }
}

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
      const pushAllowed = await isPushAllowed(params.recipientId, params.type);
      if (pushAllowed) {
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
    // Per-attendee 24h reminders: each attendee has their own flag so late
    // RSVPs receive reminders even after the event-wide batch was already sent.
    const attendees24h = await storage.getAttendeesNeedingReminder('24h');
    let sent24h = 0;
    // Group by eventId to send batch notifications per event
    const byEvent24h = new Map<string, { userIds: string[]; event: Event }>();
    for (const row of attendees24h) {
      if (!byEvent24h.has(row.eventId)) {
        byEvent24h.set(row.eventId, { userIds: [], event: row.event });
      }
      byEvent24h.get(row.eventId)!.userIds.push(row.userId);
    }
    for (const [, { userIds, event }] of byEvent24h) {
      const bubble = await storage.getBubble(event.bubbleId);
      const localTime = event.timezone && event.timezone !== 'UTC'
        ? utcToLocal(event.date, event.startTime, event.timezone).time
        : event.startTime;
      const displayTime = formatTime12h(localTime);
      await sendNotificationToMany({
        recipientIds: userIds,
        type: "event_reminder_24h",
        title: "Event Tomorrow",
        body: `"${event.title}" starts tomorrow at ${displayTime}`,
        metadata: { eventId: event.id, eventName: event.title, bubbleId: event.bubbleId, bubbleName: bubble?.title },
      });
      for (const userId of userIds) {
        await storage.markAttendeeReminderSent(userId, event.id, '24h');
      }
      sent24h++;
    }

    // Per-attendee 1h reminders
    const attendees1h = await storage.getAttendeesNeedingReminder('1h');
    let sent1h = 0;
    const byEvent1h = new Map<string, { userIds: string[]; event: Event }>();
    for (const row of attendees1h) {
      if (!byEvent1h.has(row.eventId)) {
        byEvent1h.set(row.eventId, { userIds: [], event: row.event });
      }
      byEvent1h.get(row.eventId)!.userIds.push(row.userId);
    }
    for (const [, { userIds, event }] of byEvent1h) {
      const bubble = await storage.getBubble(event.bubbleId);
      const localTime1h = event.timezone && event.timezone !== 'UTC'
        ? utcToLocal(event.date, event.startTime, event.timezone).time
        : event.startTime;
      const displayTime1h = formatTime12h(localTime1h);
      await sendNotificationToMany({
        recipientIds: userIds,
        type: "event_reminder_1h",
        title: "Starting Soon",
        body: `"${event.title}" starts in about 1 hour (${displayTime1h})`,
        metadata: { eventId: event.id, eventName: event.title, bubbleId: event.bubbleId, bubbleName: bubble?.title },
      });
      for (const userId of userIds) {
        await storage.markAttendeeReminderSent(userId, event.id, '1h');
      }
      sent1h++;
    }

    if (sent24h > 0 || sent1h > 0) {
      console.log(`[Reminders] Sent ${sent24h} 24h and ${sent1h} 1h event reminders`);
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
    const retentionDays = getSlowCallRetentionDays();
    const deleted = await storage.purgeOldSlowCalls(retentionDays);
    if (deleted > 0) {
      console.log(`[SlowCallPruner] Deleted ${deleted} slow-call record(s) older than ${retentionDays} days`);
    }
  } catch (error) {
    console.error("[SlowCallPruner] Error pruning slow_call_metrics:", error);
  }
}

export function startSlowCallPrunerScheduler(): void {
  console.log(`[SlowCallPruner] Nightly slow-call pruner started (24-hour interval, retention=${getSlowCallRetentionDays()} days)`);
  setInterval(pruneSlowCallMetrics, 24 * 60 * 60 * 1000);
  setTimeout(pruneSlowCallMetrics, 30000);
}

async function checkFatalCrashSpike(): Promise<void> {
  try {
    const from = new Date(Date.now() - FATAL_CRASH_SPIKE_WINDOW_MINUTES * 60 * 1000);
    const reports = await storage.queryCrashReports({ isFatal: true, from, limit: FATAL_CRASH_SPIKE_THRESHOLD + 1 });
    const count = reports.length;
    if (count >= FATAL_CRASH_SPIKE_THRESHOLD) {
      reportFatalCrashSpike(count, FATAL_CRASH_SPIKE_WINDOW_MINUTES, FATAL_CRASH_SPIKE_THRESHOLD);
    }
  } catch (error) {
    console.error("[FatalCrashSpike] Error checking for fatal crash spike:", error);
  }
}

export function startFatalCrashSpikeScheduler(): void {
  console.log(
    `[FatalCrashSpike] Fatal crash spike scheduler started (${FATAL_CRASH_SPIKE_WINDOW_MINUTES}-min window, threshold=${FATAL_CRASH_SPIKE_THRESHOLD})`,
  );
  setInterval(checkFatalCrashSpike, FATAL_CRASH_SPIKE_WINDOW_MINUTES * 60 * 1000);
  setTimeout(checkFatalCrashSpike, 15000);
}
