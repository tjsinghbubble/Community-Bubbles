import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import apiService from '../../services/api.service';
import ImageCarousel from '../../components/ImageCarousel';
import BubbleButton from '../../components/BubbleButton';
import { Colors, Spacing, Typography } from '../../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EVENT_CARD_WIDTH = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.sm) / 2;

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'JoinBubble'>;
  route: RouteProp<ExploreStackParamList, 'JoinBubble'>;
};

type Event = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string | null;
  attendeeCount?: number;
};

export default function JoinBubbleScreen({ navigation, route }: Props) {
  const { bubble } = route.params;
  const [bubbleDetails, setBubbleDetails] = useState<any>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [memberCount, setMemberCount] = useState(bubble.members || 0);
  const [aboutExpanded, setAboutExpanded] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [bubble.id]);

  const fetchData = async () => {
    try {
      const [details, eventsData, members] = await Promise.all([
        apiService.getBubble(bubble.id),
        apiService.getBubbleEvents(bubble.id).catch(() => []),
        apiService.getBubbleMembers(bubble.id).catch(() => []),
      ]);
      setBubbleDetails(details);
      setEvents(eventsData as Event[]);
      setMemberCount((members as any[]).length);
    } catch (error) {
      console.error('Failed to fetch bubble data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const privacy = bubbleDetails?.privacy || bubble.privacy || 'Public';
  const isRequestBased = privacy === 'Request to Join' || privacy === 'Private';

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      const result = await apiService.joinBubble(bubble.id);
      if (result.status === 'pending') {
        Alert.alert(
          'Request Sent',
          'Your request to join this bubble has been sent to the admins.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        navigation.replace('BubbleDetails', { bubble });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join bubble');
    } finally {
      setIsJoining(false);
    }
  };

  const handleContact = () => {
    Alert.alert('Coming Soon', 'Contact functionality will be available soon.');
  };

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${monthNames[date.getMonth()]} ${date.getDate()}`;
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow, ${monthNames[date.getMonth()]} ${date.getDate()}`;
    }
    return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`;
  };

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = minutes === 0 ? '' : `:${minutes.toString().padStart(2, '0')}`;
    return `${h}${m} ${ampm}`;
  };

  const formatTimeRange = (start: string, end: string | null) => {
    const startFormatted = formatTime(start);
    if (!end) return startFormatted;
    return `${startFormatted} - ${formatTime(end)}`;
  };

  const images = bubbleDetails
    ? [
        ...(bubbleDetails.coverImage ? [bubbleDetails.coverImage] : []),
        ...(bubbleDetails.images || []),
      ]
    : bubble.image
    ? [bubble.image]
    : [];

  const tagline = bubbleDetails?.tagline || bubble.tagline || '';
  const description = bubbleDetails?.description || bubble.description || '';
  const memberLimit = bubbleDetails?.memberLimit || null;
  const spotsLeft = memberLimit ? Math.max(0, memberLimit - memberCount) : null;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            data-testid="button-back"
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1} data-testid="text-header-title">
            {bubble.title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.headerSeparator} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          data-testid="button-back"
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} data-testid="text-header-title">
          {bubble.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.headerSeparator} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.carouselWrapper}>
          <ImageCarousel
            images={images}
            height={220}
            width={SCREEN_WIDTH - Spacing.xl * 2}
            borderRadius={12}
          />
        </View>

        {tagline ? (
          <Text style={styles.tagline} data-testid="text-tagline">{tagline}</Text>
        ) : null}

        <View style={styles.memberInfoRow} data-testid="member-info">
          <View style={styles.memberDot} />
          <Text style={styles.memberText}>{memberCount} active members</Text>
          {spotsLeft !== null && (
            <>
              <Text style={styles.memberDivider}> | </Text>
              <Text style={styles.spotsText}>{spotsLeft} spots left</Text>
            </>
          )}
        </View>

        <View style={styles.insetSeparator} />

        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} data-testid="text-upcoming-events">Upcoming Events</Text>
            <FlatList
              data={events}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.eventsListContent}
              renderItem={({ item }) => (
                <View style={styles.eventCard} data-testid={`card-event-${item.id}`}>
                  <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.eventDate}>{formatEventDate(item.date)}</Text>
                  <Text style={styles.eventTime}>{formatTimeRange(item.startTime, item.endTime)}</Text>
                  {(item as any).attendeeCount != null && (
                    <Text style={styles.eventAttendees}>
                      {(item as any).attendeeCount} members showing up
                    </Text>
                  )}
                </View>
              )}
              ItemSeparatorComponent={() => <View style={{ width: Spacing.sm }} />}
            />
          </View>
        )}

        <View style={styles.insetSeparator} />

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.aboutHeader}
            onPress={() => setAboutExpanded(!aboutExpanded)}
            activeOpacity={0.7}
            data-testid="button-about-toggle"
          >
            <Text style={styles.sectionTitle}>About</Text>
            <Ionicons
              name={aboutExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.neutral.charcoal}
            />
          </TouchableOpacity>
          {aboutExpanded && description ? (
            <Text style={styles.aboutText} data-testid="text-about-description">{description}</Text>
          ) : null}
        </View>

        <View style={styles.insetSeparator} />

        <View style={styles.buttonSection}>
          <BubbleButton
            title={isRequestBased ? 'Request to Join' : 'Join'}
            variant="primary"
            onPress={handleJoin}
            loading={isJoining}
            disabled={isJoining}
            testID="button-join-bubble"
          />
          <View style={{ height: Spacing.sm }} />
          <BubbleButton
            title="Contact"
            variant="outline"
            onPress={handleContact}
            testID="button-contact"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: Colors.neutral.lightSilver,
    marginHorizontal: Spacing.xl,
  },
  insetSeparator: {
    height: 1,
    backgroundColor: Colors.neutral.lightSilver,
    marginHorizontal: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  carouselWrapper: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  tagline: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  memberInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  memberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.status.success,
    marginRight: Spacing.xs,
  },
  memberText: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
  },
  memberDivider: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
  },
  spotsText: {
    fontSize: Typography.sizes.base,
    color: Colors.status.error,
    fontWeight: Typography.weights.medium as any,
  },
  section: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold as any,
    color: Colors.neutral.charcoal,
    marginBottom: Spacing.md,
  },
  eventsListContent: {
    paddingBottom: Spacing.sm,
  },
  eventCard: {
    width: EVENT_CARD_WIDTH,
    borderWidth: 1,
    borderColor: Colors.neutral.lightSilver,
    borderRadius: 12,
    padding: Spacing.md,
  },
  eventTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  eventDate: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.charcoal,
    marginBottom: 2,
  },
  eventTime: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.coolMist,
    marginBottom: Spacing.xs,
  },
  eventAttendees: {
    fontSize: Typography.sizes.xs,
    color: Colors.neutral.coolMist,
    marginTop: Spacing.xs,
  },
  aboutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutText: {
    fontSize: Typography.sizes.base,
    color: Colors.neutral.charcoal,
    lineHeight: Typography.lineHeight.md,
  },
  buttonSection: {
    paddingHorizontal: Spacing.xxxl,
    paddingTop: Spacing.xl,
  },
});
