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
  TextInput,
  KeyboardAvoidingView,
  Pressable,
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
import { CreateBubbleEventIcon } from '../../components/icons';
import * as ImagePicker from 'expo-image-picker';
import { ChevronDownIcon, ChevronUpIcon, FlagIcon, CrownIcon, PeopleIcon } from '../../components/icons';
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
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null);
  const [myBubbleRole, setMyBubbleRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [bubbleDetails, setBubbleDetails] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalConfig, setSuccessModalConfig] = useState({ title: '', subtitle: '' });
  const [activeTab, setActiveTab] = useState<'Details' | 'Events'>('Details');
  const [showKebabMenu, setShowKebabMenu] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
  const [memberCount, setMemberCount] = useState<number>(bubble.members || 0);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportFreeText, setReportFreeText] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [bubbleReportModalVisible, setBubbleReportModalVisible] = useState(false);
  const [bubbleReportReason, setBubbleReportReason] = useState<string | null>(null);
  const [bubbleReportFreeText, setBubbleReportFreeText] = useState('');
  const [bubbleReportSubmitting, setBubbleReportSubmitting] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    checkMembership();
    fetchBubbleDetails();
    fetchMemberCount();
  }, [bubble.id]);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
      fetchMemberCount();
      fetchAnnouncements();
    }, [bubble.id])
  );

  const fetchAnnouncements = async () => {
    try {
      const postTypes = await apiService.getBulletinPostTypes();
      const announcementType = postTypes.find((pt: any) => pt.name === 'announcements');
      if (announcementType) {
        const posts = await apiService.getBulletinPosts(bubble.id, announcementType.id);
        setAnnouncements(posts.slice(0, 3));
      }
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    }
  };

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
      setMembershipStatus(result.membershipStatus || null);
      setMyBubbleRole(result.role || null);
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
        setMembershipStatus(null);
        setMemberCount(prev => Math.max(0, prev - 1));
        setSuccessModalConfig({ title: 'Left Bubble', subtitle: `You left ${bubble.title}` });
        setShowSuccessModal(true);
      } else if (membershipStatus === 'pending') {
        await apiService.leaveBubble(bubble.id);
        setMembershipStatus(null);
        setSuccessModalConfig({ title: 'Request Withdrawn', subtitle: `Your request to join ${bubble.title} has been withdrawn` });
        setShowSuccessModal(true);
      } else {
        const result = await apiService.joinBubble(bubble.id);
        const privacy = bubbleDetails?.privacy || bubble.privacy;
        if (result.status === 'pending' || privacy === 'Request to Join' || privacy === 'Private') {
          setMembershipStatus('pending');
          setSuccessModalConfig({ title: 'Request Sent!', subtitle: `Your request to join ${bubble.title} has been sent to the admins` });
          setShowSuccessModal(true);
        } else {
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
          setMembershipStatus('approved');
          setMemberCount(prev => prev + 1);
          setSuccessModalConfig({ title: 'Joined!', subtitle: `Welcome to ${bubble.title}` });
          setShowSuccessModal(true);
        }
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
  const isBubbleAdmin = myBubbleRole === 'admin';
  const canManage = bubbleDetails && (isCreator || isSuperAdmin || isBubbleAdmin);
  const privacy = bubbleDetails?.privacy || bubble.privacy;
  const canCreateEvent = (() => {
    if (!user || !isMember) return false;
    if (isSuperAdmin) return true;
    if (privacy === 'Public') {
      return myBubbleRole === 'admin';
    }
    return true;
  })();

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
      const bubbleName = encodeURIComponent(bubble.title || 'bubble');
      const deepLink = `https://community-bubbles.replit.app/${bubbleName}/${bubble.id}`;
      await Share.share({
        message: `Check out "${bubble.title}" on Bubble!\n${deepLink}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleBubbleChat = async () => {
    setShowKebabMenu(false);
    const groupId = String(bubble.id);
    const groupName = bubble.title || 'Bubble Chat';

    try {
      await cometChatService.createGroup(groupId, groupName, 'public');
    } catch (e: any) {
      console.log('Group create (may exist):', e?.code);
    }

    try {
      await cometChatService.joinGroup(groupId, 'public');
    } catch (e: any) {
      console.log('Group join (may be member):', e?.code);
    }

    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Messages' as any, {
        screen: 'Chat',
        params: { groupId, groupName },
      });
    } else {
      (navigation as any).navigate('Messages', {
        screen: 'Chat',
        params: { groupId, groupName },
      });
    }
  };

  const REPORT_REASONS = [
    'Harassment or inappropriate behavior',
    'Made me feel unsafe or uncomfortable',
    'Fake profile or suspected scammer',
    'No-show pattern',
    'Other',
  ];

  const BUBBLE_REPORT_REASONS = [
    'Safety issue (harassment, threats, unsafe environment)',
    'Misleading group description',
    'Inactive or abandoned group',
    'Organizer misconduct',
    'Exclusionary behavior (discrimination, cliques)',
    'Spam or promotional content',
    'Other',
  ];

  const BUBBLE_REPORT_ROUTING: Record<string, string> = {
    'Safety issue (harassment, threats, unsafe environment)': 'Sent to Superadmins',
    'Misleading group description': 'Sent to Superadmins & Bubble admins',
    'Inactive or abandoned group': 'Sent to Bubble admins',
    'Organizer misconduct': 'Sent to Superadmins',
    'Exclusionary behavior (discrimination, cliques)': 'Sent to Superadmins & Bubble admins',
    'Spam or promotional content': 'Sent to Superadmins & Bubble admins',
    'Other': 'Sent to Superadmins',
  };

  const handleReportConcern = () => {
    setShowKebabMenu(false);
    setReportReason(null);
    setReportFreeText('');
    setReportModalVisible(true);
  };

  const handleReportBubble = () => {
    setShowKebabMenu(false);
    setBubbleReportReason(null);
    setBubbleReportFreeText('');
    setBubbleReportModalVisible(true);
  };

  const submitReport = async () => {
    if (!reportReason) return;
    setReportSubmitting(true);
    try {
      await apiService.submitReport({
        reportType: 'admin',
        reason: reportReason,
        freeText: reportFreeText.trim() || undefined,
        bubbleId: bubble.id,
      });
      setReportModalVisible(false);
      Alert.alert('Report Submitted', 'Your concern has been sent to the Bubble team for review.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
    }
  };

  const submitBubbleReport = async () => {
    if (!bubbleReportReason) return;
    setBubbleReportSubmitting(true);
    try {
      await apiService.submitReport({
        reportType: 'bubble',
        reason: bubbleReportReason,
        freeText: bubbleReportFreeText.trim() || undefined,
        bubbleId: bubble.id,
      });
      setBubbleReportModalVisible(false);
      const routing = BUBBLE_REPORT_ROUTING[bubbleReportReason] || 'Sent to Superadmins';
      Alert.alert('Report Submitted', `Your concern about this bubble has been received. ${routing}.`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setBubbleReportSubmitting(false);
    }
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
          <TouchableOpacity style={styles.kebabItem} onPress={handleBubbleChat}>
            <Ionicons name="chatbubble-outline" size={20} color={Colors.text.primary} />
            <Text style={styles.kebabItemText}>Bubble Chat</Text>
          </TouchableOpacity>
          {canManage && (
            <>
              <View style={styles.kebabSeparatorLight} />
              <TouchableOpacity style={styles.kebabItem} onPress={() => { setShowKebabMenu(false); showAdminOptions(); }}>
                <CrownIcon size={20} color={Colors.brand.primary} />
                <Text style={[styles.kebabItemText, { color: Colors.brand.primary }]}>Manage Bubble</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={styles.kebabSeparatorMedium} />
          <TouchableOpacity style={styles.kebabItem} onPress={handleReportConcern}>
            <FlagIcon size={20} color={Colors.status.error} />
            <Text style={styles.kebabItemText}>Report a Concern</Text>
          </TouchableOpacity>
          <View style={styles.kebabSeparatorLight} />
          <TouchableOpacity style={styles.kebabItem} onPress={handleReportBubble}>
            <FlagIcon size={20} color={Colors.status.error} />
            <Text style={[styles.kebabItemText, { color: Colors.status.error }]}>Report this Bubble</Text>
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
        <TouchableOpacity onPress={() => navigation.navigate('BulletinBoard' as any, { bubbleId: bubble.id, bubbleTitle: bubble.title })}>
          <Text style={styles.linkText}>view all {'>'}</Text>
        </TouchableOpacity>
      </View>
      {announcements.length > 0 ? (
        announcements.map((post: any) => (
          <TouchableOpacity
            key={post.id}
            style={[styles.bulletinCard, { marginBottom: Spacing.sm, borderLeftWidth: 3, borderLeftColor: '#FF9800' }]}
            onPress={() => navigation.navigate('PostDetail' as any, { postId: post.id, bubbleId: bubble.id })}
            activeOpacity={0.7}
          >
            {post.isPinned && <Text style={styles.pinIcon}>📌</Text>}
            <Text style={styles.bulletinTitle}>{post.title}</Text>
            <Text style={styles.bulletinBody} numberOfLines={2}>{post.body}</Text>
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.bulletinCard}>
          <Text style={styles.bulletinBody}>No announcements yet.</Text>
        </View>
      )}
    </View>
  );

  const renderAboutSection = () => (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setAboutExpanded(!aboutExpanded)}>
        <Text style={styles.sectionHeading}>About</Text>
        {aboutExpanded ? <ChevronUpIcon size={22} color={Colors.text.primary} /> : <ChevronDownIcon size={22} color={Colors.text.primary} />}
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
        {attachmentsExpanded ? <ChevronUpIcon size={22} color={Colors.text.primary} /> : <ChevronDownIcon size={22} color={Colors.text.primary} />}
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
          <PeopleIcon size={20} color={Colors.text.primary} />
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

    if (membershipStatus === 'pending') {
      return (
        <TouchableOpacity
          style={styles.pendingButton}
          onPress={handleJoinLeave}
          disabled={isJoining}
        >
          {isJoining ? (
            <ActivityIndicator color={Colors.neutral.coolMist} size="small" />
          ) : (
            <Text style={styles.pendingButtonText}>Request Pending</Text>
          )}
        </TouchableOpacity>
      );
    }

    const privacy = bubbleDetails?.privacy || bubble.privacy;
    const buttonLabel = (privacy === 'Request to Join' || privacy === 'Private') ? 'Request to Join' : 'Join Bubble';

    return (
      <TouchableOpacity
        style={styles.joinButton}
        onPress={handleJoinLeave}
        disabled={isJoining}
      >
        <LinearGradient
          colors={[...Gradients.button.colors] as [string, string]}
          start={Gradients.button.start}
          end={Gradients.button.end}
          style={StyleSheet.absoluteFillObject}
        />
        {isJoining ? (
          <ActivityIndicator color={'#FFFFFF'} size="small" />
        ) : (
          <Text style={styles.joinButtonText}>{buttonLabel}</Text>
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
      {canCreateEvent && (
        <TouchableOpacity
          style={styles.createFab}
          onPress={() => navigation.navigate('CreateEvent', { bubbleId: bubble.id, bubbleTitle: bubble.title })}
          activeOpacity={0.8}
        >
          <CreateBubbleEventIcon size={56} />
        </TouchableOpacity>
      )}
      {renderKebabMenu()}
      <SuccessModal
        visible={showSuccessModal}
        title={successModalConfig.title}
        subtitle={successModalConfig.subtitle}
        onClose={handleSuccessModalClose}
      />
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.reportOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.reportDialog}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Report a Concern</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.reportSubtitle}>
              About this bubble's admins — sent to the Bubble team
            </Text>
            <ScrollView style={styles.reportReasonsList} nestedScrollEnabled>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reportReasonItem,
                    reportReason === reason && styles.reportReasonSelected,
                  ]}
                  onPress={() => setReportReason(reason)}
                >
                  <Text style={[
                    styles.reportReasonText,
                    reportReason === reason && styles.reportReasonTextSelected,
                  ]}>{reason}</Text>
                  {reportReason === reason && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={styles.reportTextInput}
              placeholder="Additional details (optional)"
              placeholderTextColor={Colors.text.tertiary}
              value={reportFreeText}
              onChangeText={setReportFreeText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.reportSubmitButton, !reportReason && styles.reportSubmitDisabled]}
              onPress={submitReport}
              disabled={!reportReason || reportSubmitting}
            >
              {reportSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.reportSubmitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={bubbleReportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBubbleReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.reportOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.reportDialog}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Report this Bubble</Text>
              <TouchableOpacity onPress={() => setBubbleReportModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.reportSubtitle}>
              Report a concern about this bubble/group — private to admins
            </Text>
            <ScrollView style={styles.reportReasonsList} nestedScrollEnabled>
              {BUBBLE_REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.reportReasonItem,
                    bubbleReportReason === reason && styles.reportReasonSelected,
                  ]}
                  onPress={() => setBubbleReportReason(reason)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.reportReasonText,
                      bubbleReportReason === reason && styles.reportReasonTextSelected,
                    ]}>{reason}</Text>
                    <Text style={{ fontSize: 11, color: Colors.text.tertiary, marginTop: 2 }}>
                      {BUBBLE_REPORT_ROUTING[reason]}
                    </Text>
                  </View>
                  {bubbleReportReason === reason && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={styles.reportTextInput}
              placeholder="Additional details (optional)"
              placeholderTextColor={Colors.text.tertiary}
              value={bubbleReportFreeText}
              onChangeText={setBubbleReportFreeText}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.reportSubmitButton, !bubbleReportReason && styles.reportSubmitDisabled]}
              onPress={submitBubbleReport}
              disabled={!bubbleReportReason || bubbleReportSubmitting}
            >
              {bubbleReportSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.reportSubmitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  pendingButton: {
    borderWidth: 1.5,
    borderColor: Colors.neutral.coolMist,
    borderRadius: Radius.full,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    backgroundColor: Colors.neutral.cloudGrey,
  },
  pendingButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.neutral.coolMist,
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
    color: '#FFFFFF',
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
  kebabSeparatorLight: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E0E0E0',
    marginHorizontal: Spacing.lg,
  },
  kebabSeparatorMedium: {
    height: 1.5,
    backgroundColor: '#D0D0D0',
    marginHorizontal: Spacing.lg,
  },
  kebabSeparatorHeavy: {
    height: 2,
    backgroundColor: '#C0C0C0',
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
  createFab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  reportDialog: {
    backgroundColor: Colors.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reportTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text.primary,
  },
  reportSubtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.text.tertiary,
    marginBottom: Spacing.md,
  },
  reportReasonsList: {
    maxHeight: 240,
    marginBottom: Spacing.sm,
  },
  reportReasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.neutral.cloudGrey,
    marginBottom: Spacing.xs,
  },
  reportReasonSelected: {
    borderColor: Colors.brand.primary,
    backgroundColor: '#EBF5FF',
  },
  reportReasonText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.primary,
    flex: 1,
  },
  reportReasonTextSelected: {
    color: Colors.brand.primary,
    fontWeight: Typography.weights.semiBold,
  },
  reportTextInput: {
    borderWidth: 1,
    borderColor: Colors.neutral.cloudGrey,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    fontSize: Typography.sizes.sm,
    color: Colors.text.primary,
    minHeight: 80,
    marginBottom: Spacing.md,
  },
  reportSubmitButton: {
    backgroundColor: Colors.status.error,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  reportSubmitDisabled: {
    opacity: 0.5,
  },
  reportSubmitText: {
    color: '#fff',
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
  },
});
