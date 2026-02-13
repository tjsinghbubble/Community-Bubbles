import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  StatusBar,
  Share,
  Dimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import cometChatService from '../../services/cometchat.service';
import SuccessModal from '../../components/SuccessModal';
import ImageCarousel from '../../components/ImageCarousel';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_IMAGE_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'BubbleDetails'>;
  route: RouteProp<ExploreStackParamList, 'BubbleDetails'>;
};

type Event = {
  id: string;
  title: string;
  coverImage: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  locationName: string | null;
  attendeeLimit: number | null;
  creatorId: string;
};

const MOCK_ATTACHMENTS = [
  'Google sheet for equipment',
  'Tournament schedule',
  'Score sheet',
];

export default function BubbleDetailsScreen({ navigation, route }: Props) {
  const { bubble } = route.params;
  const { user } = useAuth();
  const [isJoining, setIsJoining] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [bubbleDetails, setBubbleDetails] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalConfig, setSuccessModalConfig] = useState({ title: '', subtitle: '' });
  const [activeTab, setActiveTab] = useState<'Details' | 'Events'>('Details');
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(true);
  const [memberCount, setMemberCount] = useState<number>(bubble.members || 0);

  useEffect(() => {
    checkMembership();
    fetchBubbleDetails();
    fetchMemberCount();
  }, [bubble.id]);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
      fetchMemberCount();
    }, [bubble.id])
  );

  const fetchBubbleDetails = async () => {
    try {
      const details = await apiService.getBubble(bubble.id);
      setBubbleDetails(details);
      apiService.trackBubbleVisit(bubble.id).catch(() => {});
    } catch (error) {
      console.error('Failed to fetch bubble details:', error);
    }
  };

  const fetchMemberCount = async () => {
    try {
      const members = await apiService.getBubbleMembers(bubble.id) as any[];
      setMemberCount(members.length);
    } catch (error) {
      console.error('Failed to fetch member count:', error);
    }
  };

  const checkMembership = async () => {
    try {
      const result = await apiService.checkMembership(bubble.id);
      setIsMember(result.isMember);
    } catch (error) {
      console.error('Failed to check membership:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const data = await apiService.getBubbleEvents(bubble.id) as Event[];
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setEventsLoading(false);
    }
  };

  const handleJoinLeave = async () => {
    if (!user) return;
    setIsJoining(true);
    try {
      if (isMember) {
        await apiService.leaveBubble(bubble.id);
        try {
          await cometChatService.leaveGroup(bubble.id);
        } catch (e) {
          console.log('CometChat leave error (may not be in group):', e);
        }
        setIsMember(false);
        setMemberCount(prev => Math.max(0, prev - 1));
        setSuccessModalConfig({ title: 'Left Bubble', subtitle: `You left ${bubble.title}` });
        setShowSuccessModal(true);
      } else {
        await apiService.joinBubble(bubble.id);
        try {
          await cometChatService.createGroup(bubble.id, bubble.title);
        } catch (e) {
          console.log('Group may already exist:', e);
        }
        try {
          await cometChatService.joinGroup(bubble.id);
        } catch (e) {
          console.log('CometChat join error (may already be member):', e);
        }
        setIsMember(true);
        setMemberCount(prev => prev + 1);
        setSuccessModalConfig({ title: 'Joined!', subtitle: `Welcome to ${bubble.title}` });
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleEventPress = (event: Event) => {
    navigation.navigate('EventDetails' as any, { eventId: event.id, event, bubbleTitle: bubble.title });
  };

  const formatEventDate = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const isCreator = bubbleDetails?.creatorId === user?.id;
  const isSuperAdmin = user?.isSuperAdmin === true;
  const canManage = bubbleDetails && (isCreator || isSuperAdmin);
  const canCreateEvent = !!user;

  const handleViewMembers = () => {
    navigation.navigate('BubbleMembers' as any, {
      bubbleId: bubble.id,
      bubbleTitle: bubble.title,
    });
  };

  const handleEditBubble = () => {
    navigation.navigate('EditBubble' as any, { bubble: bubbleDetails || bubble });
  };

  const handleDeleteBubble = () => {
    Alert.alert(
      'Delete Bubble',
      'Are you sure you want to delete this bubble? This action cannot be undone and will also delete all events in this bubble.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteBubble(bubble.id);
              setSuccessModalConfig({
                title: 'Bubble Deleted',
                subtitle: 'The bubble has been successfully deleted',
              });
              setShowSuccessModal(true);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete bubble');
            }
          },
        },
      ]
    );
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    navigation.goBack();
  };

  const showAdminOptions = () => {
    Alert.alert(
      'Manage Bubble',
      undefined,
      [
        { text: 'Edit Bubble', onPress: handleEditBubble },
        { text: 'Delete Bubble', style: 'destructive', onPress: handleDeleteBubble },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleShareBubble = async () => {
    setShowKebabMenu(false);
    try {
      await Share.share({
        message: `Check out "${bubble.title}" on Bubble!`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDirectMessage = () => {
    setShowKebabMenu(false);
  };

  const handleReportConcern = () => {
    setShowKebabMenu(false);
    Alert.alert('Report', 'Thank you for your report. We will review this bubble.');
  };

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{bubble.title}</Text>
        <TouchableOpacity onPress={() => setShowKebabMenu(true)} style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.headerSeparator} />
    </View>
  );

  const renderKebabMenu = () => (
    <Modal
      visible={showKebabMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowKebabMenu(false)}
    >
      <TouchableOpacity
        style={styles.kebabOverlay}
        activeOpacity={1}
        onPress={() => setShowKebabMenu(false)}
      >
        <View style={styles.kebabDropdown}>
          <TouchableOpacity style={styles.kebabItem} onPress={handleShareBubble}>
            <Ionicons name="share-outline" size={20} color={Colors.text.primary} />
            <Text style={styles.kebabItemText}>Share Bubble</Text>
          </TouchableOpacity>
          <View style={styles.kebabSeparator} />
          <TouchableOpacity style={styles.kebabItem} onPress={handleDirectMessage}>
            <Ionicons name="chatbubble-outline" size={20} color={Colors.text.primary} />
            <Text style={styles.kebabItemText}>Direct Message</Text>
          </TouchableOpacity>
          <View style={styles.kebabSeparator} />
          <TouchableOpacity style={styles.kebabItem} onPress={handleReportConcern}>
            <Ionicons name="flag-outline" size={20} color={Colors.status.error} />
            <Text style={[styles.kebabItemText, { color: Colors.status.error }]}>Report a concern</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderTabs = () => (
    <View style={styles.tabBar}>
      <View style={styles.tabsInner}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'Details' && styles.tabActive]}
          onPress={() => setActiveTab('Details')}
        >
          <Text style={[styles.tabText, activeTab === 'Details' && styles.tabTextActive]}>Details</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'Events' && styles.tabActive]}
          onPress={() => setActiveTab('Events')}
        >
          <Text style={[styles.tabText, activeTab === 'Events' && styles.tabTextActive]}>Events</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleCameraPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library to add images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      Alert.alert('Photo Selected', 'Image upload will be available soon.');
    }
  };

  const renderCoverPhoto = () => (
    <View>
      <View style={styles.coverPhotoContainer}>
        <ImageCarousel
          images={bubbleDetails?.images || (bubble.image ? [bubble.image] : [])}
          height={220}
          width={COVER_IMAGE_WIDTH}
          fallbackImage="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800"
          borderRadius={Radius.md}
        />
        <TouchableOpacity style={styles.cameraButton} onPress={handleCameraPress}>
          <Ionicons name="camera" size={20} color={Colors.brand.primary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.tagline}>
        {bubble.tagline || bubble.category || 'Community Bubble'}
      </Text>
      {isMember && (
        <View style={styles.activeMemberRow}>
          <View style={styles.greenDot} />
          <Text style={styles.activeMemberText}>Active Member</Text>
        </View>
      )}
    </View>
  );

  const renderSeparator = () => (
    <View style={styles.separator} />
  );

  const renderBulletinBoard = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>Bulletin Board</Text>
        <TouchableOpacity>
          <Text style={styles.linkText}>view all {'>'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.bulletinCard}>
        <Text style={styles.pinIcon}>📌</Text>
        <Text style={styles.bulletinTitle}>Welcome to {bubble.title}!</Text>
        <Text style={styles.bulletinBody}>
          Thanks for joining our community. Please read the guidelines and introduce yourself. We're excited to have you here!
        </Text>
      </View>
    </View>
  );

  const renderAboutSection = () => (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setAboutExpanded(!aboutExpanded)}>
        <Text style={styles.sectionHeading}>About</Text>
        <Ionicons
          name={aboutExpanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={Colors.text.primary}
        />
      </TouchableOpacity>
      {aboutExpanded && (
        <Text style={styles.bodyText}>
          {bubble.description || bubbleDetails?.description || 'Join us to connect with amazing people in your area who share your interests!'}
        </Text>
      )}
    </View>
  );

  const renderAttachmentsSection = () => (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setAttachmentsExpanded(!attachmentsExpanded)}>
        <Text style={styles.sectionHeading}>Attachments</Text>
        <Ionicons
          name={attachmentsExpanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={Colors.text.primary}
        />
      </TouchableOpacity>
      {attachmentsExpanded && (
        <View>
          {MOCK_ATTACHMENTS.map((item, index) => (
            <View key={index} style={styles.attachmentItem}>
              <Ionicons name="attach" size={18} color={Colors.text.tertiary} />
              <Text style={styles.attachmentText}>{item}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderMembersRow = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.membersLeft}>
          <Ionicons name="people-outline" size={20} color={Colors.text.primary} />
          <Text style={styles.membersCount}>{memberCount}</Text>
          <Text style={styles.membersLabel}>Members</Text>
        </View>
        <TouchableOpacity onPress={handleViewMembers}>
          <Text style={styles.linkText}>view {'>'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderJoinLeaveButton = () => {
    if (isLoading) return null;

    if (isMember) {
      return (
        <TouchableOpacity
          style={styles.leaveButton}
          onPress={handleJoinLeave}
          disabled={isJoining}
        >
          {isJoining ? (
            <ActivityIndicator color={Colors.status.error} size="small" />
          ) : (
            <Text style={styles.leaveButtonText}>Leave Bubble</Text>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.joinButton}
        onPress={handleJoinLeave}
        disabled={isJoining}
      >
        <LinearGradient
          colors={Gradients.button.colors as unknown as string[]}
          start={Gradients.button.start}
          end={Gradients.button.end}
          style={StyleSheet.absoluteFillObject}
        />
        {isJoining ? (
          <ActivityIndicator color={Colors.text.primary} size="small" />
        ) : (
          <Text style={styles.joinButtonText}>Join Bubble</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderDetailsTab = () => (
    <View>
      {renderCoverPhoto()}
      {renderSeparator()}
      {renderBulletinBoard()}
      {renderSeparator()}
      {renderAboutSection()}
      {renderSeparator()}
      {renderAttachmentsSection()}
      {renderSeparator()}
      {renderMembersRow()}
      {renderSeparator()}
      <View style={styles.section}>
        {renderJoinLeaveButton()}
      </View>
    </View>
  );

  const getEventDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.getTime() === today.getTime()) return 'Today';
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getEventFullDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return `${getEventDayLabel(dateStr)}, ${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getDate()}`;
  };

  const getEventTimeRange = (start: string, end: string | null) => {
    const fmt = (t: string) => {
      const [h, m] = t.split(':');
      const hr = parseInt(h);
      const ap = hr >= 12 ? 'PM' : 'AM';
      return `${hr % 12 || 12}:${m} ${ap}`;
    };
    return end ? `${fmt(start)} - ${fmt(end)}` : fmt(start);
  };

  const getSpotsLabel = (event: Event) => {
    if (!event.attendeeLimit) return null;
    return `${event.attendeeLimit} spots`;
  };

  const groupEventsByMonth = (evts: Event[]) => {
    const groups: { [key: string]: Event[] } = {};
    evts.forEach((e) => {
      const d = new Date(e.date + 'T00:00:00');
      const key = d.toLocaleDateString('en-US', { month: 'long' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups);
  };

  const renderEventCard = (event: Event) => (
    <TouchableOpacity
      key={event.id}
      style={styles.eventCard}
      onPress={() => handleEventPress(event)}
    >
      <Image
        source={{
          uri: event.coverImage || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400',
        }}
        style={styles.eventImage}
      />
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
        <Text style={styles.eventDateText}>{getEventFullDate(event.date)}</Text>
        <Text style={styles.eventTimeText}>{getEventTimeRange(event.startTime, event.endTime)}</Text>
        {getSpotsLabel(event) !== null && (
          <Text style={styles.eventSpotsText}>{getSpotsLabel(event)}</Text>
        )}
      </View>
      <View style={styles.eventHeartContainer}>
        <Ionicons name="heart-outline" size={22} color={Colors.text.tertiary} />
      </View>
    </TouchableOpacity>
  );

  const renderEventsTab = () => {
    const grouped = groupEventsByMonth(events);

    return (
      <View style={styles.section}>
        {eventsLoading ? (
          <ActivityIndicator size="small" color={Colors.brand.primary} style={{ marginTop: Spacing.xl }} />
        ) : events.length === 0 ? (
          <View style={styles.noEvents}>
            <Ionicons name="calendar-outline" size={32} color={Colors.text.tertiary} />
            <Text style={styles.noEventsText}>No upcoming events</Text>
          </View>
        ) : (
          <View>
            {grouped.map(([month, monthEvents]) => (
              <View key={month}>
                <Text style={styles.monthHeader}>{month}</Text>
                <View style={styles.eventsList}>
                  {monthEvents.map(renderEventCard)}
                </View>
              </View>
            ))}
          </View>
        )}
        {canCreateEvent && (
          <TouchableOpacity
            style={styles.createEventButton}
            onPress={() => navigation.navigate('CreateEvent', { bubbleId: bubble.id, bubbleTitle: bubble.title })}
          >
            <Text style={styles.createEventButtonText}>+ Create Event</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {renderHeader()}
      {renderTabs()}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'Details' ? renderDetailsTab() : renderEventsTab()}
      </ScrollView>
      {renderKebabMenu()}
      <SuccessModal
        visible={showSuccessModal}
        title={successModalConfig.title}
        subtitle={successModalConfig.subtitle}
        onClose={handleSuccessModalClose}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: '#D9D9D9',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
  },
  tabBar: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  tabsInner: {
    flexDirection: 'row',
    gap: Spacing.xxxl,
  },
  tab: {
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.brand.primary,
  },
  tabText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.tertiary,
  },
  tabTextActive: {
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxxl,
  },
  coverPhotoContainer: {
    position: 'relative',
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  cameraButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  tagline: {
    textAlign: 'center',
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.text.primary,
    marginTop: Spacing.md,
    marginHorizontal: Spacing.xl,
  },
  activeMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.status.success,
    marginRight: Spacing.xs,
  },
  activeMemberText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
  },
  separator: {
    height: 1,
    backgroundColor: '#D9D9D9',
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.lg,
  },
  section: {
    paddingHorizontal: Spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionHeading: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },
  linkText: {
    fontSize: Typography.sizes.sm,
    color: Colors.brand.primary,
  },
  bulletinCard: {
    backgroundColor: Colors.background.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    position: 'relative',
  },
  pinIcon: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    fontSize: 16,
  },
  bulletinTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  bulletinBody: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    lineHeight: 18,
  },
  bodyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  attachmentText: {
    fontSize: Typography.sizes.sm,
    color: Colors.brand.primary,
    textDecorationLine: 'underline',
  },
  addButton: {
    marginTop: Spacing.xs,
  },
  addButtonText: {
    fontSize: Typography.sizes.sm,
    color: Colors.brand.primary,
    fontWeight: Typography.weights.medium,
  },
  membersLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  membersCount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
  },
  membersLabel: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
  },
  leaveButton: {
    borderWidth: 1.5,
    borderColor: Colors.status.error,
    borderRadius: Radius.full,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  leaveButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.status.error,
  },
  joinButton: {
    borderRadius: Radius.full,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  joinButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },
  kebabOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  kebabDropdown: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 90 : 50,
    right: Spacing.lg,
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  kebabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  kebabItemText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
  },
  kebabSeparator: {
    height: 1,
    backgroundColor: '#D9D9D9',
    marginHorizontal: Spacing.lg,
  },
  monthHeader: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  noEvents: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  noEventsText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginTop: Spacing.sm,
  },
  eventsList: {
    gap: Spacing.md,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: Spacing.md,
  },
  eventImage: {
    width: 70,
    height: 70,
    borderRadius: Radius.sm,
  },
  eventInfo: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  eventTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  eventDateText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginBottom: 1,
  },
  eventTimeText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginBottom: 2,
  },
  eventSpotsText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.status.error,
  },
  eventHeartContainer: {
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createEventButton: {
    borderWidth: 1,
    borderColor: Colors.brand.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  createEventButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.brand.primary,
  },
});
