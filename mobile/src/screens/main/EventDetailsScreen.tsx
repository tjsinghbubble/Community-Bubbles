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
import ImageCarousel from '../../components/ImageCarousel';
import { Colors, Spacing, Radius, Typography } from '../../styles/theme';

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
  const [myBubbleRole, setMyBubbleRole] = useState<string | null>(null);

  const EVENT_REPORT_REASONS = [
    'Safety issue at this event',
    'Event didn\'t match description',
    'Organizer no-show or unprepared',
    'Venue issue (unsafe, inaccessible, closed)',
    'Report a member',
    'Other',
  ];

  const EVENT_REPORT_ROUTING: Record<string, string> = {
    'Safety issue at this event': 'Sent to Superadmins & Bubble admins',
    'Event didn\'t match description': 'Sent to Bubble admins',
    'Organizer no-show or unprepared': 'Sent to Superadmins & Bubble admins',
    'Venue issue (unsafe, inaccessible, closed)': 'Sent to Superadmins & Bubble admins',
    'Report a member': 'Opens member report flow',
    'Other': 'Sent to Superadmins & Bubble admins',
  };

  const handleReportEvent = () => {
    setEventReportReason(null);
    setEventReportFreeText('');
    setEventReportModalVisible(true);
  };

  const handleEventReportReasonSelect = (reason: string) => {
    if (reason === 'Report a member') {
      setEventReportModalVisible(false);
      handleViewParticipants();
      return;
    }
    setEventReportReason(reason);
  };

  const submitEventReport = async () => {
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
      const routing = EVENT_REPORT_ROUTING[eventReportReason] || 'Sent to Superadmins & Bubble admins';
      Alert.alert('Report Submitted', `Your concern about this event has been received. ${routing}.`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setEventReportSubmitting(false);
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
        await apiService.rsvpEvent(eventId, 'going');
        setIsRsvpd(true);
        setRsvpStatus('going');
        fetchAttendees();
        setSuccessModalConfig({ title: 'RSVP Confirmed!', subtitle: 'You are attending this event' });
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
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isEventCreator = event.creatorId === user?.id;
  const isBubbleAdmin = myBubbleRole === 'admin';
  const isSuperAdmin = user?.isSuperAdmin === true;
  const canManage = isEventCreator || isBubbleAdmin || isSuperAdmin;
  const goingCount = attendees.filter(a => a.status === 'going').length;
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

  const mapImageUrl = event.locationName
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(event.locationAddress || event.locationName)}&zoom=14&size=600x300&maptype=roadmap&markers=color:red%7C${encodeURIComponent(event.locationAddress || event.locationName)}&key=${process.env.GOOGLE_PLACES_API_KEY || ''}`
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBackButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{event.title}</Text>
        <View style={styles.navRightActions}>
          {canManage && (
            <TouchableOpacity onPress={showAdminOptions} style={styles.navShareButton}>
              <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleReportEvent} style={styles.navShareButton}>
            <Ionicons name="flag-outline" size={20} color={Colors.status.error} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.navShareButton}>
            <Ionicons name="paper-plane-outline" size={22} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

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
        </View>

        <View style={styles.infoRows}>
          <View style={[styles.infoRow, { zIndex: 100, position: 'relative' }]}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="calendar-outline" size={18} color={Colors.text.tertiary} />
            </View>
            <Text style={styles.infoText}>{formatDateShort(event.date)}</Text>
            <View style={styles.rsvpDropdownWrapper}>
              <TouchableOpacity
                style={[
                  styles.rsvpDropdownButton,
                  (rsvpStatus === 'going' || (isEventCreator && !rsvpStatus)) && styles.rsvpDropdownGoing,
                  rsvpStatus === 'not_going' && styles.rsvpDropdownNotGoing,
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
                        : (rsvpStatus === 'going' ? 'Going' : rsvpStatus === 'not_going' ? 'Not Going' : 'RSVP')}
                    </Text>
                    <Ionicons
                      name={showRsvpDropdown ? "chevron-up" : "chevron-down"}
                      size={14}
                      color="#FFFFFF"
                    />
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
              <Ionicons name="time-outline" size={18} color={Colors.text.tertiary} />
            </View>
            <Text style={styles.infoText}>{getTimeRange()}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="people-outline" size={18} color={Colors.text.tertiary} />
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
            <Ionicons name="location" size={20} color={Colors.brand.primary} />
          </View>
          <View style={styles.locationInfo}>
            <Text style={styles.locationLandmark}>{event.locationName || 'TBD'}</Text>
            {event.locationAddress && (
              <Text style={styles.locationAddress}>{event.locationAddress}</Text>
            )}
          </View>
          {event.locationName && (
            <Ionicons name={locationExpanded ? "chevron-up" : "chevron-down"} size={16} color={Colors.text.tertiary} />
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
              <Ionicons name="navigate-outline" size={18} color={Colors.brand.primary} />
              <Text style={styles.directionsText}>Open in Maps</Text>
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
              <Text style={styles.eventReportTitle}>Report this Event</Text>
              <TouchableOpacity onPress={() => setEventReportModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.eventReportSubtitle}>
              Report a concern about this event — sent to admins with event details
            </Text>
            <ScrollView style={styles.eventReportReasonsList} nestedScrollEnabled>
              {EVENT_REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.eventReportReasonItem,
                    eventReportReason === reason && styles.eventReportReasonSelected,
                    reason === 'Report a member' && styles.eventReportReasonLink,
                  ]}
                  onPress={() => handleEventReportReasonSelect(reason)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      styles.eventReportReasonText,
                      eventReportReason === reason && styles.eventReportReasonTextSelected,
                      reason === 'Report a member' && { color: Colors.brand.primary },
                    ]}>{reason === 'Report a member' ? '→ Report a member' : reason}</Text>
                    {reason !== 'Report a member' && (
                      <Text style={{ fontSize: 11, color: Colors.text.tertiary, marginTop: 2 }}>
                        {EVENT_REPORT_ROUTING[reason]}
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
              onPress={submitEventReport}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
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
  },
  navBackButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E1F26',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: Spacing.xs,
  },
  spotsGreenText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34C759',
  },
  rsvpDropdownWrapper: {
    marginLeft: 'auto',
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
  rsvpDropdownButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 14,
    fontWeight: '500',
    color: '#1E1F26',
  },
  rsvpDropdownDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  infoRows: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
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
    fontSize: 14,
    fontWeight: '400',
    color: '#4D4D4D',
    flex: 1,
  },
  viewLink: {
    marginLeft: Spacing.sm,
  },
  viewLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.brand.primary,
  },
  separator: {
    height: 1,
    backgroundColor: '#D9D9D9',
    marginVertical: Spacing.lg,
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
    fontSize: 12,
    fontWeight: '400',
    color: '#1E1F26',
  },
  creatorName: {
    fontWeight: '600',
  },
  creatorCity: {
    fontSize: 12,
    fontWeight: '400',
    color: '#4D4D4D',
    marginTop: 1,
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
    fontSize: 12,
    fontWeight: '600',
    color: '#1E1F26',
  },
  locationAddress: {
    fontSize: 12,
    fontWeight: '400',
    color: '#4D4D4D',
    marginTop: 1,
  },
  mapSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E1F26',
    marginBottom: Spacing.md,
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
    borderWidth: 1,
    borderColor: Colors.brand.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  directionsText: {
    fontSize: 14,
    fontWeight: '500',
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
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  bulletinBody: {
    fontSize: 12,
    color: Colors.text.tertiary,
    lineHeight: 18,
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
    fontSize: 14,
    fontWeight: '500',
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
