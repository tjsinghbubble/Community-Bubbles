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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import SuccessModal from '../../components/SuccessModal';
import ImageCarousel from '../../components/ImageCarousel';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';

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
  const [isRsvping, setIsRsvping] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalConfig, setSuccessModalConfig] = useState({ title: '', subtitle: '' });
  const [shouldNavigateBack, setShouldNavigateBack] = useState(false);

  useEffect(() => {
    if (!event) {
      fetchEvent();
    } else {
      fetchBubble(event.bubbleId);
    }
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
    } catch (error) {
      console.error('Failed to fetch bubble:', error);
    }
  };

  const fetchAttendees = async () => {
    try {
      const data = await apiService.getEventAttendees(eventId) as Attendee[];
      setAttendees(data);
      setIsRsvpd(data.some(a => a.userId === user?.id));
    } catch (error) {
      console.error('Failed to fetch attendees:', error);
    }
  };

  const handleRsvp = async () => {
    setIsRsvping(true);
    try {
      if (isRsvpd) {
        await apiService.cancelRsvp(eventId);
        setIsRsvpd(false);
        setAttendees(attendees.filter(a => a.userId !== user?.id));
        setSuccessModalConfig({ title: 'RSVP Cancelled', subtitle: 'You are no longer attending this event' });
        setShowSuccessModal(true);
      } else {
        await apiService.rsvpEvent(eventId, 'going');
        setIsRsvpd(true);
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
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
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
  const isBubbleAdmin = bubble?.creatorId === user?.id;
  const isSuperAdmin = user?.isSuperAdmin === true;
  const canManage = isEventCreator || isBubbleAdmin || isSuperAdmin;
  const goingCount = attendees.filter(a => a.status === 'going').length;
  const spotsLeft = event.attendeeLimit ? event.attendeeLimit - goingCount : null;
  const isFull = event.attendeeLimit ? goingCount >= event.attendeeLimit : false;

  const creatorAttendee = attendees.find(a => a.userId === event.creatorId);
  const creatorName = creatorAttendee?.user?.name || 'Event Creator';

  const fromBubble = !!routeBubbleTitle;
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
      {fromBubble ? (
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navBackButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.navTitle} numberOfLines={1}>{bubbleDisplayTitle}</Text>
          <TouchableOpacity onPress={handleShare} style={styles.navShareButton}>
            <Ionicons name="paper-plane-outline" size={22} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.dragHandle} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          {canManage && (
            <TouchableOpacity onPress={showAdminOptions} style={styles.adminButton}>
              <Ionicons name="ellipsis-horizontal" size={22} color={Colors.text.primary} />
            </TouchableOpacity>
          )}
        </View>
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

        <View style={styles.aboutSection}>
          {isRsvpd ? (
            <Text style={styles.goingText}>Going</Text>
          ) : spotsLeft !== null && spotsLeft > 0 ? (
            <Text style={styles.spotsText}>{spotsLeft} spots left</Text>
          ) : isFull ? (
            <Text style={styles.spotsText}>Event Full</Text>
          ) : null}
          {event.description && (
            <Text style={styles.aboutText} numberOfLines={3}>{event.description}</Text>
          )}
        </View>

        <View style={styles.infoRows}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="calendar-outline" size={18} color={Colors.text.tertiary} />
            </View>
            <Text style={styles.infoText}>{formatDateShort(event.date)}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="time-outline" size={18} color={Colors.text.tertiary} />
            </View>
            <Text style={styles.infoText}>{getTimeRange()}</Text>
          </View>
          {event.locationName && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="location-outline" size={18} color={Colors.text.tertiary} />
              </View>
              <Text style={styles.infoText} numberOfLines={2}>{locationDisplay}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="people-outline" size={18} color={Colors.text.tertiary} />
            </View>
            <Text style={styles.infoText}>
              {event.attendeeLimit ? `${goingCount}/${event.attendeeLimit}` : goingCount}
            </Text>
            <TouchableOpacity onPress={handleViewParticipants} style={styles.viewLink}>
              <Text style={styles.viewLinkText}>view {'>'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!fromBubble && (
          <>
            <View style={styles.separator} />

            <View style={styles.creatorRow}>
              <View style={styles.creatorAvatar}>
                <Ionicons name="person" size={20} color={Colors.background.primary} />
              </View>
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorLabel}>
                  Created by <Text style={styles.creatorName}>{creatorName}</Text>
                </Text>
                <Text style={styles.creatorCity}>
                  {event.locationName ? event.locationName.split(',')[0] : 'Local'}
                </Text>
              </View>
            </View>

            {event.locationName && (
              <View style={styles.locationRow}>
                <View style={styles.locationIconContainer}>
                  <Ionicons name="location" size={20} color={Colors.brand.primary} />
                </View>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLandmark}>{event.locationName}</Text>
                  {event.locationAddress && (
                    <Text style={styles.locationAddress}>{event.locationAddress}</Text>
                  )}
                </View>
              </View>
            )}

            <View style={styles.separator} />

            {event.locationName && (
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
                  <Text style={styles.directionsText}>Directions</Text>
                </TouchableOpacity>
                <View style={styles.separator} />
              </View>
            )}

            <View style={styles.bulletinSection}>
              <Text style={styles.sectionTitle}>Bulletin Board</Text>

              {!isRsvpd && !canManage && (
                <TouchableOpacity style={styles.rsvpButton} onPress={handleRsvp} disabled={isRsvping || isFull}>
                  <LinearGradient
                    colors={Gradients.button.colors as unknown as string[]}
                    start={Gradients.button.start}
                    end={Gradients.button.end}
                    style={StyleSheet.absoluteFillObject}
                  />
                  {isRsvping ? (
                    <ActivityIndicator color={Colors.text.primary} size="small" />
                  ) : (
                    <Text style={styles.rsvpButtonText}>{isFull ? 'Event Full' : 'RSVP'}</Text>
                  )}
                </TouchableOpacity>
              )}

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

            {isRsvpd && (
              <TouchableOpacity style={styles.notGoingButton} onPress={handleRsvp} disabled={isRsvping}>
                {isRsvping ? (
                  <ActivityIndicator color={Colors.status.error} size="small" />
                ) : (
                  <Text style={styles.notGoingText}>Not Going</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
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
  header: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingHorizontal: CONTENT_PADDING,
    position: 'relative',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C4C4C4',
    marginBottom: Spacing.sm,
  },
  closeButton: {
    position: 'absolute',
    right: CONTENT_PADDING,
    top: Spacing.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminButton: {
    position: 'absolute',
    left: CONTENT_PADDING,
    top: Spacing.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 200,
    borderRadius: Radius.md,
  },
  spotsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: Spacing.xs,
  },
  goingText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.status.success,
    marginBottom: Spacing.xs,
  },
  aboutSection: {
    marginTop: Spacing.lg,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E1F26',
    marginBottom: Spacing.sm,
  },
  aboutText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#4D4D4D',
    lineHeight: 20,
  },
  infoRows: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
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
    alignItems: 'flex-start',
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
  },
  rsvpButton: {
    borderRadius: Radius.full,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  rsvpButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
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
  notGoingButton: {
    borderWidth: 1.5,
    borderColor: Colors.status.error,
    borderRadius: Radius.full,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  notGoingText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.status.error,
  },
});
