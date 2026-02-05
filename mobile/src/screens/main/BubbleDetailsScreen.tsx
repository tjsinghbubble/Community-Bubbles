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
  const { user } = useAuth();
  const [isJoining, setIsJoining] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [bubbleDetails, setBubbleDetails] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalConfig, setSuccessModalConfig] = useState({ title: '', subtitle: '' });

  useEffect(() => {
    checkMembership();
    fetchBubbleDetails();
  }, [bubble.id]);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [bubble.id])
  );

  const fetchBubbleDetails = async () => {
    try {
      const details = await apiService.getBubble(bubble.id);
      setBubbleDetails(details);
      
      // Track bubble visit
      apiService.trackBubbleVisit(bubble.id).catch(() => {});
    } catch (error) {
      console.error('Failed to fetch bubble details:', error);
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
    navigation.navigate('EventDetails' as any, { eventId: event.id, event });
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
  const canCreateEvent = !!user; // Any logged-in user can propose events

  const handleViewMembers = () => {
    navigation.navigate('BubbleMembers' as any, { 
      bubbleId: bubble.id, 
      bubbleTitle: bubble.title 
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
                subtitle: 'The bubble has been successfully deleted' 
              });
              setShowSuccessModal(true);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete bubble');
            }
          }
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <ImageCarousel
          images={bubbleDetails?.images || (bubble.image ? [bubble.image] : [])}
          height={200}
          fallbackImage="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800"
        />
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
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
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{bubble.category}</Text>
          </View>
          
          <Text style={styles.title}>{bubble.title}</Text>
          <Text style={styles.description}>
            {bubble.description || 'Join us to connect with amazing people in your area who share your interests!'}
          </Text>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              {canCreateEvent && (
                <TouchableOpacity
                  style={styles.createEventButton}
                  onPress={() => navigation.navigate('CreateEvent', { bubbleId: bubble.id, bubbleTitle: bubble.title })}
                >
                  <Ionicons name="add" size={22} color="hsl(210, 95%, 55%)" />
                </TouchableOpacity>
              )}
            </View>

            {eventsLoading ? (
              <ActivityIndicator size="small" color="hsl(210, 95%, 55%)" />
            ) : events.length === 0 ? (
              <View style={styles.noEvents}>
                <Ionicons name="calendar-outline" size={32} color="#ccc" />
                <Text style={styles.noEventsText}>No upcoming events</Text>
                {isCreator && (
                  <Text style={styles.noEventsSubtext}>Create the first event for this bubble!</Text>
                )}
              </View>
            ) : (
              <View style={styles.eventsList}>
                {events.slice(0, 2).map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.eventCard}
                    onPress={() => handleEventPress(event)}
                  >
                    <View style={styles.eventDateBox}>
                      <Text style={styles.eventDateDay}>
                        {new Date(event.date + 'T00:00:00').getDate()}
                      </Text>
                      <Text style={styles.eventDateMonth}>
                        {new Date(event.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                      </Text>
                    </View>
                    <Image
                      source={{
                        uri: event.coverImage || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400',
                      }}
                      style={styles.eventImage}
                    />
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                      <View style={styles.eventMeta}>
                        <Ionicons name="time-outline" size={12} color="#666" />
                        <Text style={styles.eventMetaText}>
                          {formatTime(event.startTime)}
                        </Text>
                      </View>
                      {event.locationName && (
                        <View style={styles.eventMeta}>
                          <Ionicons name="location-outline" size={12} color="#666" />
                          <Text style={styles.eventMetaText} numberOfLines={1}>
                            {event.locationName}
                          </Text>
                        </View>
                      )}
                      {event.attendeeLimit && (
                        <View style={styles.eventMeta}>
                          <Ionicons name="people-outline" size={12} color="#666" />
                          <Text style={styles.eventMetaText}>
                            Max {event.attendeeLimit}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" style={styles.eventChevron} />
                  </TouchableOpacity>
                ))}
                {events.length > 2 && (
                  <TouchableOpacity 
                    style={styles.viewAllButton}
                    onPress={() => navigation.navigate('BubbleEvents' as any, { bubbleId: bubble.id, bubbleTitle: bubble.title })}
                  >
                    <Text style={styles.viewAllText}>Show all {events.length} events</Text>
                    <Ionicons name="arrow-forward" size={16} color="hsl(210, 95%, 55%)" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Members ({bubble.members || 0})</Text>
              {canManage && (
                <TouchableOpacity style={styles.showAllLink} onPress={handleViewMembers}>
                  <Text style={styles.showAllLinkText}>Show all</Text>
                  <Ionicons name="arrow-forward" size={14} color="hsl(210, 95%, 55%)" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.adminsList}>
              <View style={styles.adminRow}>
                <View style={styles.adminAvatar}>
                  <Ionicons name="person" size={20} color="#fff" />
                </View>
                <View style={styles.adminInfo}>
                  <Text style={styles.adminName}>Bubble Creator</Text>
                  <Text style={styles.adminRole}>Admin</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Community Guidelines</Text>
            <View style={styles.rules}>
              <Text style={styles.rule}>• Be respectful to all members</Text>
              <Text style={styles.rule}>• No spam or self-promotion</Text>
              <Text style={styles.rule}>• Keep discussions on topic</Text>
              <Text style={styles.rule}>• Have fun and make connections!</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, isMember && styles.fabLeave]}
        onPress={handleJoinLeave}
        disabled={isJoining}
      >
        {isJoining ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons 
              name={isMember ? "exit-outline" : "add"} 
              size={22} 
              color="#fff" 
            />
            <Text style={styles.fabText}>
              {isMember ? 'Leave' : 'Join'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <SuccessModal
        visible={showSuccessModal}
        title={successModalConfig.title}
        subtitle={successModalConfig.subtitle}
        onClose={() => setShowSuccessModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    paddingBottom: 80,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'hsl(210, 95%, 45%)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  createEventButton: {
    padding: 4,
  },
  description: {
    fontSize: 15,
    color: '#444',
    marginBottom: 24,
    lineHeight: 24,
  },
  noEvents: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  noEventsText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  noEventsSubtext: {
    fontSize: 12,
    color: '#bbb',
    marginTop: 4,
  },
  eventsList: {
    gap: 12,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    overflow: 'hidden',
  },
  eventDateBox: {
    width: 50,
    backgroundColor: 'hsl(210, 95%, 55%)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  eventDateDay: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  eventDateMonth: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  eventImage: {
    width: 60,
    height: 70,
  },
  eventInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  eventMetaText: {
    fontSize: 11,
    color: '#666',
  },
  eventChevron: {
    marginRight: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: 'hsl(210, 95%, 55%)',
    fontWeight: '600',
  },
  rules: {
    gap: 8,
  },
  rule: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  showAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  showAllLinkText: {
    fontSize: 14,
    color: 'hsl(210, 95%, 55%)',
    fontWeight: '500',
  },
  adminsList: {
    gap: 12,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
  },
  adminAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'hsl(210, 95%, 55%)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminInfo: {
    marginLeft: 12,
  },
  adminName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  adminRole: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: 'hsl(210, 95%, 55%)',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabLeave: {
    backgroundColor: '#dc2626',
  },
  fabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
