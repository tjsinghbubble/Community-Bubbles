import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList, BubbleData } from '../../navigation/ExploreNavigator';
import { API_URL } from '../../config/api';

type NavigationProp = NativeStackNavigationProp<ExploreStackParamList, 'ExploreList'>;

type EventData = {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  locationName: string | null;
  visibility: string;
  bubble: {
    id: string;
    title: string;
    category: string;
  };
};

export default function ExploreScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [activeTab, setActiveTab] = useState<'bubbles' | 'events'>('bubbles');
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const [bubblesResponse, eventsResponse] = await Promise.all([
        fetch(`${API_URL}/api/bubbles`),
        fetch(`${API_URL}/api/events`),
      ]);
      
      const bubblesData = await bubblesResponse.json();
      const eventsData = await eventsResponse.json();
      
      // Transform bubbles
      const transformedBubbles: BubbleData[] = bubblesData.map((bubble: any) => ({
        id: bubble.id,
        title: bubble.title,
        tagline: bubble.tagline,
        category: bubble.category,
        description: bubble.description,
        members: bubble.members || 0,
        image: bubble.coverImage || 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400',
        distance: '~',
      }));
      
      setBubbles(transformedBubbles);
      setEvents(eventsData || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
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

  const handleBubblePress = (bubble: BubbleData) => {
    navigation.navigate('BubbleDetails', { bubble });
  };

  const handleEventPress = (event: EventData) => {
    navigation.navigate('EventDetails', { eventId: event.id });
  };

  const handleFilterPress = () => {
    Alert.alert('Coming Soon', 'Filter functionality is coming soon!');
  };

  const handleNotificationPress = () => {
    Alert.alert('Coming Soon', 'Notifications are coming soon!');
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Filter bubbles and events based on search query
  const filteredBubbles = bubbles.filter((bubble) => {
    const query = searchQuery.toLowerCase();
    return (
      bubble.title.toLowerCase().includes(query) ||
      bubble.category.toLowerCase().includes(query) ||
      (bubble.tagline && bubble.tagline.toLowerCase().includes(query))
    );
  });

  const filteredEvents = events.filter((event) => {
    const query = searchQuery.toLowerCase();
    return (
      event.title.toLowerCase().includes(query) ||
      event.bubble.category.toLowerCase().includes(query) ||
      (event.description && event.description.toLowerCase().includes(query))
    );
  });

  const renderSearchHeader = () => (
    <View style={styles.searchContainer}>
      <TouchableOpacity style={styles.iconButton} onPress={handleFilterPress}>
        <Ionicons name="options-outline" size={24} color="#333" />
      </TouchableOpacity>
      
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Start your search"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>
      
      <TouchableOpacity style={styles.iconButton} onPress={handleNotificationPress}>
        <Ionicons name="notifications-outline" size={24} color="#333" />
      </TouchableOpacity>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'bubbles' && styles.activeTab]}
        onPress={() => setActiveTab('bubbles')}
      >
        <View style={styles.tabIconContainer}>
          <Ionicons 
            name="chatbubbles-outline" 
            size={28} 
            color={activeTab === 'bubbles' ? 'hsl(210, 95%, 55%)' : '#999'} 
          />
        </View>
        <Text style={[styles.tabText, activeTab === 'bubbles' && styles.activeTabText]}>
          Bubbles
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, activeTab === 'events' && styles.activeTab]}
        onPress={() => setActiveTab('events')}
      >
        <View style={styles.tabIconContainer}>
          <Ionicons 
            name="calendar-outline" 
            size={28} 
            color={activeTab === 'events' ? 'hsl(210, 95%, 55%)' : '#999'} 
          />
        </View>
        <Text style={[styles.tabText, activeTab === 'events' && styles.activeTabText]}>
          Events
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderBubbleCard = (bubble: BubbleData) => (
    <TouchableOpacity 
      key={bubble.id} 
      style={styles.card}
      onPress={() => handleBubblePress(bubble)}
    >
      <Image source={{ uri: bubble.image }} style={styles.image} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{bubble.category}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{bubble.title}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="people-outline" size={12} color="#666" />
          <Text style={styles.metaText}>{bubble.members} members</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEventCard = (event: EventData) => (
    <TouchableOpacity 
      key={event.id} 
      style={styles.card}
      onPress={() => handleEventPress(event)}
    >
      <Image 
        source={{ uri: event.coverImage || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400' }} 
        style={styles.image} 
      />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{event.bubble.category}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="time-outline" size={12} color="#666" />
          <Text style={styles.metaText}>{formatTime(event.startTime)}</Text>
        </View>
        {event.locationName && (
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={12} color="#666" />
            <Text style={styles.metaText} numberOfLines={1}>{event.locationName}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderSearchHeader()}
        {renderTabs()}
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="hsl(210, 95%, 55%)" />
        </View>
      </SafeAreaView>
    );
  }

  const currentData = activeTab === 'bubbles' ? filteredBubbles : filteredEvents;
  const isEmpty = currentData.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      {renderSearchHeader()}
      {renderTabs()}
      
      {isEmpty ? (
        <ScrollView
          contentContainerStyle={styles.empty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Ionicons 
            name={activeTab === 'bubbles' ? 'chatbubbles-outline' : 'calendar-outline'} 
            size={48} 
            color="#ccc" 
          />
          <Text style={styles.emptyTitle}>
            {searchQuery 
              ? `No ${activeTab} found` 
              : `No ${activeTab} yet`
            }
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery 
              ? `Try a different search term`
              : activeTab === 'bubbles' 
                ? 'Be the first to create a bubble in your area!'
                : 'Check back later for upcoming events!'
            }
          </Text>
        </ScrollView>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {activeTab === 'bubbles' 
            ? filteredBubbles.map(renderBubbleCard)
            : filteredEvents.map(renderEventCard)
          }
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 40,
  },
  tab: {
    alignItems: 'center',
    opacity: 0.6,
  },
  activeTab: {
    opacity: 1,
  },
  tabIconContainer: {
    marginBottom: 4,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 300,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  grid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 120,
    backgroundColor: '#e0e0e0',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'hsl(210, 95%, 45%)',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
});
