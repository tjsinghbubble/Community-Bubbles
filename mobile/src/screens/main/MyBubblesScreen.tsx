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
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../../services/api.service';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = 12;
const CARD_PADDING = 20;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_PADDING * 2 - CARD_GAP) / 2;

type Bubble = {
  id: string;
  title: string;
  tagline: string;
  category: string;
  members: number;
  coverImage: string | null;
  distance: string | null;
  creatorId?: string;
  role?: string;
  status?: 'pending' | 'approved' | 'rejected';
};

export default function MyBubblesScreen() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [createdBubbles, setCreatedBubbles] = useState<Bubble[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();

  const fetchData = async () => {
    try {
      let bubblesData: Bubble[] = [];
      let createdBubblesData: Bubble[] = [];

      try {
        bubblesData = await apiService.getMyBubbles() as Bubble[];
      } catch (err) {
        console.error('[MyBubbles] getMyBubbles FAILED:', err);
      }

      try {
        createdBubblesData = await apiService.getMyCreatedBubbles() as Bubble[];
      } catch (err) {
        console.error('[MyBubbles] getMyCreatedBubbles FAILED:', err);
      }

      setBubbles(bubblesData);
      setCreatedBubbles(createdBubblesData);
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

  const handleCreateBubble = () => {
    navigation.navigate('CreateBubble' as never);
  };

  const pendingOrRejectedBubbles = createdBubbles.filter(
    b => b.status === 'pending' || b.status === 'rejected'
  );
  const joinedBubbleIds = new Set(bubbles.map(b => b.id));
  const displayBubbles = [
    ...pendingOrRejectedBubbles.filter(b => !joinedBubbleIds.has(b.id)),
    ...bubbles,
  ];

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
        <Text style={styles.headerTitle}>Your Bubbles</Text>
        <TouchableOpacity style={styles.bellButton}>
          <Ionicons name="notifications-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {displayBubbles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No bubbles yet</Text>
          <Text style={styles.emptySubtitle}>
            Join some bubbles from the Explore tab or create your own!
          </Text>
          <TouchableOpacity style={styles.createFirstButton} onPress={handleCreateBubble}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.createFirstButtonText}>Create a Bubble</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.gridList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.gridContainer}>
            {displayBubbles.map((bubble) => (
              <TouchableOpacity
                key={bubble.id}
                style={styles.gridCard}
                onPress={() => handleBubblePress(bubble)}
                activeOpacity={0.7}
              >
                <View style={styles.gridImageContainer}>
                  <Image
                    source={{
                      uri: bubble.coverImage || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400',
                    }}
                    style={styles.gridImage}
                  />
                  {bubble.status === 'pending' ? (
                    <View style={styles.gridPendingBadge}>
                      <Text style={styles.gridPendingText}>Pending</Text>
                    </View>
                  ) : bubble.status === 'rejected' ? (
                    <View style={styles.gridRejectedBadge}>
                      <Text style={styles.gridRejectedText}>Rejected</Text>
                    </View>
                  ) : (
                    <View style={styles.gridCategoryBadge}>
                      <Text style={styles.gridCategoryText}>{bubble.category}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.gridTitle} numberOfLines={1}>{bubble.title}</Text>
                <Text style={styles.gridRole}>
                  {bubble.role === 'admin' ? 'Admin' : 'Member'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateBubble}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  gridList: {
    padding: CARD_PADDING,
    paddingBottom: 100,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  gridCard: {
    width: CARD_WIDTH,
  },
  gridImageContainer: {
    width: '100%',
    height: CARD_WIDTH * 0.85,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridCategoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gridCategoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  gridPendingBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gridPendingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF3B30',
  },
  gridRejectedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gridRejectedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF3B30',
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginTop: 8,
  },
  gridRole: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
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
