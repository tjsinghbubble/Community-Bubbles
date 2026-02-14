import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList, BubbleData } from '../../navigation/ExploreNavigator';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';

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

const SCROLL_THRESHOLD = 60;

export default function ExploreScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, token, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'bubbles' | 'events'>('bubbles');
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [campusBubbles, setCampusBubbles] = useState<BubbleData[]>([]);
  const [campusEvents, setCampusEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStudentPrompt, setShowStudentPrompt] = useState(true);
  const [campusInfo, setCampusInfo] = useState<{ name: string } | null>(null);
  const [showCampusContent, setShowCampusContent] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  const isCampusVerified = user?.campusVerified === true;
  const hasDismissedPrompt = user?.dismissedCampusPrompt === true;

  const fetchData = async () => {
    try {
      const [bubblesResponse, eventsResponse] = await Promise.all([
        fetch(`${API_URL}/api/bubbles`),
        fetch(`${API_URL}/api/events`),
      ]);
      
      const bubblesData = await bubblesResponse.json();
      const eventsData = await eventsResponse.json();
      
      const publicBubbles = bubblesData.filter((b: any) => !b.campusId);
      const transformedBubbles: BubbleData[] = publicBubbles.map((bubble: any) => ({
        id: bubble.id,
        title: bubble.title,
        tagline: bubble.tagline,
        category: bubble.category,
        description: bubble.description,
        members: bubble.members || 0,
        image: bubble.coverImage || 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400',
        distance: '~',
      }));
      
      const publicEvents = eventsData.filter((e: any) => !e.campusId);
      
      setBubbles(transformedBubbles);
      setEvents(publicEvents || []);
      
      if (isCampusVerified && token) {
        apiService.setToken(token);
        try {
          const [campusBubblesData, campusEventsData, myCampus] = await Promise.all([
            apiService.getCampusBubbles(),
            apiService.getCampusEvents(),
            apiService.getMyCampus(),
          ]);
          
          const transformedCampusBubbles: BubbleData[] = campusBubblesData.map((bubble: any) => ({
            id: bubble.id,
            title: bubble.title,
            tagline: bubble.tagline,
            category: bubble.category,
            description: bubble.description,
            members: bubble.members || 0,
            image: bubble.coverImage || 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400',
            distance: '~',
          }));
          
          setCampusBubbles(transformedCampusBubbles);
          setCampusEvents(campusEventsData || []);
          if (myCampus.campus) {
            setCampusInfo({ name: myCampus.campus.name });
          }
        } catch (error) {
          console.error('Failed to fetch campus data:', error);
        }
      }
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
      if (refreshUser) refreshUser();
    }, [isCampusVerified])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleJoinCampus = () => {
    navigation.navigate('CampusJoin');
  };

  const handleDismissPrompt = async () => {
    setShowStudentPrompt(false);
    if (token) {
      apiService.setToken(token);
      try {
        await apiService.dismissCampusPrompt();
        if (refreshUser) await refreshUser();
      } catch (error) {
        console.error('Failed to dismiss prompt:', error);
      }
    }
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

  const displayBubbles = showCampusContent ? campusBubbles : bubbles;
  const displayEvents = showCampusContent ? campusEvents : events;

  const filteredBubbles = displayBubbles.filter((bubble) => {
    const query = searchQuery.toLowerCase();
    return (
      bubble.title.toLowerCase().includes(query) ||
      bubble.category.toLowerCase().includes(query) ||
      (bubble.tagline && bubble.tagline.toLowerCase().includes(query))
    );
  });

  const filteredEvents = displayEvents.filter((event) => {
    const query = searchQuery.toLowerCase();
    return (
      event.title.toLowerCase().includes(query) ||
      event.bubble.category.toLowerCase().includes(query) ||
      (event.description && event.description.toLowerCase().includes(query))
    );
  });

  const iconOpacity = scrollY.interpolate({
    inputRange: [0, SCROLL_THRESHOLD],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const iconHeight = scrollY.interpolate({
    inputRange: [0, SCROLL_THRESHOLD],
    outputRange: [32, 0],
    extrapolate: 'clamp',
  });

  const underlineOpacity = scrollY.interpolate({
    inputRange: [0, SCROLL_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const tabPaddingVertical = scrollY.interpolate({
    inputRange: [0, SCROLL_THRESHOLD],
    outputRange: [12, 6],
    extrapolate: 'clamp',
  });

  const HEADER_EXPANDED = 56 + 60;
  const HEADER_COLLAPSED = 56 + 30;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, SCROLL_THRESHOLD],
    outputRange: [HEADER_EXPANDED, HEADER_COLLAPSED],
    extrapolate: 'clamp',
  });

  const renderSearchHeader = () => (
    <View style={styles.searchContainer}>
      <TouchableOpacity style={styles.iconButton} onPress={handleFilterPress}>
        <Ionicons name="options-outline" size={24} color={Colors.neutral.charcoal} />
      </TouchableOpacity>
      
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={Colors.neutral.coolMist} />
        <TextInput
          style={styles.searchInput}
          placeholder="Start your search"
          placeholderTextColor={Colors.neutral.coolMist}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={Colors.neutral.coolMist} />
          </TouchableOpacity>
        )}
      </View>
      
      <TouchableOpacity style={styles.iconButton} onPress={handleNotificationPress}>
        <Ionicons name="notifications-outline" size={24} color={Colors.neutral.charcoal} />
      </TouchableOpacity>
    </View>
  );

  const renderStudentPromptCard = () => {
    if (isCampusVerified || hasDismissedPrompt || !showStudentPrompt) return null;
    
    return (
      <View style={styles.studentPromptCard}>
        <Text style={styles.studentPromptTitle}>Are you a student?</Text>
        <Text style={styles.studentPromptSubtitle}>
          Unlock exclusive campus events, verified student communities, and connect with classmates
        </Text>
        <TouchableOpacity onPress={handleJoinCampus}>
          <LinearGradient
            colors={Gradients.button.colors as [string, string]}
            start={Gradients.button.start}
            end={Gradients.button.end}
            style={styles.joinCampusButton}
          >
            <Text style={styles.joinCampusButtonText}>Join a campus</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.notStudentButton} onPress={handleDismissPrompt}>
          <Text style={styles.notStudentButtonText}>I'm not a student</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTabs = () => (
    <Animated.View style={[styles.tabsContainer, { paddingVertical: tabPaddingVertical }]}>
      <TouchableOpacity
        style={[styles.tab]}
        onPress={() => setActiveTab('bubbles')}
      >
        <Animated.View style={[styles.tabIconContainer, { opacity: iconOpacity, height: iconHeight, overflow: 'hidden' }]}>
          <Ionicons 
            name="chatbubbles-outline" 
            size={28} 
            color={activeTab === 'bubbles' ? Colors.brand.bubbleBlue : Colors.neutral.coolMist} 
          />
        </Animated.View>
        <Text style={[
          styles.tabText,
          activeTab === 'bubbles' && styles.activeTabText,
        ]}>
          Bubbles
        </Text>
        <Animated.View style={[
          styles.tabUnderline,
          {
            opacity: underlineOpacity,
            backgroundColor: activeTab === 'bubbles' ? Colors.brand.bubbleBlue : 'transparent',
          },
        ]} />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab]}
        onPress={() => setActiveTab('events')}
      >
        <Animated.View style={[styles.tabIconContainer, { opacity: iconOpacity, height: iconHeight, overflow: 'hidden' }]}>
          <Ionicons 
            name="calendar-outline" 
            size={28} 
            color={activeTab === 'events' ? Colors.brand.bubbleBlue : Colors.neutral.coolMist} 
          />
        </Animated.View>
        <Text style={[
          styles.tabText,
          activeTab === 'events' && styles.activeTabText,
        ]}>
          Events
        </Text>
        <Animated.View style={[
          styles.tabUnderline,
          {
            opacity: underlineOpacity,
            backgroundColor: activeTab === 'events' ? Colors.brand.bubbleBlue : 'transparent',
          },
        ]} />
      </TouchableOpacity>
    </Animated.View>
  );

  const handleCampusToggle = () => {
    setShowCampusContent(!showCampusContent);
  };

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
          <Ionicons name="people-outline" size={12} color={Colors.neutral.coolMist} />
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
          <Ionicons name="time-outline" size={12} color={Colors.neutral.coolMist} />
          <Text style={styles.metaText}>{formatTime(event.startTime)}</Text>
        </View>
        {event.locationName && (
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={12} color={Colors.neutral.coolMist} />
            <Text style={styles.metaText} numberOfLines={1}>{event.locationName}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );


  if (isLoading) {
    return (
      <View style={[styles.outerContainer, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : insets.top }]}>
        <View style={[styles.overlayHeader, { height: HEADER_EXPANDED }]}>
          {renderSearchHeader()}
          {renderTabs()}
        </View>
        <View style={[styles.loading, { paddingTop: HEADER_EXPANDED }]}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      </View>
    );
  }

  const currentData = activeTab === 'bubbles' ? filteredBubbles : filteredEvents;
  const isEmpty = currentData.length === 0;

  const getEmptyMessage = () => {
    if (searchQuery) {
      return { title: `No ${activeTab} found`, subtitle: 'Try a different search term' };
    }
    if (showCampusContent) {
      return { 
        title: `No campus ${activeTab} yet`, 
        subtitle: `Be the first to create ${activeTab === 'bubbles' ? 'a bubble' : 'an event'} for your campus!` 
      };
    }
    return {
      title: `No ${activeTab} yet`,
      subtitle: activeTab === 'bubbles' 
        ? 'Be the first to create a bubble in your area!'
        : 'Check back later for upcoming events!'
    };
  };

  return (
    <View style={[styles.outerContainer, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : insets.top }]}>
      <Animated.View style={[styles.overlayHeader, { height: headerHeight }]}>
        {renderSearchHeader()}
        {renderTabs()}
      </Animated.View>

      {isEmpty ? (
        <Animated.ScrollView
          contentContainerStyle={[styles.empty, { paddingTop: HEADER_EXPANDED + 20 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          {showCampusContent && campusInfo && (
            <View style={styles.campusBannerInline}>
              <Text style={{ fontSize: 16 }}>🎓</Text>
              <Text style={styles.campusBannerText}>{campusInfo.name}</Text>
            </View>
          )}
          {!showCampusContent && renderStudentPromptCard()}
          <Ionicons 
            name={activeTab === 'bubbles' ? 'chatbubbles-outline' : 'calendar-outline'} 
            size={48} 
            color={Colors.neutral.coolMist} 
          />
          <Text style={styles.emptyTitle}>{getEmptyMessage().title}</Text>
          <Text style={styles.emptySubtitle}>{getEmptyMessage().subtitle}</Text>
        </Animated.ScrollView>
      ) : (
        <Animated.ScrollView 
          contentContainerStyle={[styles.grid, { paddingTop: HEADER_EXPANDED + 16 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          {showCampusContent && campusInfo && (
            <View style={styles.campusBannerInline}>
              <Text style={{ fontSize: 16 }}>🎓</Text>
              <Text style={styles.campusBannerText}>{campusInfo.name}</Text>
            </View>
          )}
          {!showCampusContent && renderStudentPromptCard()}
          {activeTab === 'bubbles' 
            ? filteredBubbles.map(renderBubbleCard)
            : filteredEvents.map(renderEventCard)
          }
        </Animated.ScrollView>
      )}
      
      {isCampusVerified && (
        <TouchableOpacity 
          style={[styles.campusFab, showCampusContent && styles.campusFabActive]} 
          onPress={handleCampusToggle}
        >
          <Text style={{ fontSize: 24 }}>🎓</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.createFab}
        onPress={() => setShowCreateSheet(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle" size={56} color={Colors.brand.bubbleBlue} />
      </TouchableOpacity>

      <Modal
        visible={showCreateSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateSheet(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setShowCreateSheet(false)}>
          <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Create New</Text>
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => {
                setShowCreateSheet(false);
                navigation.navigate('CreateBubble');
              }}
            >
              <Text style={styles.sheetOptionText}>Bubble</Text>
            </TouchableOpacity>
            <View style={styles.sheetDivider} />
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => {
                setShowCreateSheet(false);
                navigation.navigate('CreateEvent', {});
              }}
            >
              <Text style={styles.sheetOptionText}>Event</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: Colors.neutral.cloudGrey,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.neutral.cloudGrey,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  overlayHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: Colors.neutral.cloudGrey,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    shadowColor: Colors.neutral.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutral.charcoal,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    alignItems: 'center',
  },
  activeTab: {
    opacity: 1,
  },
  tabIconContainer: {
    marginBottom: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral.coolMist,
  },
  activeTabText: {
    color: Colors.neutral.charcoal,
    fontWeight: '600',
  },
  tabUnderline: {
    height: 2,
    width: '100%',
    marginTop: 4,
    borderRadius: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 300,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
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
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: Colors.neutral.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 120,
    backgroundColor: Colors.neutral.coolMist,
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
    color: Colors.brand.bubbleBlue,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
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
    color: Colors.neutral.coolMist,
    flex: 1,
  },
  studentPromptCard: {
    width: '100%',
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.neutral.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  studentPromptTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
    marginBottom: 8,
  },
  studentPromptSubtitle: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  joinCampusButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  joinCampusButtonText: {
    color: Colors.neutral.charcoal,
    fontSize: 16,
    fontWeight: '600',
  },
  notStudentButton: {
    paddingVertical: 8,
  },
  notStudentButtonText: {
    color: Colors.neutral.coolMist,
    fontSize: 14,
  },
  campusContent: {
    padding: 16,
  },
  campusHeader: {
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: Colors.neutral.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  campusName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
    marginTop: 12,
    textAlign: 'center',
  },
  campusSubtitle: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    marginTop: 4,
  },
  campusSection: {
    marginBottom: 24,
  },
  campusSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    marginBottom: 12,
  },
  campusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  campusEmpty: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  campusFab: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.brand.skyWhite,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.neutral.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: Colors.neutral.coolMist,
  },
  campusFabActive: {
    backgroundColor: Colors.brand.bubbleBlue,
    borderColor: Colors.brand.bubbleBlue,
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
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.brand.skyWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.neutral.coolMist,
    marginTop: 12,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
    marginBottom: 8,
  },
  sheetOption: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
  },
  sheetOptionText: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.brand.bubbleBlue,
  },
  sheetDivider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.neutral.coolMist,
  },
  campusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'hsl(210, 95%, 85%)',
  },
  campusBannerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'hsl(210, 95%, 95%)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
    borderRadius: 12,
    width: '100%',
    marginBottom: 12,
  },
  campusBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.brand.bubbleBlue,
  },
});
