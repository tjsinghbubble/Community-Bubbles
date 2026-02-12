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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import SuccessModal from '../../components/SuccessModal';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';

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

export default function EventDetailsScreen({ navigation, route }: Props) {
  const { eventId, event: routeEvent } = route.params;
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
      bubbleTitle: bubble?.title || '',
    });
  };

  const openInMaps = (locationName: string, locationAddress: string | null) => {
    const address = locationAddress || locationName;
    const encodedAddress = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${encodedAddress}`,
      android: `geo:0,0?q=${encodedAddress}`,
    });
    if (url) {
      Linking.canOpenURL(url)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(url);
          } else {
            return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
          }
        })
        .catch((err) => {
          console.error('Error opening maps:', err);
        });
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (isLoading || !event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      </SafeAreaView>
    );
  }

  const isEventCreator = event.creatorId === user?.id;
  const isBubbleAdmin = bubble?.creatorId === user?.id;
  const isSuperAdmin = user?.isSuperAdmin === true;
  const canManage = isEventCreator || isBubbleAdmin || isSuperAdmin;
  const goingCount = attendees.filter(a => a.status === 'going').length;
  const isFull = event.attendeeLimit ? goingCount >= event.attendeeLimit : false;

  const coverImage = event.coverImage || (event.images && event.images.length > 0 ? event.images[0] : null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{bubble?.title || ''}</Text>
        <TouchableOpacity onPress={handleShare} style={styles.headerShareButton}>
          <Ionicons name="paper-plane-outline" size={22} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        {canManage && (
          <TouchableOpacity onPress={showAdminOptions} style={styles.headerMenuButton}>
            <Ionicons name="ellipsis-vertical" size={22} color={Colors.neutral.charcoal} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 100 }}>
        {coverImage ? (
          <Image source={{ uri: coverImage }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="image-outline" size={48} color={Colors.neutral.coolMist} />
          </View>
        )}

        <Text style={styles.eventTitle}>{event.title}</Text>

        {event.description && (
          <View style={styles.aboutSection}>
            <Text style={styles.aboutLabel}>About</Text>
            <Text style={styles.aboutText}>{event.description}</Text>
          </View>
        )}

        <View style={styles.separator} />

        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.neutral.charcoal} />
            <Text style={styles.detailText}>{formatDate(event.date)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={18} color={Colors.neutral.charcoal} />
            <Text style={styles.detailText}>
              {formatTime(event.startTime)}
              {event.endTime ? ` - ${formatTime(event.endTime)}` : ''}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.detailRow}
            onPress={() => event.locationName ? openInMaps(event.locationName, event.locationAddress) : null}
            activeOpacity={event.locationName ? 0.7 : 1}
          >
            <Ionicons name="location-outline" size={18} color={Colors.neutral.charcoal} />
            <Text style={styles.detailText} numberOfLines={2}>
              {event.locationName
                ? `${event.locationName}${event.locationAddress ? `, ${event.locationAddress}` : ''}`
                : 'TBD'}
            </Text>
          </TouchableOpacity>

          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={18} color={Colors.neutral.charcoal} />
            <Text style={styles.detailText}>
              {goingCount}{event.attendeeLimit ? `/${event.attendeeLimit}` : ''}
            </Text>
            <TouchableOpacity onPress={handleViewParticipants} style={styles.viewLink}>
              <Text style={styles.viewLinkText}>view</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.brand.bubbleBlue} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {canManage ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEdit}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={Gradients.button.colors as unknown as string[]}
              start={Gradients.button.start}
              end={Gradients.button.end}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.editButtonText}>Edit Event</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.rsvpButton,
              isRsvpd && styles.cancelRsvpButton,
              isFull && !isRsvpd && styles.disabledButton,
            ]}
            onPress={handleRsvp}
            disabled={isRsvping || (isFull && !isRsvpd)}
          >
            {isRsvping ? (
              <ActivityIndicator color={Colors.brand.skyWhite} />
            ) : (
              <Text style={styles.rsvpButtonText}>
                {isRsvpd ? 'Cancel RSVP' : isFull ? 'Event Full' : 'RSVP - Going'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

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
    backgroundColor: Colors.brand.skyWhite,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.cloudGrey,
  },
  headerBackButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerShareButton: {
    padding: 4,
  },
  headerMenuButton: {
    padding: 4,
    marginLeft: 4,
  },
  scrollContent: {
    flex: 1,
  },
  coverImage: {
    width: '100%',
    aspectRatio: 16 / 10,
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: Colors.neutral.cloudGrey,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  aboutSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  aboutLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    marginBottom: 6,
  },
  aboutText: {
    fontSize: 14,
    color: Colors.neutral.charcoal,
    lineHeight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.neutral.cloudGrey,
    marginHorizontal: 20,
  },
  detailsSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: Colors.neutral.charcoal,
    lineHeight: 20,
  },
  viewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewLinkText: {
    fontSize: 14,
    color: Colors.brand.bubbleBlue,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    backgroundColor: Colors.brand.skyWhite,
  },
  editButton: {
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  editButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  rsvpButton: {
    backgroundColor: Colors.state.success,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRsvpButton: {
    backgroundColor: Colors.state.error,
  },
  disabledButton: {
    backgroundColor: Colors.neutral.coolMist,
  },
  rsvpButtonText: {
    color: Colors.brand.skyWhite,
    fontSize: 17,
    fontWeight: '600',
  },
});
