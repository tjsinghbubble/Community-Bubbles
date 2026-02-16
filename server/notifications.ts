import { storage } from "./storage";
import type { InsertNotification } from "@shared/schema";

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
  | "event_created"
  | "event_rsvp"
  | "event_cancelled"
  | "event_updated"
  | "waitlist_promoted"
  | "membership_request"
  | "report_submitted"
  | "report_resolved"
  | "admin_announcement";

type NotificationMetadata = {
  bubbleId?: string;
  bubbleName?: string;
  eventId?: string;
  eventName?: string;
  userId?: string;
  userName?: string;
  reason?: string;
  role?: string;
};

export async function sendNotification(params: {
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: NotificationMetadata;
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

    const tokens = await storage.getDevicePushTokens(params.recipientId);
    if (tokens.length > 0) {
      await sendPushNotifications(
        tokens.map((t) => t.token),
        params.title,
        params.body,
        params.metadata,
      );
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
}): Promise<void> {
  await Promise.allSettled(
    params.recipientIds.map((recipientId) =>
      sendNotification({
        recipientId,
        type: params.type,
        title: params.title,
        body: params.body,
        metadata: params.metadata,
      }),
    ),
  );
}

async function sendPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data?: NotificationMetadata,
): Promise<void> {
  const messages = tokens.map((token) => ({
    to: token,
    sound: "default" as const,
    title,
    body,
    data: data || {},
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
      });
    }
  } catch (error) {
    console.error("[Notifications] Failed to notify bubble members:", error);
  }
}
