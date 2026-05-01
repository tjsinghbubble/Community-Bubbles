import React, { useState, useEffect, useCallback } from 'react';
import { Image } from 'expo-image';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
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
import { API_URL } from '../../config/api';
import apiService from '../../services/api.service';
import cometChatService from '../../services/cometchat.service';
import SuccessModal from '../../components/SuccessModal';
import ImageCarousel from '../../components/ImageCarousel';
import MultiImagePicker from '../../components/MultiImagePicker';
import { BubbleDetailsSkeleton } from '../../components/SkeletonLoader';
import AnimatedPressable from '../../components/AnimatedPressable';
import { LinearGradient } from 'expo-linear-gradient';
import { CreateBubbleEventIcon } from '../../components/icons';
import * as ImagePicker from 'expo-image-picker';
import { ChevronDownIcon, ChevronUpIcon, FlagIcon, CrownIcon, PeopleIcon } from '../../components/icons';
import BubbleButton from '../../components/BubbleButton';
import ShareQRCodeModal from '../../components/ShareQRCodeModal';
import { requestPhotoLibraryAccess } from '../../utils/permissions';
import { showToast } from '../../components/Toast';
import { logAppEvent, logAppWarn } from '../../utils/crashReporter';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { getFallbackImage } from '../../utils/categoryImages';
import { Colors, Spacing, Radius, Typography, CardShadow } from '../../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_IMAGE_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;
const COVER_IMAGE_HEIGHT = Math.round(COVER_IMAGE_WIDTH * 3 / 4);

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

export default function BubbleDetailsScreen({ navigation, route }: Props) {
  const { bubble } = route.params;
  const { user, token } = useAuth();
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
  const [showQRModal, setShowQRModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
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
  const [imageUploading, setImageUploading] = useState(false);
  const [maxBubblePhotos, setMaxBubblePhotos] = useState(20);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [signupTaskCounts, setSignupTaskCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    checkMembership();
    fetchBubbleDetails();
    fetchMemberCount();
    apiService.getAppConfig('max_bubble_photos')
      .then(({ value }) => setMaxBubblePhotos(parseInt(value, 10) || 20))
      .catch(() => {});
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
      logAppEvent('[Screen] BubbleDetailsScreen loaded', { bubbleId: bubble.id, bubbleTitle: bubble.title });
    } catch (error) {
      logAppWarn('[Screen] BubbleDetailsScreen fetch failed', { bubbleId: bubble.id, error: String(error) });
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
      if (
        !result.isMember &&
        result.membershipStatus !== 'pending' &&
        result.membershipStatus !== 'waitlisted' &&
        result.membershipStatus !== 'on_hold'
      ) {
        navigation.replace('JoinBubble', { bubble });
        return;
      }
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
      const counts: Record<string, number> = {};
      if (data.length > 0) {
        const taskResults = await Promise.all(
          data.map((ev) => apiService.getEventSignupTasks(ev.id).catch(() => []))
        );
        data.forEach((ev, idx) => {
          const tasks: any[] = taskResults[idx] || [];
          const openCount = tasks.filter(
            (t) => t.spotsNeeded == null || t.signupCount < t.spotsNeeded
          ).length;
          if (openCount > 0) counts[ev.id] = openCount;
        });
      }
      setSignupTaskCounts(counts);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setEventsLoading(false);
    }
  };

  const performLeaveBubble = async () => {
    setIsJoining(true);
    try {
      await apiService.leaveBubble(bubble.id);
      try {
        if (user) await cometChatService.ensureLoggedIn(user.id, user.name);
        await cometChatService.leaveGroup(bubble.id);
      } catch (e) {
        console.log('CometChat leave error (may not be in group):', e);
      }
      setIsMember(false);
      setMembershipStatus(null);
      setMemberCount(prev => Math.max(0, prev - 1));
      logAppEvent('[Bubble] User left bubble', { bubbleId: bubble.id, bubbleTitle: bubble.title });
      setSuccessModalConfig({ title: 'Left Bubble', subtitle: `You left ${bubble.title}. Your DM conversations with this bubble's members have been hidden.` });
      setShowSuccessModal(true);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinLeave = async () => {
    if (!user) return;

    if (isMember) {
      Alert.alert(
        'Leave Bubble',
        `Are you sure you want to leave ${bubble.title}?\n\nYour direct message conversations with members of this bubble will also be hidden.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => performLeaveBubble(),
          },
        ],
      );
      return;
    }

    if (membershipStatus === 'pending') {
      Alert.alert(
        'Withdraw Request',
        `Are you sure you want to withdraw your request to join ${bubble.title}?\n\nAny DM conversations you may have in this bubble's context will also be hidden.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Withdraw',
            style: 'destructive',
            onPress: async () => {
              setIsJoining(true);
              try {
                await apiService.leaveBubble(bubble.id);
                setMembershipStatus(null);
                setSuccessModalConfig({ title: 'Request Withdrawn', subtitle: `Your request to join ${bubble.title} has been withdrawn` });
                setShowSuccessModal(true);
              } catch (error: any) {
                Alert.alert('Error', error.message);
              } finally {
                setIsJoining(false);
              }
            },
          },
        ],
      );
      return;
    }

    setIsJoining(true);
    try {
      const result = await apiService.joinBubble(bubble.id);
      const privacy = bubbleDetails?.privacy || bubble.privacy;
      if (result.status === 'waitlisted') {
        setMembershipStatus('waitlisted');
        setShowWaitlistModal(true);
      } else if (result.status === 'pending' || privacy === 'Request to Join' || privacy === 'Request' || privacy === 'Private') {
        setMembershipStatus('pending');
        setSuccessModalConfig({ title: 'Request Sent!', subtitle: `Your request to join ${bubble.title} has been sent to the admins` });
        setShowSuccessModal(true);
      } else {
        if (user) await cometChatService.ensureLoggedIn(user.id, user.name);

        const restoredDmCount = await cometChatService.getAdmConversationCountForBubble(String(bubble.id));

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
        logAppEvent('[Bubble] User joined bubble', { bubbleId: bubble.id, bubbleTitle: bubble.title });

        if (restoredDmCount > 0) {
          const convoWord = restoredDmCount === 1 ? 'conversation' : 'conversations';
          setSuccessModalConfig({
            title: 'Welcome Back!',
            subtitle: `Welcome back to ${bubble.title}. Your ${restoredDmCount} previous DM ${convoWord} with this bubble's members have been restored.`,
          });
          showToast({
            message:
              restoredDmCount === 1
                ? '1 previous conversation restored'
                : `${restoredDmCount} previous conversations restored`,
            type: 'success',
            duration: 4000,
          });
        } else {
          setSuccessModalConfig({ title: 'Joined!', subtitle: `Welcome to ${bubble.title}` });
        }
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleEventPress = (event: Event) => {
    navigation.navigate('EventDetails' as any, {
      eventId: event.id,
      event,
      bubbleTitle: bubble.title,
      onTasksChanged: (changedEventId: string, openCount: number) => {
        setSignupTaskCounts(prev => {
          const updated = { ...prev };
          if (openCount > 0) {
            updated[changedEventId] = openCount;
          } else {
            delete updated[changedEventId];
          }
          return updated;
        });
      },
    });
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
      const [configRes, freshBubble] = await Promise.all([
        apiService.getShareBaseUrl(),
        apiService.getBubble(bubble.id),
      ]);
      const baseUrl = configRes.baseUrl;
      const shortId = freshBubble?.shortId || bubbleDetails?.shortId || bubble.shortId || bubble.id;
      const deepLink = `${baseUrl}/b/${shortId}`;
      const shareContent = Platform.OS === 'ios'
        ? { message: `Check out "${bubble.title}" on Bubble!`, url: deepLink }
        : { message: `Check out "${bubble.title}" on Bubble!\n${deepLink}` };
      await new Promise(resolve => setTimeout(resolve, 500));
      await Share.share(shareContent);
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('Share Error', 'Unable to share this bubble. Please try again.');
      }
      console.error('Share error:', error);
    }
  };

  const handleShowQRCode = async () => {
    setShowKebabMenu(false);
    try {
      const [configRes, freshBubble] = await Promise.all([
        apiService.getShareBaseUrl(),
        apiService.getBubble(bubble.id),
      ]);
      const baseUrl = configRes.baseUrl;
      const shortId = freshBubble?.shortId || bubbleDetails?.shortId || bubble.shortId || bubble.id;
      setShareUrl(`${baseUrl}/b/${shortId}`);
      setShowQRModal(true);
    } catch (error) {
      console.error('QR code error:', error);
    }
  };

  const handleBubbleChat = async () => {
    setShowKebabMenu(false);
    const groupId = String(bubble.id);
    const groupName = bubble.title || 'Bubble Chat';

    if (user) await cometChatService.ensureLoggedIn(user.id, user.name);
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
          <Ionicons name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'} size={24} color={Colors.text.primary} />
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
          {((bubbleDetails?.privacy || bubble.privacy) === 'Public' || isMember) && (
            <>
              <TouchableOpacity style={styles.kebabItem} onPress={handleShareBubble}>
                <Ionicons name="share-outline" size={20} color={Colors.text.primary} />
                <Text style={styles.kebabItemText}>Share Bubble</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.kebabItem} onPress={handleShowQRCode} data-testid="button-qr-code">
                <Ionicons name="qr-code-outline" size={20} color={Colors.text.primary} />
                <Text style={styles.kebabItemText}>QR Code</Text>
              </TouchableOpacity>
            </>
          )}
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
    const currentImages = bubbleDetails?.images || [];
    if (currentImages.length >= maxBubblePhotos) {
      Alert.alert('Limit Reached', `This bubble already has the maximum of ${maxBubblePhotos} photos.`);
      return;
    }

    const granted = await requestPhotoLibraryAccess();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUploading(true);
      try {
        const uri = result.assets[0].uri;
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileName = uri.split('/').pop() || 'photo.jpg';
        const contentType = blob.type || 'image/jpeg';

        const uploadUrlResponse = await fetch(`${API_URL}/api/uploads/request-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ name: fileName, size: blob.size, contentType }),
        });

        if (!uploadUrlResponse.ok) throw new Error('Failed to get upload URL');
        const { uploadURL, objectPath } = await uploadUrlResponse.json();

        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': contentType },
        });

        if (!uploadResponse.ok) throw new Error('Failed to upload image');

        const imageUrl = `${API_URL}${objectPath}`;

        await apiService.addBubblePhoto(bubble.id, imageUrl);
        await fetchBubbleDetails();
      } catch (error) {
        console.error('Image upload error:', error);
        Alert.alert('Upload Failed', 'Failed to upload photo. Please try again.');
      } finally {
        setImageUploading(false);
      }
    }
  };

  const renderCoverPhoto = () => (
    <View>
      <View style={styles.coverPhotoContainer}>
        <ImageCarousel
          images={bubbleDetails?.images || (bubble.image ? [bubble.image] : [])}
          height={COVER_IMAGE_HEIGHT}
          width={COVER_IMAGE_WIDTH}
          fallbackImage="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800"
          borderRadius={Radius.md}
        />
        {isMember && (
          <TouchableOpacity style={styles.cameraButton} onPress={handleCameraPress} disabled={imageUploading} testID="button-add-photo">
            {imageUploading ? (
              <ActivityIndicator size="small" color={Colors.brand.bubbleBlue} />
            ) : (
              <Ionicons name="camera" size={20} color={Colors.brand.bubbleBlue} />
            )}
          </TouchableOpacity>
        )}
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
        <TouchableOpacity
          onPress={() => navigation.navigate('BulletinBoard' as any, { bubbleId: bubble.id, bubbleTitle: bubble.title })}
          accessibilityLabel="View all bulletin board posts"
        >
          <Ionicons name="chevron-forward" size={18} color={Colors.neutral.coolMist} />
        </TouchableOpacity>
      </View>
      {announcements.length > 0 ? (
        <View style={styles.bulletinGrid}>
          {announcements.slice(0, 4).map((post: any) => (
            <TouchableOpacity
              key={post.id}
              style={styles.bulletinCard}
              onPress={() => navigation.navigate('PostDetail' as any, { postId: post.id, bubbleId: bubble.id })}
              activeOpacity={0.7}
            >
              {post.isPinned && <Text style={styles.pinIcon}>📌</Text>}
              <Text style={styles.bulletinTitle} numberOfLines={1}>{post.title}</Text>
              <Text style={styles.bulletinBody} numberOfLines={3}>{post.body}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={[styles.bulletinCard, { width: '100%' }]}>
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

  const handleAttachmentsChange = async (updatedAttachments: string[]) => {
    try {
      await apiService.updateBubble(bubble.id, { attachments: updatedAttachments });
      await fetchBubbleDetails();
    } catch (error) {
      console.error('Failed to update attachments:', error);
      Alert.alert('Error', 'Failed to update attachments. Please try again.');
    }
  };

  const renderAttachmentsSection = () => {
    const attachments: string[] = bubbleDetails?.attachments || [];
    return (
      <View style={styles.section}>
        <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setAttachmentsExpanded(!attachmentsExpanded)}>
          <Text style={styles.sectionHeading}>Attachments</Text>
          {attachmentsExpanded ? <ChevronUpIcon size={22} color={Colors.text.primary} /> : <ChevronDownIcon size={22} color={Colors.text.primary} />}
        </TouchableOpacity>
        {attachmentsExpanded && (
          <View>
            {isBubbleAdmin ? (
              <MultiImagePicker
                images={attachments}
                onImagesChange={handleAttachmentsChange}
                maxImages={5}
                acceptAllFiles
              />
            ) : attachments.length === 0 ? (
              <Text style={styles.emptyText}>No attachments yet</Text>
            ) : (
              attachments.map((item, index) => (
                <View key={index} style={styles.attachmentItem}>
                  <Ionicons name="attach" size={18} color={Colors.text.tertiary} />
                  <Text style={styles.attachmentText} numberOfLines={1}>{item.split('/').pop() || 'File'}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  const renderMembersRow = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.membersLeft}>
          <PeopleIcon size={20} color={Colors.text.primary} />
          <Text style={styles.membersCount}>{memberCount}</Text>
          <Text style={styles.membersLabel}>Members</Text>
        </View>
        <TouchableOpacity onPress={handleViewMembers} accessibilityLabel="View all members">
          <Ionicons name="chevron-forward" size={18} color={Colors.neutral.coolMist} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderJoinLeaveButton = () => {
    if (isLoading) return null;

    let title = 'Join Bubble';
    let variant: 'primary' | 'outline' = 'primary';
    let disabled = false;
    const privacy = bubbleDetails?.privacy || bubble.privacy;
    const limit = bubbleDetails?.memberLimit || bubble.memberLimit;
    const isFull = limit != null && memberCount >= limit;

    if (isMember) {
      title = 'Leave Bubble';
      variant = 'outline';
    } else if (membershipStatus === 'pending') {
      title = 'Request Pending';
      variant = 'outline';
      disabled = true;
    } else if (membershipStatus === 'waitlisted') {
      title = 'On Waitlist';
      variant = 'outline';
      disabled = true;
    } else if (membershipStatus === 'on_hold') {
      title = 'Waitlist On Hold';
      variant = 'outline';
      disabled = true;
    } else if (isFull) {
      title = 'Join Waitlist';
    } else if (privacy === 'Request to Join' || privacy === 'Request' || privacy === 'Private') {
      title = 'Request to Join';
    }

    return (
      <BubbleButton
        title={title}
        onPress={handleJoinLeave}
        variant={variant}
        loading={isJoining}
        disabled={disabled}
        testID="button-join-leave"
      />
    );
  };

  const renderWaitlistAdminRow = () => {
    if (!canManage) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Waitlist</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('BubbleWaitlist' as any, { bubbleId: bubble.id, bubbleTitle: bubble.title })}
            accessibilityLabel="Manage waitlist"
          >
            <Ionicons name="chevron-forward" size={18} color={Colors.neutral.coolMist} />
          </TouchableOpacity>
        </View>
      </View>
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
      {renderWaitlistAdminRow()}
      {canManage && renderSeparator()}
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

  const renderEventCard = (event: Event) => {
    const openTasks = signupTaskCounts[event.id] || 0;
    return (
      <TouchableOpacity
        key={event.id}
        style={styles.eventCard}
        onPress={() => handleEventPress(event)}
        data-testid={`card-event-${event.id}`}
      >
        <Image
          source={resolveMediaUrl(event.coverImage) ?? getFallbackImage(null)}
          style={styles.eventImage}
          contentFit="cover"
        />
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
          <Text style={styles.eventDateText}>{getEventFullDate(event.date)}</Text>
          <Text style={styles.eventTimeText}>{getEventTimeRange(event.startTime, event.endTime)}</Text>
          {getSpotsLabel(event) !== null && (
            <Text style={styles.eventSpotsText}>{getSpotsLabel(event)}</Text>
          )}
          {openTasks > 0 && (
            <TouchableOpacity
              style={styles.eventTasksBadge}
              data-testid={`badge-tasks-${event.id}`}
              activeOpacity={0.7}
              onPress={(e) => {
                e.stopPropagation();
                handleEventPress(event);
              }}
            >
              <Text style={styles.eventTasksBadgeText}>
                {openTasks === 1 ? '1 task open' : `${openTasks} tasks open`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.eventChevronContainer}>
          <Ionicons name="chevron-forward" size={18} color={Colors.neutral.coolMist} />
        </View>
      </TouchableOpacity>
    );
  };

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
        <BubbleDetailsSkeleton />
      </SafeAreaView>
    );
  }

  const renderAdminDashboardEntry = () => {
    if (!canManage) return null;
    return (
      <TouchableOpacity
        style={styles.adminDashboardCard}
        onPress={() => navigation.navigate('AdminDashboard', { bubbleId: bubble.id, bubbleTitle: bubble.title, bubble })}
        activeOpacity={0.85}
      >
        <Text style={styles.adminDashboardText}>Admin Dashboard</Text>
        <Ionicons name="chevron-forward" size={22} color={Colors.brand.primary} />
      </TouchableOpacity>
    );
  };

  const renderPendingBanner = () => {
    if (bubbleDetails?.status !== 'pending') return null;
    return (
      <View style={styles.pendingBanner}>
        <Ionicons name="time-outline" size={16} color="#92400E" style={{ marginRight: 6 }} />
        <Text style={styles.pendingBannerText}>
          Your bubble is under review. It will be visible to others once our team approves it. You already have full admin access.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {renderHeader()}
      {renderPendingBanner()}
      {renderAdminDashboardEntry()}
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
      <ShareQRCodeModal
        visible={showQRModal}
        onClose={() => setShowQRModal(false)}
        bubbleName={bubble.title || ''}
        shareUrl={shareUrl}
      />
      <Modal
        visible={showWaitlistModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWaitlistModal(false)}
      >
        <View style={styles.waitlistModalOverlay}>
          <View style={styles.waitlistModalSheet}>
            <View style={styles.waitlistModalHandle} />
            <View style={styles.waitlistModalIconCircle}>
              <Ionicons name="checkmark" size={36} color={Colors.brand.skyWhite} />
            </View>
            <Text style={styles.waitlistModalTitle}>Joined Waitlist!</Text>
            <Text style={styles.waitlistModalSubtitle}>
              You'll be notified once accepted into {bubble.title}.
            </Text>
            <TouchableOpacity
              style={styles.waitlistModalBtn}
              onPress={() => setShowWaitlistModal(false)}
              activeOpacity={0.8}
              testID="button-waitlist-close"
            >
              <Text style={styles.waitlistModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    backgroundColor: Colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background.secondary,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: Colors.neutral.lightSilver,
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
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  pendingBannerText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: '#92400E',
    lineHeight: 18,
  },
  adminDashboardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    height: 65,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    shadowColor: 'rgba(0, 0, 0, 0.25)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },
  adminDashboardText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.medium as any,
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
    ...CardShadow,
  },
  tagline: {
    textAlign: 'center',
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.base,
    marginTop: Spacing.md,
    marginHorizontal: Spacing.xl,
  },
  activeMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
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
    backgroundColor: Colors.border.default,
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.xl,
  },
  section: {
    paddingHorizontal: Spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionHeading: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.neutral.charcoal,
  },
  bulletinGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  bulletinCard: {
    backgroundColor: Colors.background.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    position: 'relative',
    width: '48%',
    ...CardShadow,
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
    lineHeight: Typography.lineHeight.sm,
  },
  bodyText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.secondary,
    lineHeight: Typography.lineHeight.base,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.text.tertiary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
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
    ...CardShadow,
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
  eventTasksBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.background.brandTint,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginTop: Spacing.xs,
  },
  eventTasksBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semiBold,
    color: Colors.brand.primary,
  },
  eventChevronContainer: {
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
  waitlistModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  waitlistModalSheet: {
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
    alignItems: 'center',
  },
  waitlistModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.neutral.lightSilver,
    marginBottom: Spacing.lg,
  },
  waitlistModalIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.status.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  waitlistModalTitle: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold as any,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  waitlistModalSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    lineHeight: Typography.lineHeight.md,
    marginBottom: Spacing.lg,
  },
  waitlistModalBtn: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderRadius: 22,
    height: 44,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitlistModalBtnText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold as any,
    color: Colors.brand.skyWhite,
  },
});
