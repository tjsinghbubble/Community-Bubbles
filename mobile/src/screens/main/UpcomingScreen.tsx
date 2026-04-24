import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import AnimatedPressable from '../../components/AnimatedPressable';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../services/api.service';
import { useAuth } from '../../context/AuthContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { Colors, Spacing, Radius, Typography, NotificationBadge, CardShadow } from '../../styles/theme';
import { EventCardTokens } from '../../styles/design-tokens';
import { UpcomingScreenSkeleton } from '../../components/SkeletonLoader';

type UpcomingEvent = {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  locationName: string | null;
  bubbleId: string;
  bubble?: {
    id: string;
    title: string;
  };
};

type GroupedEvents = {
  label: string;
  events: UpcomingEvent[];
};

function groupEventsByTimePeriod(events: UpcomingEvent[]): GroupedEvents[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const dayOfWeek = today.getDay();
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - dayOfWeek));

  const groups: Map<string, UpcomingEvent[]> = new Map();
  const groupOrder: string[] = [];

  for (const event of events) {
    const eventDate = new Date(event.date + 'T00:00:00');
    let label: string;

    if (eventDate <= endOfWeek) {
      label = 'This week';
    } else {
      label = eventDate.toLocaleDateString('en-US', { month: 'long' });
      const eventYear = eventDate.getFullYear();
      if (eventYear !== now.getFullYear()) {
        label = `${label} ${eventYear}`;
      }
    }

    if (!groups.has(label)) {
      groups.set(label, []);
      groupOrder.push(label);
    }
    groups.get(label)!.push(event);
  }

  return groupOrder.map(label => ({
    label,
    events: groups.get(label)!,
  }));
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatTimeNoSuffix(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes}`;
}

function crossesMidnight(startTime: string, endTime: string): boolean {
  const [sh] = startTime.split(':').map(Number);
  const [eh] = endTime.split(':').map(Number);
  return eh < sh;
}

function formatEventDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export default function UpcomingScreen() {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showCampusOnly, setShowCampusOnly] = useState(false);
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isCampusVerified = user?.campusVerified === true;

  const fetchData = async () => {
    try {
      const data = await apiService.getUpcomingEvents() as UpcomingEvent[];
      setEvents(data);
    } catch (error) {
      console.error('[Upcoming] Failed to fetch events:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
      apiService.getUnreadNotificationCount().then(r => setUnreadNotifCount(r.count)).catch(() => {});
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleEventPress = (event: UpcomingEvent) => {
    navigation.navigate('Explore', {
      screen: 'EventDetails',
      params: { eventId: event.id, event },
    });
  };

  const displayEvents = showCampusOnly
    ? events.filter((e: any) => e.campusId)
    : events;
  const grouped = groupEventsByTimePeriod(displayEvents);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          {isCampusVerified ? (
            <TouchableOpacity 
              style={[styles.campusHatButton, showCampusOnly && styles.campusHatButtonActive]} 
              onPress={() => setShowCampusOnly(!showCampusOnly)}
            >
              <Ionicons name="school-outline" size={22} color={showCampusOnly ? Colors.brand.bubbleBlue : Colors.neutral.charcoal} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <Text style={styles.headerTitle}>Upcoming Events</Text>
          <TouchableOpacity style={styles.bellButton} onPress={() => (navigation as any).navigate('Explore', { screen: 'Notifications' })}>
            <View>
              <Ionicons name="notifications-outline" size={24} color={Colors.text.primary} />
            </View>
          </TouchableOpacity>
        </View>
        <UpcomingScreenSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {isCampusVerified ? (
          <TouchableOpacity 
            style={[styles.campusHatButton, showCampusOnly && styles.campusHatButtonActive]} 
            onPress={() => setShowCampusOnly(!showCampusOnly)}
          >
            <Ionicons name="school-outline" size={22} color={showCampusOnly ? Colors.brand.bubbleBlue : Colors.neutral.charcoal} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
        <Text style={styles.headerTitle}>Upcoming Events</Text>
        <TouchableOpacity style={styles.bellButton} onPress={() => (navigation as any).navigate('Explore', { screen: 'Notifications' })}>
          <View>
            <Ionicons name="notifications-outline" size={24} color={Colors.text.primary} />
            {unreadNotifCount > 0 && (
              <View style={NotificationBadge.badge}>
                <Text style={NotificationBadge.badgeText}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {displayEvents.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={64} color={Colors.neutral.coolMist} />
          <Text style={styles.emptyTitle}>No upcoming events</Text>
          <Text style={styles.emptySubtitle}>
            Events from your bubbles will appear here
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {grouped.map((group, groupIndex) => (
            <View key={group.label}>
              {groupIndex > 0 && (
                <View style={styles.timelineSeparator}>
                  <View style={styles.timelineLine} />
                  <Text style={styles.timelineSeparatorText}>{group.label}</Text>
                  <View style={styles.timelineLine} />
                </View>
              )}
              {groupIndex === 0 && (
                <Text style={styles.sectionTitle}>{group.label}</Text>
              )}

              {group.events.map((event) => (
                <AnimatedPressable
                  key={event.id}
                  style={styles.eventCard}
                  scaleValue={0.97}
                  onPress={() => handleEventPress(event)}
                >
                  {event.bubble && (
                    <Text style={styles.bubbleName}>{event.bubble.title}</Text>
                  )}
                  <View style={styles.eventCardInner}>
                    <Image
                      source={{
                        uri: resolveMediaUrl(event.coverImage) || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400',
                      }}
                      style={styles.eventImage}
                      resizeMode="cover"
                      onError={() => console.warn('[Image] event load failed:', event.coverImage?.slice(0, 80))}
                    />
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle} numberOfLines={1}>{event.title.length > 15 ? event.title.substring(0, 15) + '...' : event.title}</Text>
                      <Text style={styles.eventDateTime}>
                        {formatEventDate(event.date)} | {event.endTime
                          ? (crossesMidnight(event.startTime, event.endTime)
                            ? `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`
                            : `${formatTimeNoSuffix(event.startTime)} - ${formatTime(event.endTime)}`)
                          : formatTime(event.startTime)}
                      </Text>
                      {event.locationName && (
                        <Text style={styles.eventLocation} numberOfLines={1}>
                          {event.locationName}
                        </Text>
                      )}
                    </View>
                  </View>
                </AnimatedPressable>
              ))}
            </View>
          ))}
        </ScrollView>
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
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  campusHatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  campusHatButtonActive: {
    backgroundColor: '#E8F4FD',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral.charcoal,
    marginTop: 16,
    marginBottom: 16,
  },
  timelineSeparator: {
    alignItems: 'flex-start',
    marginVertical: 20,
  },
  timelineLine: {
    display: 'none',
  },
  timelineSeparatorText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral.coolMist,
  },
  eventCard: {
    backgroundColor: EventCardTokens.fill,
    borderRadius: 20,
    height: EventCardTokens.height,
    marginBottom: 12,
    padding: EventCardTokens.padding,
    justifyContent: 'center',
    ...CardShadow,
  },
  bubbleName: {
    position: 'absolute',
    top: 6,
    right: EventCardTokens.padding,
    fontSize: 11,
    color: EventCardTokens.colors.label,
  },
  eventCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: EventCardTokens.padding,
  },
  eventImage: {
    width: EventCardTokens.image.size,
    height: EventCardTokens.image.size,
    borderRadius: EventCardTokens.image.borderRadius,
    backgroundColor: EventCardTokens.image.placeholder,
  },
  eventInfo: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: EventCardTokens.colors.title,
    marginBottom: 8,
    marginTop: 4,
  },
  eventDateTime: {
    fontSize: 12,
    color: EventCardTokens.colors.subtitle,
  },
  eventLocation: {
    fontSize: 12,
    color: EventCardTokens.colors.subtitle,
  },
});
