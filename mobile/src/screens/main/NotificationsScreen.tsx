import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../services/api.service';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';
import AnimatedPressable from '../../components/AnimatedPressable';

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: string | null;
  read: boolean;
  createdAt: string;
};

function fixMilitaryTime(text: string): string {
  return text.replace(/\b(\d{1,2}):(\d{2})\b(?!\s*[APap][Mm])/g, (_, h, m) => {
    let hour = parseInt(h, 10);
    if (hour > 23 || hour < 0) return `${h}:${m}`;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    if (hour === 0) hour = 12;
    else if (hour > 12) hour -= 12;
    return `${hour}:${m} ${ampm}`;
  });
}

const ICON_MAP: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  bubble_join: { name: 'people', color: Colors.brand.primary, bg: Colors.background.brandTint },
  bubble_leave: { name: 'exit-outline', color: Colors.text.tertiary, bg: Colors.background.surface },
  bubble_approved: { name: 'checkmark-circle', color: Colors.status.success, bg: Colors.background.successTint },
  bubble_rejected: { name: 'close-circle', color: Colors.status.error, bg: Colors.background.errorTint },
  bubble_request_approved: { name: 'checkmark-circle', color: Colors.status.success, bg: Colors.background.successTint },
  bubble_request_rejected: { name: 'close-circle', color: Colors.status.error, bg: Colors.background.errorTint },
  bubble_join_request: { name: 'person-add', color: Colors.brand.primary, bg: Colors.background.brandTint },
  bubble_member_removed: { name: 'remove-circle', color: Colors.status.error, bg: Colors.background.errorTint },
  bubble_role_changed: { name: 'shield-checkmark', color: Colors.status.warning, bg: Colors.background.warningTint },
  bubble_edited: { name: 'create-outline', color: Colors.status.warning, bg: Colors.background.warningTint },
  membership_request: { name: 'person-add', color: Colors.brand.primary, bg: Colors.background.brandTint },
  event_created: { name: 'calendar', color: Colors.brand.primary, bg: Colors.background.brandTint },
  event_rsvp: { name: 'hand-right', color: Colors.status.success, bg: Colors.background.successTint },
  event_unrsvp: { name: 'hand-left', color: Colors.status.warning, bg: Colors.background.warningTint },
  event_updated: { name: 'create-outline', color: Colors.brand.primary, bg: Colors.background.brandTint },
  event_cancelled: { name: 'close-circle-outline', color: Colors.status.error, bg: Colors.background.errorTint },
  event_full: { name: 'people-circle', color: Colors.status.warning, bg: Colors.background.warningTint },
  event_reminder_24h: { name: 'alarm-outline', color: Colors.brand.primary, bg: Colors.background.brandTint },
  event_reminder_1h: { name: 'alarm', color: Colors.status.warning, bg: Colors.background.warningTint },
  waitlist_promoted: { name: 'arrow-up-circle', color: Colors.status.success, bg: Colors.background.successTint },
  report_submitted: { name: 'flag', color: Colors.status.warning, bg: Colors.background.warningTint },
  report_resolved: { name: 'checkmark-done', color: Colors.status.success, bg: Colors.background.successTint },
  admin_announcement: { name: 'megaphone', color: Colors.brand.primary, bg: Colors.background.brandTint },
};

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiService.getNotifications(50, 0);
      setNotifications(data);
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error('Failed to mark all read:', e);
    }
  };

  const handleNotificationTap = async (notif: NotificationItem) => {
    if (!notif.read) {
      try {
        await apiService.markNotificationRead(notif.id);
        setNotifications(prev =>
          prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
        );
      } catch (e) {
        console.error('Failed to mark read:', e);
      }
    }

    let meta: any = {};
    try { meta = notif.metadata ? JSON.parse(notif.metadata) : {}; } catch { meta = {}; }
    if (meta.bubbleId && !meta.eventId) {
      (navigation as any).navigate('Explore', {
        screen: 'BubbleDetails',
        params: { bubble: { id: meta.bubbleId, title: meta.bubbleName || '', category: '' } },
      });
    } else if (meta.eventId) {
      (navigation as any).navigate('Explore', {
        screen: 'EventDetails',
        params: { eventId: meta.eventId, bubbleId: meta.bubbleId, bubbleTitle: meta.bubbleName },
      });
    }
  };

  const handleDeleteNotification = (notifId: string) => {
    Alert.alert('Delete Notification', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteNotification(notifId);
            setNotifications(prev => prev.filter(n => n.id !== notifId));
          } catch (e) {
            console.error('Failed to delete notification:', e);
          }
        },
      },
    ]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  type SectionItem = { type: 'header'; title: string } | { type: 'notif'; data: NotificationItem };

  const sectionData: SectionItem[] = [];
  if (unreadNotifications.length > 0) {
    sectionData.push({ type: 'header', title: 'New' });
    unreadNotifications.forEach(n => sectionData.push({ type: 'notif', data: n }));
  }
  if (readNotifications.length > 0) {
    sectionData.push({ type: 'header', title: 'Older Notifications' });
    readNotifications.forEach(n => sectionData.push({ type: 'notif', data: n }));
  }

  const renderNotification = ({ item }: { item: NotificationItem }) => {
    const iconInfo = ICON_MAP[item.type] || { name: 'notifications' as keyof typeof Ionicons.glyphMap, color: Colors.brand.primary, bg: Colors.background.brandTint };

    return (
      <AnimatedPressable
        style={[styles.notifRow, !item.read && styles.notifRowUnread]}
        scaleValue={0.97}
        onPress={() => handleNotificationTap(item)}
        onLongPress={() => handleDeleteNotification(item.id)}
        testID={`notification-item-${item.id}`}
      >
        <View style={[styles.iconCircle, { backgroundColor: iconInfo.bg }]}>
          <Ionicons name={iconInfo.name} size={20} color={iconInfo.color} />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.notifBody} numberOfLines={2}>
            {fixMilitaryTime(item.body)}
          </Text>
          <Text style={styles.notifTime}>{getTimeAgo(item.createdAt)}</Text>
        </View>
      </AnimatedPressable>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} data-testid="button-back">
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton} data-testid="button-mark-all-read">
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton}>
            <View style={{ width: 24 }} />
          </View>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="notifications-outline" size={40} color={Colors.brand.primary} />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>
            When something happens in your bubbles or events, you'll see it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={sectionData}
          keyExtractor={(item, index) => item.type === 'header' ? `header-${item.title}` : `notif-${item.data.id}`}
          renderItem={({ item: sectionItem }) => {
            if (sectionItem.type === 'header') {
              return (
                <Text style={styles.sectionHeader}>{sectionItem.title}</Text>
              );
            }
            return renderNotification({ item: sectionItem.data });
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.brand.bubbleBlue} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lightSilver,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  markAllButton: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
  },
  markAllText: {
    fontSize: Typography.sizes.base,
    color: Colors.brand.primary,
    fontWeight: Typography.weights.semiBold,
  },
  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.tertiary,
    paddingHorizontal: Spacing.md + Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background.primary,
    borderRadius: 20,
    marginHorizontal: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  notifRowUnread: {
    backgroundColor: Colors.background.brandTint,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.text.primary,
    marginBottom: Spacing.xxs,
  },
  notifTitleUnread: {
    fontWeight: Typography.weights.bold,
  },
  notifBody: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.base,
    marginBottom: Spacing.xs,
  },
  notifTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.brand.bubbleBlue,
    marginLeft: 8,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxxl,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background.brandTint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.base,
  },
});
