import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import AnimatedPressable from '../../components/AnimatedPressable';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../services/api.service';
import { useAuth } from '../../context/AuthContext';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { getFallbackImage } from '../../utils/categoryImages';
import { Colors, Spacing, Radius, Typography, NotificationBadge, CardShadow } from '../../styles/theme';
import { EventCardTokens } from '../../styles/design-tokens';
import { UpcomingScreenSkeleton } from '../../components/SkeletonLoader';
import { CalendarIcon } from '../../components/icons';
import RsvpBottomSheet from '../../components/RsvpBottomSheet';

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
  recurrenceType?: string;
  bubble?: {
    id: string;
    title: string;
  };
  rsvpStatus?: string | null;
};

type PastEvent = {
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

type GroupedPastEvents = {
  label: string;
  events: PastEvent[];
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

function groupPastEventsByMonth(events: PastEvent[]): GroupedPastEvents[] {
  const groups: Map<string, PastEvent[]> = new Map();
  const groupOrder: string[] = [];

  for (const event of events) {
    const eventDate = new Date(event.date + 'T00:00:00');
    const label = eventDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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

function formatDateTime(event: { date: string; startTime: string; endTime: string | null }): string {
  const dateStr = formatEventDate(event.date);
  const timeStr = event.endTime
    ? (crossesMidnight(event.startTime, event.endTime)
      ? `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`
      : `${formatTimeNoSuffix(event.startTime)} - ${formatTime(event.endTime)}`)
    : formatTime(event.startTime);
  return `${dateStr} | ${timeStr}`;
}

export default function UpcomingScreen() {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [pastEvents, setPastEvents] = useState<PastEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showCampusOnly, setShowCampusOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [rsvpSheet, setRsvpSheet] = useState<{ visible: boolean; event: UpcomingEvent | null }>({
    visible: false,
    event: null,
  });
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isCampusVerified = user?.campusVerified === true;

  const fetchData = async () => {
    try {
      const data = await apiService.getMyUpcomingEvents() as UpcomingEvent[];
      setEvents(data);
    } catch (error) {
      console.error('[Upcoming] Failed to fetch events:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPastEvents = async () => {
    try {
      const data = await apiService.getPastAttendedEvents() as PastEvent[];
      setPastEvents(data);
    } catch (error) {
      console.error('[Upcoming] Failed to fetch past events:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
      fetchPastEvents();
      apiService.getUnreadNotificationCount().then(r => setUnreadNotifCount(r.count)).catch(() => {});
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
    fetchPastEvents();
  };

  const handleEventPress = (event: UpcomingEvent | PastEvent) => {
    (navigation as any).navigate('EventDetails', { eventId: event.id, event, source: 'upcoming' });
  };

  const handleRsvpPress = (event: UpcomingEvent) => {
    setRsvpSheet({ visible: true, event });
  };

  const handleRsvpSelect = async (option: string) => {
    const event = rsvpSheet.event;
    if (!event) return;
    setRsvpSheet({ visible: false, event: null });

    const currentStatus = event.rsvpStatus;

    try {
      if (option === 'not_going') {
        // Cancel RSVP if user was previously going
        if (currentStatus === 'going') {
          await apiService.cancelRsvp(event.id);
        }
        setEvents(prev => prev.map(e =>
          e.id === event.id ? { ...e, rsvpStatus: 'not_going' } : e
        ));
      } else if (option === 'going' || option === 'this' || option === 'following') {
        // Only create RSVP if not already going
        if (currentStatus !== 'going') {
          await apiService.rsvpEvent(event.id, 'going');
        }
        setEvents(prev => prev.map(e =>
          e.id === event.id ? { ...e, rsvpStatus: 'going' } : e
        ));
      }
    } catch (error) {
      console.error('[RSVP] Failed to submit:', error);
    }
  };

  const displayEvents = showCampusOnly
    ? events.filter((e: any) => e.campusId)
    : events;
  const grouped = groupEventsByTimePeriod(displayEvents);
  const groupedPast = groupPastEventsByMonth(pastEvents);

  const renderHeader = () => (
    <View style={styles.header}>
      {isCampusVerified ? (
        <TouchableOpacity
          style={[styles.campusHatButton, showCampusOnly && styles.campusHatButtonActive]}
          onPress={() => setShowCampusOnly(!showCampusOnly)}
          testID="button-campus-toggle"
          accessibilityLabel="Toggle campus events"
        >
          <Ionicons name="school-outline" size={22} color={showCampusOnly ? Colors.brand.bubbleBlue : Colors.neutral.charcoal} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSpacer} />
      )}
      <Text style={styles.headerTitle}>My Events</Text>
      <TouchableOpacity
        style={styles.bellButton}
        onPress={() => (navigation as any).navigate('Notifications')}
        testID="button-notifications"
        accessibilityLabel="Notifications"
      >
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
  );

  const renderSubTabs = () => (
    <View style={styles.subTabRow}>
      <TouchableOpacity
        style={styles.subTab}
        onPress={() => setActiveTab('upcoming')}
        accessibilityLabel="Upcoming events"
      >
        <Text style={[styles.subTabText, activeTab === 'upcoming' && styles.subTabTextActive]}>
          Upcoming
        </Text>
        {activeTab === 'upcoming' && <View style={styles.subTabUnderline} />}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.subTab}
        onPress={() => setActiveTab('past')}
        accessibilityLabel="Past events"
      >
        <Text style={[styles.subTabText, activeTab === 'past' && styles.subTabTextActive]}>
          Past
        </Text>
        {activeTab === 'past' && <View style={styles.subTabUnderline} />}
      </TouchableOpacity>
    </View>
  );

  const renderRsvpButton = (event: UpcomingEvent) => {
    const status = event.rsvpStatus;
    return (
      <TouchableOpacity
        style={styles.rsvpButton}
        onPress={() => handleRsvpPress(event)}
        accessibilityLabel={status === 'going' ? 'Going' : status === 'not_going' ? 'Not Going' : 'RSVP'}
      >
        {!status && (
          <>
            <CalendarIcon size={16} color={Colors.brand.bubbleBlue} />
            <Text style={[styles.rsvpButtonText, { color: Colors.brand.bubbleBlue }]}>RSVP</Text>
          </>
        )}
        {status === 'going' && (
          <Text style={[styles.rsvpButtonText, { color: Colors.status.success }]}>Going</Text>
        )}
        {status === 'not_going' && (
          <Text style={[styles.rsvpButtonText, { color: Colors.status.error }]}>Not Going</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        {renderSubTabs()}
        <UpcomingScreenSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {renderSubTabs()}

      {activeTab === 'upcoming' && (
        displayEvents.length === 0 ? (
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
                    testID={`card-event-${event.id}`}
                    style={styles.eventCard}
                    scaleValue={0.97}
                    onPress={() => handleEventPress(event)}
                    accessibilityLabel={event.title}
                  >
                    {event.bubble && (
                      <Text style={styles.bubbleName}>{event.bubble.title}</Text>
                    )}
                    <View style={styles.eventCardInner}>
                      <Image
                        source={resolveMediaUrl(event.coverImage) ?? getFallbackImage(null)}
                        style={styles.eventImage}
                        contentFit="cover"
                        onError={() => console.warn('[Image] event load failed:', event.coverImage?.slice(0, 80))}
                      />
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventTitle} numberOfLines={1}>
                          {event.title.length > 15 ? event.title.substring(0, 15) + '...' : event.title}
                        </Text>
                        <Text style={styles.eventDateTime}>
                          {formatDateTime(event)}
                        </Text>
                        {event.locationName && (
                          <Text style={styles.eventLocation} numberOfLines={1}>
                            {event.locationName}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.neutral.coolMist} />
                    </View>
                    {renderRsvpButton(event)}
                  </AnimatedPressable>
                ))}
              </View>
            ))}
          </ScrollView>
        )
      )}

      {activeTab === 'past' && (
        pastEvents.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={64} color={Colors.neutral.coolMist} />
            <Text style={styles.emptyTitle}>No past events yet</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {groupedPast.map((group, groupIndex) => (
              <View key={group.label}>
                {groupIndex > 0 && (
                  <View style={styles.timelineSeparator}>
                    <View style={styles.timelineLine} />
                    <Text style={styles.timelineSeparatorText}>{group.label}</Text>
                    <View style={styles.timelineLine} />
                  </View>
                )}

                {group.events.map((event) => (
                  <AnimatedPressable
                    key={event.id}
                    testID={`card-past-event-${event.id}`}
                    style={styles.eventCardPast}
                    scaleValue={0.97}
                    onPress={() => handleEventPress(event)}
                    accessibilityLabel={event.title}
                  >
                    {event.bubble && (
                      <Text style={styles.bubbleName}>{event.bubble.title}</Text>
                    )}
                    <View style={styles.eventCardInner}>
                      <Image
                        source={resolveMediaUrl(event.coverImage) ?? getFallbackImage(null)}
                        style={styles.eventImage}
                        contentFit="cover"
                        onError={() => console.warn('[Image] past event load failed:', event.coverImage?.slice(0, 80))}
                      />
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventTitle} numberOfLines={1}>
                          {event.title.length > 15 ? event.title.substring(0, 15) + '...' : event.title}
                        </Text>
                        <Text style={styles.eventDateTime}>
                          {formatDateTime(event)}
                        </Text>
                        {event.locationName && (
                          <Text style={styles.eventLocation} numberOfLines={1}>
                            {event.locationName}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.neutral.coolMist} />
                    </View>
                  </AnimatedPressable>
                ))}
              </View>
            ))}
          </ScrollView>
        )
      )}

      <RsvpBottomSheet
        visible={rsvpSheet.visible}
        isRecurring={!!(rsvpSheet.event?.recurrenceType && rsvpSheet.event.recurrenceType !== 'never')}
        currentStatus={rsvpSheet.event?.rsvpStatus ?? null}
        onClose={() => setRsvpSheet({ visible: false, event: null })}
        onSelect={handleRsvpSelect}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
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
  subTabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lightSilver,
    backgroundColor: Colors.background.primary,
  },
  subTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    position: 'relative',
  },
  subTabText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.neutral.coolMist,
    paddingBottom: 6,
  },
  subTabTextActive: {
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
  },
  subTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: Colors.brand.primary,
    borderRadius: Radius.full,
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
    marginBottom: 12,
    padding: EventCardTokens.padding,
    ...CardShadow,
  },
  eventCardPast: {
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
    minHeight: EventCardTokens.height - EventCardTokens.padding * 2,
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
  rsvpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.neutral.lightSilver,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
  },
  rsvpButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
  },
});
