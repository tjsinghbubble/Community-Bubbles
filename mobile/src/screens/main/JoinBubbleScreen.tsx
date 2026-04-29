import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import apiService from '../../services/api.service';
import cometChatService from '../../services/cometchat.service';
import { useAuth } from '../../context/AuthContext';
import ImageCarousel from '../../components/ImageCarousel';
import BubbleButton from '../../components/BubbleButton';
import WelcomeBubbleModal from '../../components/WelcomeBubbleModal';
import { Colors, Spacing, Typography } from '../../styles/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CAROUSEL_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;
const CAROUSEL_HEIGHT = SCREEN_HEIGHT * 0.25;
const EVENT_CARD_WIDTH = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.sm) / 2;
const EVENT_CARD_HEIGHT = 100;

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

type SignupTaskCounts = Record<string, number>;

export default function JoinBubbleScreen({ navigation, route }: Props) {
  const { bubble } = route.params;
  const { user } = useAuth();
  const [bubbleDetails, setBubbleDetails] = useState<any>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [memberCount, setMemberCount] = useState(bubble.members || 0);
  const [aboutExpanded, setAboutExpanded] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isContacting, setIsContacting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showWaitlistConfirm, setShowWaitlistConfirm] = useState(false);
  const [myMembershipStatus, setMyMembershipStatus] = useState<string | null>(null);
  const [effectiveRules, setEffectiveRules] = useState<{ name: string; description: string }[]>([]);
  const [signupTaskCounts, setSignupTaskCounts] = useState<SignupTaskCounts>({});

  useEffect(() => {
    fetchData();
  }, [bubble.id]);

  const fetchData = async () => {
    setSignupTaskCounts({});
    try {
      const [details, eventsData, members, rulesData, membershipData] = await Promise.all([
        apiService.getBubble(bubble.id),
        apiService.getBubbleEvents(bubble.id).catch(() => []),
        apiService.getBubbleMembers(bubble.id).catch(() => []),
        apiService.getEffectiveRules(bubble.id).catch(() => []),
        apiService.checkMembership(bubble.id).catch(() => ({ isMember: false, role: null, membershipStatus: null })),
      ]);
      setBubbleDetails(details);
      const fetchedEvents = eventsData as Event[];
      setEvents(fetchedEvents);
      setMemberCount((members as any[]).length);
      setMyMembershipStatus((membershipData as any).membershipStatus || null);
      const visibleRules = (rulesData as any[]).filter((r: any) => !r.hidden).map((r: any) => {
        if (r.name) return { name: r.name, description: r.description || '' };
        const dotIdx = (r.text || '').indexOf('. ');
        if (dotIdx > 0) return { name: r.text.substring(0, dotIdx), description: r.text.substring(dotIdx + 2) };
        return { name: r.text || '', description: '' };
      });
      setEffectiveRules(visibleRules);

      if (fetchedEvents.length > 0) {
        const taskResults = await Promise.all(
          fetchedEvents.map((ev) =>
            apiService.getEventSignupTasks(ev.id).catch(() => [])
          )
        );
        const counts: SignupTaskCounts = {};
        fetchedEvents.forEach((ev, idx) => {
          const tasks: any[] = taskResults[idx] || [];
          const openCount = tasks.filter(
            (t) => t.spotsNeeded == null || t.signupCount < t.spotsNeeded
          ).length;
          if (openCount > 0) counts[ev.id] = openCount;
        });
        setSignupTaskCounts(counts);
      }
    } catch (error) {
      console.error('Failed to fetch bubble data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const privacy = bubbleDetails?.privacy || bubble.privacy || 'Public';
  const isRequestBased = privacy === 'Request to Join' || privacy === 'Request' || privacy === 'Private';
  const memberLimit = bubbleDetails?.memberLimit || null;
  const spotsLeftCount = memberLimit ? Math.max(0, memberLimit - memberCount) : null;
  const isFull = memberLimit != null && memberCount >= memberLimit;

  const handleJoin = async () => {
    if (isFull) {
      setIsJoining(true);
      try {
        const result = await apiService.joinBubble(bubble.id);
        if (result.status === 'waitlisted') {
          setShowWaitlistConfirm(true);
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to join waitlist');
      } finally {
        setIsJoining(false);
      }
      return;
    }
    if (isRequestBased) {
      setIsJoining(true);
      try {
        const result = await apiService.joinBubble(bubble.id);
        if (result.status === 'pending') {
          Alert.alert(
            'Request Sent',
            'Your request to join this bubble has been sent to the admins.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to join bubble');
      } finally {
        setIsJoining(false);
      }
    } else {
      setShowWelcomeModal(true);
    }
  };

  const handleLetsGo = async () => {
    setIsJoining(true);
    try {
      await apiService.joinBubble(bubble.id);
      setShowWelcomeModal(false);
      navigation.replace('BubbleDetails', { bubble });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join bubble');
    } finally {
      setIsJoining(false);
    }
  };

  const handleContact = async () => {
    if (!user) return;
    setIsContacting(true);
    try {
      const members = await apiService.getBubbleMembers(bubble.id) as any[];
      const admins = members.filter((m: any) => m.role === 'admin');
      const adminUids = admins.map((a: any) => String(a.userId));

      const isMember = myMembershipStatus === 'approved';
      const memberLabel = isMember ? 'member' : 'non-member';
      const userName = user.name || user.email || 'User';
      const bubbleTitle = bubbleDetails?.title || bubble.title || 'Bubble';

      const guid = `contact_${bubble.id}_${user.id}`;
      const groupName = `${bubbleTitle}: ${userName} (${memberLabel})`;

      const otherUids = adminUids.filter(uid => uid !== String(user.id));
      await cometChatService.ensureLoggedIn(user.id, user.name);
      await cometChatService.createContactGroup(guid, groupName, otherUids);

      const parent = navigation.getParent();
      if (parent) {
        parent.navigate('Messages' as any, {
          screen: 'Chat',
          params: { groupId: guid, groupName },
        });
      } else {
        (navigation as any).navigate('Messages', {
          screen: 'Chat',
          params: { groupId: guid, groupName },
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not open contact chat. Please try again.');
    } finally {
      setIsContacting(false);
    }
  };

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
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
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            data-testid="button-back"
          >
            <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={24} color={Colors.text.primary} />
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
          <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} data-testid="text-header-title">
          {bubble.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.headerSeparator} />

      <View style={styles.content}>
        <View style={styles.carouselWrapper}>
          <ImageCarousel
            images={images}
            height={CAROUSEL_HEIGHT}
            width={CAROUSEL_WIDTH}
            borderRadius={12}
          />
        </View>

        {tagline ? (
          <Text style={styles.tagline} data-testid="text-tagline">{tagline}</Text>
        ) : null}

        <View style={styles.memberInfoRow} data-testid="member-info">
          <View style={styles.memberDot} />
          <Text style={styles.memberText}>{memberCount} active members</Text>
          {spotsLeftCount !== null && (
            <>
              <Text style={styles.memberDivider}> | </Text>
              <Text style={[styles.spotsText, isFull && { color: Colors.status.error }]}>
                {isFull ? 'Full' : `${spotsLeftCount} spots left`}
              </Text>
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
              renderItem={({ item }) => {
                const openTasks = signupTaskCounts[item.id] || 0;
                return (
                  <View style={styles.eventCard} data-testid={`card-event-${item.id}`}>
                    <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.eventDate}>{formatEventDate(item.date)}</Text>
                    <Text style={styles.eventTime}>{formatTimeRange(item.startTime, item.endTime)}</Text>
                    <Text style={styles.eventAttendees}>
                      {(item as any).attendeeCount || 0} members showing up
                    </Text>
                    {openTasks > 0 && (
                      <View style={styles.tasksBadge} data-testid={`badge-tasks-${item.id}`}>
                        <Text style={styles.tasksBadgeText}>
                          {openTasks === 1 ? '1 task open' : `${openTasks} tasks open`}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ width: Spacing.sm }} />}
            />
          </View>
        )}

        <View style={styles.insetSeparator} />

        <View style={styles.aboutSection}>
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
          {description ? (
            <Text
              style={styles.aboutText}
              numberOfLines={aboutExpanded ? 4 : 2}
              data-testid="text-about-description"
            >
              {description}
            </Text>
          ) : null}
        </View>

        <View style={styles.insetSeparator} />
      </View>

      <View style={styles.buttonSection}>
        <BubbleButton
          title={
            myMembershipStatus === 'waitlisted'
              ? 'On Waitlist'
              : myMembershipStatus === 'on_hold'
              ? 'Waitlist On Hold'
              : isFull
              ? 'Join Waitlist'
              : isRequestBased
              ? 'Request to Join'
              : 'Join'
          }
          variant={
            myMembershipStatus === 'waitlisted' || myMembershipStatus === 'on_hold'
              ? 'outline'
              : 'primary'
          }
          onPress={handleJoin}
          loading={isJoining}
          disabled={
            isJoining ||
            myMembershipStatus === 'waitlisted' ||
            myMembershipStatus === 'on_hold'
          }
          testID="button-join-bubble"
        />
        <View style={{ height: Spacing.sm }} />
        <BubbleButton
          title="Contact"
          variant="outline"
          onPress={handleContact}
          loading={isContacting}
          disabled={isContacting}
          testID="button-contact"
        />
      </View>

      <WelcomeBubbleModal
        visible={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        onLetsGo={handleLetsGo}
        bubbleName={bubble.title}
        category={bubble.category}
        rules={effectiveRules}
        nextEvent={
          events.length > 0
            ? { title: events[0].title, date: events[0].date, startTime: events[0].startTime }
            : null
        }
      />

      <Modal
        visible={showWaitlistConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWaitlistConfirm(false)}
      >
        <View style={styles.waitlistOverlay}>
          <View style={styles.waitlistCard}>
            <View style={styles.waitlistIconCircle}>
              <Ionicons name="checkmark" size={36} color={Colors.brand.skyWhite} />
            </View>
            <Text style={styles.waitlistTitle}>Joined Waitlist!</Text>
            <Text style={styles.waitlistSubtitle}>
              You'll be notified once accepted into {bubble.title}.
            </Text>
            <TouchableOpacity
              style={styles.waitlistDoneBtn}
              onPress={() => {
                setShowWaitlistConfirm(false);
                navigation.goBack();
              }}
              testID="button-waitlist-close"
              activeOpacity={0.8}
            >
              <Text style={styles.waitlistDoneBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  content: {
    flex: 1,
  },
  carouselWrapper: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  tagline: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxs,
  },
  memberInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
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
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.charcoal,
  },
  memberDivider: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.charcoal,
  },
  spotsText: {
    fontSize: Typography.sizes.sm,
    color: Colors.status.error,
    fontWeight: Typography.weights.medium as any,
  },
  section: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold as any,
    color: Colors.neutral.charcoal,
    marginBottom: Spacing.xs,
  },
  eventsListContent: {
    paddingBottom: Spacing.xs,
  },
  eventCard: {
    width: EVENT_CARD_WIDTH,
    minHeight: EVENT_CARD_HEIGHT,
    borderWidth: 1,
    borderColor: Colors.neutral.lightSilver,
    borderRadius: 12,
    padding: Spacing.md,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    marginBottom: Spacing.xxs,
  },
  eventDate: {
    fontSize: Typography.sizes.xs,
    color: Colors.neutral.charcoal,
    marginBottom: 2,
  },
  eventTime: {
    fontSize: Typography.sizes.xs,
    color: Colors.neutral.coolMist,
    marginBottom: Spacing.xxs,
  },
  eventAttendees: {
    fontSize: Typography.sizes.xxs,
    color: Colors.neutral.coolMist,
    marginTop: Spacing.xxs,
  },
  tasksBadge: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: Colors.background.brandTint,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tasksBadgeText: {
    fontSize: Typography.sizes.xxs,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.primary,
  },
  aboutSection: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  aboutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutText: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.charcoal,
    lineHeight: Typography.lineHeight.md,
  },
  buttonSection: {
    paddingHorizontal: Spacing.xxxxl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  waitlistOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  waitlistCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  waitlistIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.status.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  waitlistTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  waitlistSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.md,
    marginBottom: Spacing.lg,
  },
  waitlistDoneBtn: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 22,
    height: 44,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitlistDoneBtnText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.skyWhite,
  },
});
