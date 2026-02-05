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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import SuccessModal from '../../components/SuccessModal';
import ImageCarousel from '../../components/ImageCarousel';

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
};

type Bubble = {
  id: string;
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
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
            const webUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
            return Linking.openURL(webUrl);
          }
        })
        .catch((err) => {
          console.error('Error opening maps:', err);
          Alert.alert('Error', 'Could not open maps application');
        });
    }
  };

  if (isLoading || !event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="hsl(210, 95%, 55%)" />
        </View>
      </SafeAreaView>
    );
  }

  const isEventCreator = event.creatorId === user?.id;
  const isBubbleAdmin = bubble?.creatorId === user?.id;
  const isSuperAdmin = user?.isSuperAdmin === true;
  const canManage = isEventCreator || isBubbleAdmin || isSuperAdmin;
  const goingCount = attendees.filter(a => a.status === 'going').length;
  const isFull = event.attendeeLimit && goingCount >= event.attendeeLimit;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <ImageCarousel
          images={event.images || (event.coverImage ? [event.coverImage] : [])}
          height={200}
          fallbackImage="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800"
        />

        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>

        {canManage && (
          <TouchableOpacity 
            style={styles.optionsButton}
            onPress={showAdminOptions}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
          </TouchableOpacity>
        )}

        <View style={styles.content}>
          <View style={styles.visibilityBadge}>
            <Text style={styles.visibilityText}>
              {event.visibility === 'public' ? 'Public' : event.visibility === 'private' ? 'Private' : 'Request to Join'}
            </Text>
          </View>

          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.dateTimeSection}>
            <View style={styles.dateBox}>
              <Text style={styles.dateDay}>
                {new Date(event.date + 'T00:00:00').getDate()}
              </Text>
              <Text style={styles.dateMonth}>
                {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </Text>
            </View>
            <View style={styles.dateTimeInfo}>
              <Text style={styles.fullDate}>{formatDate(event.date)}</Text>
              <Text style={styles.timeText}>
                {formatTime(event.startTime)}
                {event.endTime && ` - ${formatTime(event.endTime)}`}
              </Text>
            </View>
          </View>

          {event.locationName && (
            <TouchableOpacity 
              style={styles.locationSection}
              onPress={() => openInMaps(event.locationName!, event.locationAddress)}
              activeOpacity={0.7}
            >
              <Ionicons name="location" size={20} color="hsl(210, 95%, 55%)" />
              <View style={styles.locationInfo}>
                <Text style={styles.locationName}>{event.locationName}</Text>
                {event.locationAddress && (
                  <Text style={styles.locationAddress}>{event.locationAddress}</Text>
                )}
              </View>
              <Ionicons name="open-outline" size={18} color="#999" />
            </TouchableOpacity>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={20} color="#666" />
              <Text style={styles.statText}>
                {goingCount} {goingCount === 1 ? 'person' : 'people'} going
              </Text>
            </View>
            {event.attendeeLimit && (
              <View style={styles.statItem}>
                <Ionicons name="warning-outline" size={20} color={isFull ? '#e74c3c' : '#666'} />
                <Text style={[styles.statText, isFull && styles.fullText]}>
                  {isFull ? 'Event Full' : `${event.attendeeLimit - goingCount} spots left`}
                </Text>
              </View>
            )}
          </View>

          {event.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{event.description}</Text>
            </View>
          )}

          {(event.petFriendly || event.smokeFree || event.wheelchairAccessible) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Environment</Text>
              <View style={styles.environmentTags}>
                {event.petFriendly && (
                  <View style={styles.envTag}>
                    <Ionicons name="paw" size={16} color="hsl(210, 95%, 55%)" />
                    <Text style={styles.envTagText}>Pet Friendly</Text>
                  </View>
                )}
                {event.smokeFree && (
                  <View style={styles.envTag}>
                    <Ionicons name="ban" size={16} color="hsl(210, 95%, 55%)" />
                    <Text style={styles.envTagText}>Smoke Free</Text>
                  </View>
                )}
                {event.wheelchairAccessible && (
                  <View style={styles.envTag}>
                    <Ionicons name="accessibility" size={16} color="hsl(210, 95%, 55%)" />
                    <Text style={styles.envTagText}>Wheelchair Accessible</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {event.rsvpDeadline && (
            <View style={styles.deadlineWarning}>
              <Ionicons name="time-outline" size={18} color="#e67e22" />
              <Text style={styles.deadlineText}>
                RSVP by {formatDate(event.rsvpDeadline)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {!isEventCreator && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.rsvpButton,
              isRsvpd && styles.cancelButton,
              isFull && !isRsvpd && styles.disabledButton,
            ]}
            onPress={handleRsvp}
            disabled={isRsvping || (isFull && !isRsvpd)}
          >
            {isRsvping ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={isRsvpd ? 'close-circle' : 'checkmark-circle'}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.rsvpButtonText}>
                  {isRsvpd ? 'Cancel RSVP' : isFull ? 'Event Full' : 'RSVP - Going'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

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
    backgroundColor: '#fff',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverImage: {
    width: '100%',
    height: 250,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  visibilityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  visibilityText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'hsl(210, 95%, 45%)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
  },
  dateTimeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  dateBox: {
    width: 60,
    backgroundColor: 'hsl(210, 95%, 55%)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  dateDay: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  dateTimeInfo: {
    flex: 1,
  },
  fullDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    color: '#666',
  },
  locationSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  fullText: {
    color: '#e74c3c',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },
  environmentTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  envTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  envTagText: {
    fontSize: 13,
    color: 'hsl(210, 95%, 45%)',
    fontWeight: '500',
  },
  deadlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3cd',
    padding: 12,
    borderRadius: 10,
  },
  deadlineText: {
    fontSize: 13,
    color: '#856404',
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  rsvpButton: {
    backgroundColor: 'hsl(142, 71%, 45%)',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#dc2626',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  rsvpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
