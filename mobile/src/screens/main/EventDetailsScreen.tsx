import React, { useState, useEffect } from 'react';
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
  Platform,
  Linking,
  Share,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import SuccessModal from '../../components/SuccessModal';
import { CalendarIcon, LocationPinIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, PeopleIcon, FlagIcon, CrownIcon } from '../../components/icons';
import ImageCarousel from '../../components/ImageCarousel';
import { EventDetailsSkeleton } from '../../components/SkeletonLoader';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';
import { API_URL, GOOGLE_PLACES_API_KEY } from '../../config/api';

const directionsIcon = require('../../assets/icons/directions-diamond.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_PADDING = Spacing.xl;
const IMAGE_WIDTH = SCREEN_WIDTH - CONTENT_PADDING * 2;

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'EventDetails'>;
  route: RouteProp<ExploreStackParamList, 'EventDetails'>;
};

type Event = {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  images: string[];
  date: string;
  startTime: string;
  endTime: string | null;
  locationName: string | null;
  locationAddress: string | null;
  visibility: string;
  petFriendly: boolean;
  smokeFree: boolean;
  wheelchairAccessible: boolean;
  attendeeLimit: number | null;
  rsvpDeadline: string | null;
  creatorId: string;
  bubbleId: string;
};

type Attendee = {
  id: string;
  userId: string;
  eventId: string;
  status: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

type Bubble = {
  id: string;
  title: string;
  creatorId: string;
  privacy?: string;
};

const MOCK_BULLETIN = [
  {
    id: '1',
    title: 'Volunteers Needed ASAP',
    body: "We're looking for 2 people to help with setup a few hours before we start the event! Please DM us if you're down!",
    time: '4 hrs ago',
    icon: '⚡',
  },
  {
    id: '2',
    title: 'Does anyone have equipment?',
    body: "Hey guys! We might need some stuff for tomorrow's event! Balls, paddles, and court tape. If anyone has any extra it would be a huge help 🙏",
    time: '1 day ago',
    icon: '💬',
  },
];

export default function EventDetailsScreen({ navigation, route }: Props) {
  const { eventId, event: routeEvent, bubbleTitle: routeBubbleTitle } = route.params;
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(routeEvent as Event | null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [isLoading, setIsLoading] = useState(!routeEvent);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isRsvpd, setIsRsvpd] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [showRsvpDropdown, setShowRsvpDropdown] = useState(false);
  const [isRsvping, setIsRsvping] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalConfig, setSuccessModalConfig] = useState({ title: '', subtitle: '' });
  const [shouldNavigateBack, setShouldNavigateBack] = useState(false);
  const [locationExpanded, setLocationExpanded] = useState(false);
  const [eventReportModalVisible, setEventReportModalVisible] = useState(false);
  const [eventReportReason, setEventReportReason] = useState<string | null>(null);
  const [eventReportFreeText, setEventReportFreeText] = useState('');
  const [eventReportSubmitting, setEventReportSubmitting] = useState(false);
  const [reportEventModalVisible, setReportEventModalVisible] = useState(false);
  const [reportEventReason, setReportEventReason] = useState<string | null>(null);
  const [reportEventFreeText, setReportEventFreeText] = useState('');
  const [reportEventSubmitting, setReportEventSubmitting] = useState(false);
  const [myBubbleRole, setMyBubbleRole] = useState<string | null>(null);
  const [showKebabMenu, setShowKebabMenu] = useState(false);

  const EVENT_CONCERN_REASONS = [
    'Safety issue at this event',
    'Event didn\'t match description',
    'Venue issue (unsafe, inaccessible, closed)',
    'Organizer no-show or unprepared',
    'Organizer misconduct',
    'Report a member',
    'Other',
  ];

  const EVENT_CONCERN_ROUTING: Record<string, string> = {
    'Safety issue at this event': 'Sent to Superadmins',
    'Event didn\'t match description': 'Sent to Bubble Admins',
    'Venue issue (unsafe, inaccessible, closed)': 'Sent to Superadmins & Bubble Admins',
    'Organizer no-show or unprepared': 'Sent to Bubble Admins, Superadmin notified',
    'Organizer misconduct': 'Sent to Superadmin directly',
    'Report a member': 'Opens member report flow',
    'Other': 'Sent to Superadmins & Bubble Admins (needs triage)',
  };

  const REPORT_EVENT_REASONS = [
    'Event was disorganized, ran late',
    'Organizer no-show',
    'Organizer misconduct',
    'Organizer made me uncomfortable',
  ];

  const REPORT_EVENT_ROUTING: Record<string, string> = {
    'Event was disorganized, ran late': 'Sent to Bubble Admins',
    'Organizer no-show': 'Sent to Bubble Admins + Superadmin notified',
    'Organizer misconduct': 'Sent to Superadmin directly',
    'Organizer made me uncomfortable': 'Sent to Superadmin directly',
  };

  const handleReportConcern = () => {
    setEventReportReason(null);
    setEventReportFreeText('');
    setEventReportModalVisible(true);
  };

  const handleReportEvent = () => {
    setReportEventReason(null);
    setReportEventFreeText('');
    setReportEventModalVisible(true);
  };

  const handleConcernReasonSelect = (reason: string) => {
    if (reason === 'Report a member') {
      setEventReportModalVisible(false);
      handleViewParticipants();
      return;
    }
    setEventReportReason(reason);
  };

  const submitConcernReport = async () => {
    if (!eventReportReason || !event) return;
    setEventReportSubmitting(true);
    try {
      await apiService.submitReport({
        reportType: 'event',
        reason: eventReportReason,
        freeText: eventReportFreeText.trim() || undefined,
        bubbleId: event.bubbleId,
        eventId: event.id,
      });
      setEventReportModalVisible(false);
      const routing = EVENT_CONCERN_ROUTING[eventReportReason] || 'Sent to Superadmins & Bubble Admins';
      Alert.alert('Report Submitted', `Your concern about this event has been received. ${routing}.`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setEventReportSubmitting(false);
    }
  };

  const submitEventReport = async () => {
    if (!reportEventReason || !event) return;
    setReportEventSubmitting(true);
    try {
      await apiService.submitReport({
        reportType: 'event',
        reason: reportEventReason,
        freeText: reportEventFreeText.trim() || undefined,
        bubbleId: event.bubbleId,
        eventId: event.id,
      });
      setReportEventModalVisible(false);
      const routing = REPORT_EVENT_ROUTING[reportEventReason] || 'Sent to Superadmins';
      Alert.alert('Report Submitted', `Your report about this event has been received. ${routing}.`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setReportEventSubmitting(false);
    }
  };

  useEffect(() => {
    fetchEvent();
    fetchAttendees();
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const data = await apiService.getEvent(eventId) as Event;
      setEvent(data);
      fetchBubble(data.bubbleId);
    } catch (error) {
      console.error('Failed to fetch event:', error);
      Alert.alert('Error', 'Failed to load event');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBubble = async (bubbleId: string) => {
    try {
      const data = await apiService.getBubble(bubbleId) as Bubble;
      setBubble(data);
      try {
        const membership = await apiService.checkMembership(bubbleId);
        setMyBubbleRole(membership.role || null);
      } catch {}
    } catch (error) {
      console.error('Failed to fetch bubble:', error);
    }
  };

  const fetchAttendees = async () => {
    try {
      const data = await apiService.getEventAttendees(eventId) as Attendee[];
      setAttendees(data);
      const myAttendance = data.find(a => a.userId === user?.id);
      setIsRsvpd(!!myAttendance);
      setRsvpStatus(myAttendance?.status || null);
    } catch (error) {
      console.error('Failed to fetch attendees:', error);
    }
  };

  const handleRsvpSelect = async (status: 'going' | 'not_going') => {
    setIsRsvping(true);
    setShowRsvpDropdown(false);
    try {
      if (status === 'not_going' && isRsvpd) {
        await apiService.cancelRsvp(eventId);
        setIsRsvpd(false);
        setRsvpStatus('not_going');
        setAttendees(attendees.filter(a => a.userId !== user?.id));
        setSuccessModalConfig({ title: 'RSVP Updated', subtitle: 'You are not attending this event' });
        setShowSuccessModal(true);
      } else if (status === 'going') {
        const result = await apiService.rsvpEvent(eventId, 'going') as { success: boolean; status: string };
        setIsRsvpd(true);
        const actualStatus = result.status || 'going';
        setRsvpStatus(actualStatus);
        fetchAttendees();
        if (actualStatus === 'waitlisted') {
          setSuccessModalConfig({ title: 'Waitlisted', subtitle: 'The event is full. You\'ve been added to the waitlist.' });
        } else {
          setSuccessModalConfig({ title: 'RSVP Confirmed!', subtitle: 'You are attending this event' });
        }
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update RSVP');
    } finally {
      setIsRsvping(false);
    }
  };

  const handleEdit = () => {
    navigation.navigate('EditEvent' as any, { event });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteEvent(eventId);
              setSuccessModalConfig({ title: 'Deleted', subtitle: 'Event has been deleted' });
              setShouldNavigateBack(true);
              setShowSuccessModal(true);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  const showAdminOptions = () => {
    Alert.alert(
      'Manage Event',
      undefined,
      [
        { text: 'Edit Event', onPress: handleEdit },
        { text: 'Delete Event', style: 'destructive', onPress: handleDelete },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleShare = async () => {
    try {
      const bubbleName = encodeURIComponent(bubble?.title || 'bubble');
      const eventName = encodeURIComponent(event?.title || 'event');
      const deepLink = `https://community-bubbles.replit.app/${bubbleName}/${eventName}/${eventId}`;
      await Share.share({
        message: `Check out this event: ${event?.title}\n${deepLink}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleViewParticipants = () => {
    navigation.navigate('EventParticipants' as any, {
      eventId,
      eventTitle: event?.title || '',
      bubbleId: event?.bubbleId || '',
      bubbleTitle: bubbleDisplayTitle || bubble?.title || '',
      bubblePrivacy: bubble?.privacy || 'Public',
      eventCreatorId: event?.creatorId || '',
    });
  };

  const openDirections = () => {
    if (!event?.locationName) return;
    const address = event.locationAddress || event.locationName;
    const encodedAddress = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${encodedAddress}`,
      android: `geo:0,0?q=${encodedAddress}`,
    });
    if (url) {
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) return Linking.openURL(url);
          return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
        })
        .catch((err) => console.error('Error opening maps:', err));
    }
  };

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${weekday}, ${monthDay}`;
  };

  const formatDateFull = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    let dayLabel: string;
    if (d.getTime() === today.getTime()) dayLabel = 'Today';
    else if (d.getTime() === tomorrow.getTime()) dayLabel = 'Tomorrow';
    else dayLabel = d.toLocaleDateString('en-US', { weekday: 'long' });
    return `${dayLabel}, ${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getDate()}`;
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getTimeRange = () => {
    if (!event) return '';
    const start = formatTime(event.startTime);
    const end = event.endTime ? formatTime(event.endTime) : null;
    return end ? `${start} - ${end}` : start;
  };

  if (isLoading || !event) {
    return (
      <SafeAreaView style={styles.container}>
        <EventDetailsSkeleton />
      </SafeAreaView>
    );
  }

  const isEventCreator = event.creatorId === user?.id;
  const isBubbleAdmin = myBubbleRole === 'admin';
  const isSuperAdmin = user?.isSuperAdmin === true;
  const canManage = isEventCreator || isBubbleAdmin || isSuperAdmin;
  const goingCount = attendees.filter(a => a.status === 'going').length;
  const waitlistCount = attendees.filter(a => a.status === 'waitlisted').length;
  const spotsLeft = event.attendeeLimit ? event.attendeeLimit - goingCount : null;
  const isFull = event.attendeeLimit ? goingCount >= event.attendeeLimit : false;

  const creatorAttendee = attendees.find(a => a.userId === event.creatorId);
  const creatorName = creatorAttendee?.user?.name || (event as any).creatorName || 'Event Creator';
  const creatorProfilePhoto = (event as any).creatorProfilePhoto || null;

  const bubbleDisplayTitle = routeBubbleTitle || bubble?.title || '';

  const eventImages = event.images?.length > 0
    ? event.images
    : event.coverImage
      ? [event.coverImage]
      : [];

  const hasImages = eventImages.length > 0;
  const locationDisplay = event.locationAddress || event.locationName || '';

  const eventAny = event as any;
  const mapImageUrl = event.locationName && (eventAny.locationLat || event.locationAddress)
    ? `${API_URL}/api/static-map?lat=${eventAny.locationLat || ''}&lng=${eventAny.locationLng || ''}&zoom=15`
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBackButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{event.title}</Text>
        <View style={styles.navRightActions}>
          <View style={{ position: 'relative', zIndex: 200 }}>
            <TouchableOpacity onPress={() => setShowKebabMenu(!showKebabMenu)} style={styles.navShareButton}>
              <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            {showKebabMenu && (
              <View style={styles.kebabMenu}>
                <TouchableOpacity
                  style={styles.kebabMenuItem}
                  onPress={() => { setShowKebabMenu(false); handleShare(); }}
                >
                  <Ionicons name="paper-plane-outline" size={18} color={Colors.text.primary} />
                  <Text style={styles.kebabMenuText}>Share Event</Text>
                </TouchableOpacity>
                {canManage && (
                  <TouchableOpacity
                    style={styles.kebabMenuItem}
                    onPress={() => { setShowKebabMenu(false); showAdminOptions(); }}
                  >
                    <CrownIcon size={18} color={Colors.brand.primary} />
                    <Text style={[styles.kebabMenuText, { color: Colors.brand.primary }]}>Manage Event</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.kebabSeparatorMedium} />
                <TouchableOpacity
                  style={styles.kebabMenuItem}
                  onPress={() => { setShowKebabMenu(false); handleReportConcern(); }}
                >
                  <FlagIcon size={18} color={Colors.status.error} />
                  <Text style={styles.kebabMenuText}>Report a Concern</Text>
                </TouchableOpacity>
                <View style={styles.kebabSeparator} />
                <TouchableOpacity
                  style={styles.kebabMenuItem}
                  onPress={() => { setShowKebabMenu(false); handleReportEvent(); }}
                >
                  <FlagIcon size={18} color={Colors.status.error} />
                  <Text style={[styles.kebabMenuText, { color: Colors.status.error }]}>Report this Event</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      {showKebabMenu && (
        <TouchableOpacity
          style={styles.kebabBackdrop}
          activeOpacity={1}
          onPress={() => setShowKebabMenu(false)}
        />
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {hasImages && (
          <View style={styles.coverImageContainer}>
            {eventImages.length === 1 ? (
              <Image source={{ uri: eventImages[0] }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <ImageCarousel
                images={eventImages}
                width={IMAGE_WIDTH}
                height={200}
                borderRadius={Radius.md}
              />
            )}
          </View>
        )}

        <View style={styles.spotsCenterRow}>
          <Text style={styles.spotsGreenText}>
            {spotsLeft !== null
              ? (isFull ? 'Event Full' : `${spotsLeft} spots left`)
              : `${goingCount} going`}
          </Text>
          {waitlistCount > 0 && (
            <Text style={styles.waitlistCountText}>
              {' · '}Waitlisted: {waitlistCount}
            </Text>
          )}
        </View>

        <View style={styles.infoRows}>
          <View style={[styles.dateTimeRsvpRow, { zIndex: 100 }]}>
            <View style={styles.dateTimeColumn}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <CalendarIcon size={18} color={Colors.text.tertiary} />
                </View>
                <Text style={styles.infoText}>{formatDateShort(event.date)}</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <ClockIcon size={18} color={Colors.text.tertiary} />
                </View>
                <Text style={styles.infoText}>{getTimeRange()}</Text>
              </View>
            </View>
            <View style={styles.rsvpDropdownWrapper}>
              <TouchableOpacity
                style={[
                  styles.rsvpDropdownButton,
                  (rsvpStatus === 'going' || (isEventCreator && !rsvpStatus)) && styles.rsvpDropdownGoing,
                  rsvpStatus === 'not_going' && styles.rsvpDropdownNotGoing,
                  rsvpStatus === 'waitlisted' && styles.rsvpDropdownWaitlisted,
                  (!rsvpStatus && !isEventCreator) && styles.rsvpDropdownDefault,
                ]}
                onPress={() => setShowRsvpDropdown(!showRsvpDropdown)}
                disabled={isRsvping}
              >
                {isRsvping ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.rsvpDropdownButtonText}>
                      {isEventCreator
                        ? (rsvpStatus === 'not_going' ? 'Not Going' : 'Going')
                        : (rsvpStatus === 'waitlisted' ? 'Waitlisted' : rsvpStatus === 'going' ? 'Going' : rsvpStatus === 'not_going' ? 'Not Going' : 'RSVP')}
                    </Text>
                    {showRsvpDropdown ? <ChevronUpIcon size={14} color="#FFFFFF" /> : <ChevronDownIcon size={14} color="#FFFFFF" />}
                  </>
                )}
              </TouchableOpacity>
              {showRsvpDropdown && (
                <View style={styles.rsvpDropdownMenu}>
                  {(!isEventCreator || rsvpStatus === 'not_going') && (
                    <>
                      <TouchableOpacity
                        style={styles.rsvpDropdownItem}
                        onPress={() => handleRsvpSelect('going')}
                      >
                        <View style={[styles.rsvpStatusDot, { backgroundColor: '#34C759' }]} />
                        <Text style={styles.rsvpDropdownItemText}>Going</Text>
                      </TouchableOpacity>
                      {!isEventCreator && <View style={styles.rsvpDropdownDivider} />}
                    </>
                  )}
                  {(!isEventCreator || rsvpStatus !== 'not_going') && (
                    <TouchableOpacity
                      style={styles.rsvpDropdownItem}
                      onPress={() => handleRsvpSelect('not_going')}
                    >
                      <View style={[styles.rsvpStatusDot, { backgroundColor: '#FF3B30' }]} />
                      <Text style={styles.rsvpDropdownItemText}>Not Going</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <PeopleIcon size={18} color={Colors.text.tertiary} />
            </View>
            <Text style={styles.infoText}>
              {event.attendeeLimit ? `${goingCount} of ${event.attendeeLimit} spots filled` : `${goingCount} going`}
            </Text>
            <TouchableOpacity onPress={handleViewParticipants} style={styles.viewLink}>
              <Text style={styles.viewLinkText}>view {'>'}</Text>
            </TouchableOpacity>
          </View>
          {event.description && (
            <TouchableOpacity style={styles.infoRow} activeOpacity={0.7} onPress={() => Alert.alert(event.title, event.description || '')}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="document-text-outline" size={18} color={Colors.text.tertiary} />
              </View>
              <Text style={styles.infoText} numberOfLines={1}>
                {event.description.length > 30 ? event.description.substring(0, 30) + '...' : event.description}
              </Text>
              <View style={styles.viewLink}>
                <Text style={styles.viewLinkText}>more {'>'}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.separator} />

        <TouchableOpacity style={styles.creatorRow} activeOpacity={0.7} onPress={() => Alert.alert(creatorName, `Event creator`)}>
          {creatorProfilePhoto ? (
            <Image source={{ uri: creatorProfilePhoto }} style={styles.creatorAvatarImage} />
          ) : (
            <View style={styles.creatorAvatar}>
              <Ionicons name="person" size={20} color={Colors.background.primary} />
            </View>
          )}
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorLabel}>
              Created by <Text style={styles.creatorName}>{creatorName}</Text>
            </Text>
            <Text style={styles.creatorCity}>
              {event.locationName ? event.locationName.split(',')[0] : 'Local'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.text.tertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.locationRow} activeOpacity={0.7} onPress={() => event.locationName && setLocationExpanded(!locationExpanded)}>
          <View style={styles.locationIconContainer}>
            <LocationPinIcon size={20} color={Colors.brand.primary} />
          </View>
          <View style={styles.locationInfo}>
            <Text style={styles.locationLandmark}>{event.locationName || 'TBD'}</Text>
            {event.locationAddress && (
              <Text style={styles.locationAddress}>{event.locationAddress}</Text>
            )}
          </View>
          {event.locationName && (
            locationExpanded ? <ChevronUpIcon size={16} color={Colors.text.tertiary} /> : <ChevronDownIcon size={16} color={Colors.text.tertiary} />
          )}
        </TouchableOpacity>

        <View style={styles.separator} />

        {event.locationName && locationExpanded && (
          <View style={styles.mapSection}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.mapContainer}>
              {mapImageUrl ? (
                <Image source={{ uri: mapImageUrl }} style={styles.mapImage} resizeMode="cover" />
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="map-outline" size={48} color={Colors.text.tertiary} />
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.directionsButton} onPress={openDirections}>
              <Image source={directionsIcon} style={{ width: 24, height: 24 }} resizeMode="contain" />
              <Text style={styles.directionsText}>Get Directions</Text>
            </TouchableOpacity>
            <View style={styles.separator} />
          </View>
        )}

        <View style={styles.bulletinSection}>
          <Text style={styles.sectionTitle}>Bulletin Board</Text>

          {MOCK_BULLETIN.map((item) => (
            <View key={item.id} style={styles.bulletinCard}>
              <View style={styles.bulletinIconRow}>
                <Text style={styles.bulletinEmoji}>{item.icon}</Text>
              </View>
              <View style={styles.bulletinContent}>
                <Text style={styles.bulletinTitle}>{item.title}</Text>
                <Text style={styles.bulletinBody}>{item.body}</Text>
              </View>
              <Text style={styles.bulletinTime}>{item.time}</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <SuccessModal
        visible={showSuccessModal}
        title={successModalConfig.title}
        subtitle={successModalConfig.subtitle}
        onClose={() => {
          setShowSuccessModal(false);
          if (shouldNavigateBack) {
            navigation.goBack();
          }
        }}
      />
      <Modal
        visible={eventReportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEventReportModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.eventReportOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.eventReportDialog}>
            <View style={styles.eventReportHeader}>
              <Text style={styles.eventReportTitle}>Report a Concern</Text>
              <TouchableOpacity onPress={() => setEventReportModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.eventReportSubtitle}>
              Report a concern about this event — private to admins
            </Text>
            <ScrollView style={styles.eventReportReasonsList} nestedScrollEnabled>
              {EVENT_CONCERN_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.eventReportReasonItem,
                    eventReportReason === reason && styles.eventReportReasonSelected,
                    reason === 'Report a member' && styles.eventReportReasonLink,
                  ]}
                  onPress={() => handleConcernReasonSelect(reason)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.eventReportReasonText,
                      eventReportReason === reason && styles.eventReportReasonTextSelected,
                      reason === 'Report a member' && { color: Colors.brand.primary },
                    ]}>{reason === 'Report a member' ? '→ Report a member' : reason}</Text>
                    {reason !== 'Report a member' && (
                      <Text style={{ fontSize: 11, color: Colors.text.tertiary, marginTop: 2 }}>
                        {EVENT_CONCERN_ROUTING[reason]}
                      </Text>
                    )}
                  </View>
                  {eventReportReason === reason && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />
                  )}
                  {reason === 'Report a member' && (
                    <Ionicons name="chevron-forward" size={18} color={Colors.brand.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {eventReportReason && (
              <TextInput
                style={styles.eventReportTextInput}
                placeholder="Additional details (optional)"
                placeholderTextColor={Colors.text.tertiary}
                value={eventReportFreeText}
                onChangeText={setEventReportFreeText}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
            <TouchableOpacity
              style={[styles.eventReportSubmitButton, !eventReportReason && styles.eventReportSubmitDisabled]}
              onPress={submitConcernReport}
              disabled={!eventReportReason || eventReportSubmitting}
            >
              {eventReportSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.eventReportSubmitText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={reportEventModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportEventModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.eventReportOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.eventReportDialog}>
            <View style={styles.eventReportHeader}>
              <Text style={styles.eventReportTitle}>Report Event</Text>
              <TouchableOpacity onPress={() => setReportEventModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.eventReportSubtitle}>
              Report a problem with this event — sent to admins for review
            </Text>
            <ScrollView style={styles.eventReportReasonsList} nestedScrollEnabled>
              {REPORT_EVENT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.eventReportReasonItem,
                    reportEventReason === reason && styles.eventReportReasonSelected,
                  ]}
                  onPress={() => setReportEventReason(reason)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.eventReportReasonText,
                      reportEventReason === reason && styles.eventReportReasonTextSelected,
                    ]}>{reason}</Text>
                    <Text style={{ fontSize: 11, color: Colors.text.tertiary, marginTop: 2 }}>
                      {REPORT_EVENT_ROUTING[reason]}
                    </Text>
                  </View>
                  {reportEventReason === reason && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.brand.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {reportEventReason && (
              <TextInput
                style={styles.eventReportTextInput}
                placeholder="Additional details (optional)"
                placeholderTextColor={Colors.text.tertiary}
                value={reportEventFreeText}
                onChangeText={setReportEventFreeText}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            )}
            <TouchableOpacity
              style={[styles.eventReportSubmitButton, !reportEventReason && styles.eventReportSubmitDisabled]}
              onPress={submitEventReport}
              disabled={!reportEventReason || reportEventSubmitting}
            >
              {reportEventSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.eventReportSubmitText}>Submit Report</Text>
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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CONTENT_PADDING,
    paddingVertical: Spacing.md,
    zIndex: 200,
    backgroundColor: Colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lightSilver,
  },
  navBackButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
  },
  navRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  navShareButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kebabMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.neutral.cloudGrey,
  },
  kebabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  kebabMenuText: {
    fontSize: Typography.sizes.base,
    color: Colors.text.primary,
  },
  kebabSeparator: {
    height: 1,
    backgroundColor: Colors.neutral.coolMist,
    marginHorizontal: 16,
    opacity: 0.4,
  },
  kebabSeparatorMedium: {
    height: 1.5,
    backgroundColor: '#D0D0D0',
    marginHorizontal: 16,
  },
  kebabSeparatorHeavy: {
    height: 2,
    backgroundColor: '#C0C0C0',
    marginHorizontal: 16,
  },
  kebabBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 150,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: Spacing.xxxl + 20,
  },
  coverImageContainer: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 200,
    borderRadius: Radius.md,
  },
  spotsCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: Spacing.xs,
  },
  spotsGreenText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.status.success,
  },
  waitlistCountText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.status.warning,
  },
  dateTimeRsvpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  dateTimeColumn: {
    flex: 1,
    gap: Spacing.xs,
  },
  rsvpDropdownWrapper: {
    marginLeft: Spacing.md,
    alignSelf: 'flex-start',
  },
  rsvpDropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 6,
  },
  rsvpDropdownDefault: {
    backgroundColor: Colors.brand.primary,
  },
  rsvpDropdownGoing: {
    backgroundColor: '#34C759',
  },
  rsvpDropdownNotGoing: {
    backgroundColor: '#FF3B30',
  },
  rsvpDropdownWaitlisted: {
    backgroundColor: '#FF9500',
  },
  rsvpDropdownButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: '#FFFFFF',
  },
  rsvpDropdownMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 140,
    overflow: 'hidden',
  },
  rsvpDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  rsvpStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rsvpDropdownItemText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.text.primary,
  },
  rsvpDropdownDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  infoRows: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
    zIndex: 100,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  infoIconContainer: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.regular,
    color: Colors.text.secondary,
    flex: 1,
    lineHeight: Typography.lineHeight.base,
  },
  viewLink: {
    marginLeft: Spacing.sm,
  },
  viewLinkText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    color: Colors.brand.primary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border.default,
    marginVertical: Spacing.xl,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  creatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  creatorInfo: {
    flex: 1,
  },
  creatorLabel: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.regular,
    color: Colors.text.primary,
    lineHeight: Typography.lineHeight.base,
  },
  creatorName: {
    fontWeight: Typography.weights.semiBold,
  },
  creatorCity: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.regular,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  locationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EAF4FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  locationLandmark: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold,
    color: Colors.text.primary,
  },
  locationAddress: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.regular,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  mapSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.bold,
    color: Colors.neutral.charcoal,
    marginBottom: Spacing.sm,
  },
  mapContainer: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    height: 180,
    backgroundColor: '#F0F0F0',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8E8E8',
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.brand.primary,
    borderRadius: Radius.full,
    paddingVertical: 14,
    marginTop: Spacing.md,
  },
  directionsText: {
    fontSize: Typography.sizes.md,
    fontWeight: Typography.weights.medium,
    color: Colors.brand.primary,
  },
  bulletinSection: {
    marginBottom: Spacing.lg,
    paddingTop: 30,
  },
  rsvpButtonLegacy: {
    display: 'none',
  },
  bulletinCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background.primary,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    position: 'relative',
  },
  bulletinIconRow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EAF4FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  bulletinEmoji: {
    fontSize: 16,
  },
  bulletinContent: {
    flex: 1,
    paddingRight: 50,
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
  bulletinTime: {
    fontSize: 11,
    color: Colors.text.tertiary,
    position: 'absolute',
    top: Spacing.lg,
    right: Spacing.lg,
  },
  addButton: {
    borderWidth: 1,
    borderColor: Colors.brand.primary,
    borderStyle: 'dashed',
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  addButtonText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.medium,
    color: Colors.brand.primary,
  },
  eventReportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  eventReportDialog: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  eventReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventReportTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  eventReportSubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  eventReportReasonsList: {
    maxHeight: 280,
    marginBottom: 12,
  },
  eventReportReasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  eventReportReasonSelected: {
    borderColor: Colors.brand.primary,
    backgroundColor: '#EBF5FF',
  },
  eventReportReasonLink: {
    backgroundColor: '#F0F8FF',
    borderColor: Colors.brand.primary,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  eventReportReasonText: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  eventReportReasonTextSelected: {
    color: Colors.brand.primary,
  },
  eventReportTextInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.text.primary,
    minHeight: 70,
    marginBottom: 12,
  },
  eventReportSubmitButton: {
    backgroundColor: Colors.brand.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  eventReportSubmitDisabled: {
    opacity: 0.5,
  },
  eventReportSubmitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
