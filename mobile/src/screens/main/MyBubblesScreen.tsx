import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
  Switch,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../services/api.service';

type Bubble = {
  id: string;
  title: string;
  tagline: string;
  category: string;
  members: number;
  coverImage: string | null;
  distance: string | null;
  creatorId?: string;
};

type Event = {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  locationName: string | null;
  creatorId: string;
  bubbleId: string;
  bubble?: {
    id: string;
    title: string;
  };
};

export default function MyBubblesScreen() {
  const [activeTab, setActiveTab] = useState<'bubbles' | 'events'>('bubbles');
  const [showAdminOnly, setShowAdminOnly] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [createdBubbles, setCreatedBubbles] = useState<Bubble[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [createdEvents, setCreatedEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();

  const fetchData = async () => {
    try {
      console.log('[MyBubbles] Starting fetchData...');
      
      // Fetch each API separately to identify which one fails
      let bubblesData = [];
      let createdBubblesData = [];
      let eventsData = [];
      let createdEventsData = [];
      
      try {
        console.log('[MyBubbles] Fetching getMyBubbles...');
        bubblesData = await apiService.getMyBubbles() as Bubble[];
        console.log('[MyBubbles] getMyBubbles success:', bubblesData);
      } catch (err) {
        console.error('[MyBubbles] getMyBubbles FAILED:', err);
      }
      
      try {
        console.log('[MyBubbles] Fetching getMyCreatedBubbles...');
        createdBubblesData = await apiService.getMyCreatedBubbles() as Bubble[];
        console.log('[MyBubbles] getMyCreatedBubbles success:', createdBubblesData);
      } catch (err) {
        console.error('[MyBubbles] getMyCreatedBubbles FAILED:', err);
      }
      
      try {
        console.log('[MyBubbles] Fetching getMyEvents...');
        eventsData = await apiService.getMyEvents() as Event[];
        console.log('[MyBubbles] getMyEvents success:', eventsData);
      } catch (err) {
        console.error('[MyBubbles] getMyEvents FAILED:', err);
      }
      
      try {
        console.log('[MyBubbles] Fetching getMyCreatedEvents...');
        createdEventsData = await apiService.getMyCreatedEvents() as Event[];
        console.log('[MyBubbles] getMyCreatedEvents success:', createdEventsData);
      } catch (err) {
        console.error('[MyBubbles] getMyCreatedEvents FAILED:', err);
      }
      
      setBubbles(bubblesData);
      setCreatedBubbles(createdBubblesData);
      setEvents(eventsData);
      setCreatedEvents(createdEventsData);
      console.log('[MyBubbles] fetchData complete');
    } catch (error) {
      console.error('[MyBubbles] Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleBubblePress = (bubble: Bubble) => {
    navigation.navigate('Explore', {
      screen: 'BubbleDetails',
      params: {
        bubble: {
          id: bubble.id,
          title: bubble.title,
          tagline: bubble.tagline,
          category: bubble.category,
          members: bubble.members,
          image: bubble.coverImage,
          distance: bubble.distance,
        },
      },
    });
  };

  const handleEventPress = (event: Event) => {
    navigation.navigate('Explore', {
      screen: 'EventDetails',
      params: { eventId: event.id, event },
    });
  };

  const handleCreateBubble = () => {
    navigation.navigate('CreateBubble' as never);
  };

  const handleCreateEvent = () => {
    navigation.navigate('CreateEvent' as never);
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

  const displayBubbles = showAdminOnly ? createdBubbles : bubbles;
  const displayEvents = showAdminOnly ? createdEvents : events;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="hsl(210, 95%, 55%)" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bubbles</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bubbles' && styles.activeTab]}
          onPress={() => setActiveTab('bubbles')}
        >
          <Text style={[styles.tabText, activeTab === 'bubbles' && styles.activeTabText]}>
            Bubbles
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'events' && styles.activeTab]}
          onPress={() => setActiveTab('events')}
        >
          <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
            Events
          </Text>
        </TouchableOpacity>
      </View>

      {/* <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Show only ones I created (Admin)</Text>
        <Switch
          value={showAdminOnly}
          onValueChange={setShowAdminOnly}
          trackColor={{ false: '#ddd', true: 'hsl(210, 95%, 75%)' }}
          thumbColor={showAdminOnly ? 'hsl(210, 95%, 55%)' : '#f4f3f4'}
        />
      </View> */}

      {activeTab === 'bubbles' ? (
        <>
          {displayBubbles.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {showAdminOnly ? 'No bubbles created yet' : 'No bubbles yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {showAdminOnly
                  ? 'Create your first bubble to get started!'
                  : 'Join some bubbles from the Explore tab or create your own!'}
              </Text>
              <TouchableOpacity style={styles.createFirstButton} onPress={handleCreateBubble}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.createFirstButtonText}>Create a Bubble</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              <Text style={styles.listCount}>
                {displayBubbles.length} {showAdminOnly ? 'created' : 'joined'}
              </Text>
              {displayBubbles.map((bubble) => (
                <TouchableOpacity
                  key={bubble.id}
                  style={styles.card}
                  onPress={() => handleBubblePress(bubble)}
                >
                  <Image
                    source={{
                      uri: bubble.coverImage || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400',
                    }}
                    style={styles.cardImage}
                  />
                  <View style={styles.cardContent}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryText}>{bubble.category}</Text>
                    </View>
                    <Text style={styles.cardTitle}>{bubble.title}</Text>
                    <Text style={styles.cardTagline}>{bubble.tagline}</Text>
                    <View style={styles.cardMeta}>
                      <Text style={styles.memberCount}>{bubble.members} members</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      ) : (
        <>
          {displayEvents.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {showAdminOnly ? 'No events created yet' : 'No events yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {showAdminOnly
                  ? 'Create your first event to get started!'
                  : 'RSVP to events in your bubbles or create your own!'}
              </Text>
              <TouchableOpacity style={styles.createFirstButton} onPress={handleCreateEvent}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.createFirstButtonText}>Create an Event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            >
              <Text style={styles.listCount}>
                {displayEvents.length} {showAdminOnly ? 'created' : 'attending'}
              </Text>
              {displayEvents.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventCard}
                  onPress={() => handleEventPress(event)}
                >
                  <View style={styles.eventDate}>
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
                  <View style={styles.eventContent}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                    <View style={styles.eventMeta}>
                      <Ionicons name="time-outline" size={12} color="#666" />
                      <Text style={styles.eventMetaText}>
                        {formatTime(event.startTime)}
                        {event.endTime ? ` - ${formatTime(event.endTime)}` : ''}
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
                    {event.bubble && (
                      <View style={styles.eventBubble}>
                        <Ionicons name="people-outline" size={12} color="hsl(210, 95%, 55%)" />
                        <Text style={styles.eventBubbleText}>{event.bubble.title}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={activeTab === 'bubbles' ? handleCreateBubble : handleCreateEvent}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#e8e8e8',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: 'hsl(210, 95%, 55%)',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterLabel: {
    fontSize: 14,
    color: '#666',
  },
  listCount: {
    fontSize: 13,
    color: 'hsl(210, 95%, 55%)',
    fontWeight: '600',
    marginBottom: 8,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    padding: 16,
    gap: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 120,
  },
  cardContent: {
    padding: 16,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'hsl(210, 95%, 45%)',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  cardTagline: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 12,
    color: '#888',
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventDate: {
    width: 60,
    backgroundColor: 'hsl(210, 95%, 55%)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  eventDateDay: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  eventDateMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  eventImage: {
    width: 80,
    height: 100,
  },
  eventContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 15,
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
    fontSize: 12,
    color: '#666',
  },
  eventBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  eventBubbleText: {
    fontSize: 12,
    color: 'hsl(210, 95%, 55%)',
    fontWeight: '500',
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'hsl(210, 95%, 55%)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
    gap: 8,
  },
  createFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'hsl(210, 95%, 55%)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
