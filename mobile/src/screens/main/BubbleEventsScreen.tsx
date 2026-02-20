import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExploreStackParamList } from '../../navigation/ExploreNavigator';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api.service';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Typography, Gradients } from '../../styles/theme';

type Props = {
  navigation: NativeStackNavigationProp<ExploreStackParamList, 'BubbleEvents'>;
  route: RouteProp<ExploreStackParamList, 'BubbleEvents'>;
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

type Bubble = {
  id: string;
  creatorId: string;
};

export default function BubbleEventsScreen({ navigation, route }: Props) {
  const { bubbleId, bubbleTitle } = route.params;
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
    fetchBubble();
  }, [bubbleId]);

  const fetchBubble = async () => {
    try {
      const data = await apiService.getBubble(bubbleId) as Bubble;
      setBubble(data);
    } catch (error) {
      console.error('Failed to fetch bubble:', error);
    }
  };

  const isSuperAdmin = user?.isSuperAdmin === true;
  const canCreateEvent = true; // Any logged-in user can propose events

  const handleCreateEvent = () => {
    navigation.navigate('CreateEvent' as any, { bubbleId, bubbleTitle });
  };

  const fetchEvents = async () => {
    try {
      const data = await apiService.getBubbleEvents(bubbleId) as Event[];
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleEventPress = (event: Event) => {
    navigation.navigate('EventDetails' as any, { eventId: event.id, event });
  };

  const renderEvent = ({ item: event }: { item: Event }) => (
    <TouchableOpacity
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
          <Ionicons name="time-outline" size={12} color={Colors.neutral.coolMist} />
          <Text style={styles.eventMetaText}>
            {formatTime(event.startTime)}
          </Text>
        </View>
        {event.locationName && (
          <View style={styles.eventMeta}>
            <Ionicons name="location-outline" size={12} color={Colors.neutral.coolMist} />
            <Text style={styles.eventMetaText} numberOfLines={1}>
              {event.locationName}
            </Text>
          </View>
        )}
        {event.attendeeLimit && (
          <View style={styles.eventMeta}>
            <Ionicons name="people-outline" size={12} color={Colors.neutral.coolMist} />
            <Text style={styles.eventMetaText}>
              Max {event.attendeeLimit}
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.neutral.coolMist} style={styles.eventChevron} />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Events</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.bubbleBlue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.neutral.charcoal} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Events</Text>
          <Text style={styles.headerSubtitle}>{bubbleTitle}</Text>
        </View>
      </View>

      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={48} color={Colors.neutral.coolMist} />
          <Text style={styles.emptyText}>No events yet</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {canCreateEvent && (
        <TouchableOpacity onPress={handleCreateEvent}>
          <LinearGradient
            colors={Gradients.button.colors as [string, string]}
            start={Gradients.button.start}
            end={Gradients.button.end}
            style={styles.fab}
          >
            <Ionicons name="add" size={24} color={'#FFFFFF'} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.skyWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.coolMist,
  },
  backButton: {
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutral.charcoal,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.neutral.coolMist,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.neutral.coolMist,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.cloudGrey,
    borderRadius: 12,
    overflow: 'hidden',
  },
  eventDateBox: {
    width: 50,
    padding: 8,
    alignItems: 'center',
    backgroundColor: Colors.brand.bubbleBlue,
  },
  eventDateDay: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.brand.skyWhite,
  },
  eventDateMonth: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  eventImage: {
    width: 60,
    height: 60,
  },
  eventInfo: {
    flex: 1,
    padding: 10,
    gap: 2,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.charcoal,
    marginBottom: 2,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventMetaText: {
    fontSize: 11,
    color: Colors.neutral.coolMist,
  },
  eventChevron: {
    marginRight: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.neutral.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
