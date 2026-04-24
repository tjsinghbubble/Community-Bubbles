import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { CreateBubbleEventIcon, BubblesIcon } from '../../components/icons';
import { ExploreGridSkeleton } from '../../components/SkeletonLoader';
import AnimatedPressable from '../../components/AnimatedPressable';
import { ExploreStackParamList, BubbleData } from '../../navigation/ExploreNavigator';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { Colors, Spacing, Radius, Typography, Gradients, NotificationBadge, CardShadow } from '../../styles/theme';
import { PeopleIcon, ClockIcon } from '../../components/icons';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStudentPrompt, setShowStudentPrompt] = useState(true);
  const [campusInfo, setCampusInfo] = useState<{ name: string } | null>(null);
  const [showCampusContent, setShowCampusContent] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

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
      
      const transformedBubbles: BubbleData[] = bubblesData.map((bubble: any) => ({
        id: bubble.id,
        title: bubble.title,
        tagline: bubble.tagline,
        category: bubble.category,
        description: bubble.description,
        members: bubble.members || 0,
        image: bubble.coverImage || 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400',
        distance: '~',
        campusId: bubble.campusId || null,
      }));
      
      if (isMountedRef.current) {
        setBubbles(transformedBubbles);
        setEvents(eventsData || []);
      }

      if (isCampusVerified && token) {
        apiService.setToken(token);
        try {
          const myCampus = await apiService.getMyCampus();
          if (isMountedRef.current && myCampus.campus) {
            setCampusInfo({ name: myCampus.campus.name });
          }
        } catch (error) {
          console.error('Failed to fetch campus data:', error);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setRefreshing(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
      if (refreshUser) refreshUser();
      apiService.getUnreadNotificationCount().then(r => setUnreadNotifCount(r.count)).catch(() => {});
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
    navigation.navigate('Notifications');
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const displayBubbles = showCampusContent ? bubbles.filter(b => b.campusId) : bubbles;
  const displayEvents = showCampusContent ? events.filter((e: any) => e.campusId) : events;

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
    outputRange: [10, 4],
    extrapolate: 'clamp',
  });

  const HEADER_EXPANDED = 89 + 60;
  const HEADER_COLLAPSED = 89 + 32;

  const renderSearchHeader = () => (
    <View style={styles.searchContainer}>
      {isCampusVerified && (
        <TouchableOpacity 
          style={[styles.campusHatButton, showCampusContent && styles.campusHatButtonActive]} 
          onPress={handleCampusToggle}
        >
          <Ionicons name="school-outline" size={22} color={showCampusContent ? Colors.brand.bubbleBlue : Colors.neutral.charcoal} />
        </TouchableOpacity>
      )}
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
        <View>
          <Ionicons name="notifications-outline" size={24} color={Colors.neutral.charcoal} />
          {unreadNotifCount > 0 && (
            <View style={NotificationBadge.badge}>
              <Text style={NotificationBadge.badgeText}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</Text>
            </View>
          )}
        </View>
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
        <TouchableOpacity
          onPress={handleJoinCampus}
          activeOpacity={0.7}
          style={styles.joinCampusButton}
          testID="button-join-campus"
        >
          <LinearGradient
            colors={['#35A8F7', '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.7, y: 3.6 }}
            style={styles.joinCampusBtnGradient}
          >
            <Text style={styles.joinCampusBtnText}>Join a campus</Text>
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
          <BubblesIcon 
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
    <AnimatedPressable
      key={bubble.id} 
      style={styles.card}
      scaleValue={0.95}
      onPress={() => handleBubblePress(bubble)}
    >
      <View style={styles.imageShadowWrapper}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: bubble.image }} style={styles.image} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{bubble.category}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{bubble.title}</Text>
      <View style={styles.cardMeta}>
        <PeopleIcon size={12} color="#4D4D4D" />
        <Text style={styles.metaText}>{bubble.members} members</Text>
      </View>
    </AnimatedPressable>
  );

  const renderEventCard = (event: EventData) => (
    <AnimatedPressable
      key={event.id} 
      style={styles.card}
      scaleValue={0.95}
      onPress={() => handleEventPress(event)}
    >
      <View style={styles.imageShadowWrapper}>
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: event.coverImage || 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400' }} 
            style={styles.image} 
          />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{event.bubble.category}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
      <View style={styles.cardMetaRow}>
        <View style={styles.cardMeta}>
          <ClockIcon size={12} color="#4D4D4D" />
          <Text style={styles.metaText}>{formatTime(event.startTime)}</Text>
        </View>
        {event.locationName && (
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={12} color="#4D4D4D" />
            <Text style={[styles.metaText, { maxWidth: 60 }]} numberOfLines={1}>{event.locationName.slice(0, 6)}</Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );


  if (isLoading) {
    return (
      <View style={[styles.outerContainer, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : insets.top }]}>
        <View style={[styles.overlayHeader, { height: HEADER_EXPANDED }]}>
          {renderSearchHeader()}
          {renderTabs()}
        </View>
        <View style={{ paddingTop: HEADER_EXPANDED }}>
          <ExploreGridSkeleton />
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
      <View style={styles.overlayHeader}>
        {renderSearchHeader()}
        {renderTabs()}
      </View>

      {isEmpty ? (
        <Animated.ScrollView
          contentContainerStyle={[styles.empty, { paddingTop: HEADER_EXPANDED + 4 }]}
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
          contentContainerStyle={[styles.grid, { paddingTop: HEADER_EXPANDED }]}
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
      
      <TouchableOpacity
        style={styles.createFab}
        onPress={() => setShowCreateSheet(true)}
        activeOpacity={0.8}
      >
        <CreateBubbleEventIcon size={56} />
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
    backgroundColor: Colors.background.secondary,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  overlayHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: Colors.background.secondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 4,
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
    ...CardShadow,
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lightSilver,
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
    height: 3,
    width: '100%',
    marginTop: 6,
    borderRadius: 1.5,
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
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '47.5%',
    marginBottom: 20,
  },
  imageShadowWrapper: {
    width: '100%',
    borderRadius: 16,
    marginBottom: 8,
    ...CardShadow,
  },
  imageContainer: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8E8E8',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(245, 246, 248, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#1E1F26',
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E1F26',
    letterSpacing: 0.24,
    marginBottom: 2,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#4D4D4D',
  },
  studentPromptCard: {
    width: '100%',
    backgroundColor: Colors.brand.skyWhite,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    ...CardShadow,
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
    width: '100%',
    marginBottom: 12,
  },
  joinCampusBtnGradient: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinCampusBtnText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semiBold as any,
    color: '#1E1F26',
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
    ...CardShadow,
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
  campusHatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  campusHatButtonActive: {
    backgroundColor: '#E8F4FD',
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
